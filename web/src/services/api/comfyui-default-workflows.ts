import type { ComfyuiWorkflow, ComfyWorkflowItem } from "@/stores/use-config-store";

// Builtin channel workflows (unified for local and cloud ComfyUI instances)
import t2iZImageTurboJson from "@/assets/workflows/t2i_z_image_turbo_api.json";
import i2iFlux2DevJson from "@/assets/workflows/i2i_flux2_dev_api.json";
import inpaintQwenImageJson from "@/assets/workflows/inpaint_qwen_image_api.json";
import textQwen35Json from "@/assets/workflows/text_qwen3_5_api.json";
import omniVideoFp8Json from "@/assets/workflows/video_minimax_h3_omni_fp8_20step_api.json";
import omniVideoBf16TurboJson from "@/assets/workflows/video_minimax_h3_omni_bf16_8step_turbo_api.json";
import frameVideoFp8Json from "@/assets/workflows/video_minimax_h3_frame_fp8_20step_api.json";
import frameVideoBf16TurboJson from "@/assets/workflows/video_minimax_h3_frame_bf16_8step_turbo_api.json";

// Built-in single workflow definitions
export const DEFAULT_BUILTIN_COMFYUI_T2I_WORKFLOW: ComfyuiWorkflow = {
    name: "Z-Image-Turbo 文生图",
    json: t2iZImageTurboJson as Record<string, unknown>,
    createdAt: 0,
    isBuiltin: true,
};

export const DEFAULT_BUILTIN_COMFYUI_I2I_WORKFLOW: ComfyuiWorkflow = {
    name: "Flux2.Dev 图生图",
    json: i2iFlux2DevJson as Record<string, unknown>,
    createdAt: 0,
    isBuiltin: true,
};

export const DEFAULT_BUILTIN_COMFYUI_INPAINT_WORKFLOW: ComfyuiWorkflow = {
    name: "Qwen-Image 局部编辑",
    json: inpaintQwenImageJson as Record<string, unknown>,
    createdAt: 0,
    isBuiltin: true,
};

export const DEFAULT_BUILTIN_COMFYUI_TEXT_WORKFLOW: ComfyuiWorkflow = {
    name: "Qwen-3.5 文本生成/反推",
    json: textQwen35Json as Record<string, unknown>,
    createdAt: 0,
    isBuiltin: true,
};

export const DEFAULT_BUILTIN_COMFYUI_VIDEO_WORKFLOW: ComfyuiWorkflow = {
    name: "MiniMax H3 全能参考 (FP8 20步)",
    json: omniVideoFp8Json as Record<string, unknown>,
    createdAt: 0,
    isBuiltin: true,
};

export const DEFAULT_BUILTIN_COMFYUI_VIDEO_TURBO_WORKFLOW: ComfyuiWorkflow = {
    name: "MiniMax H3 全能参考 (BF16 8步极速)",
    json: omniVideoBf16TurboJson as Record<string, unknown>,
    createdAt: 0,
    isBuiltin: true,
};

export const DEFAULT_BUILTIN_COMFYUI_FRAME_VIDEO_WORKFLOW: ComfyuiWorkflow = {
    name: "MiniMax H3 首尾帧 (FP8 20步)",
    json: frameVideoFp8Json as Record<string, unknown>,
    createdAt: 0,
    isBuiltin: true,
};

export const DEFAULT_BUILTIN_COMFYUI_FRAME_VIDEO_TURBO_WORKFLOW: ComfyuiWorkflow = {
    name: "MiniMax H3 首尾帧 (BF16 8步极速)",
    json: frameVideoBf16TurboJson as Record<string, unknown>,
    createdAt: 0,
    isBuiltin: true,
};

// Aliases for unified ComfyUI workflows
export const DEFAULT_COMFYUI_T2I_WORKFLOW = DEFAULT_BUILTIN_COMFYUI_T2I_WORKFLOW;
export const DEFAULT_COMFYUI_I2I_WORKFLOW = DEFAULT_BUILTIN_COMFYUI_I2I_WORKFLOW;
export const DEFAULT_COMFYUI_INPAINT_WORKFLOW = DEFAULT_BUILTIN_COMFYUI_INPAINT_WORKFLOW;
export const DEFAULT_COMFYUI_TEXT_WORKFLOW = DEFAULT_BUILTIN_COMFYUI_TEXT_WORKFLOW;
export const DEFAULT_COMFYUI_VIDEO_WORKFLOW = DEFAULT_BUILTIN_COMFYUI_VIDEO_WORKFLOW;
export const DEFAULT_COMFYUI_FRAME_VIDEO_WORKFLOW = DEFAULT_BUILTIN_COMFYUI_FRAME_VIDEO_WORKFLOW;

