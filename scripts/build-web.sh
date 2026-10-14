#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
npm --prefix web ci
npm --prefix web test
npm --prefix web run build
printf '\nStatic site ready in web/dist/\n'
