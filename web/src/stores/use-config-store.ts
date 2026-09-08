import { useMemo } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { nanoid } from "nanoid";

import {
    DEFAULT_COMFYUI_FRAME_VIDEO_WORKFLOW,
    DEFAULT_COMFYUI_I2I_WORKFLOW,
    DEFAULT_COMFYUI_INPAINT_WORKFLOW,
    DEFAULT_COMFYUI_T2I_WORKFLOW,
    DEFAULT_COMFYUI_TEXT_WORKFLOW,
    DEFAULT_COMFYUI_VIDEO_WORKFLOW,
} from "@/services/api/comfyui-default-workflows";
import i18n from "@/i18n";

export type ApiCallFormat = "openai" | "gemini" | "comfyui";
export type ModelCapability = "image" | "video" | "text" | "audio";
export type ReasoningEffort = "auto" | "low" | "medium" | "high" | "xhigh";

export type ComfyuiWorkflow = {
    name: string;
    json: Record<string, unknown>;
    createdAt: number;
};

export type ChannelModel = {
    name: string;
    capability: ModelCapability;
    script?: string;
    comfyuiWorkflow?: ComfyuiWorkflow;
};

export type ModelChannel = {
    id: string;
    name: string;
    baseUrl: string;
    apiKey: string;
    apiFormat: ApiCallFormat;
    models: ChannelModel[];
    comfyuiProxyUrl?: string;
    comfyuiProxyToken?: string;
    comfyuiT2iWorkflow?: ComfyuiWorkflow;
    comfyuiI2iWorkflow?: ComfyuiWorkflow;
    comfyuiInpaintWorkflow?: ComfyuiWorkflow;
    comfyuiTextWorkflow?: ComfyuiWorkflow;
    comfyuiVideoWorkflow?: ComfyuiWorkflow;
    comfyuiFrameVideoWorkflow?: ComfyuiWorkflow;
};

export type AiConfig = {
    channelMode: "remote" | "local";
    baseUrl: string;
    apiKey: string;
    apiFormat: ApiCallFormat;
    channels: ModelChannel[];
    model: string;
    imageModel: string;
    videoModel: string;
    textModel: string;
    audioModel: string;
    audioVoice: string;
    audioFormat: string;
    audioSpeed: string;
    audioInstructions: string;
    videoSeconds: string;
    videoMode: string;
    vquality: string;
    videoGenerateAudio: string;
    videoWatermark: string;
    systemPrompt: string;
    reasoningEffort: ReasoningEffort;
    models: string[];
    quality: string;
    size: string;
    background: string;
    count: string;
    canvasImageCount: string;
};

export type WebdavSyncConfig = {
    url: string;
    username: string;
    password: string;
    directory: string;
    lastSyncedAt: string;
};
export type ConfigTabKey = "channels" | "preferences" | "prompt-sources" | "webdav" | "local-storage";

export const CONFIG_STORE_KEY = "infinite-canvas:ai_config_store";
const CHANNEL_MODEL_SEPARATOR = "::";

