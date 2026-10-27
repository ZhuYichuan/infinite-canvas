export interface WorkflowReferencesConfig {
    promptMaxChars?: number;
    minImages?: number;
    maxImages?: number;
    maskSupported?: boolean;
    minVideos?: number;
    maxVideos?: number;
    maxAudios?: number;
}

export interface WorkflowSizeConfig {
    parameter: "size" | "aspect_ratio";
    values: string[];
    default: string;
    allowCustom: boolean;
}

export interface WorkflowDurationConfig {
    selection: "range" | "enum";
    min?: number;
    max?: number;
    step?: number;
    tags?: number[];
    default: number;
}

export type VideoVramTier = "8GB" | "16GB" | "24GB" | "32GB";

export interface WorkflowVramConfig {
    tier: VideoVramTier;
    recommendedDuration: {
        min: number;
        max: number;
        description: string;
    };
}

export interface WorkflowCapabilityConfig {
    version: 1;
    references: WorkflowReferencesConfig;
    size?: WorkflowSizeConfig;
    duration?: WorkflowDurationConfig;
    vram?: WorkflowVramConfig;
    features?: Record<string, { supported: boolean; default?: boolean }>;
}

export type ModelCapabilityType = "image" | "video" | "audio" | "text";

export type ModelCategoryType =
    | "omniVideo"
    | "frameVideo"
    | "t2i"
    | "i2i"
    | "inpaint"
    | "text"
    | "audio"
    | "faceRefine"
    | "depthVideo"
    | "superResolve"
    | "angle"
    | "upscale";

export interface WorkflowModelProfile {
    id: string;
    name: string;
    capability: ModelCapabilityType;
    protocol: "comfyui";
    category: ModelCategoryType;
    steps?: number;
    precision?: "fp8" | "bf16";
    vramTier?: VideoVramTier;
    capabilityConfig: WorkflowCapabilityConfig;
    slotMapping: Record<string, string>;
    description?: string;
}
