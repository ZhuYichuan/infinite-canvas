#!/usr/bin/env bash
# Text-to-image: read t2i_api.json from stdin, inject prompt + width/height, run.
set -euo pipefail

PROMPT="${1:-a cat sitting on a windowsill}"
WIDTH="${2:-1024}"
HEIGHT="${3:-1024}"
shift 3

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEMO_DIR="${SCRIPT_DIR}/../../../Comfy/Comfy-Api/workflows/1_t2i_z_image_turbo"

cat "${DEMO_DIR}/z_image_turbo_api.json" \
  | bun run "${SCRIPT_DIR}/../bin/comfyui-task" run \
      --prompt "$PROMPT" \
      --width "$WIDTH" \
      --height "$HEIGHT" \
      --output "${SCRIPT_DIR}/../out" \
      ${COMFYUI_PROXY_URL:+--base-url "$COMFYUI_PROXY_URL"} \
      "$@"