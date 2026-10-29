#!/bin/sh
set -eu

state=target/deployment
pid_file="$state/app.pid"
log_file="$state/app.log"
jar=${ARTIFACT_PATH:-target/jenkins-java-maven-demo-1.0.0.jar}
action=${1:?Specify deploy, smoke or cleanup}
: "${BUILD_TAG:?BUILD_TAG must identify this build}"
marker="-Dhealthylife.deployment=$BUILD_TAG"

fail() {
    echo "HealthyLife test deployment: $*" >&2
    exit 1
}

owns_process() {
    [ -r "/proc/$pid/cmdline" ] &&
        tr '\000' '\n' < "/proc/$pid/cmdline" | grep -Fx -- "$marker" > /dev/null
}

read_pid() {
    [ -f "$pid_file" ] || fail "No deployment PID file. Deploy to Test must succeed first."
    pid=$(cat "$pid_file")
    case "$pid" in
        ''|*[!0-9]*) fail "Invalid deployment PID file; refusing to signal any process." ;;
    esac
    [ "$pid" -gt 1 ] || fail "Unsafe deployment PID; refusing to signal any process."
}

cleanup() {
    [ -f "$pid_file" ] || return 0
    read_pid
    if owns_process; then
        echo "Stopping only this build's test deployment (PID $pid)."
        kill -TERM "$pid" || fail "Could not stop deployment PID $pid."
        attempts=0
        while owns_process; do
            attempts=$((attempts + 1))
            [ "$attempts" -le 15 ] || fail "Deployment PID $pid did not stop; manual investigation required."
            sleep 1
        done
    elif [ -r "/proc/$pid/cmdline" ] && [ -n "$(tr '\000' '\n' < "/proc/$pid/cmdline")" ]; then
        fail "PID $pid no longer belongs to this build; refusing to signal it."
    else
        echo "Test deployment has already stopped."
    fi
    rm -f "$pid_file"
}

case "$action" in
    deploy)
        [ "$(uname -s)" = Linux ] || fail "This deployment requires a Linux Java 21 agent with /proc."
        for tool in java timeout nohup grep tr; do
            command -v "$tool" > /dev/null || fail "Required agent tool is missing: $tool"
        done
        : "${TEST_PORT:?Configure TEST_PORT}"
        case "$TEST_PORT" in
            ''|*[!0-9]*) fail "TEST_PORT must be a decimal port number." ;;
        esac
        [ "$TEST_PORT" = 18081 ] || fail "Pipeline Test is reserved for TEST_PORT=18081."
        [ -f "$jar" ] || fail "Packaged JAR not found: $jar"
        cleanup
        mkdir -p "$state"
        printf '%s\n' "$TEST_PORT" > "$state/port"
        echo "Deploying packaged JAR as an isolated, temporary process on this agent."
        echo "Pipeline Test uses no Docker resources and cannot stop SIT."
        echo "Test URL: http://127.0.0.1:$TEST_PORT (agent-local, not host-published)."
        trap 'status=$?; trap - EXIT; if [ "$status" -ne 0 ]; then cleanup; fi; exit "$status"' EXIT
        trap 'exit 1' HUP INT TERM
        # A distinct Jenkins cookie survives sh-step completion; timeout bounds orphan lifetime.
        BUILD_ID="$BUILD_TAG-healthylife" JENKINS_NODE_COOKIE="$BUILD_TAG-healthylife" \
            nohup timeout --signal=TERM --kill-after=10s 10m \
            java "$marker" -jar "$jar" \
            --server.address=127.0.0.1 --server.port="$TEST_PORT" \
            > "$log_file" 2>&1 < /dev/null &
        pid=$!
        printf '%s\n' "$pid" > "$pid_file"
        attempts=0
        until grep -F 'Started HealthyLifeApplication' "$log_file" > /dev/null; do
            if ! owns_process; then
                cat "$log_file" >&2
                fail "Application exited before startup; check the deployment log (including port conflicts)."
            fi
            attempts=$((attempts + 1))
            if [ "$attempts" -ge 60 ]; then
                cleanup
                cat "$log_file" >&2
                fail "Application did not start within 60 seconds."
            fi
            sleep 1
        done
        owns_process || fail "Deployment process exited during startup."
        java scripts/SmokeCheck.java "http://127.0.0.1:$TEST_PORT/api/health"
        owns_process || fail "Deployment process exited during readiness."
        echo "Readiness passed; Smoke Test will independently verify this deployment."
        ;;
    smoke)
        read_pid
        owns_process || fail "The deployed application is not running."
        port=$(cat "$state/port")
        java scripts/SmokeCheck.java "http://127.0.0.1:$port/api/health"
        owns_process || fail "The deployed application exited during its health check."
        ;;
    cleanup)
        cleanup
        ;;
    *)
        fail "Unknown action: $action"
        ;;
esac
