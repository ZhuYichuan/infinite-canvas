import type { ComfyuiWorkflow } from "@/stores/use-config-store";

// Local channel workflows (D:\ComfyUI, pruned/scaled fp8 for video)
import localT2iJson from "@/assets/workflows/comfyuiT2iWorkflow_api.json";
import localI2iJson from "@/assets/workflows/comfyuiI2iWorkflow_api.json";
import localInpaintJson from "@/assets/workflows/comfyuiInpaintWorkflow_api.json";
import localTextJson from "@/assets/workflows/comfyuiTextWorkflow_api.json";
import localVideoJson from "@/assets/workflows/comfyuiVideoWorkflow_api.json";
import localFrameVideoJson from "@/assets/workflows/comfyuiFrameVideoWorkflow_api.json";

// Cloud channel workflows (/root/autodl-tmp/ComfyUI, full bf16 & 8-step turbo for video)
import cloudT2iJson from "@/assets/workflows/cloud/comfyuiT2iWorkflow_api.json";
import cloudI2iJson from "@/assets/workflows/cloud/comfyuiI2iWorkflow_api.json";
import cloudInpaintJson from "@/assets/workflows/cloud/comfyuiInpaintWorkflow_api.json";
import cloudTextJson from "@/assets/workflows/cloud/comfyuiTextWorkflow_api.json";
import cloudVideoJson from "@/assets/workflows/cloud/comfyuiVideoWorkflow_api.json";
import cloudFrameVideoJson from "@/assets/workflows/cloud/comfyuiFrameVideoWorkflow_api.json";

export const DEFAULT_LOCAL_COMFYUI_T2I_WORKFLOW: ComfyuiWorkflow = {
    name: "comfyuiT2iWorkflow_api.json",
    json: localT2iJson as Record<string, unknown>,
    createdAt: 0,
};

export const DEFAULT_LOCAL_COMFYUI_I2I_WORKFLOW: ComfyuiWorkflow = {
    name: "comfyuiI2iWorkflow_api.json",
    json: localI2iJson as Record<string, unknown>,
    createdAt: 0,
};

export const DEFAULT_LOCAL_COMFYUI_INPAINT_WORKFLOW: ComfyuiWorkflow = {
    name: "comfyuiInpaintWorkflow_api.json",
    json: localInpaintJson as Record<string, unknown>,
    createdAt: 0,
};

/** Built-in fallback workflow for ComfyUI LLM text generation and visual prompt inference (Qwen-3.5 VLM). */
export const DEFAULT_LOCAL_COMFYUI_TEXT_WORKFLOW: ComfyuiWorkflow = {
    name: "comfyuiTextWorkflow_api.json",
    json: localTextJson as Record<string, unknown>,
    createdAt: 0,
};

export const DEFAULT_LOCAL_COMFYUI_VIDEO_WORKFLOW: ComfyuiWorkflow = {
    name: "comfyuiVideoWorkflow_api.json",
    json: localVideoJson as Record<string, unknown>,
    createdAt: 0,
};

export const DEFAULT_LOCAL_COMFYUI_FRAME_VIDEO_WORKFLOW: ComfyuiWorkflow = {
    name: "comfyuiFrameVideoWorkflow_api.json",
    json: localFrameVideoJson as Record<string, unknown>,
    createdAt: 0,
};

// Cloud channel workflows
export const DEFAULT_CLOUD_COMFYUI_T2I_WORKFLOW: ComfyuiWorkflow = {
    name: "comfyuiT2iWorkflow_api.json",
    json: cloudT2iJson as Record<string, unknown>,
    createdAt: 0,
};

export const DEFAULT_CLOUD_COMFYUI_I2I_WORKFLOW: ComfyuiWorkflow = {
    name: "comfyuiI2iWorkflow_api.json",
    json: cloudI2iJson as Record<string, unknown>,
    createdAt: 0,
};

export const DEFAULT_CLOUD_COMFYUI_INPAINT_WORKFLOW: ComfyuiWorkflow = {
    name: "comfyuiInpaintWorkflow_api.json",
    json: cloudInpaintJson as Record<string, unknown>,
    createdAt: 0,
};

