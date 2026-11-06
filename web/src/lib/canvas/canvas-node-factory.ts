import { nanoid } from "nanoid";
import { getNodeSpec, NODE_DEFAULT_SIZE } from "@/constant/canvas";
import { nodeSizeFromRatio } from "@/lib/canvas/canvas-node-size";
import { getDefaultWorkflow, type AiConfig } from "@/stores/use-config-store";
import { getModelProfile, resolveModelIdFromWorkflowId } from "@/services/api/models";
import type { UploadedImage } from "@/services/image-storage";
import type { UploadedFile } from "@/services/file-storage";
import type { ReferenceImage } from "@/types/image";
import { CanvasNodeType, type CanvasImageGenerationType, type CanvasNodeData, type CanvasNodeImage, type CanvasNodeMetadata, type CanvasNodeText, type CanvasNodeTypeId, type Position } from "@/types/canvas";

export function createDefaultNodeMetadata(type: CanvasNodeTypeId, config: AiConfig): CanvasNodeMetadata | undefined {
    const activeChannel = (config.channelId ? config.channels?.find((c) => c.id === config.channelId) : undefined) || config.channels?.[0];
    if (!activeChannel) return undefined;

    if (type === CanvasNodeType.Image) {
        const wf = getDefaultWorkflow(activeChannel, "t2i");
        const modelId = (wf ? resolveModelIdFromWorkflowId(wf.id) || getModelProfile(wf.id)?.id : undefined) || "image-qwen-2.1";
        return {
            channelId: activeChannel.id,
            ...(wf ? { workflowId: wf.id } : {}),
            modelId,
        };
    }
    if (type === CanvasNodeType.Video) {
        const wf = getDefaultWorkflow(activeChannel, "omniVideo");
        const modelId = (wf ? resolveModelIdFromWorkflowId(wf.id) || getModelProfile(wf.id)?.id : undefined) || "omni-video-minimax-h3-fp8-4step-pdmd";
        return {
            channelId: activeChannel.id,
            ...(wf ? { workflowId: wf.id } : {}),
            modelId,
            videoMode: wf?.category === "frameVideo" ? "frame" : "omni",
            seconds: config.videoSeconds || "5",
            size: config.size || "1280x736",
        };
    }
    if (type === CanvasNodeType.Text) {
        const wf = getDefaultWorkflow(activeChannel, "text");
        const modelId = (wf ? resolveModelIdFromWorkflowId(wf.id) || getModelProfile(wf.id)?.id : undefined) || "text-qwen-35";
        return {
            channelId: activeChannel.id,
            ...(wf ? { workflowId: wf.id } : {}),
            modelId,
            fontSize: 14,
        };
    }
    if (type === CanvasNodeType.Audio) {
        const wf = getDefaultWorkflow(activeChannel, "audio");
        const modelId = (wf ? resolveModelIdFromWorkflowId(wf.id) || getModelProfile(wf.id)?.id : undefined) || "audio-minimax-music-3";
        return {
            channelId: activeChannel.id,
            ...(wf ? { workflowId: wf.id } : {}),
            modelId,
        };
    }
    if (type === CanvasNodeType.Config) {
        return {
            model: config.imageModel || config.model,
            size: config.size,
            count: Number(config.canvasImageCount || config.count) || 1,
        };
    }
    return undefined;
}

