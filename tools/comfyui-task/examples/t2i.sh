#!/usr/bin/env bash
# Text-to-image: read t2i_api.json from stdin, inject prompt + width/height, run.
set -euo pipefail

PROMPT="${1:-a cat sitting on a windowsill}"
WIDTH="${2:-1024}"
HEIGHT="${3:-1024}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEMO_DIR="${SCRIPT_DIR}/../../../comfyui_api_demo"

cat "${DEMO_DIR}/t2i_api.json" \
  | bun run "${SCRIPT_DIR}/../bin/comfyui-task" run \
      --prompt "$PROMPT" \
      --width "$WIDTH" \
      --height "$HEIGHT" \
      --output "${SCRIPT_DIR}/../out"