export const defaultConfig: AiConfig = {
    channelMode: "local",
    baseUrl: "",
    apiKey: "",
    apiFormat: "comfyui",
    channels: [
        {
            id: "default",
            name: "ComfyUI",
            baseUrl: "",
            apiKey: "",
            apiFormat: "comfyui",
            comfyuiProxyUrl: "http://127.0.0.1:8188",
            comfyuiProxyToken: "",
            comfyuiT2iWorkflow: DEFAULT_COMFYUI_T2I_WORKFLOW,
            comfyuiI2iWorkflow: DEFAULT_COMFYUI_I2I_WORKFLOW,
            comfyuiInpaintWorkflow: DEFAULT_COMFYUI_INPAINT_WORKFLOW,
            comfyuiTextWorkflow: DEFAULT_COMFYUI_TEXT_WORKFLOW,
            comfyuiVideoWorkflow: DEFAULT_COMFYUI_VIDEO_WORKFLOW,
            comfyuiFrameVideoWorkflow: DEFAULT_COMFYUI_FRAME_VIDEO_WORKFLOW,
            models: [
                { name: "ComfyUI T2I", capability: "image", comfyuiWorkflow: DEFAULT_COMFYUI_T2I_WORKFLOW },
                { name: "ComfyUI I2I", capability: "image", comfyuiWorkflow: DEFAULT_COMFYUI_I2I_WORKFLOW },
                { name: "ComfyUI Inpaint", capability: "image", comfyuiWorkflow: DEFAULT_COMFYUI_INPAINT_WORKFLOW },
                { name: "ComfyUI LLM", capability: "text", comfyuiWorkflow: DEFAULT_COMFYUI_TEXT_WORKFLOW },
                { name: "ComfyUI Video", capability: "video", comfyuiWorkflow: DEFAULT_COMFYUI_VIDEO_WORKFLOW },
                { name: "ComfyUI Frame Video", capability: "video", comfyuiWorkflow: DEFAULT_COMFYUI_FRAME_VIDEO_WORKFLOW },
            ],
        },
    ],
    model: "default::ComfyUI T2I",
    imageModel: "default::ComfyUI T2I",
    videoModel: "default::ComfyUI Video",
    textModel: "default::ComfyUI LLM",
    audioModel: "",
    audioVoice: "alloy",
    audioFormat: "mp3",
    audioSpeed: "1",
    audioInstructions: "",
    videoSeconds: "6",
    videoMode: "omni",
    vquality: "720",
    videoGenerateAudio: "true",
    videoWatermark: "false",
    systemPrompt: "",
    reasoningEffort: "auto",
    models: [
        "default::ComfyUI T2I",
        "default::ComfyUI I2I",
        "default::ComfyUI Inpaint",
        "default::ComfyUI LLM",
        "default::ComfyUI Video",
        "default::ComfyUI Frame Video",
    ],
    quality: "auto",
    size: "1:1",
    background: "",
    count: "1",
    canvasImageCount: "3",
};

export const defaultWebdavSyncConfig: WebdavSyncConfig = {
    url: "",
    username: "",
    password: "",
    directory: "infinite-canvas",
    lastSyncedAt: "",
};

type ConfigStore = {
    config: AiConfig;
    webdav: WebdavSyncConfig;
    isConfigOpen: boolean;
    configTab: ConfigTabKey;
    shouldPromptContinue: boolean;
    setConfig: (config: AiConfig) => void;
    updateConfig: <K extends keyof AiConfig>(key: K, value: AiConfig[K]) => void;
    updateWebdavConfig: <K extends keyof WebdavSyncConfig>(key: K, value: WebdavSyncConfig[K]) => void;
    isAiConfigReady: (config: AiConfig, model: string) => boolean;
    openConfigDialog: (shouldPromptContinue?: boolean, tab?: ConfigTabKey) => void;
    setConfigDialogOpen: (isOpen: boolean) => void;
    clearPromptContinue: () => void;
};

const VIDEO_KEYWORDS = ["video", "sora", "veo", "kling", "wan", "hailuo"];

export function boolConfig(value: string, fallback: boolean) {
    return value ? value === "true" : fallback;
}
const AUDIO_KEYWORDS = ["audio", "tts", "speech", "voice", "music", "sound"];
const IMAGE_KEYWORDS = ["seedream", "gpt-image", "image", "dall-e", "dalle", "imagen", "flux", "sdxl", "stable-diffusion", "midjourney", "t2i", "i2i", "inpaint", "txt2img", "img2img"];

/** Best-effort default capability for a freshly fetched model name; user can override in the channel editor. */
export function guessCapability(name: string): ModelCapability {
    const value = name.toLowerCase();
    if (VIDEO_KEYWORDS.some((keyword) => value.includes(keyword))) return "video";
    if (AUDIO_KEYWORDS.some((keyword) => value.includes(keyword))) return "audio";
    if (IMAGE_KEYWORDS.some((keyword) => value.includes(keyword))) return "image";
    return "text";
}

