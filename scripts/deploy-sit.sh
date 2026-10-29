#!/bin/sh
set -eu

echo "SIT deployment must run on the approved Windows agent using scripts/sit-service.ps1, not from the Linux Pipeline Test agent." >&2
echo "No deployment was attempted. Use TARGET_ENV=SIT in the reviewed Jenkins pipeline." >&2
exit 1
