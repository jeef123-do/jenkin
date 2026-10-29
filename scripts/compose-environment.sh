#!/bin/sh
set -eu

environment=${1:?Specify SIT or PRD}
action=${2:?Specify deploy, smoke, rollback, stop, start, status or logs}
case "$environment" in
    SIT)
        project=healthylife-sit
        service=sit-app
        file=compose.sit.yaml
        port=18082
        engine_expected=${SIT_DOCKER_ENGINE_ID:?Set the trusted Docker Desktop engine ID before using SIT}
        ;;
    PRD)
        project=healthylife-prd
        service=prd-app
        file=compose.prd.yaml
        port=18083
        engine_expected=${PRD_DOCKER_ENGINE_ID:?Set the trusted Docker Desktop engine ID before using local PRD}
        ;;
    *)
        echo "HealthyLife Compose: environment must be SIT or PRD." >&2
        exit 1
        ;;
esac

fail() {
    echo "HealthyLife $environment: $*" >&2
    exit 1
}

case "$action" in
    deploy|smoke|rollback|stop|start|status|logs) ;;
    *) fail "Unknown action: $action" ;;
esac
command -v docker > /dev/null || fail "Docker CLI is missing on this agent."
docker compose version > /dev/null || fail "Docker Compose v2+ is required."
engine_id=$(docker info --format '{{.ID}}') || fail "Cannot access the Docker daemon. Configure agent permissions/transport outside this repository."
[ "$engine_id" = "$engine_expected" ] || fail "Wrong Docker daemon; refusing to operate on $environment."
engine_os=$(docker info --format '{{.OperatingSystem}}')
[ "$engine_os" = 'Docker Desktop' ] || fail "$environment requires the agreed Windows Docker Desktop target."

current=$project:current
previous=$project:previous

select_image() {
    case "$environment" in
        SIT) SIT_IMAGE=$1; export SIT_IMAGE ;;
        PRD) PRD_IMAGE=$1; export PRD_IMAGE ;;
    esac
}
select_image "$current"

compose() {
    docker compose --project-name "$project" --file "$file" "$@"
}

smoke() {
    compose exec -T "$service" java /opt/healthylife/SmokeCheck.java http://127.0.0.1:8080/api/health
}

active_image() {
    container=$(compose ps --all --quiet "$service")
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
            echo "$environment update failed; restoring the preceding container image." >&2
            select_image "$old_image"
            if compose up --detach --no-build --wait --wait-timeout 180 "$service" && smoke; then
                echo "$environment restored; the requested update still failed." >&2
            else
                echo "$environment restoration failed; operator intervention is required. No volumes were removed." >&2
            fi
        else
            echo "$environment update failed; no preceding deployment exists. Inspect $environment status/logs." >&2
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
        release_image="$project:git-$revision-$build"
        select_image "$release_image"
        # Always build the image from this run's tested/scanned JAR, never a stale tag.
        compose build --pull "$service"
        sha256sum --check target/artifact.sha256
        candidate=$(docker image inspect --format '{{.Id}}' "$release_image")
        old_image=$(active_image)
        if [ -n "$old_image" ]; then
            docker image tag "$old_image" "$previous"
        fi
        select_image "$candidate"
        updating=true
        compose up --detach --no-build --wait --wait-timeout 180 "$service"
        smoke
        docker image tag "$candidate" "$current"
        updating=false
        echo "$environment is ready. Windows browser: http://localhost:$port/"
        ;;
    rollback)
        candidate=$(docker image inspect --format '{{.Id}}' "$previous") ||
            fail "No previous $environment image is retained on this daemon."
        old_image=$(active_image)
        [ -n "$old_image" ] || fail "No current $environment container; investigate before rollback."
        select_image "$candidate"
        updating=true
        compose up --detach --no-build --wait --wait-timeout 180 "$service"
        smoke
        docker image tag "$old_image" "$previous"
        docker image tag "$candidate" "$current"
        updating=false
        echo "$environment rollback passed readiness and smoke; no data volumes were removed."
        ;;
    start)
        candidate=$(docker image inspect --format '{{.Id}}' "$current") ||
            fail "No built $environment release. Use deploy after building/testing/scanning the JAR."
        select_image "$candidate"
        compose up --detach --no-build --wait --wait-timeout 180 "$service"
        smoke
        ;;
    smoke) smoke ;;
    stop) compose stop "$service" ;;
    status) compose ps --all "$service" ;;
    logs) compose logs --tail 100 "$service" ;;
esac