function findChannelModel(config: AiConfig, value: string): { channel: ModelChannel; model: ChannelModel } | null {
    const decoded = decodeChannelModel(value);
    const name = decoded?.model || value;
    const channel = decoded ? config.channels.find((item) => item.id === decoded.channelId) : config.channels.find((item) => item.models.some((model) => model.name === name));
    const model = channel?.models.find((item) => item.name === name);
    return channel && model ? { channel, model } : null;
}

export function modelCapabilityOf(config: AiConfig, value: string): ModelCapability | undefined {
    return findChannelModel(config, value)?.model.capability;
}

function isInpaintModelName(name: string): boolean {
    const lower = name.toLowerCase();
    return lower.includes("inpaint") || name.includes("局部编辑") || name.includes("局部修改") || name.includes("局部") || name.includes("遮罩");
}

export function modelMatchesCapability(config: AiConfig, value: string, capability?: ModelCapability) {
    if (!capability) return true;
    if (capability === "image") {
        const decoded = decodeChannelModel(value);
        const name = decoded?.model || value;
        if (isInpaintModelName(name)) return false;
    }
    return modelCapabilityOf(config, value) === capability;
}

export function resolveModelForCapability(config: AiConfig, currentModel: string | undefined, capability: ModelCapability) {
    const defaultModel = capability === "image" ? config.imageModel : capability === "video" ? config.videoModel : capability === "audio" ? config.audioModel : config.textModel;
    const fallbackModel = capability === "image" ? defaultConfig.imageModel : capability === "video" ? defaultConfig.videoModel : capability === "audio" ? defaultConfig.audioModel : defaultConfig.textModel;
    if (currentModel && modelMatchesCapability(config, currentModel, capability)) return currentModel;
    if (defaultModel && modelMatchesCapability(config, defaultModel, capability)) return defaultModel;
    return fallbackModel;
}

export function selectableModelsByCapability(config: AiConfig, capability?: ModelCapability) {
    if (!capability) return config.models;
    return config.channels.flatMap((channel) =>
        channel.models
            .filter((model) => {
                if (model.capability !== capability) return false;
                if (capability === "image" && isInpaintModelName(model.name)) return false;
                return true;
            })
            .map((model) => encodeChannelModel(channel.id, model.name))
    );
}

/** The user script (if any) attached to a model; empty string means use the system default call. */
export function resolveModelScript(config: AiConfig, value: string) {
    return findChannelModel(config, value)?.model.script?.trim() || "";
}

export function isAiConfigReady(config: AiConfig, model: string) {
    if (!model.trim()) return false;
    return config.channels.some((channel) => isChannelReady(channel));
}

export function isChannelReady(channel: ModelChannel) {
    return Boolean((channel.comfyuiProxyUrl || "").trim());
}