// Backward-compatible local aliases
export const DEFAULT_LOCAL_COMFYUI_T2I_WORKFLOW = DEFAULT_BUILTIN_COMFYUI_T2I_WORKFLOW;
export const DEFAULT_LOCAL_COMFYUI_I2I_WORKFLOW = DEFAULT_BUILTIN_COMFYUI_I2I_WORKFLOW;
export const DEFAULT_LOCAL_COMFYUI_INPAINT_WORKFLOW = DEFAULT_BUILTIN_COMFYUI_INPAINT_WORKFLOW;
export const DEFAULT_LOCAL_COMFYUI_TEXT_WORKFLOW = DEFAULT_BUILTIN_COMFYUI_TEXT_WORKFLOW;
export const DEFAULT_LOCAL_COMFYUI_VIDEO_WORKFLOW = DEFAULT_BUILTIN_COMFYUI_VIDEO_WORKFLOW;
export const DEFAULT_LOCAL_COMFYUI_FRAME_VIDEO_WORKFLOW = DEFAULT_BUILTIN_COMFYUI_FRAME_VIDEO_WORKFLOW;

// Backward-compatible cloud aliases
export const DEFAULT_CLOUD_COMFYUI_T2I_WORKFLOW = DEFAULT_BUILTIN_COMFYUI_T2I_WORKFLOW;
export const DEFAULT_CLOUD_COMFYUI_I2I_WORKFLOW = DEFAULT_BUILTIN_COMFYUI_I2I_WORKFLOW;
export const DEFAULT_CLOUD_COMFYUI_INPAINT_WORKFLOW = DEFAULT_BUILTIN_COMFYUI_INPAINT_WORKFLOW;
export const DEFAULT_CLOUD_COMFYUI_TEXT_WORKFLOW = DEFAULT_BUILTIN_COMFYUI_TEXT_WORKFLOW;
export const DEFAULT_CLOUD_COMFYUI_VIDEO_WORKFLOW = DEFAULT_BUILTIN_COMFYUI_VIDEO_TURBO_WORKFLOW;
export const DEFAULT_CLOUD_COMFYUI_FRAME_VIDEO_WORKFLOW = DEFAULT_BUILTIN_COMFYUI_FRAME_VIDEO_TURBO_WORKFLOW;

export type ComfyuiWorkflowBundle = {
    t2i: ComfyuiWorkflow;
    i2i: ComfyuiWorkflow;
    inpaint: ComfyuiWorkflow;
    text: ComfyuiWorkflow;
    video: ComfyuiWorkflow;
    frameVideo: ComfyuiWorkflow;
};

export const DEFAULT_BUILTIN_COMFYUI_WORKFLOWS: ComfyuiWorkflowBundle = {
    t2i: DEFAULT_BUILTIN_COMFYUI_T2I_WORKFLOW,
    i2i: DEFAULT_BUILTIN_COMFYUI_I2I_WORKFLOW,
    inpaint: DEFAULT_BUILTIN_COMFYUI_INPAINT_WORKFLOW,
    text: DEFAULT_BUILTIN_COMFYUI_TEXT_WORKFLOW,
    video: DEFAULT_BUILTIN_COMFYUI_VIDEO_WORKFLOW,
    frameVideo: DEFAULT_BUILTIN_COMFYUI_FRAME_VIDEO_WORKFLOW,
};

export const DEFAULT_LOCAL_COMFYUI_WORKFLOWS = DEFAULT_BUILTIN_COMFYUI_WORKFLOWS;
export const DEFAULT_CLOUD_COMFYUI_WORKFLOWS: ComfyuiWorkflowBundle = {
    ...DEFAULT_BUILTIN_COMFYUI_WORKFLOWS,
    video: DEFAULT_BUILTIN_COMFYUI_VIDEO_TURBO_WORKFLOW,
    frameVideo: DEFAULT_BUILTIN_COMFYUI_FRAME_VIDEO_TURBO_WORKFLOW,
};

