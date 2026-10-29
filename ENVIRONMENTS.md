# HealthyLife: Pipeline Test, SIT and Production

## Confirmed topology and approved scope

The user confirmed that the Windows browser and Docker Desktop are on the same
machine and authorized file changes for Pipeline Test and SIT only. Production
has no supplied target. **No deployment, agent installation or target-system
change is authorized by this document or the file-change approval.**

Read-only inspection found context `desktop-linux` at the local pipe
`npipe:////./pipe/dockerDesktopLinuxEngine`. The running controller
`jenkins-backup` is a Linux container with only 8080 and 50000 published. It
has Java but no Docker CLI/socket. Earlier build logs ran on node `Jenkins`
in `/var/jenkins_home/workspace/Jenkins`, consistent with the built-in executor.
No dedicated deployment agent was confirmed. Windows 18082 had no TCP listener;
check again before deploy. No existing Dockerfile/Compose/HealthyLife service
or application port override was found. The new Dockerfile explicitly sets
`0.0.0.0:8080`, an approved new configuration, not a discovered running port.

## Workflow and isolation

```text
Linux CI: Checkout -> Build -> Test -> Package once -> Trivy/checksum
  -> Deploy to Test :18081 -> Smoke Test -> Prepare SIT Artifact
  -> JUnit/archive -> owned TEST process cleanup

TEST -> end
SIT  -> Windows SIT agent -> Deploy to SIT -> SIT Smoke Test -> leave running
PRD  -> Production Configuration failure (no target, no approval or deploy)
```

| Concern | Pipeline Test | SIT | Production |
| --- | --- | --- | --- |
| Lifetime | Temporary owned Java process | Persistent Linux container on Docker Desktop | Separate future service, disabled |
| Executor | healthylife-linux | healthylife-windows-sit, confirmed Windows host | Must be separately specified/protected |
| Bind/port | Agent 127.0.0.1:18081 | Container 0.0.0.0:8080; Windows publish 127.0.0.1:18082 only | Real host/domain/port required; no localhost fallback |
| Resource identity | BUILD_TAG process marker | Compose project healthylife-sit, service sit-app | Never reuse SIT identity |
| Profile/config | Existing local test settings | External SPRING_PROFILES_ACTIVE=sit | Own settings, not supplied |
| Release state | target/deployment PID/log/port | Agent account %LOCALAPPDATA%\HealthyLife\SIT\release.json | Separate storage and ACLs required |
| Server data / DB | None | None; read-only root, temporary /tmp | Not supplied; never share SIT storage/schema |
| Secrets | None for local test | OS Docker named-pipe authorization, no deployment secret | Own production identity/secret store required |
| Cleanup | CI-group post, including failure | Explicit SIT Stop only | Never targeted by TEST/SIT lifecycle |

No backend database/driver or persistent application server data is present;
the user confirmed none exists outside the repository. Do not invent a DB.
`sit` is a runtime profile marker: no new application property file is needed
for this stateless application. Future integrations need SIT-specific endpoint,
data/volume, DB/schema/account and secrets first; Production must use its own.

Browser localStorage is isolated by **origin**, not container/profile. Keep
Production on its own actual origin. Old browser data can remain at
http://localhost:18082 after redeployment; review/reset test values when reusing
that origin. There are no server-data migrations to roll back currently.

The Pipeline fixes TEST_PORT=18081, retains Build/Test/Package/Trivy and the test
failure demonstration, checks the JAR checksum before/after scan and compares
the scan input byte-for-byte. The same JAR/checksum and only Dockerfile/SIT
Compose/script are stashed to a build-specific Windows directory. Windows
verifies SHA-256 and copies only the JAR and Dockerfile to a small image context;
there is no Maven rebuild per environment.

CI-group post stays on the same Linux executor to publish JUnit/archive and
clean its owned process before any deployment. Failed cleanup/unstable CI blocks
SIT. The original process marker and 10-minute maximum lifetime remain bounded
orphan protection, not an unconditional guarantee after Jenkins/agent/OS loss.
No top-level post action stops persistent services. Nested SIT stages share one
Windows executor; agent none avoids accidental execution on the wrong host.
Stage restart/concurrent builds are disabled. Original timeout/retention values
remain: 60-minute overall, 30-minute scan, 15-minute future approval.

Production Configuration fails before input because no target is supplied.
The retained future input template uses submitter release-manager; deployment
still has a second explicit failure barrier. Future implementation must retain
approval and same-run prerequisite checks, never use a checkbox as approval.
Promotion across runs additionally needs an approved immutable artifact store
and digest workflow, not rebuilding. Checksums do not protect against a
malicious Pipeline/SCM editor.

## Jenkins UI / agent setup (not performed automatically)

1. Label the intended Java 21 Linux CI executor `healthylife-linux`. Existing
   shell/Trivy tools plus sha256sum/cmp must be available. A dedicated CI node
   is preferred; do not casually grant Docker access to the controller.
2. Create a permanent Windows node labeled `healthylife-windows-sit` on the
   confirmed Windows machine, one executor and usage restricted to matching
   labels. Use an approved work directory/account with a persistent profile.
