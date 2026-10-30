import { defaultConfig, findWorkflow, resolveModelForCapability, type AiConfig } from "@/stores/use-config-store";
import i18n from "@/i18n";
import { TaskExecutionError } from "@/services/api/task";
import { imageToDataUrl, resolveImageUrl, uploadImage } from "@/services/image-storage";
import { resolveMediaUrl } from "@/services/file-storage";
import { imageMetadata, referenceUrl } from "@/lib/canvas/canvas-node-factory";
import type { NodeGenerationContext as NodeGenerationInputContext, NodeGenerationInput } from "@/components/canvas/canvas-node-generation";
import type { CanvasNodeGenerationMode } from "@/components/canvas/canvas-node-prompt-panel";
import type { CanvasImageAngleParams } from "@/components/canvas/canvas-node-angle-dialog";
import type { ReferenceImage } from "@/types/image";
import { nanoid } from "nanoid";
import { CanvasNodeType, type CanvasAssistantSession, type CanvasConnection, type CanvasGenerationIntent, type CanvasGenerationReferenceSnapshot, type CanvasNodeData, type CanvasNodeMetadata } from "@/types/canvas";

export function getVideoToolCategory(config: AiConfig, node?: CanvasNodeData) {
    const workflowId = node?.metadata?.workflowId || config.workflowId;
    if (!workflowId) return undefined;
    const workflow = findWorkflow(config, node?.metadata?.channelId || config.channelId, workflowId);
    return workflow?.id === workflowId && (workflow.category === "faceRefine" || workflow.category === "depthVideo") ? workflow.category : undefined;
}

export function snapshotVideoToolInputs(source: CanvasNodeData, images: ReferenceImage[] = []): CanvasGenerationReferenceSnapshot[] {
    return [
        { nodeId: source.id, kind: "video", storageKey: source.metadata?.storageKey, url: source.metadata?.storageKey ? undefined : source.metadata?.content, mimeType: source.metadata?.mimeType || "video/mp4" },
        ...images.map((image): CanvasGenerationReferenceSnapshot => ({ nodeId: image.id, kind: "image", storageKey: image.storageKey, url: image.storageKey ? undefined : image.url || image.dataUrl, mimeType: image.type })),
    ];
}

export function imageExtension(dataUrl: string) {
    return dataUrl.match(/^data:image[/]([^;]+)/)?.[1] || dataUrl.match(/image[/]([^;]+)/)?.[1] || "png";
}

export function audioExtension(mimeType?: string) {
    if (mimeType?.includes("wav")) return "wav";
    if (mimeType?.includes("opus")) return "opus";
    if (mimeType?.includes("aac")) return "aac";
    if (mimeType?.includes("flac")) return "flac";
    if (mimeType?.includes("pcm")) return "pcm";
    return "mp3";
}

export function generationReferenceUrls(context: { referenceImages: ReferenceImage[]; referenceVideos: Array<{ storageKey?: string; url?: string }>; referenceAudios?: Array<{ storageKey?: string; url?: string }> }) {
    return [
        ...context.referenceImages.map(referenceUrl).filter((url): url is string => Boolean(url)),
        ...context.referenceVideos.map((video) => video.storageKey || video.url).filter((url): url is string => Boolean(url)),
        ...(context.referenceAudios || []).map((audio) => audio.storageKey || audio.url).filter((url): url is string => Boolean(url)),
    ];
}