export function getDefaultComfyuiWorkflows(channel?: { id?: string; name?: string } | null): ComfyuiWorkflowBundle {
    const isCloud = channel?.id === "cloud" || (channel?.name ? channel.name.includes("云端") : false);
    return isCloud ? DEFAULT_CLOUD_COMFYUI_WORKFLOWS : DEFAULT_BUILTIN_COMFYUI_WORKFLOWS;
}

/**
 * Returns all built-in workflows for the unified ComfyUI channel.
 * Each category provides official models with accurate titles, specifications, and descriptions.
 */
export function getDefaultComfyWorkflowItems(channel?: { id?: string; name?: string } | null): ComfyWorkflowItem[] {
    const prefix = channel?.id || "builtin";
    return [
        {
            id: `${prefix}-t2i-z-image-turbo`,
            name: "Z-Image-Turbo 文生图",
            category: "t2i",
            json: DEFAULT_BUILTIN_COMFYUI_T2I_WORKFLOW.json,
            createdAt: 0,
            isBuiltin: true,
            isDefault: true,
            description: "Z-Image-Turbo 极速文生图工作流 (BF16，4~8步出图)",
        },
        {
            id: `${prefix}-i2i-flux2-dev`,
            name: "Flux2.Dev 图生图",
            category: "i2i",
            json: DEFAULT_BUILTIN_COMFYUI_I2I_WORKFLOW.json,
            createdAt: 0,
            isBuiltin: true,
            isDefault: true,
            description: "Flux2.Dev 多图参考与风格迁移工作流 (FP8 + Turbo LoRA)",
        },
        {
            id: `${prefix}-inpaint-qwen-image`,
            name: "Qwen-Image 局部编辑",
            category: "inpaint",
            json: DEFAULT_BUILTIN_COMFYUI_INPAINT_WORKFLOW.json,
            createdAt: 0,
            isBuiltin: true,
            isDefault: true,
            description: "Qwen-Image 视觉语言引导局部精准重绘工作流 (4步 Lightning)",
        },
        {
            id: `${prefix}-text-qwen3-5`,
            name: "Qwen3.5 文本生成与反推",
            category: "text",
            json: DEFAULT_BUILTIN_COMFYUI_TEXT_WORKFLOW.json,
            createdAt: 0,
            isBuiltin: true,
            isDefault: true,
            description: "Qwen3.5 4B 本地端侧提示词扩写与视觉反推工作流",
        },
        {
            id: `${prefix}-omni-video-minimax-h3-fp8`,
            name: "MiniMax H3 全能视频 (FP8 20步)",
            category: "omniVideo",
            json: DEFAULT_BUILTIN_COMFYUI_VIDEO_WORKFLOW.json,
            createdAt: 0,
            isBuiltin: true,
            isDefault: true,
            description: "MiniMax H3 全能参考视频 (FP8 Scaled, 适合消费级单卡)",
        },
        {
            id: `${prefix}-omni-video-minimax-h3-bf16-turbo`,
            name: "MiniMax H3 全能视频 (BF16 8步 Turbo)",
            category: "omniVideo",
            json: DEFAULT_BUILTIN_COMFYUI_VIDEO_TURBO_WORKFLOW.json,
            createdAt: 0,
            isBuiltin: true,
            isDefault: false,
            description: "MiniMax H3 全能参考视频极速版 (BF16 Turbo 8步, 适合大显存高性能显卡)",
        },
        {
            id: `${prefix}-frame-video-minimax-h3-fp8`,
            name: "MiniMax H3 首尾帧视频 (FP8 20步)",
            category: "frameVideo",
            json: DEFAULT_BUILTIN_COMFYUI_FRAME_VIDEO_WORKFLOW.json,
            createdAt: 0,
            isBuiltin: true,
            isDefault: true,
            description: "MiniMax H3 首尾帧插值视频 (FP8 Scaled, 适合消费级单卡)",
        },
        {
            id: `${prefix}-frame-video-minimax-h3-bf16-turbo`,
            name: "MiniMax H3 首尾帧视频 (BF16 8步 Turbo)",
            category: "frameVideo",
            json: DEFAULT_BUILTIN_COMFYUI_FRAME_VIDEO_TURBO_WORKFLOW.json,
            createdAt: 0,
            isBuiltin: true,
            isDefault: false,
            description: "MiniMax H3 首尾帧插值视频极速版 (BF16 Turbo 8步, 适合大显存高性能显卡)",
        },
    ];
}
