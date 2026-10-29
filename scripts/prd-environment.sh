#!/bin/sh
set -eu

exec sh scripts/compose-environment.sh PRD "${1:?Specify a lifecycle action}"
