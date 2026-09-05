import type { ComfyuiWorkflow } from "@/stores/use-config-store";

import t2iJson from "@/assets/workflows/comfyuiT2iWorkflow_api.json";
import i2iJson from "@/assets/workflows/comfyuiI2iWorkflow_api.json";
import inpaintJson from "@/assets/workflows/comfyuiInpaintWorkflow_api.json";
import textJson from "@/assets/workflows/comfyuiTextWorkflow_api.json";
import videoJson from "@/assets/workflows/comfyuiVideoWorkflow_api.json";
import frameVideoJson from "@/assets/workflows/comfyuiFrameVideoWorkflow_api.json";

export const DEFAULT_COMFYUI_T2I_WORKFLOW: ComfyuiWorkflow = {
    name: "comfyuiT2iWorkflow_api.json",
    json: t2iJson as Record<string, unknown>,
    createdAt: 0,
};

export const DEFAULT_COMFYUI_I2I_WORKFLOW: ComfyuiWorkflow = {
    name: "comfyuiI2iWorkflow_api.json",
    json: i2iJson as Record<string, unknown>,
    createdAt: 0,
};

export const DEFAULT_COMFYUI_INPAINT_WORKFLOW: ComfyuiWorkflow = {
    name: "comfyuiInpaintWorkflow_api.json",
    json: inpaintJson as Record<string, unknown>,
    createdAt: 0,
};

/** Built-in fallback workflow for ComfyUI LLM text generation and visual prompt inference (Qwen-3.5 VLM). */
export const DEFAULT_COMFYUI_TEXT_WORKFLOW: ComfyuiWorkflow = {
    name: "comfyuiTextWorkflow_api.json",
    json: textJson as Record<string, unknown>,
    createdAt: 0,
};

export const DEFAULT_COMFYUI_VIDEO_WORKFLOW: ComfyuiWorkflow = {
    name: "comfyuiVideoWorkflow_api.json",
    json: videoJson as Record<string, unknown>,
    createdAt: 0,
};

export const DEFAULT_COMFYUI_FRAME_VIDEO_WORKFLOW: ComfyuiWorkflow = {
    name: "comfyuiFrameVideoWorkflow_api.json",
    json: frameVideoJson as Record<string, unknown>,
    createdAt: 0,
};