export async function restoreGenerationContext(metadata: CanvasNodeMetadata): Promise<NodeGenerationInputContext | null> {
    if (metadata.effectivePrompt === undefined || !metadata.generationReferences) return null;
    const imageSnapshots = metadata.generationReferences.filter((reference) => reference.kind === "image");
    const videoSnapshots = metadata.generationReferences.filter((reference) => reference.kind === "video");
    const audioSnapshots = metadata.generationReferences.filter((reference) => reference.kind === "audio");
    const referenceImages = await Promise.all(
        imageSnapshots.map(async (reference) => {
            const dataUrl = await imageToDataUrl({ storageKey: reference.storageKey, url: reference.url });
            if (!dataUrl) throw new Error(i18n.t("canvas.projectPage.referenceMissing"));
            return { id: reference.nodeId, name: reference.nodeId + ".png", type: reference.mimeType || "image/png", dataUrl, storageKey: reference.storageKey, url: reference.url };
        }),
    );
    const referenceVideos = await Promise.all(
        videoSnapshots.map(async (reference) => {
            const url = await resolveMediaUrl(reference.storageKey, reference.url || "");
            if (!url) throw new Error(i18n.t("canvas.projectPage.referenceMissing"));
            return { id: reference.nodeId, name: reference.nodeId + ".mp4", type: reference.mimeType || "video/mp4", url, storageKey: reference.storageKey };
        }),
    );
    const referenceAudios = await Promise.all(
        audioSnapshots.map(async (reference) => {
            const url = await resolveMediaUrl(reference.storageKey, reference.url || "");
            if (!url) throw new Error(i18n.t("canvas.projectPage.referenceMissing"));
            return { id: reference.nodeId, name: reference.nodeId + ".mp3", type: reference.mimeType || "audio/mpeg", url, storageKey: reference.storageKey };
        }),
    );
    return {
        prompt: metadata.effectivePrompt,
        generationReferences: metadata.generationReferences,
        referenceImages,
        referenceVideos,
        referenceAudios,
        textCount: metadata.generationReferences.filter((reference) => reference.kind === "text").length,
        imageCount: referenceImages.length,
        videoCount: referenceVideos.length,
        audioCount: referenceAudios.length,
    };
}

export async function resolveMetadataReferences(metadata: CanvasNodeMetadata) {
    if (metadata.generationType !== "edit") return [];
    if (!metadata.references?.length) return null;
    const references = await Promise.all(
        metadata.references.map(async (url, index) => {
            const dataUrl = url.startsWith("image:") ? await resolveImageUrl(url, "") : url;
            return dataUrl ? { id: `${index}`, name: `reference-${index}.png`, type: "image/png", dataUrl, storageKey: url.startsWith("image:") ? url : undefined } : null;
        }),
    );
    return references.every(Boolean) ? (references as ReferenceImage[]) : null;
}

export async function hydrateCanvasImages(nodes: CanvasNodeData[]) {
    return Promise.all(
        nodes.map(async (node) => {
            const content = node.metadata?.content;
            if ((node.type === CanvasNodeType.Video || node.type === CanvasNodeType.Audio) && node.metadata?.storageKey) return { ...node, metadata: { ...node.metadata, content: await resolveMediaUrl(node.metadata.storageKey, content) } };
            if (node.type !== CanvasNodeType.Image || !content) return node;
            const images = await Promise.all((node.metadata?.images || []).map(async (image) => (image.content ? { ...image, content: await resolveImageUrl(image.storageKey, image.content) } : image)));
            if (node.metadata?.storageKey) return { ...node, metadata: { ...node.metadata, content: await resolveImageUrl(node.metadata.storageKey, content), images } };
            if (!content.startsWith("data:image/")) return node;
            return { ...node, metadata: { ...node.metadata, ...imageMetadata(await uploadImage(content)) } };
        }),
    );
}

export async function hydrateAssistantImages(sessions: CanvasAssistantSession[]) {
    const hydrateItem = async <T extends { dataUrl?: string; storageKey?: string }>(item: T) => {
        if (item.storageKey) return { ...item, dataUrl: await resolveImageUrl(item.storageKey, item.dataUrl) };
        if (item.dataUrl?.startsWith("data:image/")) {
            const image = await uploadImage(item.dataUrl);
            return { ...item, dataUrl: image.url, storageKey: image.storageKey };
        }
        return item;
    };
    return Promise.all(
        sessions.map(async (session) => ({
            ...session,
            messages: await Promise.all(
                session.messages.map(async (message) => ({
                    ...message,
                    references: await Promise.all((message.references || []).map(hydrateItem)),
                })),
            ),
        })),
    );
}

