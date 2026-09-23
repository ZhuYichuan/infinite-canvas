#!/usr/bin/env bash
# Image-to-image (1 reference): read i2i_ref1_api.json, inject prompt + 1 ref image.
set -euo pipefail

PROMPT="${1:-convert to watercolor style}"
REF_IMAGE="${2:?usage: i2i-ref1.sh <prompt> <ref-image-path>}"
WIDTH="${3:-1024}"
HEIGHT="${4:-1024}"
shift 4

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEMO_DIR="${SCRIPT_DIR}/../../../Comfy/Comfy-Api/workflows/2_i2i_flux2_dev"

cat "${DEMO_DIR}/flux2_dev_i2i_api.json" \
  | bun run "${SCRIPT_DIR}/../bin/comfyui-task" run \
      --prompt "$PROMPT" \
      --refs "$REF_IMAGE" \
      --width "$WIDTH" \
      --height "$HEIGHT" \
      --output "${SCRIPT_DIR}/../out" \
      ${COMFYUI_PROXY_URL:+--base-url "$COMFYUI_PROXY_URL"} \
      "$@"