import type { ComfyuiWorkflow, ComfyWorkflowItem } from "@/stores/use-config-store";

// Builtin channel workflows (unified for local and cloud ComfyUI instances)
import t2iZImageTurboJson from "@/assets/workflows/t2i_z_image_turbo_api.json";
import i2iFlux2DevJson from "@/assets/workflows/i2i_flux2_dev_api.json";
import inpaintQwenImageJson from "@/assets/workflows/inpaint_qwen_image_api.json";
import textQwen35Json from "@/assets/workflows/text_qwen3_5_api.json";
import omniVideoFp8Json from "@/assets/workflows/video_minimax_h3_omni_fp8_20step_api.json";
import omniVideoFp84StepPdmdJson from "@/assets/workflows/video_minimax_h3_omni_fp8_4step_pdmd_api.json";
import omniVideoBf16TurboJson from "@/assets/workflows/video_minimax_h3_omni_bf16_8step_turbo_api.json";
import omniVideoBf1620StepJson from "@/assets/workflows/video_minimax_h3_omni_bf16_20step_api.json";
import frameVideoFp8Json from "@/assets/workflows/video_minimax_h3_frame_fp8_20step_api.json";
import frameVideoFp84StepPdmdJson from "@/assets/workflows/video_minimax_h3_frame_fp8_4step_pdmd_api.json";
import frameVideoBf16TurboJson from "@/assets/workflows/video_minimax_h3_frame_bf16_8step_turbo_api.json";
import frameVideoBf1620StepJson from "@/assets/workflows/video_minimax_h3_frame_bf16_20step_api.json";
import qwenImage21Json from "@/assets/workflows/qwen_image_21_api.json";
import qwenImage21Int8Json from "@/assets/workflows/qwen_image_21_int8_api.json";
import audioMinimaxMusic3Json from "@/assets/workflows/audio_minimax_music_3_api.json";
import videoH3FaceRefineJson from "@/assets/workflows/video_h3_face_refine_api.json";
import videoDepthReshotJson from "@/assets/workflows/video_depth_reshot_api.json";

// Built-in single workflow definitions
export const DEFAULT_BUILTIN_COMFYUI_DEPTH_VIDEO_WORKFLOW: ComfyuiWorkflow = {
    name: "ReShot 深度视频提取",
    json: videoDepthReshotJson as Record<string, unknown>,
    createdAt: 0,
    isBuiltin: true,
};
export const DEFAULT_BUILTIN_COMFYUI_FACE_REFINE_WORKFLOW: ComfyuiWorkflow = {
    name: "MiniMax H3 人脸修复",
    json: videoH3FaceRefineJson as Record<string, unknown>,
    createdAt: 0,
    isBuiltin: true,
};
export const DEFAULT_BUILTIN_COMFYUI_QWEN_IMAGE_21_WORKFLOW: ComfyuiWorkflow = {
    name: "Qwen-Image-2.1 全能生图",
    json: qwenImage21Json as Record<string, unknown>,
    createdAt: 0,
    isBuiltin: true,
};
export const DEFAULT_BUILTIN_COMFYUI_QWEN_IMAGE_21_INT8_WORKFLOW: ComfyuiWorkflow = {
    name: "Qwen-Image-2.1 全能生图 (Int8)",
    json: qwenImage21Int8Json as Record<string, unknown>,
    createdAt: 0,
    isBuiltin: true,
};
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

export const DEFAULT_BUILTIN_COMFYUI_VIDEO_20STEP_WORKFLOW: ComfyuiWorkflow = {
    name: "MiniMax H3 全能参考 (FP8 20步)",
    json: omniVideoFp8Json as Record<string, unknown>,
    createdAt: 0,
    isBuiltin: true,
};

export const DEFAULT_BUILTIN_COMFYUI_VIDEO_PDMD_WORKFLOW: ComfyuiWorkflow = {
    name: "MiniMax H3 全能视频 (FP8 4步 PDMD)",
    json: omniVideoFp84StepPdmdJson as Record<string, unknown>,
    createdAt: 0,
    isBuiltin: true,
};