export function getGenerationCount(count: string) {
    return Math.max(1, Math.min(15, Math.floor(Math.abs(Number(count)) || 1)));
}

export function getInputSummary(inputs: NodeGenerationInput[]) {
    const resources = [...new Map(inputs.flatMap((input) => (input.type === "group" ? input.children : [input])).map((input) => [input.nodeId, input])).values()];
    return {
        textCount: resources.filter((input) => input.type === "text").length,
        imageCount: resources.filter((input) => input.type === "image").length,
        videoCount: resources.filter((input) => input.type === "video").length,
        audioCount: resources.filter((input) => input.type === "audio").length,
    };
}

export function buildGenerationConfig(config: AiConfig, node: CanvasNodeData | undefined, mode: CanvasNodeGenerationMode): AiConfig {
    const videoTool = mode === "video" && getVideoToolCategory(config, node);
    const rawModel = videoTool ? undefined : node?.metadata?.modelId || node?.metadata?.model;
    const channelId = node?.metadata?.channelId || config.channelId;
    const workflowId = node?.metadata?.workflowId || config.workflowId;
    const model = videoTool ? workflowId! : resolveModelForCapability(config, rawModel, mode);
    let videoMode = node?.metadata?.videoMode;
    if (mode === "video" && node?.metadata?.modelId) {
        videoMode = node.metadata.modelId.includes("frame") ? "frame" : "omni";
    }
    if (mode === "video" && workflowId && !videoMode) {
        const wf = findWorkflow(config, channelId, workflowId);
        if (wf?.category === "frameVideo") videoMode = "frame";
        else if (wf?.category === "omniVideo" || wf?.category === "faceRefine") videoMode = "omni";
    }
    if (videoTool) {
        videoMode = "omni";
    }
    if (!videoMode) {
        videoMode = config.videoMode || defaultConfig.videoMode || "omni";
    }

    return {
        ...config,
        channelId,
        workflowId,
        model,
        videoModel: mode === "video" ? model : config.videoModel,
        imageModel: mode === "image" ? model : config.imageModel,
        textModel: mode === "text" ? model : config.textModel,
        audioModel: mode === "audio" ? model : config.audioModel,
        reasoningEffort: node?.metadata?.reasoningEffort || config.reasoningEffort || defaultConfig.reasoningEffort,
        quality: node?.metadata?.quality || config.quality || defaultConfig.quality,
        size: node?.metadata?.size || config.size || defaultConfig.size,
        background: node?.metadata?.background ?? config.background ?? defaultConfig.background,
        videoSeconds: node?.metadata?.seconds || config.videoSeconds || defaultConfig.videoSeconds,
        audioSeconds: node?.metadata?.seconds || config.audioSeconds || defaultConfig.audioSeconds || "60",
        videoMode,
        vquality: node?.metadata?.vquality || config.vquality || defaultConfig.vquality,
        videoGenerateAudio: node?.metadata?.generateAudio || config.videoGenerateAudio || defaultConfig.videoGenerateAudio,
        videoWatermark: node?.metadata?.watermark || config.videoWatermark || defaultConfig.videoWatermark,
        audioVoice: node?.metadata?.audioVoice || config.audioVoice || defaultConfig.audioVoice,
        audioFormat: node?.metadata?.audioFormat || config.audioFormat || defaultConfig.audioFormat,
        audioSpeed: node?.metadata?.audioSpeed || config.audioSpeed || defaultConfig.audioSpeed,
        audioInstructions: node?.metadata?.audioInstructions || config.audioInstructions || defaultConfig.audioInstructions,
        count: String(node?.metadata?.count || (mode === "image" ? config.canvasImageCount || config.count : config.count) || defaultConfig.count),
    };
}

