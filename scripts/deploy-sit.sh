#!/bin/sh
set -eu

echo "SIT deployment is not configured. No deployment was attempted." >&2
echo "Configure the real target, transport, destination, external application configuration, SIT-only Jenkins credentials and SIT_HEALTH_URL; implement and review this script before enabling SIT." >&2
exit 1
