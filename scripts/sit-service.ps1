[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('Deploy', 'Smoke', 'Start', 'Stop', 'Status', 'Logs', 'Rollback')]
    [string]$Action,
    [string]$StateDirectory = (Join-Path $env:LOCALAPPDATA 'HealthyLife\SIT')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$compose = Join-Path $root 'compose.sit.yaml'
$stateFile = Join-Path $StateDirectory 'release.json'
$context = 'desktop-linux'

function Invoke-Docker {
    param([string[]]$Arguments)
    $output = & docker --context $context @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Docker command failed (exit $LASTEXITCODE). Inspect SIT; no successful deployment or automatic rollback is assumed."
    }
    return $output
}

function Invoke-Compose {
    param([string[]]$Arguments)
    Invoke-Docker -Arguments (@('compose', '--project-name', 'healthylife-sit', '--file', $compose) + $Arguments)
}

function Get-SitContainer {
    $ids = @(Invoke-Compose -Arguments @('ps', '--all', '--quiet', 'sit-app'))
    if ($ids.Count -gt 1) { throw 'Expected at most one SIT container.' }
    if ($ids.Count -eq 0) { return $null }
    $containers = @(Invoke-Docker -Arguments @('inspect', $ids[0]) | ConvertFrom-Json)
    $container = $containers[0]
    if ($container.Config.Labels.'com.docker.compose.project' -ne 'healthylife-sit' -or
        $container.Config.Labels.'com.docker.compose.service' -ne 'sit-app') {
        throw 'Container does not belong to the SIT project/service.'
    }
    return $container
}

function Read-Release {
    if (!(Test-Path -LiteralPath $stateFile -PathType Leaf)) {
        throw 'No saved SIT release. Use the approved deployment and the same Windows account/state directory.'
    }
    $release = Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
    if ($release.CurrentImage -notmatch '^sha256:[0-9a-f]{64}$' -or
        ($release.PreviousImage -and $release.PreviousImage -notmatch '^sha256:[0-9a-f]{64}$')) {
        throw 'Invalid SIT release image identity.'
    }
    return $release
}

function Save-Release {
    param([string]$CurrentImage, [AllowNull()][string]$PreviousImage)
    New-Item -ItemType Directory -Path $StateDirectory -Force | Out-Null
    $temporary = Join-Path $StateDirectory 'release.pending.json'
    @{ CurrentImage = $CurrentImage; PreviousImage = $PreviousImage } |
        ConvertTo-Json | Set-Content -LiteralPath $temporary -Encoding UTF8
    Move-Item -LiteralPath $temporary -Destination $stateFile -Force
}

function Assert-SitHealth {
    param([string]$ExpectedImage)
    $container = Get-SitContainer
    if (!$container -or !$container.State.Running -or $container.Image -ne $ExpectedImage) {
        throw 'SIT is not running the expected immutable image.'
    }
    $ports = @($container.NetworkSettings.Ports.'8080/tcp')
    if ($ports.Count -ne 1 -or $ports[0].HostIp -ne '127.0.0.1' -or $ports[0].HostPort -ne '18082') {
        throw 'SIT must publish only Windows loopback 127.0.0.1:18082 to container port 8080.'
    }
    $expectedCommand = @('java', '-jar', '/app/application.jar', '--server.address=0.0.0.0', '--server.port=8080')
    if (($container.Config.Entrypoint -join '|') -ne ($expectedCommand -join '|') -or
        !($container.Config.Env -contains 'SPRING_PROFILES_ACTIVE=sit')) {
        throw 'Unexpected SIT application port/interface/profile configuration.'
    }
    $deadline = (Get-Date).AddSeconds(60)
    do {
        try {
            $response = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:18082/api/health' `
                -TimeoutSec 5 -MaximumRedirection 0 -Proxy $null
            if ($response.StatusCode -eq 200 -and ($response.Content | ConvertFrom-Json).status -eq 'UP') {
                $inside = @(Invoke-Docker -Arguments @('exec', $container.Id, 'bash', '-c',
                    'exec 3<>/dev/tcp/127.0.0.1/8080; printf "GET /api/health HTTP/1.0\r\nHost: localhost\r\n\r\n" >&3; timeout 5 cat <&3'))
                if (($inside -join "`n") -notmatch 'HTTP/1\.[01] 200' -or
                    ($inside -join "`n") -notmatch '"status"\s*:\s*"UP"') {
                    throw 'Container-local SIT health did not confirm port 8080 and status UP.'
                }
                Write-Output 'SIT health passed from Windows agent and inside the SIT container.'
                return
            }
            Write-Warning 'SIT health response is not UP; retrying.'
        } catch [System.Net.WebException] {
            Write-Warning "SIT health connection failed: $($_.Exception.Status); retrying."
        }
        Start-Sleep -Seconds 2
    } while ((Get-Date) -lt $deadline)
    throw 'SIT health failed within 60 seconds. Inspect logs or explicitly roll back; SIT is not stopped by cleanup.'
}

