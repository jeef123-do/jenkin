#!/bin/sh
set -eu

case "${1:-}" in
    TEST)
        exec sh scripts/test-environment.sh smoke
        ;;
    SIT)
        echo "SIT smoke must run on the approved Windows agent: scripts/sit-service.ps1 -Action Smoke. Agent-local localhost is not Windows localhost." >&2
        exit 1
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