export function isInterruptedGenerationError(errorDetails?: string) {
    if (!errorDetails) return false;
    return (
        errorDetails === "Generation was interrupted by a page refresh. Generate again." ||
        errorDetails === "页面刷新后生成已中断，请重新生成。" ||
        errorDetails === "canvas.generation.interrupted" ||
        errorDetails.includes("Generation was interrupted by a page refresh") ||
        errorDetails.includes("页面刷新后生成已中断")
    );
}

export function isCancelledGenerationError(error: unknown): boolean {
    if (!error) return false;
    if (error instanceof TaskExecutionError && error.category === "cancelled") return true;
    const name = typeof error === "object" && error !== null && "name" in error ? String((error as { name?: unknown }).name) : "";
    if (name === "ComfyuiJobCancelledError" || name === "ComfyuiAbortedError") return true;
    const msg = error instanceof Error ? error.message : typeof error === "string" ? error : "";
    return msg.includes("已取消") || msg.toLowerCase().includes("cancelled") || msg.includes("execution_interrupted");
}

export function isLostOrNotFoundGenerationError(error: unknown): boolean {
    if (!error) return false;
    if (error instanceof TaskExecutionError && error.category === "lost") return true;
    const name = typeof error === "object" && error !== null && "name" in error ? String((error as { name?: unknown }).name) : "";
    if (name === "ComfyuiJobLostError" || name === "ComfyuiJobNotFoundError") return true;
    const msg = error instanceof Error ? error.message : typeof error === "string" ? error : "";
    return msg.includes("丢失") || msg.includes("不存在") || msg.toLowerCase().includes("job lost") || msg.toLowerCase().includes("not found");
}

export function isNetworkGenerationError(error: unknown): boolean {
    if (!error) return false;
    if (error instanceof TaskExecutionError && error.category === "network") return true;
    const name = typeof error === "object" && error !== null && "name" in error ? String((error as { name?: unknown }).name) : "";
    if (name === "ComfyuiNetworkError" || name === "ComfyuiMixedContentError") return true;
    const msg = error instanceof Error ? error.message : typeof error === "string" ? error : "";
    return (
        msg.includes("无法连接 ComfyUI") ||
        msg.includes("本地网络连接已断开") ||
        msg.includes("Failed to fetch") ||
        msg.includes("Load failed") ||
        msg.includes("NetworkError") ||
        msg.includes("ECONNREFUSED") ||
        msg.includes("MixedContent")
    );
}

export function isTimeoutGenerationError(error: unknown): boolean {
    if (!error) return false;
    if (error instanceof TaskExecutionError && error.category === "timeout") return true;
    const name = typeof error === "object" && error !== null && "name" in error ? String((error as { name?: unknown }).name) : "";
    if (name === "ComfyuiTimeoutError") return true;
    const msg = error instanceof Error ? error.message : typeof error === "string" ? error : "";
    return msg.toLowerCase().includes("timeout") || msg.includes("超时");
}

export function isJobExecutionError(error: unknown): boolean {
    if (!error) return false;
    if (error instanceof TaskExecutionError && error.category === "execution_failed") return true;
    const name = typeof error === "object" && error !== null && "name" in error ? String((error as { name?: unknown }).name) : "";
    return name === "ComfyuiJobError";
}