export const DEFAULT_CLOUD_COMFYUI_TEXT_WORKFLOW: ComfyuiWorkflow = {
    name: "comfyuiTextWorkflow_api.json",
    json: cloudTextJson as Record<string, unknown>,
    createdAt: 0,
};

export const DEFAULT_CLOUD_COMFYUI_VIDEO_WORKFLOW: ComfyuiWorkflow = {
    name: "comfyuiVideoWorkflow_api.json",
    json: cloudVideoJson as Record<string, unknown>,
    createdAt: 0,
};

export const DEFAULT_CLOUD_COMFYUI_FRAME_VIDEO_WORKFLOW: ComfyuiWorkflow = {
    name: "comfyuiFrameVideoWorkflow_api.json",
    json: cloudFrameVideoJson as Record<string, unknown>,
    createdAt: 0,
};

// Default aliases (defaults to local for backward compatibility)
export const DEFAULT_COMFYUI_T2I_WORKFLOW = DEFAULT_LOCAL_COMFYUI_T2I_WORKFLOW;
export const DEFAULT_COMFYUI_I2I_WORKFLOW = DEFAULT_LOCAL_COMFYUI_I2I_WORKFLOW;
export const DEFAULT_COMFYUI_INPAINT_WORKFLOW = DEFAULT_LOCAL_COMFYUI_INPAINT_WORKFLOW;
export const DEFAULT_COMFYUI_TEXT_WORKFLOW = DEFAULT_LOCAL_COMFYUI_TEXT_WORKFLOW;
export const DEFAULT_COMFYUI_VIDEO_WORKFLOW = DEFAULT_LOCAL_COMFYUI_VIDEO_WORKFLOW;
export const DEFAULT_COMFYUI_FRAME_VIDEO_WORKFLOW = DEFAULT_LOCAL_COMFYUI_FRAME_VIDEO_WORKFLOW;

export type ComfyuiWorkflowBundle = {
    t2i: ComfyuiWorkflow;
    i2i: ComfyuiWorkflow;
    inpaint: ComfyuiWorkflow;
    text: ComfyuiWorkflow;
    video: ComfyuiWorkflow;
    frameVideo: ComfyuiWorkflow;
};

export const DEFAULT_LOCAL_COMFYUI_WORKFLOWS: ComfyuiWorkflowBundle = {
    t2i: DEFAULT_LOCAL_COMFYUI_T2I_WORKFLOW,
    i2i: DEFAULT_LOCAL_COMFYUI_I2I_WORKFLOW,
    inpaint: DEFAULT_LOCAL_COMFYUI_INPAINT_WORKFLOW,
    text: DEFAULT_LOCAL_COMFYUI_TEXT_WORKFLOW,
    video: DEFAULT_LOCAL_COMFYUI_VIDEO_WORKFLOW,
    frameVideo: DEFAULT_LOCAL_COMFYUI_FRAME_VIDEO_WORKFLOW,
};

export const DEFAULT_CLOUD_COMFYUI_WORKFLOWS: ComfyuiWorkflowBundle = {
    t2i: DEFAULT_CLOUD_COMFYUI_T2I_WORKFLOW,
    i2i: DEFAULT_CLOUD_COMFYUI_I2I_WORKFLOW,
    inpaint: DEFAULT_CLOUD_COMFYUI_INPAINT_WORKFLOW,
    text: DEFAULT_CLOUD_COMFYUI_TEXT_WORKFLOW,
    video: DEFAULT_CLOUD_COMFYUI_VIDEO_WORKFLOW,
    frameVideo: DEFAULT_CLOUD_COMFYUI_FRAME_VIDEO_WORKFLOW,
};

export function getDefaultComfyuiWorkflows(channel?: { id?: string; name?: string } | null): ComfyuiWorkflowBundle {
    const isCloud = channel?.id === "cloud" || (channel?.name ? channel.name.includes("云端") : false);
    return isCloud ? DEFAULT_CLOUD_COMFYUI_WORKFLOWS : DEFAULT_LOCAL_COMFYUI_WORKFLOWS;
}
