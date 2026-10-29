#!/bin/sh
set -eu

case "${1:-}" in
    TEST)
        exec sh scripts/test-environment.sh smoke
        ;;
    SIT)
        exec sh scripts/sit-environment.sh smoke
        ;;
    PRD)
        exec sh scripts/prd-environment.sh smoke
        ;;
    *)
        echo "HealthyLife smoke test: environment must be TEST, SIT or PRD." >&2
        exit 1
        ;;
esac