export const useConfigStore = create<ConfigStore>()(
    persist(
        (set, get) => ({
            config: defaultConfig,
            webdav: defaultWebdavSyncConfig,
            isConfigOpen: false,
            configTab: "channels",
            shouldPromptContinue: false,
            setConfig: (config) => set({ config }),
            updateConfig: (key, value) =>
                set((state) => ({
                    config: {
                        ...state.config,
                        [key]: value,
                    },
                })),
            updateWebdavConfig: (key, value) =>
                set((state) => ({
                    webdav: {
                        ...state.webdav,
                        [key]: value,
                    },
                })),
            isAiConfigReady: (config, model) => isAiConfigReady(config, model),
            openConfigDialog: (shouldPromptContinue = false, configTab = "channels") => set({ isConfigOpen: true, shouldPromptContinue, configTab }),
            setConfigDialogOpen: (isConfigOpen) => set({ isConfigOpen }),
            clearPromptContinue: () => set({ shouldPromptContinue: false }),
        }),
        {
            name: CONFIG_STORE_KEY,
            version: 1,
            migrate: (persistedState: any, version: number) => {
                if (version < 1) {
                    return {
                        ...persistedState,
                        config: defaultConfig,
                    };
                }
                return persistedState;
            },
            partialize: (state) => ({ config: state.config, webdav: state.webdav }),
            merge: (persisted, current) => {
                const persistedState = (persisted || {}) as Partial<ConfigStore>;
                const persistedConfig = (persistedState.config || {}) as Partial<AiConfig>;
                const persistedWebdav = (persistedState.webdav || {}) as Partial<WebdavSyncConfig>;
                const config = { ...defaultConfig, ...persistedConfig };
                if (!Array.isArray(persistedConfig.channels)) config.channels = [];
                const channels = normalizeChannels(config);
                const models = modelOptionsFromChannels(channels);
                const resolveOption = (value: string | undefined, fallback: string, capability: ModelCapability) => {
                    const normalized = normalizeModelOptionValue(value, channels);
                    if (normalized && modelMatchesCapability({ ...config, channels }, normalized, capability)) {
                        return normalized;
                    }
                    const fallbackNormalized = normalizeModelOptionValue(fallback, channels);
                    if (fallbackNormalized && modelMatchesCapability({ ...config, channels }, fallbackNormalized, capability)) {
                        return fallbackNormalized;
                    }
                    const firstMatch = channels.flatMap((c) => c.models.filter((m) => m.capability === capability).map((m) => encodeChannelModel(c.id, m.name)))[0];
                    return firstMatch || "";
                };
                return {
                    ...current,
                    webdav: { ...defaultWebdavSyncConfig, ...persistedWebdav },
                    config: {
                        ...config,
                        channelMode: "local",
                        apiFormat: normalizeApiFormat(config.apiFormat),
                        channels,
                        models,
                        imageModel: resolveOption(config.imageModel || config.model, defaultConfig.imageModel, "image"),
                        videoModel: resolveOption(config.videoModel, defaultConfig.videoModel, "video"),
                        textModel: resolveOption(config.textModel || config.model, defaultConfig.textModel, "text"),
                        audioModel: normalizeModelOptionValue(config.audioModel || defaultConfig.audioModel, channels),
                        audioVoice: config.audioVoice || defaultConfig.audioVoice,
                        audioFormat: config.audioFormat || defaultConfig.audioFormat,
                        audioSpeed: config.audioSpeed || defaultConfig.audioSpeed,
                        audioInstructions: config.audioInstructions || "",
                        reasoningEffort: config.reasoningEffort || "auto",
                        videoSeconds: config.videoSeconds || "6",
                        videoMode: config.videoMode || "omni",
                        vquality: config.vquality || "720",
                        videoGenerateAudio: config.videoGenerateAudio || "true",
                        videoWatermark: config.videoWatermark || "false",
                        canvasImageCount: config.canvasImageCount || "3",
                    },
                };
            },
        },
    ),
);

export function useEffectiveConfig() {
    const config = useConfigStore((state) => state.config);
    return useMemo(() => ({ ...config, channelMode: "local" as const }), [config]);
}

/** Normalize a mixed list of raw model names or model objects into deduped ChannelModel entries. */
export function normalizeChannelModels(models: Array<string | ChannelModel> | undefined): ChannelModel[] {
    const seen = new Set<string>();
    const result: ChannelModel[] = [];
    for (const item of models || []) {
        const name = (typeof item === "string" ? item : item?.name || "").trim();
        if (!name || seen.has(name)) continue;
        seen.add(name);
        const capability = typeof item === "string" ? guessCapability(name) : item.capability || guessCapability(name);
        const script = typeof item === "string" ? undefined : item.script?.trim() || undefined;
        const comfyuiWorkflow = typeof item === "string" ? undefined : item.comfyuiWorkflow;
        result.push({ name, capability, script, comfyuiWorkflow });
    }
    return result;
}