export function localizeErrorDetails(errorDetails?: string): string | undefined {
    if (!errorDetails) return undefined;
    if (isInterruptedGenerationError(errorDetails)) {
        return i18n.t("canvas.generation.interrupted");
    }
    if (
        errorDetails === "Failed to fetch" ||
        errorDetails === "Load failed" ||
        errorDetails === "NetworkError"
    ) {
        return "无法连接 ComfyUI 服务，请检查服务状态与网络设置";
    }
    if (
        errorDetails === "生成失败" ||
        errorDetails === "Generation failed" ||
        errorDetails === "canvas.projectPage.generationFailed"
    ) {
        return i18n.t("canvas.projectPage.generationFailed");
    }
    if (
        errorDetails === "部分生成失败" ||
        errorDetails === "Partial generation failed" ||
        errorDetails === "canvas.projectPage.partialFailed"
    ) {
        return i18n.t("canvas.projectPage.partialFailed");
    }
    if (
        errorDetails === "全部生成失败" ||
        errorDetails === "All generations failed" ||
        errorDetails === "canvas.projectPage.allFailed"
    ) {
        return i18n.t("canvas.projectPage.allFailed");
    }
    if (
        errorDetails === "部分文本生成失败" ||
        errorDetails === "Partial text generation failed" ||
        errorDetails === "canvas.projectPage.partialTextFailed"
    ) {
        return i18n.t("canvas.projectPage.partialTextFailed");
    }
    return errorDetails;
}

/**
 * 计算节点加载中文案（排队位次、重连中或常规生成中）
 */
export function formatNodeLoadingText(meta?: { queuePosition?: number; networkRetryText?: string }): string {
    if (meta?.networkRetryText) {
        return meta.networkRetryText;
    }
    if (typeof meta?.queuePosition === "number" && meta.queuePosition > 0) {
        return `排队中 (第 ${meta.queuePosition} 位)`;
    }
    return i18n.t("canvas.node.generating");
}

export function hasInterruptedGeneration(node: CanvasNodeData): boolean {
    if (node.metadata?.status === "error" && isInterruptedGenerationError(node.metadata?.errorDetails)) {
        return true;
    }
    if (node.metadata?.images?.some((image) => image.status === "error" && isInterruptedGenerationError(image.errorDetails))) {
        return true;
    }
    if (node.metadata?.texts?.some((text) => text.status === "error" && isInterruptedGenerationError(text.errorDetails))) {
        return true;
    }
    return false;
}

export function countInterruptedTasks(nodes: CanvasNodeData[]): number {
    let count = 0;
    for (const node of nodes) {
        if (!hasInterruptedGeneration(node)) continue;
        const interruptedImages = node.metadata?.images?.filter((img) => img.status === "error" && isInterruptedGenerationError(img.errorDetails));
        if (interruptedImages && interruptedImages.length > 0) {
            count += interruptedImages.length;
        } else {
            count += 1;
        }
    }
    return count;
}

export function resetInterruptedGeneration(nodes: CanvasNodeData[]) {
    return nodes.map((node) => {
        const hasInterruptedImages = node.metadata?.images?.some(
            (image) => image.status === "loading" || isInterruptedGenerationError(image.errorDetails),
        );
        const hasInterruptedTexts = node.metadata?.texts?.some(
            (text) => text.status === "loading" || isInterruptedGenerationError(text.errorDetails),
        );
        const isInterrupted = node.metadata?.status === "loading" || isInterruptedGenerationError(node.metadata?.errorDetails) || hasInterruptedImages || hasInterruptedTexts;
        if (isInterrupted) {
            const rootJobId = node.metadata?.jobId;
            return {
                ...node,
                metadata: {
                    ...node.metadata,
                    status: "error" as const,
                    errorDetails: i18n.t("canvas.generation.interrupted"),
                    images: node.metadata.images?.map((image) =>
                        image.status === "loading" || isInterruptedGenerationError(image.errorDetails)
                            ? {
                                  ...image,
                                  status: "error" as const,
                                  errorDetails: i18n.t("canvas.generation.interrupted"),
                                  ...(image.jobId || rootJobId ? { jobId: image.jobId || rootJobId } : {}),
                              }
                            : image,
                    ),
                    texts: node.metadata.texts?.map((text) =>
                        text.status === "loading" || isInterruptedGenerationError(text.errorDetails)
                            ? { ...text, status: "error" as const, errorDetails: i18n.t("canvas.generation.interrupted") }
                            : text,
                    ),
                },
            };
        }
        return node;
    });
}

