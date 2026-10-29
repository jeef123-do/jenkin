#!/bin/sh
set -eu

exec sh scripts/compose-environment.sh SIT "${1:?Specify a lifecycle action}"