/** Models pre-provisioned when a ComfyUI channel is created without explicit models. */
export const COMFYUI_DEFAULT_MODELS: ChannelModel[] = [
    { name: "ComfyUI T2I", capability: "image", comfyuiWorkflow: DEFAULT_COMFYUI_T2I_WORKFLOW },
    { name: "ComfyUI I2I", capability: "image", comfyuiWorkflow: DEFAULT_COMFYUI_I2I_WORKFLOW },
    { name: "ComfyUI Inpaint", capability: "image", comfyuiWorkflow: DEFAULT_COMFYUI_INPAINT_WORKFLOW },
    { name: "ComfyUI LLM", capability: "text", comfyuiWorkflow: DEFAULT_COMFYUI_TEXT_WORKFLOW },
    { name: "ComfyUI Video", capability: "video", comfyuiWorkflow: DEFAULT_COMFYUI_VIDEO_WORKFLOW },
    { name: "ComfyUI Frame Video", capability: "video", comfyuiWorkflow: DEFAULT_COMFYUI_FRAME_VIDEO_WORKFLOW },
];

export function createModelChannel(channel?: Partial<ModelChannel>, options?: { preprovisionComfyuiModels?: boolean }): ModelChannel {
    const models = normalizeChannelModels(channel?.models);
    const result: ModelChannel = {
        id: channel?.id?.trim() || nanoid(),
        name: channel?.name?.trim() || "ComfyUI",
        baseUrl: "",
        apiKey: "",
        apiFormat: "comfyui",
        models: models.length ? models : options?.preprovisionComfyuiModels !== false ? [...COMFYUI_DEFAULT_MODELS] : [],
        comfyuiProxyUrl: channel?.comfyuiProxyUrl !== undefined ? channel.comfyuiProxyUrl : "http://127.0.0.1:8188",
        comfyuiProxyToken: channel?.comfyuiProxyToken !== undefined ? channel.comfyuiProxyToken : "",
        comfyuiT2iWorkflow: channel?.comfyuiT2iWorkflow ?? DEFAULT_COMFYUI_T2I_WORKFLOW,
        comfyuiI2iWorkflow: channel?.comfyuiI2iWorkflow ?? DEFAULT_COMFYUI_I2I_WORKFLOW,
        comfyuiInpaintWorkflow: channel?.comfyuiInpaintWorkflow ?? DEFAULT_COMFYUI_INPAINT_WORKFLOW,
        comfyuiTextWorkflow: channel?.comfyuiTextWorkflow ?? DEFAULT_COMFYUI_TEXT_WORKFLOW,
        comfyuiVideoWorkflow: channel?.comfyuiVideoWorkflow ?? DEFAULT_COMFYUI_VIDEO_WORKFLOW,
        comfyuiFrameVideoWorkflow: channel?.comfyuiFrameVideoWorkflow ?? DEFAULT_COMFYUI_FRAME_VIDEO_WORKFLOW,
    };
    return result;
}

export function encodeChannelModel(channelId: string, model: string) {
    return `${channelId}${CHANNEL_MODEL_SEPARATOR}${model.trim()}`;
}

export function isChannelModelValue(value: string) {
    return value.includes(CHANNEL_MODEL_SEPARATOR);
}

export function decodeChannelModel(value: string) {
    const index = value.indexOf(CHANNEL_MODEL_SEPARATOR);
    if (index < 0) return null;
    return { channelId: value.slice(0, index), model: value.slice(index + CHANNEL_MODEL_SEPARATOR.length) };
}

export function modelOptionName(value: string) {
    return decodeChannelModel(value)?.model || value;
}

export function modelOptionLabel(config: AiConfig, value: string) {
    const decoded = decodeChannelModel(value);
    if (!decoded) return value;
    const channel = config.channels.find((item) => item.id === decoded.channelId);
    return channel ? `${decoded.model}（${channel.name}）` : decoded.model;
}