if ($env:OS -ne 'Windows_NT') { throw 'Run on the approved Windows SIT Docker Desktop host.' }
if (!(Test-Path -LiteralPath $compose -PathType Leaf)) { throw 'compose.sit.yaml is missing.' }
Get-Command docker -ErrorAction Stop | Out-Null
$endpoint = (Invoke-Docker -Arguments @('context', 'inspect', $context, '--format', '{{.Endpoints.docker.Host}}') | Out-String).Trim()
if ($endpoint -ne 'npipe:////./pipe/dockerDesktopLinuxEngine') {
    throw 'SIT context must be this Windows host Docker Desktop named pipe, not a remote endpoint.'
}
$osType = (Invoke-Docker -Arguments @('info', '--format', '{{.OSType}}') | Out-String).Trim()
if ($osType -ne 'linux') { throw 'SIT requires Linux containers.' }

if ($Action -eq 'Deploy') {
    $artifact = Join-Path $root 'target\jenkins-java-maven-demo-1.0.0.jar'
    $checksum = (Get-Content -LiteralPath (Join-Path $root 'target\artifact.sha256') -Raw).Trim()
    if ($checksum -notmatch '^([0-9a-f]{64})[ \t]+target/jenkins-java-maven-demo-1\.0\.0\.jar$') {
        throw 'Unexpected artifact checksum manifest.'
    }
    $expectedHash = $Matches[1]
    if ((Get-FileHash -LiteralPath $artifact -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expectedHash) {
        throw 'Artifact differs from the packaged/scanned JAR. SIT deployment refused.'
    }
    $env:HEALTHYLIFE_SIT_IMAGE = 'healthylife-sit:inspection'
    $existing = Get-SitContainer
    $listeners = @(Get-NetTCPConnection -State Listen | Where-Object { $_.LocalPort -eq 18082 })
    if (!$existing -and $listeners.Count -gt 0) {
        throw 'Windows port 18082 is occupied. No unrelated process will be stopped.'
    }
    $previous = $null
    if ($existing) {
        $saved = Read-Release
        if ($existing.Image -ne $saved.CurrentImage) {
            throw 'SIT differs from saved release. Investigate before replacing it.'
        }
        $previous = $existing.Image
    }
    $buildContext = Join-Path $root 'target\sit-image'
    New-Item -ItemType Directory -Path $buildContext -Force | Out-Null
    Copy-Item -LiteralPath $artifact -Destination (Join-Path $buildContext 'application.jar') -Force
    Copy-Item -LiteralPath (Join-Path $root 'Dockerfile') -Destination (Join-Path $buildContext 'Dockerfile') -Force
    if ((Get-FileHash -LiteralPath (Join-Path $buildContext 'application.jar') -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expectedHash) {
        throw 'SIT image build input differs from scanned JAR.'
    }
    $imageFile = Join-Path $root 'target\sit-image.id'
    Invoke-Docker -Arguments @('build', '--iidfile', $imageFile, $buildContext) | Out-Host
    $image = (Get-Content -LiteralPath $imageFile -Raw).Trim()
    if ($image -notmatch '^sha256:[0-9a-f]{64}$') { throw 'Docker did not return an immutable image ID.' }
    if ($image -eq $previous) { $previous = $saved.PreviousImage }
    Save-Release -CurrentImage $image -PreviousImage $previous
    $env:HEALTHYLIFE_SIT_IMAGE = $image
    Invoke-Compose -Arguments @('up', '--detach', '--no-build', '--pull', 'never', 'sit-app') | Out-Host
    Write-Output 'SIT activation requested. Smoke Test must pass before deployment is considered successful.'
} else {
    $saved = Read-Release
    $env:HEALTHYLIFE_SIT_IMAGE = $saved.CurrentImage
    $existing = Get-SitContainer
    if ($existing -and $existing.Image -notin @($saved.CurrentImage, $saved.PreviousImage)) {
        throw 'SIT image differs from both saved releases; refusing to manage an unexpected instance.'
    }
    switch ($Action) {
        'Smoke' { Assert-SitHealth -ExpectedImage $saved.CurrentImage }
        'Start' {
            Invoke-Compose -Arguments @('up', '--detach', '--no-build', '--pull', 'never', 'sit-app') | Out-Host
            Assert-SitHealth -ExpectedImage $saved.CurrentImage
        }
        'Stop' { Invoke-Compose -Arguments @('stop', 'sit-app') }
        'Status' { Invoke-Compose -Arguments @('ps', '--all') }
        'Logs' { Invoke-Compose -Arguments @('logs', '--no-color', '--tail', '100', 'sit-app') }
        'Rollback' {
            if (!$saved.PreviousImage) { throw 'No previous SIT image exists; the first release cannot be rolled back.' }
            $env:HEALTHYLIFE_SIT_IMAGE = $saved.PreviousImage
            Save-Release -CurrentImage $saved.PreviousImage -PreviousImage $saved.CurrentImage
            Invoke-Compose -Arguments @('up', '--detach', '--no-build', '--pull', 'never', 'sit-app') | Out-Host
            Assert-SitHealth -ExpectedImage $saved.PreviousImage
        }
    }
}