export function createCanvasNode(type: CanvasNodeTypeId, position: Position, metadata?: CanvasNodeMetadata, title?: string): CanvasNodeData {
    const spec = getNodeSpec(type);
    const id = `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    return {
        id,
        type,
        title: title || spec.title,
        position: {
            x: position.x - spec.width / 2,
            y: position.y - spec.height / 2,
        },
        width: spec.width,
        height: spec.height,
        metadata: { ...spec.metadata, ...metadata },
    };
}

export function imageMetadata(image: UploadedImage): CanvasNodeMetadata {
    return { content: image.url, storageKey: image.storageKey, status: "success", naturalWidth: image.width, naturalHeight: image.height, bytes: image.bytes, mimeType: image.mimeType };
}

export function videoMetadata(video: UploadedFile): CanvasNodeMetadata {
    return { content: video.url, storageKey: video.storageKey, status: "success", naturalWidth: video.width, naturalHeight: video.height, bytes: video.bytes, mimeType: video.mimeType || "video/mp4", durationMs: video.durationMs };
}

export function audioMetadata(audio: UploadedFile): CanvasNodeMetadata {
    return { content: audio.url, storageKey: audio.storageKey, status: "success", bytes: audio.bytes, mimeType: audio.mimeType || "audio/mpeg", durationMs: audio.durationMs };
}

export function referenceUrl(image: ReferenceImage) {
    return image.storageKey || image.url || (!image.dataUrl.startsWith("data:") ? image.dataUrl : undefined);
}

export function buildImageGenerationMetadata(type: CanvasImageGenerationType, config: AiConfig, count: number, references: ReferenceImage[], seed?: number): CanvasNodeMetadata {
    return {
        generationType: type,
        model: config.model,
        size: config.size,
        quality: config.quality,
        ...(config.background ? { background: config.background } : {}),
        count,
        references: references.map(referenceUrl).filter((url): url is string => Boolean(url)),
        generationReferences: references.map((reference) => ({
            nodeId: reference.id,
            kind: "image" as const,
            storageKey: reference.storageKey,
            url: reference.storageKey ? undefined : reference.url || (!reference.dataUrl.startsWith("data:") ? reference.dataUrl : undefined),
            mimeType: reference.type,
        })),
        ...(seed !== undefined ? { seed } : {}),
    };
}

export function buildAudioGenerationMetadata(config: AiConfig, seed?: number): CanvasNodeMetadata {
    return {
        model: config.model,
        seconds: config.audioSeconds || "60",
        ...(seed !== undefined ? { seed } : {}),
    };
}

export function applyNodeConfigPatch(node: CanvasNodeData, patch: Partial<CanvasNodeData["metadata"]>) {
    const safePatch = patch || {};
    const next = { ...node, metadata: { ...node.metadata, ...safePatch } };
    const spec = node.type === CanvasNodeType.Video ? NODE_DEFAULT_SIZE[CanvasNodeType.Video] : NODE_DEFAULT_SIZE[CanvasNodeType.Image];
    const size = typeof safePatch.size === "string" && !node.metadata?.content ? nodeSizeFromRatio(safePatch.size, spec.width, spec.height) : null;
    return size && (node.type === CanvasNodeType.Image || node.type === CanvasNodeType.Video) ? { ...next, ...size, position: { x: node.position.x + node.width / 2 - size.width / 2, y: node.position.y + node.height / 2 - size.height / 2 } } : next;
}

export function cloneNodeMetadata(metadata?: CanvasNodeMetadata, nodeType?: CanvasNodeTypeId): CanvasNodeMetadata | undefined {
    if (!metadata) return undefined;
    const cloned = structuredClone(metadata);

    // 1. 重置瞬时任务与报错标记
    delete cloned.jobId;
    delete cloned.queuePosition;
    delete cloned.networkRetryText;
    delete cloned.progressPct;
    delete cloned.progressNodeClassType;
    delete cloned.progressNodeStep;
    delete cloned.progressNodeSteps;
    delete cloned.errorDetails;
    delete cloned.isTimeout;

    // 2. 复制时将活跃草稿 (composerContent) 提拔为 official prompt，并清除 draft 避免影子遮蔽
    const activePrompt = cloned.composerContent ?? cloned.prompt;
    if (activePrompt !== undefined) cloned.prompt = activePrompt;
    delete cloned.composerContent;

    const targetType = nodeType || (cloned.generationMode as CanvasNodeType) || undefined;

    // 2. 识别是否属于 AI 生成类节点（生图/生视频/生音频/AI文本）
    const isAiGenerativeImage =
        targetType === CanvasNodeType.Image &&
        Boolean(
            cloned.generationMode === "image" ||
            cloned.generationType ||
            cloned.prompt ||
            cloned.model ||
            cloned.workflowId ||
            (Array.isArray(cloned.images) && cloned.images.length > 0)
        );

    const isAiGenerativeVideo =
        targetType === CanvasNodeType.Video &&
        Boolean(
            cloned.generationMode === "video" ||
            cloned.prompt ||
            cloned.model ||
            cloned.workflowId ||
            cloned.videoMode
        );

    const isAiGenerativeAudio =
        targetType === CanvasNodeType.Audio &&
        Boolean(
            cloned.generationMode === "audio" ||
            cloned.prompt ||
            cloned.model ||
            cloned.workflowId ||
            cloned.audioVoice
        );

    const isAiGenerativeText =
        targetType === CanvasNodeType.Text &&
        Boolean(
            cloned.generationMode === "text" ||
            (Array.isArray(cloned.texts) && cloned.texts.length > 0)
        );

    if (isAiGenerativeImage) {
        // AI 生图节点：清空媒体产物，保留提示词、模型、尺寸、参考图等生成配置，就绪重置为 idle
        cloned.content = "";
        delete cloned.storageKey;
        delete cloned.images;
        delete cloned.primaryImageId;
        delete cloned.naturalWidth;
        delete cloned.naturalHeight;
        delete cloned.bytes;
        delete cloned.mimeType;
        delete cloned.seed;
        cloned.status = "idle";
    } else if (isAiGenerativeVideo) {
        // AI 视频节点：清空视频产物，保留提示词、模型、时长、参考图等生成配置，就绪重置为 idle
        cloned.content = "";
        delete cloned.storageKey;
        delete cloned.naturalWidth;
        delete cloned.naturalHeight;
        delete cloned.bytes;
        delete cloned.mimeType;
        delete cloned.durationMs;
        delete cloned.seed;
        cloned.status = "idle";
    } else if (isAiGenerativeAudio) {
        // AI 音频节点：清空音频产物，保留提示词、音色、时长等生成配置，就绪重置为 idle
        cloned.content = "";
        delete cloned.storageKey;
        delete cloned.bytes;
        delete cloned.mimeType;
        delete cloned.durationMs;
        cloned.status = "idle";
    } else if (isAiGenerativeText) {
        // AI 文本节点：清空生成文本产物，保留提示词与配置，就绪重置为 idle
        cloned.content = "";
        delete cloned.texts;
        delete cloned.primaryTextId;
        cloned.status = "idle";
    } else {
        // 用户手动上传的媒体素材（图片/视频/音频）或手动输入的文本节点：保留内容与状态
        cloned.status = cloned.content ? "success" : "idle";
    }

    return cloned;
}

