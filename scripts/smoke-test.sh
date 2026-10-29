#!/bin/sh
set -eu

case "${1:-}" in
    TEST)
        exec sh scripts/test-environment.sh smoke
        ;;
    SIT)
        : "${SIT_HEALTH_URL:?Configure the actual SIT HTTPS health endpoint}"
        exec java scripts/SmokeCheck.java "$SIT_HEALTH_URL" remote
        ;;
    PRD)
        : "${PRD_HEALTH_URL:?Configure the actual PRD HTTPS health endpoint}"
        exec java scripts/SmokeCheck.java "$PRD_HEALTH_URL" remote
        ;;
    *)
        echo "HealthyLife smoke test: environment must be TEST, SIT or PRD." >&2
        exit 1
        ;;
esac
