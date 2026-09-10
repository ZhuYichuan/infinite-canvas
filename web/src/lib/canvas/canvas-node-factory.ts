import { nanoid } from "nanoid";
import { getNodeSpec, NODE_DEFAULT_SIZE } from "@/constant/canvas";
import { nodeSizeFromRatio } from "@/lib/canvas/canvas-node-size";
import type { AiConfig } from "@/stores/use-config-store";
import type { UploadedImage } from "@/services/image-storage";
import type { UploadedFile } from "@/services/file-storage";
import type { ReferenceImage } from "@/types/image";
import { CanvasNodeType, type CanvasImageGenerationType, type CanvasNodeData, type CanvasNodeImage, type CanvasNodeMetadata, type CanvasNodeText, type CanvasNodeTypeId, type Position } from "@/types/canvas";

export function createCanvasNode(type: CanvasNodeTypeId, position: Position, metadata?: CanvasNodeMetadata): CanvasNodeData {
    const spec = getNodeSpec(type);
    const id = `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    return {
        id,
        type,
        title: spec.title,
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

export function buildAudioGenerationMetadata(config: AiConfig): CanvasNodeMetadata {
    return {
        model: config.model,
        audioVoice: config.audioVoice,
        audioFormat: config.audioFormat,
        audioSpeed: config.audioSpeed,
        audioInstructions: config.audioInstructions,
    };
}

export function applyNodeConfigPatch(node: CanvasNodeData, patch: Partial<CanvasNodeData["metadata"]>) {
    const safePatch = patch || {};
    const next = { ...node, metadata: { ...node.metadata, ...safePatch } };
    const spec = node.type === CanvasNodeType.Video ? NODE_DEFAULT_SIZE[CanvasNodeType.Video] : NODE_DEFAULT_SIZE[CanvasNodeType.Image];
    const size = typeof safePatch.size === "string" && !node.metadata?.content ? nodeSizeFromRatio(safePatch.size, spec.width, spec.height) : null;
    return size && (node.type === CanvasNodeType.Image || node.type === CanvasNodeType.Video) ? { ...next, ...size, position: { x: node.position.x + node.width / 2 - size.width / 2, y: node.position.y + node.height / 2 - size.height / 2 } } : next;
}

export function cloneNodeMetadata(metadata?: CanvasNodeMetadata): CanvasNodeMetadata | undefined {
    if (!metadata) return undefined;
    const cloned = structuredClone(metadata);

    // 1. 重置瞬时生成态与任务标记：新节点作为「未生成」就绪态，杜绝陈旧任务与报错干扰
    delete cloned.status;
    delete cloned.jobId;
    delete cloned.errorDetails;
    delete cloned.isTimeout;

    // 2. 清理多图批次 (images) 数组：重新生成子项 ID，清除任务 ID，过滤未就绪的 loading 占位
    if (Array.isArray(cloned.images) && cloned.images.length > 0) {
        const idMap = new Map<string, string>();
        const validImages = cloned.images.filter((image) => image.content || image.status !== "loading");
        cloned.images = validImages.map((image) => {
            const newId = nanoid();
            idMap.set(image.id, newId);
            const nextImage: CanvasNodeImage = {
                ...image,
                id: newId,
                jobId: undefined,
                errorDetails: undefined,
                isTimeout: undefined,
                status: image.content ? "success" : image.status === "error" ? "idle" : image.status,
            };
            return nextImage;
        });
        if (cloned.primaryImageId && idMap.has(cloned.primaryImageId)) {
            cloned.primaryImageId = idMap.get(cloned.primaryImageId);
        } else if (cloned.images[0]) {
            cloned.primaryImageId = cloned.images[0].id;
        }
    }

    // 3. 清理多文本 (texts) 数组：重新生成子项 ID，清除任务 ID，过滤未就绪的 loading 占位
    if (Array.isArray(cloned.texts) && cloned.texts.length > 0) {
        const idMap = new Map<string, string>();
        const validTexts = cloned.texts.filter((text) => text.content || text.status !== "loading");
        cloned.texts = validTexts.map((text) => {
            const newId = nanoid();
            idMap.set(text.id, newId);
            const nextText: CanvasNodeText = {
                ...text,
                id: newId,
                jobId: undefined,
                errorDetails: undefined,
                isTimeout: undefined,
                status: text.content ? "success" : text.status === "error" ? "idle" : text.status,
            };
            return nextText;
        });
        if (cloned.primaryTextId && idMap.has(cloned.primaryTextId)) {
            cloned.primaryTextId = idMap.get(cloned.primaryTextId);
        } else if (cloned.texts[0]) {
            cloned.primaryTextId = cloned.texts[0].id;
        }
    }

    return cloned;
}

