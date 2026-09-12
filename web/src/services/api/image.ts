import i18n from "@/i18n";
import { resolveModelRequestConfig, type AiConfig, type ModelChannel } from "@/stores/use-config-store";
import { requestComfyuiImage, requestComfyuiInpaint, requestComfyuiText } from "./comfyui";
import type { ReferenceImage } from "@/types/image";

const apiText = (key: string, options?: Record<string, unknown>) => i18n.t(`apiErrors.${key}`, options);

export type AiTextMessage = {
    role: "system" | "user" | "assistant";
    content: string | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;
};

type RequestOptions = {
    signal?: AbortSignal;
    jobId?: string;
    onProgress?: (status: string, detail?: { jobId?: string }) => void;
    seed?: number;
};

export async function requestGeneration(config: AiConfig, prompt: string, options?: RequestOptions) {
    const rawModel = config.imageModel || config.model;
    const requestConfig = resolveModelRequestConfig(config, rawModel);
    const n = Math.max(1, Math.min(15, Math.floor(Math.abs(Number(config.count)) || 1)));
    if (n > 1) {
        const results = await Promise.all(
            Array.from({ length: n }, (_, index) =>
                requestComfyuiImage({
                    config: requestConfig,
                    model: rawModel,
                    prompt,
                    size: requestConfig.size,
                    seed: options?.seed !== undefined ? (options.seed + index) % 9007199254740991 : undefined,
                    signal: options?.signal,
                    jobId: options?.jobId,
                    onProgress: options?.onProgress,
                }),
            ),
        );
        return results.flatMap((res) => res.items);
    }
    return (
        await requestComfyuiImage({
            config: requestConfig,
            model: rawModel,
            prompt,
            size: requestConfig.size,
            seed: options?.seed,
            signal: options?.signal,
            jobId: options?.jobId,
            onProgress: options?.onProgress,
        })
    ).items;
}

export async function requestEdit(config: AiConfig, prompt: string, references: ReferenceImage[], mask?: ReferenceImage, options?: RequestOptions) {
    const rawModel = config.imageModel || config.model;
    if (mask && references[0]?.dataUrl) {
        const result = await requestComfyuiInpaint({
            config,
            model: rawModel,
            prompt,
            sourceDataUrl: references[0].dataUrl,
            maskDataUrl: mask.dataUrl,
            seed: options?.seed,
            signal: options?.signal,
            jobId: options?.jobId,
            onProgress: options?.onProgress,
        });
        return result.items;
    }
    return (
        await requestComfyuiImage({
            config,
            model: rawModel,
            prompt,
            size: config.size,
            references,
            seed: options?.seed,
            signal: options?.signal,
            jobId: options?.jobId,
            onProgress: options?.onProgress,
        })
    ).items;
}

export async function requestImageQuestion(config: AiConfig, messages: AiTextMessage[], onDelta: (text: string) => void, options?: RequestOptions) {
    let prompt = "";
    let imageDataUrl: string | undefined;
    for (const msg of messages) {
        if (typeof msg.content === "string") {
            prompt += (prompt ? "\n" : "") + msg.content;
        } else if (Array.isArray(msg.content)) {
            for (const part of msg.content) {
                if (part.type === "text") {
                    prompt += (prompt ? "\n" : "") + part.text;
                } else if (part.type === "image_url" && part.image_url?.url) {
                    if (!imageDataUrl) imageDataUrl = part.image_url.url;
                }
            }
        }
    }

    const rawModel = config.textModel || config.model;
    const res = await requestComfyuiText({
        config,
        model: rawModel,
        prompt,
        imageDataUrl,
        seed: options?.seed,
        signal: options?.signal,
        jobId: options?.jobId,
        onProgress: options?.onProgress,
        onDelta,
    });
    return res.text;
}

export async function fetchImageModels(_config?: Pick<AiConfig, "baseUrl" | "apiKey" | "apiFormat">): Promise<string[]> {
    return ["ComfyUI T2I"];
}

export async function fetchChannelModels(channel: ModelChannel): Promise<string[]> {
    return channel.models.map((model) => model.name);
}