export const DEFAULT_BUILTIN_COMFYUI_VIDEO_WORKFLOW: ComfyuiWorkflow = DEFAULT_BUILTIN_COMFYUI_VIDEO_PDMD_WORKFLOW;

export const DEFAULT_BUILTIN_COMFYUI_VIDEO_TURBO_WORKFLOW: ComfyuiWorkflow = {
    name: "MiniMax H3 全能参考 (BF16 8步极速)",
    json: omniVideoBf16TurboJson as Record<string, unknown>,
    createdAt: 0,
    isBuiltin: true,
};

export const DEFAULT_BUILTIN_COMFYUI_VIDEO_BF16_20STEP_WORKFLOW: ComfyuiWorkflow = {
    name: "MiniMax H3 全能参考 (BF16 20步)",
    json: omniVideoBf1620StepJson as Record<string, unknown>,
    createdAt: 0,
    isBuiltin: true,
};

export const DEFAULT_BUILTIN_COMFYUI_FRAME_VIDEO_20STEP_WORKFLOW: ComfyuiWorkflow = {
    name: "MiniMax H3 首尾帧 (FP8 20步)",
    json: frameVideoFp8Json as Record<string, unknown>,
    createdAt: 0,
    isBuiltin: true,
};

export const DEFAULT_BUILTIN_COMFYUI_FRAME_VIDEO_PDMD_WORKFLOW: ComfyuiWorkflow = {
    name: "MiniMax H3 首尾帧视频 (FP8 4步 PDMD)",
    json: frameVideoFp84StepPdmdJson as Record<string, unknown>,
    createdAt: 0,
    isBuiltin: true,
};

export const DEFAULT_BUILTIN_COMFYUI_FRAME_VIDEO_WORKFLOW: ComfyuiWorkflow = DEFAULT_BUILTIN_COMFYUI_FRAME_VIDEO_PDMD_WORKFLOW;

export const DEFAULT_BUILTIN_COMFYUI_FRAME_VIDEO_TURBO_WORKFLOW: ComfyuiWorkflow = {
    name: "MiniMax H3 首尾帧 (BF16 8步极速)",
    json: frameVideoBf16TurboJson as Record<string, unknown>,
    createdAt: 0,
    isBuiltin: true,
};

export const DEFAULT_BUILTIN_COMFYUI_FRAME_VIDEO_BF16_20STEP_WORKFLOW: ComfyuiWorkflow = {
    name: "MiniMax H3 首尾帧 (BF16 20步)",
    json: frameVideoBf1620StepJson as Record<string, unknown>,
    createdAt: 0,
    isBuiltin: true,
};

export const DEFAULT_BUILTIN_COMFYUI_AUDIO_WORKFLOW: ComfyuiWorkflow = {
    name: "MiniMax Music 03 音乐生成",
    json: audioMinimaxMusic3Json as Record<string, unknown>,
    createdAt: 0,
    isBuiltin: true,
};