3. Configure its launch using Jenkins UI instructions (Java 21; inbound
   WebSocket if appropriate). Keep the agent connection secret private. This
   change does not install/start an agent, open firewall ports or change
   Windows execution policy. Follow organizational script-signing/policy rules.
4. Verify Docker Desktop Linux engine, Docker CLI, Compose v2+ with --pull never
   and Windows PowerShell 5.1 under the **actual agent account**, not only an
   interactive administrator account. The script refuses remote Docker
   endpoints and requires the inspected local named pipe.
5. Pipeline script from SCM uses Jenkinsfile. Refresh parameters; TEST_PORT is
   now fixed. Do not start a SIT run until deployment is separately authorized:
   SIT deliberately has no release approval once the job is started.
6. Restrict Job/Build for SIT-capable jobs, Job/Configure, Run/Replay, SCM branch
   changes and node use to trusted users. Labels route work, not authorization.
   If ordinary CI editors are untrusted for deployment, split a protected SIT
   job/folder before exposing its node. Docker authority is host-privileged.
   Do not mount Docker socket into the Jenkins container.
7. Jenkins needs Declarative sequential stages, Input Step, basic/durable steps
   (sh, Windows powershell, stash/unstash), Git, JUnit and Timestamper.
   Credentials/Binding are needed when secret integrations exist. Verify
   installed/active plugin health and authenticated Declarative validation.

Only one protected job/operator may manage SIT at a time:
disableConcurrentBuilds does not serialize different jobs or manual commands.
Do not invoke manual lifecycle actions during deployment or manage the same
Compose project through several accounts. Production must not use this SIT
project/state/config or its future credentials.

## Credentials and Production prerequisites

Local SIT uses OS authorization to Docker's named pipe; no dummy credential ID
or token is needed. Public base image download uses no login. Optional private
SCM checkout should use a read-only SCM identity, not a deployment identity.
Future SIT registry/integration credentials must be scoped separately from
Production and bound only around necessary commands.

Production requires a supplied hostname/domain/IP, platform/transport, reachable
agent, service identity/name, ports, verified TLS/SSH trust, health URL, runtime
config, storage/DB boundaries and rollback policy before implementation. Until
then PRD fails without target contact, approval or credential use.

Configure a real security realm, exact release-manager user/group and Matrix/
Role-based authorization; input alone is not authorization. Admins can approve
despite submitter. Limit configuration/replay/SCM and credential administration/
use, remove anonymous privileges and audit release actions. Use protected
Production jobs/folders/agents if CI editors are not production-trusted.

Use Jenkins Credentials/withCredentials by actual type when needed:
sshUserPrivateKey, usernamePassword, string token or file. Never request secret
values in chat, interpolate them in Groovy, place them in command arguments,
Docker build args/layers, committed Compose/config or logs. Disable tracing,
avoid environment dumps, keep secret files outside browsable/archived
workspaces and review logs. Masking/credential domains are not ACLs.

## URLs and localhost boundaries

| Caller | URL | Meaning |
| --- | --- | --- |
| Linux CI executor | http://127.0.0.1:18081/api/health | Owned temporary process, not Windows |
| Windows SIT executor | http://127.0.0.1:18082/api/health | Docker-published SIT health |
| Inside SIT container | http://127.0.0.1:8080/api/health | Confirms configured internal port serves UP |
| Browser on confirmed Windows host | http://localhost:18082/ | SIT frontend; use 127.0.0.1 if IPv6 localhost fails |
| Production | Not supplied | Must use reachable real hostname/domain/IP |

No port 18081 mapping is added. Jenkins UI remains on Windows 8080; SIT's
container-local 8080 is another namespace, Windows uses 18082 for SIT.
localhost:18082 on another team member's machine points to **their own** machine.
Loopback-only SIT is not a shared LAN service: use separately approved per-user
forwarding or revise TLS/access control/network plans; never silently publish
0.0.0.0. The unused PRD shell remote smoke helper remains HTTPS/non-loopback;
SIT uses its separate Windows route, not a global relaxation of that rule.

## Lifecycle (instructions, not executed automatically)

After separate authorization to deploy, configure both nodes and run TARGET_ENV
SIT with SIMULATE_TEST_FAILURE=false. It performs CI/Pipeline Test/cleanup and
then deploys SIT without a production approval. Open the browser only after SIT
Smoke Test passes. TEST never starts/updates persistent SIT.

Use the same Windows account/state directory and the retained release directory
sit-release-<BUILD_NUMBER> on the Windows agent for manual administration:

```powershell
# Inspection
.\scripts\sit-service.ps1 -Action Status
.\scripts\sit-service.ps1 -Action Logs
.\scripts\sit-service.ps1 -Action Smoke

# State-changing: only after separate authorization
.\scripts\sit-service.ps1 -Action Stop
.\scripts\sit-service.ps1 -Action Start
.\scripts\sit-service.ps1 -Action Rollback
```

Deploy is also an action, but use the protected Pipeline to enforce CI;
scripts alone cannot prove Jenkins gates/permissions. Restrict local script/
Docker access. No actual Production lifecycle command is supplied because its
platform/target is unknown; generating one would guess the system.

