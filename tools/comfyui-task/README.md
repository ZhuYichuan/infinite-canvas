# comfyui-task

Local ComfyUI workflow runner. Reads an API-format workflow from stdin, resolves `_meta.title` bindings, submits to a `comfy-api-proxy`, polls until done, downloads outputs.

Built for the `infinite-canvas` web app's ComfyUI integration, but usable as a standalone CLI.

## Why

The `_meta.title` convention lets a user mark which node in their ComfyUI workflow is the prompt input, which are reference images, etc. — without touching the JSON. This library:

1. Scans the workflow for nodes by title.
2. Injects caller-provided values (prompt text, width/height, ref images) into those slots.
3. Uploads reference images to the proxy (`POST /api/v2/assets`) and replaces filenames with `core/ASSET` references.
4. Submits the workflow (`POST /api/v2/jobs`).
5. Polls (`GET /api/v2/jobs/{id}`) until terminal state.
6. Downloads each output asset (`GET /api/v2/assets/{id}/content`).

## Install

```bash
cd tools/comfyui-task
bun install
```

Requires Bun ≥ 1.0. The web app does not need this; it imports the library source directly via a tsconfig path alias.

## CLI

```bash
cat ../../Comfy-Api/comfyuiT2iWorkflow_api.json \
  | bun run bin/comfyui-task run \
      --prompt "a cat on a windowsill" \
      --width 1024 --height 1024 \
      --output ./out
```

**Flags:**

| Flag | Default | Description |
|---|---|---|
| `--base-url <url>` | `http://127.0.0.1:8189` | Proxy base URL |
| `--token <jwt>` | (env `COMFY_PROXY_TOKEN`) | Bearer token |
| `--prompt <text>` | — | Prompt text |
| `--width <n>` / `--height <n>` | — | Image dimensions |
| `--ref <input>` | — | Reference (path / http(s) URL / data URL); repeat |
| `--output-cap <image\|video>` | auto | Override output capability |
| `--output <dir>` | `./out` | Output directory |
| `--timeout <duration>` | 30m (image) / 6h (video) | e.g. `30m`, `6h`, `120s` |
| `--stdin <file>` | stdin | Read workflow JSON from a file instead |

**Stdin format** (auto-detected):

- Wrapper: `{"workflow": {...}, "outputCap": "image"}`
- Bare: just the API-format workflow

## Examples

```bash
./examples/t2i.sh "a cat on a windowsill"
./examples/i2i-ref1.sh "convert to watercolor" ./myref.png
./examples/i2i-ref3.sh "merge these into one scene" ./a.png ./b.png ./c.png
```

## Library API

```ts
import { runWorkflow } from "@comfyui-task/run";

const result = await runWorkflow(workflow, {
    baseUrl: "http://127.0.0.1:8189",
    prompt: "a cat",
    width: 1024,
    height: 1024,
    refImages: [
        { kind: "path", value: "./ref.png" },
        { kind: "url", value: "https://example.com/photo.jpg" },
    ],
    signal: abortController.signal,
    onProgress: (status, detail) => console.log(status, detail),
});

for (const out of result.outputs) {
    await out.bytes.arrayBuffer(); // blob bytes
    out.suggestedPath;             // filename like "ComfyUI_00001_.png"
}
```

The web app calls `runWorkflow` directly from `web/src/services/api/`. See `web/tsconfig.json`'s `paths` for the alias.

## Title conventions

| Title | Class examples | Input slot |
|---|---|---|
| `prompt` | CLIPTextEncode / PrimitiveStringMultiline / TextEncodeBooguEdit | `text` / `value` / `prompt` |
| `width` / `height` | PrimitiveInt / PrimitiveFloat | `value` |
| `ref_image_01` … `ref_image_09` | LoadImage / LoadImageMask | `image` |
| `ref_video_01` … `ref_video_09` | LoadVideo / VHS_LoadVideo | `video` |
| `ref_audio_01` … `ref_audio_09` | LoadAudio | `audio` |

Two-digit zero-padded suffix is required (`ref_image_1` is invalid).

## Out of scope (Phase 1)

- Video / audio workflows (slots reserved, not exercised)
- SSE progress (CLI only polls; web uses its own pattern)
- Workflow editor / browser upload
- npm publish

## License

Same as the parent project.