// Aliases for unified ComfyUI workflows
export const DEFAULT_COMFYUI_T2I_WORKFLOW = DEFAULT_BUILTIN_COMFYUI_QWEN_IMAGE_21_WORKFLOW;
export const DEFAULT_COMFYUI_I2I_WORKFLOW = DEFAULT_BUILTIN_COMFYUI_QWEN_IMAGE_21_WORKFLOW;
export const DEFAULT_COMFYUI_INPAINT_WORKFLOW = DEFAULT_BUILTIN_COMFYUI_INPAINT_WORKFLOW;
export const DEFAULT_COMFYUI_TEXT_WORKFLOW = DEFAULT_BUILTIN_COMFYUI_TEXT_WORKFLOW;
export const DEFAULT_COMFYUI_VIDEO_WORKFLOW = DEFAULT_BUILTIN_COMFYUI_VIDEO_WORKFLOW;
export const DEFAULT_COMFYUI_VIDEO_PDMD_WORKFLOW = DEFAULT_BUILTIN_COMFYUI_VIDEO_PDMD_WORKFLOW;
export const DEFAULT_COMFYUI_FRAME_VIDEO_WORKFLOW = DEFAULT_BUILTIN_COMFYUI_FRAME_VIDEO_WORKFLOW;
export const DEFAULT_COMFYUI_FRAME_VIDEO_PDMD_WORKFLOW = DEFAULT_BUILTIN_COMFYUI_FRAME_VIDEO_PDMD_WORKFLOW;
export const DEFAULT_COMFYUI_AUDIO_WORKFLOW = DEFAULT_BUILTIN_COMFYUI_AUDIO_WORKFLOW;
export const DEFAULT_COMFYUI_FACE_REFINE_WORKFLOW = DEFAULT_BUILTIN_COMFYUI_FACE_REFINE_WORKFLOW;

/**
 * 根据模型 Profile ID 匹配精准对齐的系统内置工作流模板
 */
export function getWorkflowForModelProfile(modelId?: string): ComfyuiWorkflow | undefined {
    if (!modelId) return undefined;
    switch (modelId) {
        case "omni-video-minimax-h3-fp8-4step-pdmd":
        case "video_minimax_h3_omni":
            return DEFAULT_BUILTIN_COMFYUI_VIDEO_PDMD_WORKFLOW;
        case "omni-video-minimax-h3-fp8":
            return DEFAULT_BUILTIN_COMFYUI_VIDEO_20STEP_WORKFLOW;
        case "frame-video-minimax-h3-fp8-4step-pdmd":
        case "video_minimax_h3_frame":
            return DEFAULT_BUILTIN_COMFYUI_FRAME_VIDEO_PDMD_WORKFLOW;
        case "frame-video-minimax-h3-fp8":
            return DEFAULT_BUILTIN_COMFYUI_FRAME_VIDEO_20STEP_WORKFLOW;
        default:
            return undefined;
    }
}

// Backward-compatible local aliases
export const DEFAULT_LOCAL_COMFYUI_T2I_WORKFLOW = DEFAULT_BUILTIN_COMFYUI_QWEN_IMAGE_21_WORKFLOW;
export const DEFAULT_LOCAL_COMFYUI_I2I_WORKFLOW = DEFAULT_BUILTIN_COMFYUI_QWEN_IMAGE_21_WORKFLOW;
export const DEFAULT_LOCAL_COMFYUI_INPAINT_WORKFLOW = DEFAULT_BUILTIN_COMFYUI_INPAINT_WORKFLOW;
export const DEFAULT_LOCAL_COMFYUI_TEXT_WORKFLOW = DEFAULT_BUILTIN_COMFYUI_TEXT_WORKFLOW;
export const DEFAULT_LOCAL_COMFYUI_VIDEO_WORKFLOW = DEFAULT_BUILTIN_COMFYUI_VIDEO_WORKFLOW;
export const DEFAULT_LOCAL_COMFYUI_FRAME_VIDEO_WORKFLOW = DEFAULT_BUILTIN_COMFYUI_FRAME_VIDEO_WORKFLOW;

// Backward-compatible cloud aliases
export const DEFAULT_CLOUD_COMFYUI_T2I_WORKFLOW = DEFAULT_BUILTIN_COMFYUI_QWEN_IMAGE_21_WORKFLOW;
export const DEFAULT_CLOUD_COMFYUI_I2I_WORKFLOW = DEFAULT_BUILTIN_COMFYUI_QWEN_IMAGE_21_WORKFLOW;
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
    audio: ComfyuiWorkflow;
    faceRefine?: ComfyuiWorkflow;
    depthVideo?: ComfyuiWorkflow;
};

