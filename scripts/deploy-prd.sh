#!/bin/sh
set -eu

echo "PRD deployment is not configured. Approval does not enable deployment; no deployment was attempted." >&2
echo "Configure the protected target, transport, destination, external application configuration, PRD-only Jenkins credentials, PRD_HEALTH_URL and Jenkins authorization; implement and review this script before enabling PRD." >&2
exit 1
