#!/bin/sh
set -eu

fail() {
    echo "HealthyLife SIT: $*" >&2
    exit 1
}

action=${1:?Specify deploy, smoke, rollback, stop, start, status or logs}
case "$action" in
    deploy|smoke|rollback|stop|start|status|logs) ;;
    *) fail "Unknown action: $action" ;;
esac
command -v docker > /dev/null || fail "Docker CLI is missing on this agent."
docker compose version > /dev/null || fail "Docker Compose v2+ is required."
: "${SIT_DOCKER_ENGINE_ID:?Set the trusted Docker Desktop engine ID before using SIT}"
engine_id=$(docker info --format '{{.ID}}') || fail "Cannot access the Docker daemon. Configure agent permissions/transport outside this repository."
[ "$engine_id" = "$SIT_DOCKER_ENGINE_ID" ] || fail "Wrong Docker daemon; refusing to operate on SIT."
engine_os=$(docker info --format '{{.OperatingSystem}}')
[ "$engine_os" = 'Docker Desktop' ] || fail "SIT requires the agreed Windows Docker Desktop target."

current=healthylife-sit:current
previous=healthylife-sit:previous
SIT_IMAGE=$current
export SIT_IMAGE

compose() {
    docker compose --project-name healthylife-sit --file compose.sit.yaml "$@"
}

smoke() {
    compose exec -T sit-app java /opt/healthylife/SmokeCheck.java http://127.0.0.1:8080/api/health
}

active_image() {
    container=$(compose ps --all --quiet sit-app)
    if [ -n "$container" ]; then
        docker inspect --format '{{.Image}}' "$container"
    fi
}

old_image=
updating=false
restore_on_exit() {
    status=$?
    trap - EXIT HUP INT TERM
    if [ "$updating" = true ]; then
        if [ -n "$old_image" ]; then
            echo "SIT update failed; restoring the preceding container image." >&2
            SIT_IMAGE=$old_image
            if compose up --detach --no-build --wait --wait-timeout 180 sit-app && smoke; then
                echo "SIT restored; the requested update still failed." >&2
            else
                echo "SIT restoration failed; operator intervention is required. No volumes were removed." >&2
            fi
        else
            echo "SIT update failed; no preceding deployment exists. Inspect SIT status/logs." >&2
        fi
    fi
    exit "$status"
}
trap restore_on_exit EXIT
trap 'exit 1' HUP INT TERM

compose config --quiet
case "$action" in
    deploy)
        sha256sum --check target/artifact.sha256
        revision=$(git rev-parse --verify HEAD)
        build=${BUILD_NUMBER:-local}
        case "$build" in
            ''|*[!0-9a-zA-Z_.-]*) fail "Invalid build identifier." ;;
        esac
        SIT_IMAGE="healthylife-sit:git-$revision-$build"
        # Always build the image from this run's tested/scanned JAR, never a stale tag.
        compose build --pull sit-app
        sha256sum --check target/artifact.sha256
        candidate=$(docker image inspect --format '{{.Id}}' "$SIT_IMAGE")
        old_image=$(active_image)
        if [ -n "$old_image" ]; then
            docker image tag "$old_image" "$previous"
        fi
        SIT_IMAGE=$candidate
        updating=true
        compose up --detach --no-build --wait --wait-timeout 180 sit-app
        smoke
        docker image tag "$candidate" "$current"
        updating=false
        echo "SIT is ready. Windows browser: http://localhost:18082/"
        ;;
    rollback)
        candidate=$(docker image inspect --format '{{.Id}}' "$previous") ||
            fail "No previous SIT image is retained on this daemon."
        old_image=$(active_image)
        [ -n "$old_image" ] || fail "No current SIT container; investigate before rollback."
        SIT_IMAGE=$candidate
        updating=true
        compose up --detach --no-build --wait --wait-timeout 180 sit-app
        smoke
        docker image tag "$old_image" "$previous"
        docker image tag "$candidate" "$current"
        updating=false
        echo "SIT rollback passed readiness and smoke; no data volumes were removed."
        ;;
    start)
        SIT_IMAGE=$(docker image inspect --format '{{.Id}}' "$current") ||
            fail "No built SIT release. Use deploy after building/testing/scanning the JAR."
        compose up --detach --no-build --wait --wait-timeout 180 sit-app
        smoke
        ;;
    smoke) smoke ;;
    stop) compose stop sit-app ;;
    status) compose ps --all sit-app ;;
    logs) compose logs --tail 100 sit-app ;;
esac
