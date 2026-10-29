const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..', '..');
const shell = process.env.TEST_SHELL || (process.platform === 'win32'
    ? 'C:\\Program Files\\Git\\bin\\bash.exe' : '/bin/sh');
const posix = value => value.replaceAll('\\', '/');
const shellPath = value => posix(value).replace(/^([A-Za-z]):\//, (_, drive) => `/${drive.toLowerCase()}/`);
const dockerMock = `#!/bin/sh
set -eu
printf '%s | %s\\n' "\${SIT_IMAGE:-unset}" "$*" >> "$MOCK_LOG"
case "$*" in
    'compose version') echo 'Docker Compose version v2.40.0' ;;
    'info --format {{.ID}}')
        [ "\${MOCK_DAEMON_DOWN:-0}" != 1 ] || exit 1
        echo "\${MOCK_ENGINE_ID:-desktop-test}" ;;
    'info --format {{.OperatingSystem}}') echo "\${MOCK_ENGINE_OS:-Docker Desktop}" ;;
    'image inspect --format {{.Id}} healthylife-sit:previous')
        [ "\${MOCK_NO_PREVIOUS:-0}" != 1 ] || exit 1
        echo sha256:previous ;;
    'image inspect --format {{.Id}} healthylife-sit:current') echo sha256:old ;;
    'image inspect --format {{.Id}} '*) echo sha256:candidate ;;
    'inspect --format {{.Image}} abc123') echo sha256:old ;;
    'start abc123') ;;
    'inspect --format {{.State.Status}} {{.State.Health.Status}} abc123')
        if [ "\${MOCK_HEALTH_STARTING:-0}" = 1 ] && [ ! -f "$MOCK_LOG.checked" ]; then
            touch "$MOCK_LOG.checked"
            echo 'running starting'
        elif [ "\${MOCK_RESTORE_FAIL:-0}" = 1 ] && [ "$SIT_IMAGE" = sha256:old ]; then
            echo 'exited unhealthy'
        elif [ "\${MOCK_READINESS_FAIL:-0}" = 1 ] && [ "$SIT_IMAGE" != sha256:old ]; then
            echo 'running unhealthy'
        else
            echo 'running healthy'
        fi ;;
    'image tag '*) ;;
    'compose --project-name healthylife-sit --file compose.sit.yaml '*)
        case "$*" in
            *'config --quiet')
                [ "\${MOCK_CONFIG_FAIL:-0}" != 1 ] || exit 1 ;;
            *'build --pull sit-app')
                [ "\${MOCK_BUILD_FAIL:-0}" != 1 ] || exit 1 ;;
            *'ps --all --quiet sit-app')
                if [ "\${MOCK_NO_CONTAINER:-0}" != 1 ] || [ -f "$MOCK_LOG.created" ]; then
                    echo "\${MOCK_CONTAINER_ID:-abc123}"
                fi ;;
            *'create --no-build sit-app')
                touch "$MOCK_LOG.created" ;;
            *'exec -T sit-app java /opt/healthylife/SmokeCheck.java http://127.0.0.1:8080/api/health')
                if [ "\${MOCK_SMOKE_FAIL:-0}" = 1 ] && [ "$SIT_IMAGE" != sha256:old ]; then exit 1; fi ;;
            *'stop sit-app'|*'ps --all sit-app'|*'logs --tail 100 sit-app') ;;
            *) echo "Unexpected compose command: $*" >&2; exit 99 ;;
        esac ;;
    *) echo "Unexpected Docker command: $*" >&2; exit 99 ;;
esac
`;

function fixture(t, environment = 'SIT') {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'healthylife-mocks-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    fs.mkdirSync(path.join(dir, 'bin'));
    fs.mkdirSync(path.join(dir, 'target', 'deployment'), { recursive: true });
    fs.cpSync(path.join(root, 'scripts'), path.join(dir, 'scripts'), { recursive: true });
    fs.copyFileSync(path.join(root, 'compose.sit.yaml'), path.join(dir, 'compose.sit.yaml'));
    fs.copyFileSync(path.join(root, 'compose.prd.yaml'), path.join(dir, 'compose.prd.yaml'));
    const jar = Buffer.from('mock JAR only; never run an application');
    fs.writeFileSync(path.join(dir, 'target', 'jenkins-java-maven-demo-1.0.0.jar'), jar);
    fs.writeFileSync(path.join(dir, 'target', 'artifact.sha256'),
        `${createHash('sha256').update(jar).digest('hex')}  target/jenkins-java-maven-demo-1.0.0.jar\n`);
    const mock = environment === 'PRD'
        ? dockerMock.replaceAll('SIT_IMAGE', 'PRD_IMAGE').replaceAll('healthylife-sit', 'healthylife-prd')
            .replaceAll('compose.sit.yaml', 'compose.prd.yaml').replaceAll('sit-app', 'prd-app')
            .replaceAll('sit-container', 'prd-container')
        : dockerMock;
    fs.writeFileSync(path.join(dir, 'bin', 'docker'), mock, { mode: 0o755 });
    fs.writeFileSync(path.join(dir, 'bin', 'timeout'), `#!/bin/sh
set -eu
printf 'timeout | %s %s %s\\n' "$1" "$2" "$3" >> "$MOCK_LOG"
[ "$1" = --signal=TERM ] && [ "$2" = --kill-after=5s ] && [ "$3" = 240s ] || exit 99
if [ "\${MOCK_ACTIVATION_SIGNAL:-0}" = 1 ]; then kill -TERM "$PPID"; exit 143; fi
if [ "\${MOCK_ACTIVATION_TIMEOUT:-0}" != 0 ]; then exit "$MOCK_ACTIVATION_TIMEOUT"; fi
shift 3
exec "$@"
`, { mode: 0o755 });
    fs.writeFileSync(path.join(dir, 'bin', 'git'), '#!/bin/sh\necho abc123\n', { mode: 0o755 });
    fs.writeFileSync(path.join(dir, 'bin', 'uname'), '#!/bin/sh\necho Linux\n', { mode: 0o755 });
    fs.writeFileSync(path.join(dir, 'bin', 'java'), '#!/bin/sh\necho "Unexpected host Java invocation" >&2\nexit 99\n', { mode: 0o755 });
    const log = path.join(dir, 'docker.log');
    return {
        dir,
        run(script, action, extra = {}) {
            const result = spawnSync(shell, ['-c', 'export PATH="$MOCK_BIN:$PATH"; exec sh "$@"', 'mock', script, action], {
                cwd: dir,
                encoding: 'utf8',
                env: {
                    ...process.env,
                    PATH: `${path.join(dir, 'bin')}${path.delimiter}${process.env.PATH}`,
                    MOCK_BIN: shellPath(path.join(dir, 'bin')),
                    MOCK_LOG: posix(log),
                    SIT_DOCKER_ENGINE_ID: 'desktop-test',
                    PRD_DOCKER_ENGINE_ID: 'desktop-test',
                    SIT_IMAGE: '',
                    PRD_IMAGE: '',
                    BUILD_TAG: 'mock-build',
                    TEST_PORT: '18081',
                    ...extra,
                },
            });
            assert.ifError(result.error);
            return { ...result, log: fs.existsSync(log) ? fs.readFileSync(log, 'utf8') : '' };
        },
    };
}

test('all shell scripts parse without executing deployment commands', () => {
    for (const name of fs.readdirSync(path.join(root, 'scripts')).filter(name => name.endsWith('.sh'))) {
        const result = spawnSync(shell, ['-n', posix(path.join(root, 'scripts', name))], { encoding: 'utf8' });
        assert.ifError(result.error);
        assert.equal(result.status, 0, `${name}: ${result.stderr}`);
    }
});

test('deploy always builds current artifact, waits, smokes, then promotes immutable image', t => {
    const result = fixture(t).run('scripts/deploy-sit.sh', '');
    assert.equal(result.status, 0, result.stderr);
    const lines = result.log.split('\n');
    const index = text => lines.findIndex(line => line.includes(text));
    assert(index('build --pull sit-app') < index('image tag sha256:old healthylife-sit:previous'));
    assert(index('image tag sha256:old healthylife-sit:previous') < index('create --no-build'));
    assert(index('create --no-build') < index('start abc123'));
    assert(index('start abc123') < index('inspect --format {{.State.Status}}'));
    assert(index('inspect --format {{.State.Status}}') < index('exec -T sit-app java'));
    assert(index('exec -T sit-app java') < index('image tag sha256:candidate healthylife-sit:current'));
    assert.match(result.log, /sha256:candidate \| .*create --no-build/);
    assert.doesNotMatch(result.log, /\bdown\b|--volumes|18081|up --detach/);
});

for (const failure of ['MOCK_READINESS_FAIL', 'MOCK_SMOKE_FAIL']) {
    test(`${failure} restores preceding image and still fails the request`, t => {
        const result = fixture(t).run('scripts/sit-environment.sh', 'deploy', { [failure]: '1' });
        assert.notEqual(result.status, 0);
        assert.match(result.log, /sha256:old \| .*create --no-build/);
        assert.match(result.stderr, /SIT restored; the requested update still failed/);
        assert.doesNotMatch(result.log, /image tag sha256:candidate healthylife-sit:current|\bdown\b/);
    });
}

test('failed automatic restoration is explicit, never success-shaped', t => {
    const result = fixture(t).run('scripts/sit-environment.sh', 'deploy',
        { MOCK_READINESS_FAIL: '1', MOCK_RESTORE_FAIL: '1' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /restoration failed; operator intervention/);
});

for (const failure of ['MOCK_BUILD_FAIL', 'MOCK_CONFIG_FAIL']) {
    test(`${failure} leaves the active service untouched`, t => {
        const result = fixture(t).run('scripts/sit-environment.sh', 'deploy', { [failure]: '1' });
        assert.notEqual(result.status, 0);
        assert.doesNotMatch(result.log, /create --no-build|start abc123|image tag/);
    });
}

test('checksum mismatch refuses image build and service changes', t => {
    const f = fixture(t);
    fs.appendFileSync(path.join(f.dir, 'target', 'jenkins-java-maven-demo-1.0.0.jar'), 'changed');
    const result = f.run('scripts/sit-environment.sh', 'deploy');
    assert.notEqual(result.status, 0);
    assert.doesNotMatch(result.log, /build --pull|create --no-build|image tag/);
});

test('wrong daemon fails before Compose or image mutations', t => {
    const result = fixture(t).run('scripts/sit-environment.sh', 'deploy', { MOCK_ENGINE_ID: 'other' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Wrong Docker daemon/);
    assert.doesNotMatch(result.log, /--project-name|image tag/);
});

test('missing trusted daemon ID fails closed', t => {
    const result = fixture(t).run('scripts/sit-environment.sh', 'deploy', { SIT_DOCKER_ENGINE_ID: '' });
    assert.notEqual(result.status, 0);
    assert.doesNotMatch(result.log, /--project-name|image tag/);
});

test('unreachable daemon explains the required agent access without deployment', t => {
    const result = fixture(t).run('scripts/sit-environment.sh', 'deploy', { MOCK_DAEMON_DOWN: '1' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Cannot access the Docker daemon.*agent permissions/);
    assert.doesNotMatch(result.log, /--project-name|image tag/);
});

test('non-Desktop daemon is not an implicit Windows deployment target', t => {
    const result = fixture(t).run('scripts/sit-environment.sh', 'deploy', { MOCK_ENGINE_OS: 'Other Linux' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Windows Docker Desktop target/);
    assert.doesNotMatch(result.log, /--project-name|image tag/);
});

test('rollback uses retained image without rebuilding, waits and checks from container', t => {
    const result = fixture(t).run('scripts/sit-environment.sh', 'rollback');
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.log, /sha256:previous \| .*create --no-build/);
    assert.match(result.log, /image tag sha256:previous healthylife-sit:current/);
    assert.match(result.log, /image tag sha256:old healthylife-sit:previous/);
    assert.doesNotMatch(result.log, /build --pull|\bdown\b|--volumes/);
});

test('missing rollback image does not change containers', t => {
    const result = fixture(t).run('scripts/sit-environment.sh', 'rollback', { MOCK_NO_PREVIOUS: '1' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /No previous SIT image/);
    assert.doesNotMatch(result.log, /create --no-build|image tag/);
});

test('failed manual rollback restores the active release and remains a failure', t => {
    const result = fixture(t).run('scripts/sit-environment.sh', 'rollback', { MOCK_SMOKE_FAIL: '1' });
    assert.notEqual(result.status, 0);
    assert.match(result.log, /sha256:previous \| .*create --no-build/);
    assert.match(result.log, /sha256:old \| .*create --no-build/);
    assert.doesNotMatch(result.log, /image tag/);
    assert.match(result.stderr, /SIT restored; the requested update still failed/);
});

test('first deployment failure cannot fabricate a preceding release', t => {
    const result = fixture(t).run('scripts/sit-environment.sh', 'deploy',
        { MOCK_NO_CONTAINER: '1', MOCK_READINESS_FAIL: '1' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /no preceding deployment exists/);
    assert.doesNotMatch(result.log, /image tag|sha256:old \| .*create --no-build/);
});

for (const action of ['start', 'stop', 'status', 'logs', 'smoke']) {
    test(`${action} is scoped to the SIT project/service, not Pipeline Test`, t => {
        const result = fixture(t).run('scripts/sit-environment.sh', action);
        assert.equal(result.status, 0, result.stderr);
        assert.match(result.log, /--project-name healthylife-sit --file compose.sit.yaml/);
        assert.doesNotMatch(result.log, /\bdown\b|--volumes|18081|build --pull/);
    });
}

test('TEST cleanup is idempotent and never accesses Docker', t => {
    const f = fixture(t);
    for (let i = 0; i < 2; i++) {
        const result = f.run('scripts/test-environment.sh', 'cleanup');
        assert.equal(result.status, 0, result.stderr);
        assert.equal(result.log, '');
    }
});

test('Pipeline Test rejects SIT port and cannot start any deployment there', t => {
    const result = fixture(t).run('scripts/test-environment.sh', 'deploy', { TEST_PORT: '18082' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /reserved for TEST_PORT=18081/);
    assert.equal(result.log, '');
});

for (const pid of ['1', 'invalid', '0']) {
    test(`TEST cleanup rejects unsafe PID ${pid} without Docker access`, t => {
        const f = fixture(t);
        fs.writeFileSync(path.join(f.dir, 'target', 'deployment', 'app.pid'), `${pid}\n`);
        const result = f.run('scripts/test-environment.sh', 'cleanup');
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /refusing to signal/);
        assert.equal(result.log, '');
    });
}

test('local PRD builds, waits, smokes and promotes only its own image', t => {
    const result = fixture(t, 'PRD').run('scripts/deploy-prd.sh', '');
    assert.equal(result.status, 0, result.stderr);
    const index = value => result.log.indexOf(value);
    assert(index('build --pull prd-app') >= 0);
    assert(index('build --pull prd-app') < index('image tag sha256:old healthylife-prd:previous'));
    assert(index('image tag sha256:old healthylife-prd:previous') < index('create --no-build'));
    assert(index('create --no-build') < index('start abc123'));
    assert(index('start abc123') < index('inspect --format {{.State.Status}}'));
    assert(index('inspect --format {{.State.Status}}') < index('exec -T prd-app java'));
    assert(index('exec -T prd-app java') < index('image tag sha256:candidate healthylife-prd:current'));
    assert.match(result.stdout, /local PRD simulation.*not a real production target/);
    assert.match(result.stdout, /http:\/\/localhost:18083/);
    assert.doesNotMatch(result.log, /sit-app|healthylife-sit|compose\.sit|18081|\bdown\b|--volumes/);
});

for (const failure of ['MOCK_READINESS_FAIL', 'MOCK_SMOKE_FAIL']) {
    for (const action of ['deploy', 'rollback']) {
        test(`local PRD ${action} ${failure} restores PRD only and still fails`, t => {
            const result = fixture(t, 'PRD').run('scripts/prd-environment.sh', action, { [failure]: '1' });
            assert.notEqual(result.status, 0);
            assert.match(result.log, /sha256:old \| .*create --no-build/);
            assert.match(result.stderr, /PRD restored; the requested update still failed/);
            assert.doesNotMatch(result.log, /image tag sha256:(candidate|previous) healthylife-prd:current|healthylife-sit|\bdown\b/);
        });
    }
}

for (const [extra, expected] of [
    [{ PRD_DOCKER_ENGINE_ID: '' }, /trusted Docker Desktop engine ID/],
    [{ PRD_DOCKER_ENGINE_ID: 'wrong', SIT_DOCKER_ENGINE_ID: 'desktop-test' }, /Wrong Docker daemon/],
    [{ MOCK_DAEMON_DOWN: '1' }, /Cannot access the Docker daemon/],
    [{ MOCK_ENGINE_OS: 'Other Linux' }, /Windows Docker Desktop target/],
]) {
    test(`local PRD preflight rejects ${JSON.stringify(extra)} without SIT fallback`, t => {
        const result = fixture(t, 'PRD').run('scripts/prd-environment.sh', 'deploy', extra);
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, expected);
        assert.doesNotMatch(result.log, /--project-name|image tag|healthylife-sit/);
    });
}

for (const failure of ['MOCK_CONFIG_FAIL', 'MOCK_BUILD_FAIL']) {
    test(`local PRD ${failure} leaves running services untouched`, t => {
        const result = fixture(t, 'PRD').run('scripts/prd-environment.sh', 'deploy', { [failure]: '1' });
        assert.notEqual(result.status, 0);
        assert.doesNotMatch(result.log, /create --no-build|image tag|healthylife-sit/);
    });
}

test('local PRD checksum mismatch blocks image build and activation', t => {
    const f = fixture(t, 'PRD');
    fs.appendFileSync(path.join(f.dir, 'target', 'jenkins-java-maven-demo-1.0.0.jar'), 'changed');
    const result = f.run('scripts/prd-environment.sh', 'deploy');
    assert.notEqual(result.status, 0);
    assert.doesNotMatch(result.log, /build --pull|create --no-build|image tag/);
});

for (const action of ['start', 'stop', 'status', 'logs', 'smoke', 'rollback']) {
    test(`local PRD ${action} cannot operate on SIT`, t => {
        const result = fixture(t, 'PRD').run('scripts/prd-environment.sh', action);
        assert.equal(result.status, 0, result.stderr);
        assert.match(result.log, /--project-name healthylife-prd --file compose.prd.yaml/);
        assert.doesNotMatch(result.log, /sit-app|healthylife-sit|compose\.sit|\bdown\b|--volumes|build --pull/);
        if (action === 'rollback') {
            assert.match(result.log, /sha256:previous \| .*create --no-build/);
            assert.match(result.log, /image tag sha256:previous healthylife-prd:current/);
            assert.match(result.log, /image tag sha256:old healthylife-prd:previous/);
        }
    });
}

test('PRD smoke dispatcher uses PRD container rather than a remote URL or SIT', t => {
    const result = fixture(t, 'PRD').run('scripts/smoke-test.sh', 'PRD');
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.log, /exec -T prd-app java .* http:\/\/127.0.0.1:8080\/api\/health/);
    assert.doesNotMatch(result.log, /healthylife-sit/);
});

test('SIT does not require the separate PRD daemon setting', t => {
    const result = fixture(t).run('scripts/sit-environment.sh', 'status', { PRD_DOCKER_ENGINE_ID: '' });
    assert.equal(result.status, 0, result.stderr);
    assert.doesNotMatch(result.log, /healthylife-prd|prd-app/);
});

test('local PRD first activation failure reports no preceding release', t => {
    const result = fixture(t, 'PRD').run('scripts/prd-environment.sh', 'deploy',
        { MOCK_NO_CONTAINER: '1', MOCK_READINESS_FAIL: '1' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /no preceding deployment exists/);
    assert.doesNotMatch(result.log, /image tag|healthylife-sit/);
});

test('local PRD missing rollback version cannot alter either service', t => {
    const result = fixture(t, 'PRD').run('scripts/prd-environment.sh', 'rollback', { MOCK_NO_PREVIOUS: '1' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /No previous PRD image/);
    assert.doesNotMatch(result.log, /create --no-build|image tag|healthylife-sit/);
});

test('local PRD failed recovery explicitly requires operator intervention', t => {
    const result = fixture(t, 'PRD').run('scripts/prd-environment.sh', 'deploy',
        { MOCK_READINESS_FAIL: '1', MOCK_RESTORE_FAIL: '1' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /PRD restoration failed; operator intervention/);
});

test('Compose contract isolates host exposure, health, lifecycle and storage', () => {
    const compose = fs.readFileSync(path.join(root, 'compose.sit.yaml'), 'utf8');
    const dockerfile = fs.readFileSync(path.join(root, 'Dockerfile'), 'utf8');
    assert.match(compose, /name: healthylife-sit/);
    assert.match(compose, /sit-app:/);
    assert.match(compose, /127\.0\.0\.1:18082:8080/);
    assert.match(compose, /restart: unless-stopped/);
    assert.match(compose, /healthcheck:[\s\S]*http:\/\/127\.0\.0\.1:8080\/api\/health/);
    assert.doesNotMatch(compose, /18081|container_name:|network_mode:|volumes:/);
    assert.match(dockerfile, /"--server.port=8080"/);
    assert.match(dockerfile, /COPY target\/jenkins-java-maven-demo-1.0.0.jar application.jar/);
});

test('local PRD Compose uses its own project, service and loopback port with the same Dockerfile', () => {
    const compose = fs.readFileSync(path.join(root, 'compose.prd.yaml'), 'utf8');
    assert.match(compose, /name: healthylife-prd/);
    assert.match(compose, /prd-app:/);
    assert.match(compose, /\$\{PRD_IMAGE:\?/);
    assert.match(compose, /dockerfile: Dockerfile/);
    assert.match(compose, /127\.0\.0\.1:18083:8080/);
    assert.match(compose, /restart: unless-stopped/);
    assert.match(compose, /healthcheck:[\s\S]*http:\/\/127\.0\.0\.1:8080\/api\/health/);
    assert.doesNotMatch(compose, /18081|18082|SIT_IMAGE|sit-app|volumes:|container_name:|network_mode:/);
});

for (const environment of ['SIT', 'PRD']) {
    for (const action of ['deploy', 'rollback', 'start']) {
        test(`${environment} ${action} activation timeout is bounded and does not issue overlapping recovery`, t => {
            const result = fixture(t, environment).run(`scripts/${environment.toLowerCase()}-environment.sh`,
                action, { MOCK_ACTIVATION_TIMEOUT: '124' });
            assert.equal(result.status, 124);
            assert.match(result.log, /timeout \| --signal=TERM --kill-after=5s 240s/);
            assert.equal(result.log.match(/timeout \|/g).length, 1);
            assert.match(result.stderr, /daemon request may still be in flight/);
            assert.doesNotMatch(result.log, /create --no-build|start abc123|exec -T|image tag sha256:(candidate|previous) healthylife-(sit|prd):current/);
            assert.doesNotMatch(result.stderr, /restored;|restoring the preceding/);
        });

    }
}

test('force-killed activation cannot trigger an overlapping rollback', t => {
    const result = fixture(t, 'PRD').run('scripts/prd-environment.sh', 'deploy', { MOCK_ACTIVATION_TIMEOUT: '137' });
    assert.equal(result.status, 137);
    assert.equal(result.log.match(/timeout \|/g).length, 1);
    assert.match(result.stderr, /no automatic retry or rollback/);
    assert.doesNotMatch(result.log, /create --no-build|start abc123|exec -T/);
});

test('interrupted deployment does not launch recovery after Jenkins abort', t => {
    const result = fixture(t, 'PRD').run('scripts/prd-environment.sh', 'deploy', { MOCK_ACTIVATION_SIGNAL: '1' });
    assert.notEqual(result.status, 0);
    assert.equal(result.log.match(/timeout \|/g).length, 1);
    assert.match(result.stderr, /uncertain after timeout\/interruption/);
    assert.doesNotMatch(result.log, /create --no-build|start abc123|exec -T/);
});

test('activation refuses multiple or malformed container identifiers before start', t => {
    const result = fixture(t, 'PRD').run('scripts/prd-environment.sh', 'start', { MOCK_CONTAINER_ID: 'abc123\ndef456' });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Expected exactly one Docker container ID/);
    assert.doesNotMatch(result.log, /\| start /);
});

test('readiness waits past starting and requires healthy before smoke', t => {
    const result = fixture(t, 'PRD').run('scripts/prd-environment.sh', 'start', { MOCK_HEALTH_STARTING: '1' });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /running starting[\s\S]*running healthy/);
    assert.equal(result.log.match(/inspect --format \{\{.State.Status\}\}/g).length, 2);
    assert.equal(result.log.match(/\| start abc123/g).length, 1);
    assert(result.log.lastIndexOf('inspect --format {{.State.Status}}') < result.log.indexOf('exec -T prd-app'));
});

test('installed GNU timeout terminates a stalled child within a bounded interval', () => {
    const started = Date.now();
    const result = spawnSync(shell, ['-c', 'timeout --signal=TERM --kill-after=1s 0.1s sh -c "sleep 10"'],
        { encoding: 'utf8', timeout: 5000 });
    assert.ifError(result.error);
    assert.equal(result.status, 124, result.stderr);
    assert(Date.now() - started < 4000, 'timeout did not bound the child process');
});