export function isGenerationCanceled(error: unknown) {
    return error instanceof Error && (error.message === i18n.t("common.requestCanceled") || error.name === "AbortError" || error.name === "ComfyuiAbortedError");
}

export function findRetrySourceNode(nodeId: string, nodes: CanvasNodeData[], connections: CanvasConnection[]) {
    const queue = connections.filter((connection) => connection.kind === "lineage" && connection.toNodeId === nodeId).map((connection) => connection.fromNodeId);
    const visited = new Set<string>();
    while (queue.length) {
        const id = queue.shift()!;
        if (visited.has(id)) continue;
        visited.add(id);
        const node = nodes.find((item) => item.id === id);
        if (node?.type === CanvasNodeType.Config) return node;
        connections.filter((connection) => connection.kind === "lineage" && connection.toNodeId === id).forEach((connection) => queue.push(connection.fromNodeId));
    }
    return null;
}

export function shouldMarkGenerationSourceStatus(sourceNode: CanvasNodeData | null | undefined): boolean {
    if (!sourceNode) return true;
    const hasSuccessContent =
        sourceNode.type !== CanvasNodeType.Config &&
        sourceNode.metadata?.status === "success" &&
        !!sourceNode.metadata?.content;
    return !hasSuccessContent;
}

export function sourceNodeReferenceImages(node: CanvasNodeData | null) {
    if (!node || node.type !== CanvasNodeType.Image || !node.metadata?.content) return [];
    return [
        {
            id: node.id,
            name: `${node.title || node.id}.png`,
            type: node.metadata.mimeType || "image/png",
            dataUrl: node.metadata.content,
            storageKey: node.metadata.storageKey,
        },
    ];
}

export function isAudioFile(file: File) {
    return file.type.startsWith("audio/") || /\.(mp3|wav)$/i.test(file.name);
}

export function buildAngleLabel(params: CanvasImageAngleParams) {
    const horizontal = params.horizontalAngle === 0 ? i18n.t("canvas.generation.front") : params.horizontalAngle > 0 ? i18n.t("canvas.generation.rotateRight", { angle: params.horizontalAngle }) : i18n.t("canvas.generation.rotateLeft", { angle: Math.abs(params.horizontalAngle) });
    const pitch = params.pitchAngle === 0 ? i18n.t("canvas.generation.level") : params.pitchAngle > 0 ? i18n.t("canvas.generation.topDown", { angle: params.pitchAngle }) : i18n.t("canvas.generation.lowAngle", { angle: Math.abs(params.pitchAngle) });
    return i18n.t("canvas.generation.angleLabel", { horizontal, pitch, distance: params.cameraDistance.toFixed(1), lens: i18n.t(params.wideAngle ? "canvas.editors.wide" : "canvas.editors.standard") });
}

export function buildAnglePrompt(params: CanvasImageAngleParams) {
    return i18n.t("canvas.generation.anglePrompt", { angle: buildAngleLabel(params) });
}

/**
 * Generate a new random seed distinct from the previous seed.
 */
export function generateNextSeed(previousSeed?: number, max = 9007199254740991): number {
    let next = Math.floor(Math.random() * max);
    if (previousSeed !== undefined && next === previousSeed) {
        next = (next + 1) % max;
    }
    return next;
}

/**
 * Builds connection(s) for a newly generated node.
 * When intent is "repeat", instead of connecting from the current node itself,
 * it connects from the current node's parent nodes (incoming connections).
 * If no valid parent connections exist, it returns an empty list (the repeated
 * node is a sibling/re-roll, and should never connect to the current node).
 */
