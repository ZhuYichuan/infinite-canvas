#!/usr/bin/env bash
# Image-to-image (3 references): read i2i_ref3_api.json, inject prompt + 3 ref images.
set -euo pipefail

PROMPT="${1:-combine these references into one scene}"
REF1="${2:?usage: i2i-ref3.sh <prompt> <ref1> <ref2> <ref3>}"
REF2="${3:?usage: i2i-ref3.sh <prompt> <ref1> <ref2> <ref3>}"
REF3="${4:?usage: i2i-ref3.sh <prompt> <ref1> <ref2> <ref3>}"
WIDTH="${5:-1024}"
HEIGHT="${6:-1024}"
shift 6

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEMO_DIR="${SCRIPT_DIR}/../../../comfyui_api"

cat "${DEMO_DIR}/comfyuiI2iWorkflow_api.json" \
  | bun run "${SCRIPT_DIR}/../bin/comfyui-task" run \
      --prompt "$PROMPT" \
      --refs "$REF1,REF2,REF3" \
      --width "$WIDTH" \
      --height "$HEIGHT" \
      --output "${SCRIPT_DIR}/../out" \
      ${COMFYUI_PROXY_URL:+--base-url "$COMFYUI_PROXY_URL"} \
      "$@"