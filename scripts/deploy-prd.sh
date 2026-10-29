#!/bin/sh
set -eu

echo "Deploying local PRD simulation only; this is not a real production target."
exec sh scripts/prd-environment.sh deploy
