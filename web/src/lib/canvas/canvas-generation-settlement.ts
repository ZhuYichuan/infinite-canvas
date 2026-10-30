import i18n from "@/i18n";
import { isCancelledGenerationError, isJobExecutionError, isLostOrNotFoundGenerationError, isNetworkGenerationError, isTimeoutGenerationError } from "@/lib/canvas/canvas-generation-helpers";
import { TaskExecutionError } from "@/services/api/task/errors";
import { CanvasNodeType, type CanvasGenerationIntent, type CanvasNodeData, type CanvasNodeImage, type CanvasNodeMetadata, type CanvasNodeText } from "@/types/canvas";

type GenerationTarget = { nodeId: string; sourceNodeId?: string };

function updateResult(nodes: CanvasNodeData[], target: GenerationTarget, result: CanvasNodeData): CanvasNodeData[] {
    return nodes.map((node) => {
        if (node.id === result.id) return result;
        if (node.id !== target.sourceNodeId || node.type !== CanvasNodeType.Config) return node;
        return { ...node, metadata: { ...node.metadata, status: result.metadata?.status, errorDetails: result.metadata?.errorDetails, jobId: undefined, queuePosition: undefined, networkRetryText: undefined, isTimeout: undefined } };
    });
}

function settleBatchNode(node: CanvasNodeData): CanvasNodeData {
    const metadata = node.metadata || {};
    const imageBatch = Boolean(metadata.images?.length);
    const slots = imageBatch ? metadata.images : metadata.texts;
    if (!slots?.length) return node;
    const active = slots.some((slot) => slot.status === "loading");
    const completed = slots.filter((slot) => slot.status === "success" && slot.content);
    const failed = slots.filter((slot) => slot.status === "error");
    const primaryId = imageBatch ? metadata.primaryImageId : metadata.primaryTextId;
    const primary = completed.find((slot) => slot.id === primaryId) || completed[0];
    const firstError = failed[0]?.errorDetails || i18n.t("canvas.projectPage.generationFailed");
    const errorDetails = failed.length ? (primary || active ? `${i18n.t(imageBatch ? "canvas.projectPage.partialFailed" : "canvas.projectPage.partialTextFailed")}（${failed.length} 项）：${firstError}` : firstError) : undefined;
    const single = slots.length === 1 ? slots[0] : undefined;
    const primaryMetadata: CanvasNodeMetadata = !primary ? {} : imageBatch
        ? { content: primary.content, primaryImageId: primary.id, storageKey: (primary as CanvasNodeImage).storageKey, naturalWidth: (primary as CanvasNodeImage).naturalWidth, naturalHeight: (primary as CanvasNodeImage).naturalHeight, bytes: (primary as CanvasNodeImage).bytes, mimeType: (primary as CanvasNodeImage).mimeType }
        : { content: primary.content, primaryTextId: primary.id };
    return {
        ...node,
        metadata: {
            ...metadata,
            ...primaryMetadata,
            status: active ? "loading" : primary ? "success" : failed.length ? "error" : "idle",
            errorDetails,
            jobId: !primary ? single?.jobId : undefined,
            isTimeout: !primary ? single?.isTimeout : undefined,
            queuePosition: active ? single?.queuePosition : undefined,
            networkRetryText: active ? single?.networkRetryText : undefined,
        },
    };
}

export function failCanvasGeneration(nodes: CanvasNodeData[], options: GenerationTarget & { slotId?: string; error: unknown; intent?: CanvasGenerationIntent }): CanvasNodeData[] {
    const node = nodes.find((item) => item.id === options.nodeId);
    if (!node) return nodes;
    const metadata = node.metadata || {};
    const slots = metadata.images?.length ? metadata.images : metadata.texts;
    if (options.slotId && !slots?.some((slot) => slot.id === options.slotId)) return nodes;
    const { error } = options;
    const errorDetails = error instanceof Error ? error.message : typeof error === "string" && error ? error : i18n.t("canvas.projectPage.generationFailed");
    const category = error instanceof TaskExecutionError ? error.category : undefined;
    const timeout = category ? category === "timeout" : isTimeoutGenerationError(error);
    const terminal = category ? category === "lost" || category === "cancelled" || category === "execution_failed" : isLostOrNotFoundGenerationError(error) || isCancelledGenerationError(error) || isJobExecutionError(error);
    const resumable = !terminal && (timeout || (category ? category === "network" : isNetworkGenerationError(error)) || options.intent === "resume");
    const errorJobId = typeof error === "object" && error !== null && "jobId" in error && typeof error.jobId === "string" ? error.jobId : undefined;
    const failure = (jobId?: string, useErrorJobId = true): CanvasNodeMetadata => ({ status: "error", errorDetails, jobId: resumable ? (useErrorJobId ? errorJobId : undefined) || jobId : undefined, queuePosition: undefined, networkRetryText: undefined, isTimeout: timeout && !terminal ? true : undefined });
    const failSlot = <T extends CanvasNodeImage | CanvasNodeText>(slot: T): T => options.slotId ? slot.id === options.slotId ? { ...slot, ...failure(slot.jobId) } : slot : slot.status === "success" ? slot : { ...slot, ...failure(slot.jobId, slots?.length === 1) };
    const result = { ...node, metadata: { ...metadata, ...failure(slots?.length ? undefined : metadata.jobId), images: metadata.images?.map(failSlot), texts: metadata.texts?.map(failSlot) } };
    const hasFailedSlots = result.metadata.images?.some((slot) => slot.status === "error") || result.metadata.texts?.some((slot) => slot.status === "error");
    return updateResult(nodes, options, hasFailedSlots ? settleBatchNode(result) : result);
}

export function settleCanvasGeneration(nodes: CanvasNodeData[], options: GenerationTarget): CanvasNodeData[] {
    const node = nodes.find((item) => item.id === options.nodeId);
    if (!node) return nodes;
    const result = settleBatchNode(node);
    return updateResult(nodes, options, result);
}