export const DEFAULT_BUILTIN_COMFYUI_WORKFLOWS: ComfyuiWorkflowBundle = {
    t2i: DEFAULT_BUILTIN_COMFYUI_QWEN_IMAGE_21_WORKFLOW,
    i2i: DEFAULT_BUILTIN_COMFYUI_QWEN_IMAGE_21_WORKFLOW,
    inpaint: DEFAULT_BUILTIN_COMFYUI_INPAINT_WORKFLOW,
    text: DEFAULT_BUILTIN_COMFYUI_TEXT_WORKFLOW,
    video: DEFAULT_BUILTIN_COMFYUI_VIDEO_WORKFLOW,
    frameVideo: DEFAULT_BUILTIN_COMFYUI_FRAME_VIDEO_WORKFLOW,
    audio: DEFAULT_BUILTIN_COMFYUI_AUDIO_WORKFLOW,
    faceRefine: DEFAULT_BUILTIN_COMFYUI_FACE_REFINE_WORKFLOW,
    depthVideo: DEFAULT_BUILTIN_COMFYUI_DEPTH_VIDEO_WORKFLOW,
};

export const DEFAULT_LOCAL_COMFYUI_WORKFLOWS = DEFAULT_BUILTIN_COMFYUI_WORKFLOWS;
export const DEFAULT_CLOUD_COMFYUI_WORKFLOWS: ComfyuiWorkflowBundle = {
    ...DEFAULT_BUILTIN_COMFYUI_WORKFLOWS,
    video: DEFAULT_BUILTIN_COMFYUI_VIDEO_PDMD_WORKFLOW,
    frameVideo: DEFAULT_BUILTIN_COMFYUI_FRAME_VIDEO_PDMD_WORKFLOW,
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
            id: `${prefix}-t2i-qwen-image-21`,
            name: "Qwen-Image-2.1 文生图",
            category: "t2i",
            json: DEFAULT_BUILTIN_COMFYUI_QWEN_IMAGE_21_WORKFLOW.json,
            createdAt: 0,
            isBuiltin: true,
            isDefault: true,
            description: "Qwen-Image-2.1 大模型文生图工作流 (BF16，支持多模态理解与超写实画质)",
        },
        {
            id: `${prefix}-t2i-qwen-image-21-int8`,
            name: "Qwen-Image-2.1 文生图 (Int8)",
            category: "t2i",
            json: DEFAULT_BUILTIN_COMFYUI_QWEN_IMAGE_21_INT8_WORKFLOW.json,
            createdAt: 0,
            isBuiltin: true,
            isDefault: false,
            description: "Qwen-Image-2.1 大模型文生图工作流 (Int8 量化版，低显存占用与更快推理)",
        },
        {
            id: `${prefix}-t2i-z-image-turbo`,
            name: "Z-Image-Turbo 文生图",
            category: "t2i",
            json: DEFAULT_BUILTIN_COMFYUI_T2I_WORKFLOW.json,
            createdAt: 0,
            isBuiltin: true,
            isDefault: false,
            description: "Z-Image-Turbo 极速文生图工作流 (BF16，4~8步出图)",
        },
        {
            id: `${prefix}-i2i-qwen-image-21`,
            name: "Qwen-Image-2.1 多图参考图生图",
            category: "i2i",
            json: DEFAULT_BUILTIN_COMFYUI_QWEN_IMAGE_21_WORKFLOW.json,
            createdAt: 0,
            isBuiltin: true,
            isDefault: true,
            description: "Qwen-Image-2.1 多图融合与风格迁移工作流 (支持最多 10 张参考图)",
        },
        {
            id: `${prefix}-i2i-qwen-image-21-int8`,
            name: "Qwen-Image-2.1 多图参考图生图 (Int8)",
            category: "i2i",
            json: DEFAULT_BUILTIN_COMFYUI_QWEN_IMAGE_21_INT8_WORKFLOW.json,
            createdAt: 0,
            isBuiltin: true,
            isDefault: false,
            description: "Qwen-Image-2.1 多图融合与风格迁移工作流 (Int8 量化版，支持最多 10 张参考图)",
        },
        {
            id: `${prefix}-i2i-flux2-dev`,
            name: "Flux2.Dev 图生图",
            category: "i2i",
            json: DEFAULT_BUILTIN_COMFYUI_I2I_WORKFLOW.json,
            createdAt: 0,
            isBuiltin: true,
            isDefault: false,
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
            id: `${prefix}-omni-video-minimax-h3-fp8-4step-pdmd`,
            name: "MiniMax H3 全能 (FP8 4步 PDMD)",
            category: "omniVideo",
            json: DEFAULT_BUILTIN_COMFYUI_VIDEO_PDMD_WORKFLOW.json,
            createdAt: 0,
            isBuiltin: true,
            isDefault: true,
            description: "MiniMax H3 全能参考视频极速版 (FP8 4步 PDMD, 集成 EasyCache 特征缓存)",
        },
        {
            id: `${prefix}-omni-video-minimax-h3-fp8`,
            name: "MiniMax H3 全能 (FP8 20步)",
            category: "omniVideo",
            json: DEFAULT_BUILTIN_COMFYUI_VIDEO_20STEP_WORKFLOW.json,
            createdAt: 0,
            isBuiltin: true,
            isDefault: false,
            description: "MiniMax H3 全能参考视频 (FP8 Scaled, 适合消费级单卡)",
        },
        {
            id: `${prefix}-frame-video-minimax-h3-fp8-4step-pdmd`,
            name: "MiniMax H3 首尾帧 (FP8 4步 PDMD)",
            category: "frameVideo",
            json: DEFAULT_BUILTIN_COMFYUI_FRAME_VIDEO_PDMD_WORKFLOW.json,
            createdAt: 0,
            isBuiltin: true,
            isDefault: true,
            description: "MiniMax H3 首尾帧插值视频极速版 (FP8 4步 PDMD, 仅需 4 步极速出片)",
        },
        {
            id: `${prefix}-frame-video-minimax-h3-fp8`,
            name: "MiniMax H3 首尾帧 (FP8 20步)",
            category: "frameVideo",
            json: DEFAULT_BUILTIN_COMFYUI_FRAME_VIDEO_20STEP_WORKFLOW.json,
            createdAt: 0,
            isBuiltin: true,
            isDefault: false,
            description: "MiniMax H3 首尾帧插值视频 (FP8 Scaled, 适合消费级单卡)",
        },
        {
            id: `${prefix}-audio-minimax-music-3`,
            name: "MiniMax Music 03 音乐生成",
            category: "audio",
            json: DEFAULT_BUILTIN_COMFYUI_AUDIO_WORKFLOW.json,
            createdAt: 0,
            isBuiltin: true,
            isDefault: true,
            description: "MiniMax Music 03 扩散音乐大模型 (支持最长 5 分钟完整歌曲与纯伴奏)",
        },
        {
            id: `${prefix}-tool-face-refine-h3`,
            name: "MiniMax H3 人脸修复",
            category: "faceRefine",
            json: DEFAULT_BUILTIN_COMFYUI_FACE_REFINE_WORKFLOW.json,
            createdAt: 0,
            isBuiltin: true,
            isDefault: true,
            description: "MiniMax H3 视频人脸/小脸追踪精修工作流 (支持最多 9 张角色参考图与原视频局部脸部增强)",
        },
        {
            id: `${prefix}-tool-depth-video-reshot`,
            name: "ReShot 深度视频提取",
            category: "depthVideo",
            json: DEFAULT_BUILTIN_COMFYUI_DEPTH_VIDEO_WORKFLOW.json,
            createdAt: 0,
            isBuiltin: true,
            isDefault: true,
            description: "ReShot 单目视频时序连续深度估计工作流 (近白远黑深度视频，用于剥离演员与画风生成走位参考)",
        },
    ];
}
