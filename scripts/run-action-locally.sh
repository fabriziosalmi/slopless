#!/usr/bin/env bash
#
# Runs the composite Action the way a GitHub runner would, in a container, so a
# change to action.yml can be checked before it is published.
#
# This exists because the Action once expanded its own glob in bash before the
# CLI saw it, and analysed half the files it claimed to. Reading action.yml
# proved nothing; running it did.
#
#   scripts/run-action-locally.sh <target-repo> [patterns] [format] [output]
#
# The step script is extracted from action.yml rather than copied, so this
# harness cannot drift from the Action it is testing.
set -euo pipefail

ACTION_REPO="${ACTION_REPO:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
IMAGE="${IMAGE:-node:22-bookworm-slim}"

TARGET="${1:?usage: run-action-locally.sh <target-repo> [patterns] [format] [output]}"
PATTERNS="${2:-src/**/*.ts}"
FORMAT="${3:-default}"
OUTPUT="${4:-}"

if ! command -v docker >/dev/null 2>&1; then
    echo "docker is not on PATH." >&2
    echo "Docker Desktop keeps it in /Applications/Docker.app/Contents/Resources/bin." >&2
    exit 1
fi

if [ ! -f "$ACTION_REPO/dist/index.js" ]; then
    echo "dist/index.js is missing. Run npm run build first." >&2
    exit 1
fi

STEP=$(python3 - "$ACTION_REPO/action.yml" <<'PY'
import sys, yaml
doc = yaml.safe_load(open(sys.argv[1]))
sys.stdout.write(doc['runs']['steps'][0]['run'])
PY
)

exec docker run --rm \
    -v "$ACTION_REPO:/action:ro" \
    -v "$(cd "$TARGET" && pwd):/workspace" \
    -w /workspace \
    -e SLOPLESS_DIR=/action \
    -e SLOPLESS_PATTERNS="$PATTERNS" \
    -e SLOPLESS_CONFIG="" \
    -e SLOPLESS_FORMAT="$FORMAT" \
    -e SLOPLESS_TYPE_CHECK="false" \
    -e SLOPLESS_ARGS="" \
    -e SLOPLESS_OUTPUT="$OUTPUT" \
    -e STEP_SCRIPT="$STEP" \
    "$IMAGE" \
    bash -c 'printf "%s" "$STEP_SCRIPT" > /tmp/step.sh; bash /tmp/step.sh'