export function buildGeneratedNodeConnections(
    sourceNodeId: string,
    targetNodeId: string,
    intent: CanvasGenerationIntent,
    connections: CanvasConnection[],
    nodes: CanvasNodeData[],
): CanvasConnection[] {
    if (intent === "repeat") {
        return duplicateIncomingConnections(sourceNodeId, targetNodeId, connections, nodes);
    }
    return [{ id: nanoid(), fromNodeId: sourceNodeId, toNodeId: targetNodeId, kind: "lineage" }];
}

/**
 * Clones incoming parent connections from a source node to a target node.
 * Validates that parent nodes exist on the canvas and deduplicates connections from the same parent.
 */
export function duplicateIncomingConnections(
    sourceNodeId: string,
    targetNodeId: string,
    connections: CanvasConnection[],
    nodes: CanvasNodeData[],
): CanvasConnection[] {
    const parentConnections = connections.filter(
        (conn) => conn.toNodeId === sourceNodeId && nodes.some((node) => node.id === conn.fromNodeId),
    );
    const seenFromNodeIds = new Set<string>();
    const result: CanvasConnection[] = [];
    for (const conn of parentConnections) {
        if (!seenFromNodeIds.has(conn.fromNodeId)) {
            seenFromNodeIds.add(conn.fromNodeId);
            result.push({
                id: nanoid(),
                fromNodeId: conn.fromNodeId,
                toNodeId: targetNodeId,
                kind: conn.kind,
            });
        }
    }
    return result;
}

/**
 * Builds connection list for pasted / duplicated nodes.
 * Internal connections between duplicated nodes are remapped using idMap.
 * External incoming connections from parent nodes that exist on canvas are preserved.
 */
export function buildPastedNodeConnections(
    sourceConnections: CanvasConnection[],
    idMap: Map<string, string>,
    canvasNodes: CanvasNodeData[],
): CanvasConnection[] {
    const seenPairs = new Set<string>();
    const result: CanvasConnection[] = [];
    for (const conn of sourceConnections) {
        const toNodeId = idMap.get(conn.toNodeId);
        if (!toNodeId) continue;
        const fromNodeId = idMap.get(conn.fromNodeId) || (canvasNodes.some((n) => n.id === conn.fromNodeId) ? conn.fromNodeId : undefined);
        if (!fromNodeId) continue;
        const key = `${fromNodeId}->${toNodeId}`;
        if (seenPairs.has(key)) continue;
        seenPairs.add(key);
        result.push({
            ...conn,
            id: nanoid(),
            fromNodeId,
            toNodeId,
        });
    }
    return result;
}

/**
 * 统一更新画布节点在生成生命周期中的进度与瞬态字段（submitted、pending、running、network_retry）
 */
export function updateNodeGenerationProgress(
    nodes: CanvasNodeData[],
    targetNodeId: string,
    status: string,
    detail?: { jobId?: string; queuePosition?: number; message?: string },
    slotId?: string,
): CanvasNodeData[] {
    const patch = {
        ...(status === "submitted" && detail?.jobId ? { jobId: detail.jobId, networkRetryText: undefined } : {}),
        ...(status === "pending" && typeof detail?.queuePosition === "number" ? { queuePosition: detail.queuePosition, networkRetryText: undefined } : {}),
        ...(status === "running" ? { queuePosition: undefined, networkRetryText: undefined } : {}),
        ...(status === "network_retry" ? { networkRetryText: detail?.message || "服务重连中..." } : {}),
    };
    return nodes.map((node) => {
        if (node.id !== targetNodeId) return node;
        const metadata = node.metadata || {};
        const slots = metadata.images?.length ? metadata.images : metadata.texts;
        return {
            ...node,
            metadata: {
                ...metadata,
                ...(!slots?.length || slots.length === 1 ? patch : {}),
                images: metadata.images?.map((slot) => !slotId || slot.id === slotId ? { ...slot, ...patch } : slot),
                texts: metadata.texts?.map((slot) => !slotId || slot.id === slotId ? { ...slot, ...patch } : slot),
            },
        };
    });
}
