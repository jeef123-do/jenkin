#!/bin/sh
set -eu

echo "TEST mode: temporary agent-local deployment, not a remote TEST server."
exec sh scripts/test-environment.sh deploy