SIT uses non-root UID/GID 10001, read-only root, ephemeral writable /tmp, dropped
capabilities and no-new-privileges. No host data/socket mount exists. Restart
unless-stopped keeps SIT beyond the job and restarts it when the Docker engine
starts unless explicitly stopped. Docker Desktop must remain running; this is
not an installed Windows service.

The script refuses occupied 18082 on first deploy and checks project/service
labels. It never kills unrelated processes. SIT-only state records current/
previous immutable image IDs before activation, permitting explicit rollback
after a failed activation. A receipt records an attempted image, not proof of
health. First release has no previous image. Failed deploy/smoke/rollback stays
a failure and leaves SIT for inspection. Do not delete state or prune retained
images. Rollback uses the same Compose config; changing ports/mounts/data needs
a separate migration plan. Unknown container images are rejected.

The upstream base image eclipse-temurin:21-jre is mutable; each built image gets
a fixed local ID. Before real Production, pin an approved base digest and scan
the final image OS separately. Current Trivy scans JAR dependencies, not OS.
Runtime bash/timeout used for internal health, bind settings, permissions and
restart behavior still need authorized live verification.

## Acceptance tests and validation limits

Before any target change, parse PowerShell/Groovy, validate Compose config/model
and mock gates/cleanup/routing, health/identity checks and rollback. Mocks are
not Declarative/CPS, ACL, network or container runtime proof.
Authenticated Declarative validation (token at prompt, never committed):

```powershell
curl.exe --fail-with-body --user YOUR_JENKINS_USER -X POST -F "jenkinsfile=<Jenkinsfile" http://localhost:8080/pipeline-model-converter/validate
```

After separately authorizing relevant execution:

1. TEST: CI gates, local 18081 UP, JUnit/archive and closed port after cleanup;
   no Windows node allocation or persistent service modification.
2. Build/Test/Package/Trivy failures and scanner/report errors: no SIT deploy.
   TEST startup partial failure/smoke failure: owned cleanup runs. Failed
   cleanup or unstable result blocks SIT.
3. PRD: TEST cleans up, Production Configuration fails, no input, Windows SIT
   allocation, Production contact or secret binding. Later PRD stages skip.
4. Invalid/missing TARGET_ENV fails before Build. Checksum tampering blocks
   Docker build. One Maven package per run and the same JAR on Windows.
5. SIT: confirm correct node/context, exact loopback mapping, profile sit,
   expected image, Windows/container health, browser access and persistence
   after job. A subsequent TEST job cannot stop SIT.
6. Occupied port, unexpected project/image, Stop/Start, retained-image Rollback,
   first-release no rollback and failed activation/smoke all report explicit
   outcomes without touching another service.
7. Missing/offline Windows label queues/times out, never falls back to another
   host. Stash/unstash failure blocks deploy; stage restart is unavailable.
8. Once Production target exists: verify separate identity/data/config/secrets
   and health route, approval before any deploy, deny unauthorized non-admin
   UI/API approval, propagate abort/timeout and audit admin bypass.

No real deployment, image build or agent installation is part of this file-change
task. Static/mock results are recorded below after validation; live behavior
remains a separately authorized acceptance step.

### File-change verification on 2026-10-29

- PowerShell 5.1 syntax passed. Compose config interpolation/model validation
  passed: one SIT-only service/project, profile sit, read-only root,
  unless-stopped restart and exactly 127.0.0.1:18082 to container 8080.
  Compose config does not create containers/networks or open ports.
- Groovy 2.4.21 syntax parsing and **32 mocked Pipeline flows** passed: TEST/
  SIT/PRD routing, successful TEST cleanup before SIT, failures at each CI
  gate, partial TEST startup failure, smoke failure, cleanup failure, unstable
  results, stash/unstash failure, missing/invalid environment and deliberate
  test command preservation. PRD always stopped before approval and deploy.
  The local legacy JVM emitted a Groovy NIO extension warning; parsing and
  mocks completed, not a Jenkins/Java 21 execution certification.
- **21 isolated PowerShell lifecycle operations** passed with all Docker,
  HTTP, network-listener and clock calls mocked: context/occupied-port/
  checksum refusal, SIT identity/profile/port checks, wrong-project Stop
  refusal, stopped container, first-release no rollback, deployment/smoke,
  logs/status, health failure without stopping SIT, failed activation,
  rollback, Stop and Start. Dummy artifacts/state were confined to the session
  fixture, not the Windows target service directory. Only a child test process
  used a temporary execution policy; no persistent policy was changed.
- The two modified shell scripts passed sh -n using read-only execution.
  git diff --check passed; application/POM, TEST lifecycle and Trivy scripts
  remained unchanged. No Maven build/tests or vulnerability database scan was
  rerun for this orchestration-only change.
- Unauthenticated Declarative HTTP validation returned **403**. Authenticated
  validation, plugin health, real Jenkins CPS/ACLs, node setup, Docker build,
  published/internal runtime port, browser access and real rollback are
  **not verified**. No real SIT/Production deploy or agent installation was
  performed. Final inspection still showed only jenkins-backup running and no
  Windows TCP listener on 18082.