export function modelOptionsFromChannels(channels: ModelChannel[]) {
    return uniqueModelOptions(channels.flatMap((channel) => channel.models.map((model) => encodeChannelModel(channel.id, model.name))));
}

export function normalizeModelOptionValue(value: string | undefined, channels: ModelChannel[]) {
    const model = (value || "").trim();
    if (!model) return "";
    const decoded = decodeChannelModel(model);
    if (decoded) {
        const channel = channels.find((item) => item.id === decoded.channelId);
        return channel && channel.models.some((item) => item.name === decoded.model) ? model : "";
    }
    const channel = channels.find((item) => item.models.some((entry) => entry.name === model)) || channels[0];
    return channel && channel.models.some((item) => item.name === model) ? encodeChannelModel(channel.id, model) : model;
}

export function resolveModelChannel(config: AiConfig, value: string) {
    const decoded = decodeChannelModel(value);
    if (decoded) {
        const matched = config.channels.find((channel) => channel.id === decoded.channelId);
        if (matched) return matched;
    }
    const model = decoded?.model || value;
    const cap = guessCapability(model);
    const preferredCand = cap === "video" ? config.videoModel : cap === "text" ? config.textModel : cap === "audio" ? config.audioModel : config.imageModel;
    const modelCandidates = [preferredCand, config.model, config.videoModel, config.imageModel, config.textModel, config.audioModel].filter(Boolean) as string[];
    for (const cand of modelCandidates) {
        if (!cand) continue;
        const candDecoded = decodeChannelModel(cand);
        if (candDecoded && (!value || candDecoded.model === value)) {
            const matched = config.channels.find((channel) => channel.id === candDecoded.channelId);
            if (matched) return matched;
        }
    }
    const matched = config.channels.find((channel) => channel.models.some((item) => item.name === model));
    return matched || config.channels[0] || createModelChannel({ id: "default", name: "ComfyUI", apiFormat: "comfyui", models: config.models.map(modelOptionName).map((name) => ({ name, capability: guessCapability(name) })) });
}

export function resolveModelRequestConfig(config: AiConfig, value: string) {
    const channel = resolveModelChannel(config, value);
    return {
        ...config,
        model: modelOptionName(value || config.model),
        baseUrl: channel.baseUrl || channel.comfyuiProxyUrl,
        apiKey: channel.apiKey || channel.comfyuiProxyToken,
        apiFormat: channel.apiFormat,
    };
}

function normalizeChannels(config: AiConfig) {
    const persistedChannels = Array.isArray(config.channels) ? config.channels : [];
    const channels = persistedChannels.map((channel, index) =>
        createModelChannel(
            {
                ...channel,
                id: channel.id || (index === 0 ? "default" : `channel-${index + 1}`),
                name: channel.name || (index === 0 ? "ComfyUI" : i18n.t("config.channels.indexedName", { index: index + 1 })),
                models: normalizeChannelModels(channel.models),
            },
            { preprovisionComfyuiModels: false },
        ),
    );
    if (!channels.length) {
        channels.push(createModelChannel());
    }
    return channels;
}

export function defaultBaseUrlForApiFormat(_apiFormat?: ApiCallFormat) {
    return "";
}

export function normalizeApiFormat(_apiFormat?: unknown): ApiCallFormat {
    return "comfyui";
}

function uniqueModelOptions(models: string[]) {
    return Array.from(new Set((models || []).map((model) => model.trim()).filter(Boolean)));
}

export function buildApiUrl(baseUrl: string, path: string) {
    const normalizedBaseUrl = baseUrl.trim().replace(/\/+$/, "");
    const lowerBaseUrl = normalizedBaseUrl.toLowerCase();
    const apiBaseUrl = lowerBaseUrl.endsWith("/v1") ? normalizedBaseUrl : `${normalizedBaseUrl}/v1`;
    return `${apiBaseUrl}${path}`;
}
