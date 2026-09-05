import localforage from "localforage";

import { nanoid } from "nanoid";
import i18n from "@/i18n";
import { resolveModelChannel, resolveModelRequestConfig, type AiConfig } from "@/stores/use-config-store";
import {
    DEFAULT_COMFYUI_FRAME_VIDEO_WORKFLOW,
    DEFAULT_COMFYUI_I2I_WORKFLOW,
    DEFAULT_COMFYUI_INPAINT_WORKFLOW,
    DEFAULT_COMFYUI_T2I_WORKFLOW,
    DEFAULT_COMFYUI_TEXT_WORKFLOW,
    DEFAULT_COMFYUI_VIDEO_WORKFLOW,
} from "./comfyui-default-workflows";
import type { ReferenceImage } from "@/types/image";
import type { ReferenceAudio, ReferenceVideo } from "@/types/media";

export type ComfyuiSize = {
    width: number;
    height: number;
};

const DEFAULT_SIZE: ComfyuiSize = { width: 1024, height: 1024 };
/** Short-edge base (px) used to materialize a plain aspect ratio into pixel dimensions. */
const SIZE_BASE = 1024;
/** Long-edge base (px) for the "2k"/"4k" ratio tiers exposed by the image settings panel. */
const SIZE_TIER_BASE: Record<string, number> = { "2k": 2048, "4k": 3840 };
/** Hard ceiling per side for explicit pixel sizes; beyond this the input is treated as invalid. */
const MAX_PIXEL = 8192;

const PIXEL_SIZE_PATTERN = /^(\d+)\s*[x×]\s*(\d+)$/;
const RATIO_PATTERN = /^(\d+)\s*:\s*(\d+)(?:\s*[-_]\s*(2k|4k))?$/i;

function roundToEven(value: number) {
    return Math.max(2, Math.round(value / 2) * 2);
}

/**
 * Parse an image size setting into pixel dimensions.
 * Accepts "auto"/empty (falls back to 1024x1024), pixel sizes ("1024x1024", rounded to
 * even, each side capped at 8192px), and aspect ratios ("3:4", shorter edge at 1024px,
 * or "16:9-2k"/"9:16-4k" tiers with the longer edge at 2048/3840px to match the
 * image-settings-panel presets). Note the ratio materialization (short edge 1024) may
 * differ by a few pixels from the OpenAI-side preset the UI advertises for the same
 * ratio value (e.g. 4:3 → 1366x1024 here vs 1360x1024 for OpenAI). Anything else throws.
 */
export function parseSize(size?: string): ComfyuiSize {
    const value = (size || "").trim();
    if (!value || value.toLowerCase() === "auto") return { ...DEFAULT_SIZE };
    const pixelMatch = PIXEL_SIZE_PATTERN.exec(value);
    if (pixelMatch) {
        const widthRaw = Number(pixelMatch[1]);
        const heightRaw = Number(pixelMatch[2]);
        if (widthRaw <= 0 || heightRaw <= 0) throw new Error(`Invalid image size: ${value}`);
        const width = roundToEven(widthRaw);
        const height = roundToEven(heightRaw);
        if (width > MAX_PIXEL || height > MAX_PIXEL) throw new Error(`Invalid image size: ${value}`);
        return { width, height };
    }
    const ratioMatch = RATIO_PATTERN.exec(value);
    if (ratioMatch) {
        const a = Number(ratioMatch[1]);
        const b = Number(ratioMatch[2]);
        if (a <= 0 || b <= 0) throw new Error(`Invalid image size: ${value}`);
        const tier = ratioMatch[3]?.toLowerCase();
        if (tier) {
            const base = SIZE_TIER_BASE[tier];
            return a >= b
                ? { width: base, height: roundToEven((base * b) / a) }
                : { width: roundToEven((base * a) / b), height: base };
        }
        return a >= b
            ? { width: roundToEven((SIZE_BASE * a) / b), height: SIZE_BASE }
            : { width: SIZE_BASE, height: roundToEven((SIZE_BASE * b) / a) };
    }
    throw new Error(`Invalid image size: ${value}`);
}

function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("Failed to read image"));
        reader.readAsDataURL(blob);
    });
}

export type ComfyuiWorkflowJson = Record<string, unknown>;

export type ComfyuiBindings = {
    prompt?: string;
    width?: number;
    height?: number;
    seed?: number;
    refImages?: string[];
    refMask?: string;
};

/** Generate a random safe integer seed for ComfyUI nodes (15-digit safe integer). */
export function generateRandomSeed(): number {
    return Math.floor(Math.random() * 1_000_000_000_000_000);
}

/**
 * _meta.title → class_type → input slot for ComfyUI parameters.
 */
const BINDING_TITLE_TO_INPUT_SLOT: Record<string, Record<string, string>> = {
    prompt: { CLIPTextEncode: "text", PrimitiveStringMultiline: "value", PrimitiveString: "value", TextEncodeBooguEdit: "prompt", TextEncodeQwenImageEditPlus: "prompt" },
    width: { PrimitiveInt: "value", PrimitiveFloat: "value" },
    height: { PrimitiveInt: "value", PrimitiveFloat: "value" },
    seed: { KSampler: "seed", KSamplerAdvanced: "noise_seed", PrimitiveInt: "value", PrimitiveFloat: "value" },
    ref_image: { LoadImage: "image", LoadImageMask: "image" },
    ref_mask: { LoadImage: "image", LoadImageMask: "image" },
};

/**
 * Deep-copy a workflow and write generation params into the nodes marked by
 * _meta.title ("prompt", "width", "height", "seed", "ref_image", "ref_mask").
 * Nodes with a known title but an unrecognized class_type check fallback slot names before being skipped.
 * The original workflow object is never mutated.
 */
export function applyBindings(workflow: ComfyuiWorkflowJson, params: ComfyuiBindings): ComfyuiWorkflowJson {
    const cloned = structuredClone(workflow);
    type NodeRecord = { class_type?: string; inputs?: Record<string, unknown>; _meta?: { title?: unknown } };
    let boundSeed = false;
    for (const node of Object.values(cloned)) {
        if (typeof node !== "object" || node === null) continue;
        const record = node as NodeRecord;
        const rawTitle = record._meta?.title;
        if (typeof rawTitle !== "string" || !record.class_type || !record.inputs) continue;
        const title = rawTitle.trim().toLowerCase();
        let slot: string | undefined;
        let value: unknown;
        if (title === "prompt" && params.prompt !== undefined) {
            slot = BINDING_TITLE_TO_INPUT_SLOT.prompt[record.class_type] || ("value" in record.inputs ? "value" : "text" in record.inputs ? "text" : "prompt" in record.inputs ? "prompt" : undefined);
            value = params.prompt;
        } else if (title === "width" && params.width !== undefined) {
            slot = BINDING_TITLE_TO_INPUT_SLOT.width[record.class_type] || ("value" in record.inputs ? "value" : "width" in record.inputs ? "width" : undefined);
            value = params.width;
        } else if (title === "height" && params.height !== undefined) {
            slot = BINDING_TITLE_TO_INPUT_SLOT.height[record.class_type] || ("value" in record.inputs ? "value" : "height" in record.inputs ? "height" : undefined);
            value = params.height;
        } else if (title === "seed" && params.seed !== undefined) {
            slot = BINDING_TITLE_TO_INPUT_SLOT.seed[record.class_type];
            if (!slot) {
                if ("seed" in record.inputs) slot = "seed";
                else if ("noise_seed" in record.inputs) slot = "noise_seed";
                else if ("value" in record.inputs) slot = "value";
            }
            value = params.seed;
            boundSeed = true;
        } else if (title.startsWith("ref_image") && params.refImages?.length) {
            const m = /^ref_image_(0[1-9])$/.exec(title);
            const index = m ? Number(m[1]) - 1 : 0;
            if (params.refImages[index]) {
                slot = BINDING_TITLE_TO_INPUT_SLOT.ref_image[record.class_type] || "image";
                value = params.refImages[index];
            }
        } else if ((title === "ref_mask" || title === "mask" || title === "ref_mask_01") && params.refMask) {
            slot = BINDING_TITLE_TO_INPUT_SLOT.ref_mask[record.class_type] || "image";
            value = params.refMask;
        }
        if (slot) record.inputs[slot] = value;
    }
    // Fallback: if no node had _meta.title === "seed", find any sampler with a literal numeric seed
    if (!boundSeed && params.seed !== undefined) {
        for (const node of Object.values(cloned)) {
            if (typeof node !== "object" || node === null) continue;
            const record = node as NodeRecord;
            if (!record.inputs) continue;
            if (typeof record.inputs.seed === "number") {
                record.inputs.seed = params.seed;
                break;
            } else if (typeof record.inputs.noise_seed === "number") {
                record.inputs.noise_seed = params.seed;
                break;
            }
        }
    }

    // 自动抹除未指派资产的参考节点（图片）及其级联连线与 ReferenceLatent 节点桥接
    const assignedImageCount = params.refImages?.length || 0;
    const removedNodeIds = new Set<string>();

    for (const [id, node] of Object.entries(cloned)) {
        if (typeof node !== "object" || node === null) continue;
        const record = node as NodeRecord;
        const rawTitle = record._meta?.title;
        const title = typeof rawTitle === "string" ? rawTitle.trim().toLowerCase() : "";

        const imgMatch = /^ref_image_(0[1-9])$/.exec(title);
        if (imgMatch) {
            const idx = Number(imgMatch[1]) - 1;
            if (idx >= assignedImageCount) removedNodeIds.add(id);
        } else if (title === "ref_image" && assignedImageCount === 0) {
            removedNodeIds.add(id);
        }
    }

    // 级联处理与旁路桥接（例如 ReferenceLatent、ApplyControlNet、VAEEncode、ImageScaleToTotalPixels）
    let hasMorePruning = true;
    while (hasMorePruning) {
        hasMorePruning = false;
        for (const [id, node] of Object.entries(cloned)) {
            if (removedNodeIds.has(id)) continue;
            const record = node as NodeRecord;
            if (!record.inputs) continue;

            // 1. 如果是 ReferenceLatent 节点，且其 latent 输入节点被删除了
            if (record.class_type === "ReferenceLatent") {
                const latentInput = record.inputs.latent;
                if (Array.isArray(latentInput) && removedNodeIds.has(String(latentInput[0]))) {
                    const upstreamConditioning = record.inputs.conditioning;
                    if (Array.isArray(upstreamConditioning)) {
                        // 将所有消费当前 ReferenceLatent 输出的节点，重定向至 upstream conditioning
                        for (const [otherId, otherNode] of Object.entries(cloned)) {
                            if (otherId === id || typeof otherNode !== "object" || otherNode === null) continue;
                            const otherRec = otherNode as NodeRecord;
                            if (!otherRec.inputs) continue;
                            for (const [key, val] of Object.entries(otherRec.inputs)) {
                                if (Array.isArray(val) && String(val[0]) === id) {
                                    otherRec.inputs[key] = [upstreamConditioning[0], upstreamConditioning[1] ?? 0];
                                }
                            }
                        }
                    }
                    removedNodeIds.add(id);
                    hasMorePruning = true;
                    continue;
                }
            }

            // 2. 正向级联：如果当前节点的输入来自已删除节点（非 Flux2Scheduler 尺寸回退容错），则当前节点亦无法运行，一并抹除
            let hasRemovedInput = false;
            for (const [key, val] of Object.entries(record.inputs)) {
                if (Array.isArray(val) && removedNodeIds.has(String(val[0]))) {
                    if (record.class_type === "Flux2Scheduler" && (key === "width" || key === "height")) {
                        continue;
                    }
                    hasRemovedInput = true;
                    break;
                }
            }
            if (hasRemovedInput) {
                removedNodeIds.add(id);
                hasMorePruning = true;
                continue;
            }

            // 3. 通用反向级联：若某非输出节点仅被已删除节点消费（无存活消费者），则一并抹除
            if (record.class_type !== "SaveImage") {
                let hasLiveConsumer = false;
                let hasRemovedConsumer = false;
                for (const [otherId, otherNode] of Object.entries(cloned)) {
                    if (otherId === id || typeof otherNode !== "object" || otherNode === null) continue;
                    const otherRec = otherNode as NodeRecord;
                    for (const val of Object.values(otherRec.inputs || {})) {
                        if (Array.isArray(val) && String(val[0]) === id) {
                            if (removedNodeIds.has(otherId)) hasRemovedConsumer = true;
                            else hasLiveConsumer = true;
                            break;
                        }
                    }
                    if (hasLiveConsumer) break;
                }
                if (hasRemovedConsumer && !hasLiveConsumer) {
                    removedNodeIds.add(id);
                    hasMorePruning = true;
                }
            }
        }
    }

    if (removedNodeIds.size > 0) {
        for (const id of removedNodeIds) {
            delete cloned[id];
        }
        for (const node of Object.values(cloned)) {
            if (typeof node !== "object" || node === null) continue;
            const record = node as NodeRecord;
            if (!record.inputs) continue;
            for (const [inputKey, val] of Object.entries(record.inputs)) {
                if (Array.isArray(val) && removedNodeIds.has(String(val[0]))) {
                    // 若是 Flux2Scheduler 的 width/height 丢失，回退到指定的尺寸
                    if (record.class_type === "Flux2Scheduler" && (inputKey === "width" || inputKey === "height")) {
                        record.inputs[inputKey] = inputKey === "width" ? params.width ?? 1024 : params.height ?? 1024;
                    } else {
                        delete record.inputs[inputKey];
                    }
                }
            }
        }
    }

    return cloned;
}

/** Base class for every error raised by the ComfyUI service layer. */
export class ComfyuiError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ComfyuiError";
    }
}

export class ComfyuiApiError extends ComfyuiError {
    readonly status?: number;

    constructor(message: string, status?: number) {
        super(message);
        this.name = "ComfyuiApiError";
        this.status = status;
    }
}

/** Thrown when the proxy reports the job reached a failed or cancelled state. */
export class ComfyuiJobError extends ComfyuiError {
    readonly status: string;

    constructor(message: string, status: string) {
        super(message);
        this.name = "ComfyuiJobError";
        this.status = status;
    }
}

/** Thrown when the job has not reached a terminal state within the timeout window. */
export class ComfyuiTimeoutError extends ComfyuiError {
    readonly timeoutMs: number;
    readonly jobId?: string;

    constructor(timeoutMs: number, jobId?: string) {
        const durationDesc =
            timeoutMs >= 3600_000
                ? `${(timeoutMs / 3600_000).toFixed(1).replace(/\.0$/, "")}h`
                : timeoutMs >= 60_000
                  ? `${Math.floor(timeoutMs / 60_000)}m`
                  : `${Math.floor(timeoutMs / 1000)}s`;
        super(`${i18n.t("comfyui.timeout")} (after ${durationDesc})`);
        this.name = "ComfyuiTimeoutError";
        this.timeoutMs = timeoutMs;
        this.jobId = jobId;
    }
}

/** Thrown when the caller aborted the in-flight generation. */
export class ComfyuiAbortedError extends ComfyuiError {
    constructor(message = i18n.t("comfyui.cancelled")) {
        super(message);
        this.name = "ComfyuiAbortedError";
    }
}

/** Thrown when the selected model has no ComfyUI workflow attached. */
export class ComfyuiNoWorkflowError extends ComfyuiError {
    constructor(message = "No ComfyUI workflow is attached to this model") {
        super(message);
        this.name = "ComfyuiNoWorkflowError";
    }
}

export function isMixedContentHttp(url?: string): boolean {
    if (typeof window === "undefined" || !url) return false;
    return window.location.protocol === "https:" && url.trim().toLowerCase().startsWith("http://");
}

export function notifyMixedContentBlocked(url: string) {
    if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("comfyui:mixed-content-blocked", { detail: { url } }));
    }
}

export class ComfyuiMixedContentError extends ComfyuiError {
    readonly baseUrl: string;

    constructor(baseUrl: string) {
        super(`浏览器安全策略拦截了对本地 HTTP 服务 (${baseUrl}) 的请求。请在浏览器地址栏左侧点击锁头图标 ->「网站设置/此站点的权限」-> 将「不安全内容」设为「允许」后刷新页面。`);
        this.name = "ComfyuiMixedContentError";
        this.baseUrl = baseUrl;
    }
}

async function comfyuiFetch(url: string, init?: RequestInit, baseUrl = url): Promise<Response> {
    try {
        return await fetch(url, init);
    } catch (error) {
        if (isMixedContentHttp(baseUrl)) {
            notifyMixedContentBlocked(baseUrl);
            throw new ComfyuiMixedContentError(baseUrl);
        }
        throw error;
    }
}

function normalizeBaseUrl(baseUrl: string) {
    return baseUrl.trim().replace(/\/+$/, "");
}

/**
 * Submit a bound workflow to ComfyUI's /prompt endpoint; returns prompt_id as jobId.
 */
export async function submitJob(workflow: ComfyuiWorkflowJson, baseUrl: string, token?: string): Promise<string> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    const clientId = nanoid();
    const response = await comfyuiFetch(`${normalizeBaseUrl(baseUrl)}/prompt`, {
        method: "POST",
        headers,
        body: JSON.stringify({ prompt: workflow, client_id: clientId }),
    }, baseUrl);
    if (!response.ok) {
        let errDetail = `${response.status}`;
        try {
            const errJson = (await response.json()) as { error?: { message?: string; details?: string; type?: string }; node_errors?: Record<string, unknown> };
            if (errJson?.node_errors && Object.keys(errJson.node_errors).length) {
                errDetail = JSON.stringify(errJson.node_errors);
            } else if (errJson?.error?.message) {
                errDetail = errJson.error.details ? `${errJson.error.message}: ${errJson.error.details}` : errJson.error.message;
            }
        } catch {
            // ignore
        }
        throw new ComfyuiApiError(`ComfyUI 任务提交失败: ${errDetail}`, response.status);
    }
    const data = (await response.json()) as { prompt_id?: unknown; node_errors?: Record<string, unknown> };
    if (data?.node_errors && Object.keys(data.node_errors).length > 0) {
        throw new ComfyuiApiError(`ComfyUI 工作流校验报错: ${JSON.stringify(data.node_errors)}`);
    }
    if (typeof data?.prompt_id !== "string") throw new ComfyuiApiError("ComfyUI /prompt 响应未返回 prompt_id");
    return data.prompt_id;
}

/** How often the job status is polled while the job is pending or in progress. */
const JOB_POLL_INTERVAL_MS = 2_000;
/** Total window allowed for the job to complete before the request times out (2 hours). */
const JOB_TIMEOUT_MS = 7_200_000;

type ComfyuiJobResponse = {
    status?: {
        status_str?: string;
        completed?: boolean;
        messages?: unknown[];
    };
    outputs?: Record<string, unknown>;
};

/** Collect the image asset identifiers from outputs. */
function collectImageAssetIds(outputs: unknown): string[] {
    const ids: string[] = [];
    if (!Array.isArray(outputs)) return ids;
    for (const entry of outputs) {
        if (!entry || typeof entry !== "object") continue;
        const { id, type, content_type, filename } = entry as { id?: unknown; type?: unknown; content_type?: unknown; filename?: unknown };
        const assetId = typeof id === "string" && id ? id : typeof filename === "string" ? filename : "";
        if (!assetId) continue;
        const fn = typeof filename === "string" ? filename.toLowerCase() : "";
        if (fn.endsWith(".mp4") || fn.endsWith(".webm") || fn.endsWith(".mov") || fn.endsWith(".mkv")) continue;
        if (type === "image" || (typeof content_type === "string" && content_type.startsWith("image/"))) ids.push(assetId);
    }
    return ids;
}

export function prioritizeInpaintOutput(outputs: unknown, workflow: ComfyuiWorkflowJson): string[] {
    if (!Array.isArray(outputs)) return [];
    let compositeSaveNodeId: string | undefined;
    for (const [nodeId, node] of Object.entries(workflow)) {
        if (typeof node !== "object" || node === null) continue;
        const rec = node as { class_type?: string; inputs?: { images?: [string, number] } };
        if (rec.class_type === "SaveImage" && Array.isArray(rec.inputs?.images) && rec.inputs.images[0]) {
            const upstreamId = String(rec.inputs.images[0]);
            const upstream = workflow[upstreamId] as { class_type?: string } | undefined;
            if (upstream?.class_type === "ImageCompositeMasked") {
                compositeSaveNodeId = nodeId;
                break;
            }
        }
    }

    const items: Array<{ id: string; nodeId?: string }> = [];
    for (const entry of outputs) {
        if (!entry || typeof entry !== "object") continue;
        const { id, type, content_type, node_id, filename } = entry as { id?: unknown; type?: unknown; content_type?: unknown; node_id?: unknown; filename?: unknown };
        const assetId = typeof id === "string" && id ? id : typeof filename === "string" ? filename : "";
        if (!assetId) continue;
        const fn = typeof filename === "string" ? filename.toLowerCase() : "";
        if (fn.endsWith(".mp4") || fn.endsWith(".webm") || fn.endsWith(".mov") || fn.endsWith(".mkv")) continue;
        if (type === "image" || (typeof content_type === "string" && content_type.startsWith("image/"))) {
            items.push({ id: assetId, nodeId: typeof node_id === "string" ? node_id : undefined });
        }
    }

    if (compositeSaveNodeId) {
        items.sort((a, b) => (a.nodeId === compositeSaveNodeId ? -1 : b.nodeId === compositeSaveNodeId ? 1 : 0));
    }
    return items.map((item) => item.id);
}

export type PollJobResult = {
    outputs: Array<{
        id: string;
        filename?: string;
        subfolder?: string;
        type?: string;
        content_type?: string;
        node_id?: string;
        text?: string;
        value?: string;
        url?: string;
    }>;
    job: ComfyuiJobResponse;
};

export async function pollJobRaw(jobId: string, baseUrl: string, token?: string, signal?: AbortSignal, deadlineMs?: number): Promise<PollJobResult | undefined> {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const startedAt = Date.now();
    for (;;) {
        if (signal?.aborted) return undefined;
        if (deadlineMs !== undefined && Date.now() >= deadlineMs) throw new ComfyuiTimeoutError(Math.max(0, deadlineMs - startedAt), jobId);
        const response = await comfyuiFetch(`${normalizeBaseUrl(baseUrl)}/history/${jobId}`, { headers }, baseUrl);
        if (!response.ok) throw new ComfyuiApiError(`Failed to poll ComfyUI history: ${response.status}`, response.status);
        const data = (await response.json()) as Record<
            string,
            {
                outputs?: Record<
                    string,
                    {
                        images?: Array<{ filename: string; subfolder?: string; type?: string }>;
                        videos?: Array<{ filename: string; subfolder?: string; type?: string }>;
                        gifs?: Array<{ filename: string; subfolder?: string; type?: string }>;
                        audio?: Array<{ filename: string; subfolder?: string; type?: string }>;
                        text?: string[] | string;
                        string?: string[] | string;
                        animated?: boolean[];
                        ui?: Record<string, unknown>;
                    }
                >;
                status?: {
                    status_str?: string;
                    completed?: boolean;
                    messages?: unknown[];
                };
            }
        >;

        const jobEntry = data?.[jobId];
        if (jobEntry) {
            const statusStr = jobEntry.status?.status_str;
            if (statusStr === "error") {
                const msg = Array.isArray(jobEntry.status?.messages) ? JSON.stringify(jobEntry.status?.messages) : statusStr;
                throw new ComfyuiJobError(`ComfyUI 执行失败: ${msg}`, statusStr);
            }

            const rawOutputs = jobEntry.outputs || {};
            const outputs: PollJobResult["outputs"] = [];

            for (const [nodeId, nodeOut] of Object.entries(rawOutputs)) {
                if (!nodeOut || typeof nodeOut !== "object") continue;

                if (Array.isArray(nodeOut.images)) {
                    for (const img of nodeOut.images) {
                        if (img?.filename) {
                            const subfolder = img.subfolder || "";
                            const itemType = img.type || "output";
                            const isVideo = /\.(mp4|webm|mov|avi|mkv)$/i.test(img.filename);
                            const isAnimated = Boolean(Array.isArray(nodeOut.animated) && nodeOut.animated[0]);
                            const contentType = isVideo ? "video/mp4" : isAnimated ? "image/gif" : "image/png";
                            const viewPath = `/api/view?filename=${encodeURIComponent(img.filename)}&type=${encodeURIComponent(itemType)}&subfolder=${encodeURIComponent(subfolder)}`;
                            outputs.push({
                                id: viewPath,
                                filename: img.filename,
                                subfolder,
                                type: isVideo ? "video" : itemType,
                                content_type: contentType,
                                node_id: nodeId,
                            });
                        }
                    }
                }

                if (Array.isArray(nodeOut.videos)) {
                    for (const vid of nodeOut.videos) {
                        if (vid?.filename) {
                            const subfolder = vid.subfolder || "";
                            const itemType = vid.type || "output";
                            const viewPath = `/api/view?filename=${encodeURIComponent(vid.filename)}&type=${encodeURIComponent(itemType)}&subfolder=${encodeURIComponent(subfolder)}`;
                            outputs.push({
                                id: viewPath,
                                filename: vid.filename,
                                subfolder,
                                type: "video",
                                content_type: "video/mp4",
                                node_id: nodeId,
                            });
                        }
                    }
                }
                if (Array.isArray(nodeOut.gifs)) {
                    for (const gif of nodeOut.gifs) {
                        if (gif?.filename) {
                            const subfolder = gif.subfolder || "";
                            const itemType = gif.type || "output";
                            const viewPath = `/api/view?filename=${encodeURIComponent(gif.filename)}&type=${encodeURIComponent(itemType)}&subfolder=${encodeURIComponent(subfolder)}`;
                            outputs.push({
                                id: viewPath,
                                filename: gif.filename,
                                subfolder,
                                type: "video",
                                content_type: "video/mp4",
                                node_id: nodeId,
                            });
                        }
                    }
                }

                if (Array.isArray(nodeOut.audio)) {
                    for (const aud of nodeOut.audio) {
                        if (aud?.filename) {
                            const subfolder = aud.subfolder || "";
                            const itemType = aud.type || "output";
                            const viewPath = `/api/view?filename=${encodeURIComponent(aud.filename)}&type=${encodeURIComponent(itemType)}&subfolder=${encodeURIComponent(subfolder)}`;
                            outputs.push({
                                id: viewPath,
                                filename: aud.filename,
                                subfolder,
                                type: "audio",
                                content_type: "audio/mp3",
                                node_id: nodeId,
                            });
                        }
                    }
                }

                if (nodeOut.text) {
                    const textVal = Array.isArray(nodeOut.text) ? nodeOut.text.join("\n") : String(nodeOut.text);
                    if (textVal.trim()) {
                        outputs.push({
                            id: `text_${nodeId}`,
                            text: textVal,
                            content_type: "text/plain",
                            node_id: nodeId,
                        });
                    }
                }
                if (nodeOut.string) {
                    const strVal = Array.isArray(nodeOut.string) ? nodeOut.string.join("\n") : String(nodeOut.string);
                    if (strVal.trim()) {
                        outputs.push({
                            id: `text_${nodeId}`,
                            text: strVal,
                            content_type: "text/plain",
                            node_id: nodeId,
                        });
                    }
                }
            }

            if (jobEntry.status?.completed || outputs.length > 0) {
                return { outputs, job: jobEntry };
            }
        }

        await new Promise((resolve) => setTimeout(resolve, JOB_POLL_INTERVAL_MS));
    }
}

/**
 * Poll ComfyUI /history endpoint until the job reaches a terminal state.
 */
export async function pollJob(
    jobId: string,
    baseUrl: string,
    token?: string,
    signal?: AbortSignal,
    deadlineMs?: number,
    collector: (outputs: unknown) => string[] = collectImageAssetIds,
): Promise<string[] | undefined> {
    const res = await pollJobRaw(jobId, baseUrl, token, signal, deadlineMs);
    return res !== undefined ? collector(res.outputs) : undefined;
}

/**
 * Download an asset from ComfyUI /view endpoint and convert it to a data URL.
 */
export async function downloadAsset(
    assetIdOrFilename: string,
    baseUrl: string,
    token?: string,
    options?: { subfolder?: string; type?: string },
): Promise<{ blob: Blob; dataUrl: string }> {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    let url: string;
    if (assetIdOrFilename.startsWith("http://") || assetIdOrFilename.startsWith("https://")) {
        url = assetIdOrFilename;
    } else if (assetIdOrFilename.startsWith("/view?") || assetIdOrFilename.startsWith("/api/view?")) {
        url = `${normalizeBaseUrl(baseUrl)}${assetIdOrFilename}`;
    } else {
        let filename = assetIdOrFilename;
        let subfolder = options?.subfolder || "";
        if (!subfolder && filename.includes("/")) {
            const parts = filename.split("/");
            filename = parts.pop() || filename;
            subfolder = parts.join("/");
        }
        const type = options?.type || "output";
        url = `${normalizeBaseUrl(baseUrl)}/view?filename=${encodeURIComponent(filename)}&subfolder=${encodeURIComponent(subfolder)}&type=${encodeURIComponent(type)}`;
    }

    let response = await comfyuiFetch(url, { headers }, baseUrl);
    if (!response.ok && response.status === 404) {
        let altUrl = "";
        if (url.includes("/api/view?")) {
            altUrl = url.replace("/api/view?", "/view?");
        } else if (url.includes("/view?")) {
            altUrl = url.replace("/view?", "/api/view?");
        }
        if (altUrl) {
            try {
                const altResponse = await comfyuiFetch(altUrl, { headers }, baseUrl);
                if (altResponse.ok) {
                    response = altResponse;
                }
            } catch {
                // keep original response
            }
        }
    }
    if (!response.ok) throw new ComfyuiApiError(`Failed to download asset from ComfyUI: ${response.status}`, response.status);
    const blob = await response.blob();
    if (!blob.size) throw new ComfyuiApiError("Downloaded asset is empty");
    return { blob, dataUrl: await blobToDataUrl(blob) };
}

/**
 * Best-effort interrupt of a running job via /interrupt.
 */
export async function cancelJob(_jobId: string, baseUrl: string, token?: string): Promise<void> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    try {
        await fetch(`${normalizeBaseUrl(baseUrl)}/interrupt`, { method: "POST", headers, body: "{}" });
    } catch {
        // The abort takes priority over the cancel outcome.
    }
}

const generationLogStore = localforage.createInstance({ name: "infinite-canvas", storeName: "image_generation_logs" });

export type ComfyuiGenerationLog = {
    model: string;
    prompt: string;
    provider: "comfyui";
    jobId?: string;
    durationMs: number;
    status: "success" | "failed";
    imageCount?: number;
    images?: Array<{ id: string; dataUrl: string; seed?: number }>;
    errorMessage?: string;
    seed?: number;
};

/**
 * Persist a ComfyUI generation into the shared `image_generation_logs` localforage
 * store (the same store the OpenAI/Gemini workbench logs use) so it shows up in the
 * workbench history. The entry keeps the fields the image page's log normalizer
 * understands, plus ComfyUI-specific extras (provider / jobId / errorMessage).
 * Returns the entry id.
 */
export async function logImageGeneration(entry: ComfyuiGenerationLog): Promise<string> {
    const id = nanoid();
    const succeeded = entry.status === "success";
    const imageCount = entry.imageCount ?? 0;
    const record: Record<string, unknown> = {
        id,
        createdAt: Date.now(),
        title: entry.prompt.slice(0, 12),
        prompt: entry.prompt,
        model: entry.model,
        provider: entry.provider,
        jobId: entry.jobId || "",
        status: entry.status,
        durationMs: entry.durationMs,
        successCount: succeeded ? imageCount : 0,
        failCount: succeeded ? 0 : 1,
        imageCount: succeeded ? imageCount : 0,
        images: succeeded ? entry.images ?? [] : [],
    };
    if (entry.errorMessage) record.errorMessage = entry.errorMessage;
    if (entry.seed !== undefined) record.seed = entry.seed;
    await generationLogStore.setItem(id, record);
    return id;
}

export interface ComfyuiImageRequest {
    config: AiConfig;
    model: string;
    prompt: string;
    size?: string;
    seed?: number;
    jobId?: string;
    references?: ReferenceImage[];
    signal?: AbortSignal;
    onProgress?: (status: string, detail?: Record<string, unknown>) => void;
}

export interface ComfyuiImageResult {
    items: Array<{ id: string; dataUrl: string; seed?: number }>;
    jobId: string;
    seed?: number;
}

function imageReferenceSlots(workflow: ComfyuiWorkflowJson) {
    return Object.values(workflow)
        .map((node) => (node && typeof node === "object" ? (node as { _meta?: { title?: unknown } })._meta?.title : undefined))
        .filter((title): title is string => typeof title === "string")
        .map((title) => title.trim().toLowerCase())
        .filter((title) => /^ref_image(_0[1-9])?$/.test(title))
        .sort();
}

/**
 * Run a full ComfyUI image generation: resolve the channel and model, bind the
 * generation params into the model's workflow, submit the job, poll it until
 * completion (10 minute deadline) and download the outputs as data urls.
 *
 * - Aborting the signal cancels the job on the proxy and rejects with
 *   ComfyuiAbortedError; the timeout window does NOT cancel the job, it only
 *   rejects with ComfyuiTimeoutError.
 * - Exactly one image_generation_logs entry (success or failed) is written
 *   before the result is returned or the error rethrown.
 */
export async function requestComfyuiImage(req: ComfyuiImageRequest): Promise<ComfyuiImageResult> {
    const startedAt = Date.now();
    let requestConfig: ReturnType<typeof resolveModelRequestConfig> | undefined;
    let jobId = req.jobId || "";
    let seed: number | undefined = req.seed;
    try {
        requestConfig = resolveModelRequestConfig(req.config, req.model);
        const channel = resolveModelChannel(req.config, req.model);
        const requestModel = requestConfig.model;
        const channelModel = channel.models.find((model) => model.name === requestModel);
        const references = req.references || [];
        const isI2i = references.length > 0;
        const workflow = isI2i
            ? channel.comfyuiI2iWorkflow ||
              channel.models.find((m) => m.name === "ComfyUI I2I" || m.name.toLowerCase().includes("i2i") || m.name.includes("图生图"))?.comfyuiWorkflow ||
              channelModel?.comfyuiWorkflow ||
              channel.models[0]?.comfyuiWorkflow ||
              DEFAULT_COMFYUI_I2I_WORKFLOW
            : channelModel?.comfyuiWorkflow ||
              channel.models.find((m) => m.name === "ComfyUI T2I" || m.name.toLowerCase().includes("t2i") || m.name.includes("文生图"))?.comfyuiWorkflow ||
              channel.models[0]?.comfyuiWorkflow ||
              DEFAULT_COMFYUI_T2I_WORKFLOW;
        if (!workflow) throw new ComfyuiNoWorkflowError(i18n.t("comfyui.noWorkflow", { model: requestModel }));
        const baseUrl = (channel.comfyuiProxyUrl || "").trim();
        const token = channel.comfyuiProxyToken;

        if (!jobId) {
            const referenceSlots = imageReferenceSlots(workflow.json);
            if (references.length && !referenceSlots.length) throw new ComfyuiError(i18n.t("comfyui.noImageReferenceSlot"));
            if (references.length > referenceSlots.length) throw new ComfyuiError(i18n.t("comfyui.imageReferenceLimit", { count: referenceSlots.length }));

            const size = parseSize(req.size);
            if (seed === undefined) seed = generateRandomSeed();
            const refImages = await Promise.all(references.map((image, index) => uploadComfyuiAsset(baseUrl, token, image.dataUrl, image.name || `ref_image_${index + 1}.png`, req.signal)));
            const boundWorkflow = applyBindings(workflow.json, { prompt: req.prompt, width: size.width, height: size.height, seed, refImages });
            jobId = await submitJob(boundWorkflow, baseUrl, token);
            req.onProgress?.("submitted", { jobId });
        }

        const signal = req.signal;
        if (signal?.aborted) {
            await cancelJob(jobId, baseUrl, token);
            throw new ComfyuiAbortedError();
        }

        const polling = pollJob(jobId, baseUrl, token, signal, startedAt + JOB_TIMEOUT_MS);
        let waiting: Promise<string[] | undefined> = polling;
        if (signal) {
            // `{ once: true }` keeps the cancel call idempotent across repeated aborts;
            // the timeout path never reaches this listener. Aborting rejects the race
            // immediately so polling can stop without leaking on the heap.
            const aborted: Promise<never> = new Promise((_resolve, reject) => {
                signal.addEventListener("abort", () => {
                    void cancelJob(jobId, baseUrl, token).catch(() => undefined);
                    reject(new ComfyuiAbortedError());
                }, { once: true });
            });
            waiting = Promise.race([polling, aborted]);
        }
        const resultAssetIds = await waiting;
        if (!resultAssetIds) {
            // pollJob exited silently because the signal aborted; the abort listener already cancelled the job.
            throw new ComfyuiAbortedError();
        }

        const items: Array<{ id: string; dataUrl: string; seed?: number }> = [];
        for (const assetId of resultAssetIds) {
            const { dataUrl } = await downloadAsset(assetId, baseUrl, token);
            items.push({ id: nanoid(), dataUrl, seed });
        }

        void logImageGeneration({ model: requestConfig.model, prompt: req.prompt, provider: "comfyui", jobId, durationMs: Date.now() - startedAt, status: "success", imageCount: items.length, images: items, seed }).catch(() => undefined);
        return { items, jobId, seed };
    } catch (error) {
        void logImageGeneration({
            model: requestConfig?.model ?? req.model,
            prompt: req.prompt,
            provider: "comfyui",
            jobId: jobId || undefined,
            durationMs: Date.now() - startedAt,
            status: "failed",
            errorMessage: error instanceof Error ? error.message : String(error),
            seed,
        }).catch(() => undefined);
        throw error;
    }
}

/**
 * Upload an image/media (dataURL or blob URL) to ComfyUI's /upload/image endpoint.
 * Returns the uploaded file name.
 */
export async function uploadComfyuiAsset(
    baseUrl: string,
    token: string | undefined,
    dataUrl: string,
    filename = "image.png",
    signal?: AbortSignal,
): Promise<string> {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const form = new FormData();
    const safeFilename = `${nanoid(8)}_${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    form.append("image", blob, safeFilename);
    form.append("overwrite", "true");
    form.append("type", "input");

    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    const uploadRes = await comfyuiFetch(`${normalizeBaseUrl(baseUrl)}/upload/image`, {
        method: "POST",
        headers,
        body: form,
        signal,
    }, baseUrl);
    if (!uploadRes.ok) {
        throw new ComfyuiApiError(`Upload asset failed: ${uploadRes.status}`, uploadRes.status);
    }
    const data = (await uploadRes.json()) as { name?: string; subfolder?: string };
    if (!data?.name) throw new ComfyuiApiError("Upload asset returned missing name");
    return data.subfolder ? `${data.subfolder}/${data.name}` : data.name;
}

export interface ComfyuiInpaintRequest {
    config: AiConfig;
    prompt: string;
    sourceDataUrl: string;
    maskDataUrl: string;
    seed?: number;
    jobId?: string;
    signal?: AbortSignal;
    onProgress?: (status: string, detail?: { jobId?: string }) => void;
}

export async function requestComfyuiInpaint(req: ComfyuiInpaintRequest): Promise<ComfyuiImageResult> {
    const startedAt = Date.now();
    let jobId = req.jobId || "";
    let seed: number | undefined = req.seed;
    try {
        const channel = resolveModelChannel(req.config, req.config.model || req.config.imageModel);
        const inpaintWorkflow =
            channel.comfyuiInpaintWorkflow ||
            channel.models.find((m) => m.name.toLowerCase().includes("inpaint") || m.name.includes("局部编辑"))?.comfyuiWorkflow ||
            DEFAULT_COMFYUI_INPAINT_WORKFLOW;
        if (!inpaintWorkflow) {
            throw new ComfyuiNoWorkflowError(i18n.t("comfyui.noInpaintWorkflow"));
        }
        const baseUrl = (channel.comfyuiProxyUrl || "").trim();
        const token = channel.comfyuiProxyToken;

        if (!jobId) {
            // 1. Upload source image and mask image
            const [refAssetId, maskAssetId] = await Promise.all([
                uploadComfyuiAsset(baseUrl, token, req.sourceDataUrl, "ref_image.png", req.signal),
                uploadComfyuiAsset(baseUrl, token, req.maskDataUrl, "ref_mask.png", req.signal),
            ]);

            // 2. Bind parameters into workflow
            if (seed === undefined) seed = generateRandomSeed();
            const boundWorkflow = applyBindings(inpaintWorkflow.json, {
                prompt: req.prompt,
                seed,
                refImages: [refAssetId],
                refMask: maskAssetId,
            });

            // 3. Submit job
            jobId = await submitJob(boundWorkflow, baseUrl, token);
            req.onProgress?.("submitted", { jobId });
        }

        const signal = req.signal;
        if (signal?.aborted) {
            await cancelJob(jobId, baseUrl, token);
            throw new ComfyuiAbortedError();
        }

        // 4. Poll job
        const polling = pollJob(jobId, baseUrl, token, signal, startedAt + JOB_TIMEOUT_MS, (outputs) => prioritizeInpaintOutput(outputs, inpaintWorkflow.json));
        let waiting: Promise<string[] | undefined> = polling;
        if (signal) {
            const aborted: Promise<never> = new Promise((_resolve, reject) => {
                signal.addEventListener("abort", () => {
                    void cancelJob(jobId, baseUrl, token).catch(() => undefined);
                    reject(new ComfyuiAbortedError());
                }, { once: true });
            });
            waiting = Promise.race([polling, aborted]);
        }
        const resultAssetIds = await waiting;
        if (!resultAssetIds) {
            throw new ComfyuiAbortedError();
        }

        // 5. Download outputs
        const items: Array<{ id: string; dataUrl: string; seed?: number }> = [];
        for (const assetId of resultAssetIds) {
            const { dataUrl } = await downloadAsset(assetId, baseUrl, token);
            items.push({ id: nanoid(), dataUrl, seed });
        }

        void logImageGeneration({ model: "ComfyUI Inpaint", prompt: req.prompt, provider: "comfyui", jobId, durationMs: Date.now() - startedAt, status: "success", imageCount: items.length, images: items, seed }).catch(() => undefined);
        return { items, jobId, seed };
    } catch (error) {
        void logImageGeneration({
            model: "ComfyUI Inpaint",
            prompt: req.prompt,
            provider: "comfyui",
            jobId: jobId || undefined,
            durationMs: Date.now() - startedAt,
            status: "failed",
            errorMessage: error instanceof Error ? error.message : String(error),
            seed,
        }).catch(() => undefined);
        throw error;
    }
}

/** Built-in fallback workflow JSON for ComfyUI LLM text generation and visual prompt inference (Qwen-3.5 VLM). */
export const FALLBACK_COMFYUI_TEXT_WORKFLOW_JSON: ComfyuiWorkflowJson = {
    "1": {
        inputs: {
            clip_name: "qwen3.5_4b_bf16.safetensors",
            type: "stable_diffusion",
            device: "default",
        },
        class_type: "CLIPLoader",
        _meta: { title: "加载CLIP" },
    },
    "3": {
        inputs: {
            prompt: ["8", 0],
            max_length: 256,
            sampling_mode: "on",
            "sampling_mode.temperature": 0.7,
            "sampling_mode.top_k": 64,
            "sampling_mode.top_p": 0.95,
            "sampling_mode.min_p": 0.05,
            "sampling_mode.repetition_penalty": 1.05,
            "sampling_mode.seed": ["26", 0],
            "sampling_mode.presence_penalty": 0,
            thinking: false,
            use_default_template: true,
            clip: ["1", 0],
            image: ["12", 0],
        },
        class_type: "TextGenerate",
        _meta: { title: "TextGenerate" },
    },
    "8": {
        inputs: {
            value: "请根据参考图片反推一段适合用于 AI 生图的提示词。\n\n要求：\n1. 只输出提示词正文，不要解释。\n2. 覆盖主体、构图、风格、光线、色彩、材质、镜头和氛围。\n3. 尽量写成可直接用于生图模型的完整提示词。",
        },
        class_type: "PrimitiveStringMultiline",
        _meta: { title: "prompt" },
    },
    "12": {
        inputs: {
            image: "",
        },
        class_type: "LoadImage",
        _meta: { title: "image" },
    },
    "15": {
        inputs: {
            output_file_path: "output/prompt",
            file_name: ["25", 0],
            file_extension: "txt",
            overwrite: true,
            text: ["16", 0],
        },
        class_type: "easy saveText",
        _meta: { title: "保存文本" },
    },
    "16": {
        inputs: {
            source: ["3", 0],
        },
        class_type: "PreviewAny",
        _meta: { title: "预览任意" },
    },
    "23": {
        inputs: {
            input_type: "INT",
            output_type: "STRING",
            string_input: "",
            int_input: ["26", 0],
            float_input: 0,
            boolean_input: false,
        },
        class_type: "kkSomethingToAny",
        _meta: { title: "kkSomethingToAny（任意类型转换）" },
    },
    "25": {
        inputs: {
            text: "4747",
            data: ["23", 0],
        },
        class_type: "ShowAny_UTK",
        _meta: { title: "Show Any (UTK)" },
    },
    "26": {
        inputs: {
            value: 388590439460300,
        },
        class_type: "PrimitiveInt",
        _meta: { title: "seed" },
    },
};

/**
 * Deep-copy a text/LLM workflow and bind prompt, random seed, and optional image.
 * If NO image asset is provided, nodes with _meta.title === "image" are removed from the graph,
 * and any links pointing to them are cleanly removed so the node runs text-to-text.
 */
export function applyTextBindings(
    workflow: ComfyuiWorkflowJson,
    params: { prompt: string; assetId?: string; seed?: number },
): ComfyuiWorkflowJson {
    const cloned = structuredClone(workflow);
    type NodeRecord = {
        class_type?: string;
        inputs?: Record<string, unknown>;
        _meta?: { title?: unknown };
    };

    let imageNodeId: string | undefined;

    // 1. Find nodes with title "prompt", "image", and "seed"
    let boundSeedTitle = false;
    for (const [nodeId, node] of Object.entries(cloned)) {
        if (typeof node !== "object" || node === null) continue;
        const record = node as NodeRecord;
        const rawTitle = record._meta?.title;
        if (typeof rawTitle !== "string") continue;
        const title = rawTitle.trim().toLowerCase();

        if (title === "prompt" && record.inputs) {
            if ("value" in record.inputs) record.inputs.value = params.prompt;
            else if ("text" in record.inputs) record.inputs.text = params.prompt;
            else if ("prompt" in record.inputs) record.inputs.prompt = params.prompt;
        } else if (title === "image" || title === "ref_image_01" || title === "ref_image") {
            imageNodeId = nodeId;
        } else if (title === "seed" && params.seed !== undefined && record.inputs) {
            if ("value" in record.inputs) record.inputs.value = params.seed;
            else if ("seed" in record.inputs) record.inputs.seed = params.seed;
            else if ("int_input" in record.inputs) record.inputs.int_input = params.seed;
            boundSeedTitle = true;
        }
    }

    // 2. Handle image node
    if (params.assetId) {
        if (imageNodeId && cloned[imageNodeId]) {
            const imageNode = cloned[imageNodeId] as NodeRecord;
            if (imageNode.inputs) {
                imageNode.inputs.image = params.assetId;
            }
        }
    } else {
        // If only prompt is provided, remove the node where _meta.title === "image"
        if (imageNodeId) {
            delete cloned[imageNodeId];
            // Remove any input links pointing to this removed node
            for (const node of Object.values(cloned)) {
                if (typeof node !== "object" || node === null) continue;
                const record = node as NodeRecord;
                if (!record.inputs) continue;
                for (const [inputKey, val] of Object.entries(record.inputs)) {
                    if (Array.isArray(val) && String(val[0]) === imageNodeId) {
                        delete record.inputs[inputKey];
                    }
                }
            }
        }
    }

    // 3. Fallback: handle seed only if no node has _meta.title === "seed"
    if (params.seed !== undefined && !boundSeedTitle) {
        for (const node of Object.values(cloned)) {
            if (typeof node !== "object" || node === null) continue;
            const record = node as NodeRecord;
            if (!record.inputs) continue;
            if ("sampling_mode.seed" in record.inputs && !Array.isArray(record.inputs["sampling_mode.seed"])) {
                record.inputs["sampling_mode.seed"] = params.seed;
            } else if ("seed" in record.inputs && !Array.isArray(record.inputs.seed)) {
                record.inputs.seed = params.seed;
            }
        }
    }

    return cloned;
}

/** Clean raw text output: unwrap JSON arrays, JSON objects, or quoted strings. */
export function cleanExtractedText(raw: string): string {
    let cleaned = raw.trim();
    if ((cleaned.startsWith("[") && cleaned.endsWith("]")) || (cleaned.startsWith("{") && cleaned.endsWith("}"))) {
        try {
            const parsed = JSON.parse(cleaned);
            if (Array.isArray(parsed) && typeof parsed[0] === "string") {
                cleaned = parsed[0].trim();
            } else if (parsed && typeof parsed === "object") {
                const rec = parsed as Record<string, unknown>;
                const val = rec.text || rec.content || rec.value || rec.prompt;
                if (typeof val === "string") cleaned = val.trim();
                else if (Array.isArray(val) && typeof val[0] === "string") cleaned = val[0].trim();
            }
        } catch {
            // keep raw
        }
    } else if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
        try {
            cleaned = JSON.parse(cleaned);
        } catch {
            // keep raw
        }
    }
    return cleaned;
}

/** Recursively search job status response object for text outputs (e.g. ComfyUI history or UI outputs). */
export function extractTextFromJobResponse(data: unknown): string {
    if (!data || typeof data !== "object") return "";
    const visited = new Set<unknown>();

    function search(obj: unknown, depth: number): string {
        if (!obj || depth > 6 || visited.has(obj)) return "";
        visited.add(obj);

        if (typeof obj === "string") {
            const trimmed = obj.trim();
            if (trimmed.length > 20 && !trimmed.startsWith("http://") && !trimmed.startsWith("https://") && !/^[0-9a-f-]{36}$/i.test(trimmed)) {
                return trimmed;
            }
            return "";
        }

        if (Array.isArray(obj)) {
            for (const item of obj) {
                const res = search(item, depth + 1);
                if (res) return res;
            }
            return "";
        }

        if (typeof obj === "object") {
            const rec = obj as Record<string, unknown>;
            for (const key of ["text", "ui", "string", "ui_string", "prompt", "result", "history", "outputs"]) {
                if (key in rec && rec[key] !== undefined) {
                    const res = search(rec[key], depth + 1);
                    if (res) return res;
                }
            }
            for (const val of Object.values(rec)) {
                const res = search(val, depth + 1);
                if (res) return res;
            }
        }
        return "";
    }

    return search(data, 0);
}

/**
 * Download a text asset's content from ComfyUI /view endpoint and return as string.
 */
export async function downloadComfyuiText(assetIdOrUrl: string, baseUrl: string, token?: string): Promise<string> {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const url = assetIdOrUrl.startsWith("http://") || assetIdOrUrl.startsWith("https://")
        ? assetIdOrUrl
        : assetIdOrUrl.startsWith("/view?")
          ? `${normalizeBaseUrl(baseUrl)}${assetIdOrUrl}`
          : `${normalizeBaseUrl(baseUrl)}/view?filename=${encodeURIComponent(assetIdOrUrl)}&type=output`;
    const response = await comfyuiFetch(url, { headers }, baseUrl);
    if (!response.ok) throw new ComfyuiApiError(`Failed to download text asset: ${response.status}`, response.status);
    return await response.text();
}

export interface ComfyuiTextRequest {
    config: AiConfig;
    prompt: string;
    imageDataUrl?: string;
    seed?: number;
    jobId?: string;
    signal?: AbortSignal;
    onProgress?: (status: string, detail?: { jobId?: string }) => void;
    onDelta?: (text: string) => void;
}

export async function requestComfyuiText(req: ComfyuiTextRequest): Promise<{ text: string; jobId: string }> {
    const startedAt = Date.now();
    let jobId = req.jobId || "";
    let seed: number | undefined = req.seed;
    try {
        const channel = resolveModelChannel(req.config, req.config.textModel || req.config.model);
        const textWorkflow =
            channel.comfyuiTextWorkflow ||
            channel.models.find((m) => m.name === "ComfyUI LLM" || m.capability === "text")?.comfyuiWorkflow ||
            DEFAULT_COMFYUI_TEXT_WORKFLOW;

        if (!textWorkflow) {
            throw new ComfyuiNoWorkflowError(i18n.t("comfyui.noTextWorkflow"));
        }
        const baseUrl = (channel.comfyuiProxyUrl || "").trim();
        const token = channel.comfyuiProxyToken;

        if (!jobId) {
            let assetId: string | undefined;
            if (req.imageDataUrl) {
                assetId = await uploadComfyuiAsset(baseUrl, token, req.imageDataUrl, "image.png", req.signal);
            }

            if (seed === undefined) seed = generateRandomSeed();
            const boundWorkflow = applyTextBindings(textWorkflow.json as unknown as ComfyuiWorkflowJson, {
                prompt: req.prompt,
                assetId,
                seed,
            });

            jobId = await submitJob(boundWorkflow, baseUrl, token);
            req.onProgress?.("submitted", { jobId });
        }

        const signal = req.signal;
        if (signal?.aborted) {
            await cancelJob(jobId, baseUrl, token);
            throw new ComfyuiAbortedError();
        }

        const polling = pollJobRaw(jobId, baseUrl, token, signal, startedAt + JOB_TIMEOUT_MS);
        let waiting: Promise<PollJobResult | undefined> = polling;
        if (signal) {
            const aborted: Promise<never> = new Promise((_resolve, reject) => {
                signal.addEventListener(
                    "abort",
                    () => {
                        void cancelJob(jobId, baseUrl, token).catch(() => undefined);
                        reject(new ComfyuiAbortedError());
                    },
                    { once: true },
                );
            });
            waiting = Promise.race([polling, aborted]);
        }
        const pollResult = await waiting;
        if (!pollResult) {
            throw new ComfyuiAbortedError();
        }

        let text = "";
        const outputs = pollResult.outputs;

        // 1. Sort outputs prioritizing text, txt/json/md file assets
        const prioritizedOutputs = [...outputs].sort((a, b) => {
            const getScore = (item: unknown) => {
                if (!item || typeof item !== "object") return 0;
                const rec = item as { type?: unknown; name?: unknown; content_type?: unknown };
                const type = String(rec.type || "").toLowerCase();
                const name = String(rec.name || "").toLowerCase();
                const ct = String(rec.content_type || "").toLowerCase();
                if (type === "text" || name.endsWith(".txt") || ct.startsWith("text/")) return 3;
                if (type === "file" || name.endsWith(".json") || name.endsWith(".md")) return 2;
                if (type === "image" || type === "video") return -1;
                return 1;
            };
            return getScore(b) - getScore(a);
        });

        for (const entry of prioritizedOutputs) {
            if (!entry || typeof entry !== "object") continue;
            const rec = entry as { id?: unknown; url?: unknown; text?: unknown; value?: unknown; type?: unknown; content_type?: unknown; name?: unknown };
            if (typeof rec.text === "string" && rec.text.trim()) {
                text = cleanExtractedText(rec.text);
                break;
            } else if (typeof rec.value === "string" && rec.value.trim()) {
                text = cleanExtractedText(rec.value);
                break;
            } else if (typeof rec.id === "string" || typeof rec.url === "string") {
                const target = typeof rec.url === "string" && rec.url ? rec.url : String(rec.id);
                try {
                    const raw = await downloadComfyuiText(target, baseUrl, token);
                    const cleaned = cleanExtractedText(raw);
                    if (cleaned) {
                        text = cleaned;
                        break;
                    }
                } catch {
                    // continue to next output entry
                }
            }
        }

        // 2. If no text found in outputs, inspect job status response (history/result/ui)
        if (!text && pollResult.job) {
            text = extractTextFromJobResponse(pollResult.job);
        }

        if (!text) {
            console.warn("[ComfyUI] Text generation succeeded but no text was extracted from job:", pollResult.job);
            throw new Error("ComfyUI 执行成功但未获取到文本输出，请确认工作流中包含保存文本节点（如 easy saveText）或有效文本输出节点。");
        }

        req.onDelta?.(text);
        return { text, jobId };
    } catch (error) {
        throw error;
    }
}

/**
 * Download a video asset's content from ComfyUI /view endpoint and return as data URL.
 */
export async function downloadComfyuiVideo(assetId: string, baseUrl: string, token?: string): Promise<{ dataUrl: string; mimeType: string }> {
    const { blob, dataUrl } = await downloadAsset(assetId, baseUrl, token);
    const mimeType = blob.type || "video/mp4";
    return { dataUrl, mimeType };
}

/**
 * Collect output asset ids for video generation jobs.
 */
export function collectVideoAssetIds(outputs: unknown): string[] {
    if (!Array.isArray(outputs)) return [];
    const ids: string[] = [];
    for (const item of outputs) {
        if (!item || typeof item !== "object") continue;
        const rec = item as { id?: unknown; type?: unknown; content_type?: unknown; url?: unknown; filename?: unknown; subfolder?: unknown };
        const id = typeof rec.id === "string" && rec.id ? rec.id : typeof rec.url === "string" && rec.url ? rec.url : typeof rec.filename === "string" ? rec.filename : "";
        if (!id) continue;
        const filename = typeof rec.filename === "string" ? rec.filename.toLowerCase() : "";
        const idLower = id.toLowerCase();
        const type = String(rec.type || "").toLowerCase();
        const contentType = String(rec.content_type || "").toLowerCase();
        const isVideo =
            type === "video" ||
            contentType.startsWith("video/") ||
            filename.endsWith(".mp4") ||
            filename.endsWith(".webm") ||
            filename.endsWith(".mov") ||
            filename.endsWith(".mkv") ||
            idLower.includes(".mp4") ||
            idLower.includes(".webm") ||
            idLower.includes(".mov") ||
            idLower.includes(".mkv");

        if (isVideo) {
            ids.push(id);
        }
    }
    if (ids.length === 0) {
        for (const item of outputs) {
            if (item && typeof item === "object") {
                const rec = item as { id?: unknown; url?: unknown; filename?: unknown };
                const fallbackId = typeof rec.id === "string" && rec.id ? rec.id : typeof rec.url === "string" && rec.url ? rec.url : typeof rec.filename === "string" ? rec.filename : "";
                if (fallbackId) ids.push(fallbackId);
            }
        }
    }
    return ids;
}

/**
 * Deep-copy a video workflow and bind prompt, reference images, and random seed.
 */

export function applyVideoBindings(
    workflow: ComfyuiWorkflowJson,
    params: {
        prompt: string;
        assetIds?: string[];
        videoAssetIds?: string[];
        audioAssetIds?: string[];
        firstFrameAssetId?: string;
        lastFrameAssetId?: string;
        videoMode?: "omni" | "frame";
        width?: number;
        height?: number;
        duration?: number;
        seed?: number;
    },
): ComfyuiWorkflowJson {
    const cloned = structuredClone(workflow);
    type NodeRecord = {
        class_type?: string;
        inputs?: Record<string, unknown>;
        _meta?: { title?: unknown };
    };

    let boundPrompt = false;
    let refIndex = 0;
    for (const node of Object.values(cloned)) {
        if (typeof node !== "object" || node === null) continue;
        const record = node as NodeRecord;
        const rawTitle = record._meta?.title;
        const title = typeof rawTitle === "string" ? rawTitle.trim().toLowerCase() : "";
        if (!record.inputs) continue;

        if (title === "prompt") {
            if ("value" in record.inputs) record.inputs.value = params.prompt;
            else if ("text" in record.inputs) record.inputs.text = params.prompt;
            else if ("prompt" in record.inputs) record.inputs.prompt = params.prompt;
            boundPrompt = true;
        }

        if (title === "width" && params.width !== undefined) {
            if ("Number" in record.inputs) record.inputs.Number = String(params.width);
            else if ("value" in record.inputs) record.inputs.value = params.width;
            else if ("width" in record.inputs) record.inputs.width = params.width;
        }

        if (title === "height" && params.height !== undefined) {
            if ("Number" in record.inputs) record.inputs.Number = String(params.height);
            else if ("value" in record.inputs) record.inputs.value = params.height;
            else if ("height" in record.inputs) record.inputs.height = params.height;
        }

        if (title === "duration" && params.duration !== undefined) {
            if ("Number" in record.inputs) record.inputs.Number = String(params.duration);
            else if ("value" in record.inputs) record.inputs.value = params.duration;
            else if ("duration" in record.inputs) record.inputs.duration = params.duration;
            else if ("frames" in record.inputs) record.inputs.frames = params.duration;
        }

        // 首尾帧插槽绑定
        if (title === "first_frame" && params.firstFrameAssetId) {
            record.inputs.image = params.firstFrameAssetId;
        } else if (title === "last_frame" && params.lastFrameAssetId) {
            record.inputs.image = params.lastFrameAssetId;
        }

        // 1. 全能参考 - 图片插槽绑定
        if (params.assetIds && params.assetIds.length > 0) {
            const numberedMatch = /^ref_image_(0[1-9])$/.exec(title);
            if (numberedMatch) {
                const idx = Number(numberedMatch[1]) - 1;
                if (params.assetIds[idx]) {
                    record.inputs.image = params.assetIds[idx];
                }
            } else if (title === "ref_image" || title === "image" || title.includes("input_image")) {
                const assetId = params.assetIds[refIndex % params.assetIds.length];
                refIndex++;
                record.inputs.image = assetId;
            }
        }

        // 2. 全能参考 - 视频插槽绑定
        if (params.videoAssetIds && params.videoAssetIds.length > 0) {
            const numberedMatch = /^ref_video_(0[1-9])$/.exec(title);
            if (numberedMatch) {
                const idx = Number(numberedMatch[1]) - 1;
                if (params.videoAssetIds[idx]) {
                    const assetVal = params.videoAssetIds[idx];
                    if ("file" in record.inputs) record.inputs.file = assetVal;
                    else if ("video" in record.inputs) record.inputs.video = assetVal;
                    else record.inputs.file = assetVal;
                }
            }
        }

        // 3. 全能参考 - 音频插槽绑定
        if (params.audioAssetIds && params.audioAssetIds.length > 0) {
            const numberedMatch = /^ref_audio_(0[1-9])$/.exec(title);
            if (numberedMatch) {
                const idx = Number(numberedMatch[1]) - 1;
                if (params.audioAssetIds[idx]) {
                    const assetVal = params.audioAssetIds[idx];
                    if ("audio" in record.inputs) record.inputs.audio = assetVal;
                    else if ("file" in record.inputs) record.inputs.file = assetVal;
                    else record.inputs.audio = assetVal;
                }
            }
        }

        if (params.seed !== undefined) {
            if ("seed" in record.inputs) record.inputs.seed = params.seed;
            else if ("sampling_mode.seed" in record.inputs) record.inputs["sampling_mode.seed"] = params.seed;
            else if ("noise_seed" in record.inputs) record.inputs.noise_seed = params.seed;
            else if ("value" in record.inputs && title === "seed") record.inputs.value = params.seed;
        }
    }

    if (!boundPrompt && params.prompt) {
        for (const node of Object.values(cloned)) {
            if (typeof node !== "object" || node === null) continue;
            const record = node as NodeRecord;
            if (!record.inputs) continue;
            if ("prompt" in record.inputs && typeof record.inputs.prompt === "string") {
                record.inputs.prompt = params.prompt;
                break;
            } else if ("text" in record.inputs && typeof record.inputs.text === "string") {
                record.inputs.text = params.prompt;
                break;
            }
        }
    }

    // 自动抹除未指派资产的参考节点及其级联连线，避免向 ComfyUI 提交旧文件或断链
    const assignedImageCount = params.assetIds?.length || 0;
    const assignedVideoCount = params.videoAssetIds?.length || 0;
    const assignedAudioCount = params.audioAssetIds?.length || 0;
    const removedNodeIds = new Set<string>();

    // Pass 1: 按 _meta.title 匹配 ref_image_NN / ref_video_NN / ref_audio_NN / first_frame / last_frame
    for (const [id, node] of Object.entries(cloned)) {
        if (typeof node !== "object" || node === null) continue;
        const record = node as NodeRecord;
        const rawTitle = record._meta?.title;
        const title = typeof rawTitle === "string" ? rawTitle.trim().toLowerCase() : "";

        if (title === "first_frame" && !params.firstFrameAssetId) {
            removedNodeIds.add(id);
        }
        if (title === "last_frame" && !params.lastFrameAssetId) {
            removedNodeIds.add(id);
        }

        const imgMatch = /^ref_image_(0[1-9])$/.exec(title);
        if (imgMatch) {
            const idx = Number(imgMatch[1]) - 1;
            if (idx >= assignedImageCount) removedNodeIds.add(id);
        }
        const vidMatch = /^ref_video_(0[1-9])$/.exec(title);
        if (vidMatch) {
            const idx = Number(vidMatch[1]) - 1;
            if (idx >= assignedVideoCount) removedNodeIds.add(id);
        }
        const audMatch = /^ref_audio_(0[1-9])$/.exec(title);
        if (audMatch) {
            const idx = Number(audMatch[1]) - 1;
            if (idx >= assignedAudioCount) removedNodeIds.add(id);
        }
    }

    // Pass 2: 按主节点输入键名（ref_images.ref_image_N / ref_videos.ref_video_N / ref_audios.ref_audio_N）
    // 反向追溯未指派插槽的上游节点，解决 LoadVideo/LoadAudio 无 ref 标题无法被 Pass 1 捕获的问题
    for (const node of Object.values(cloned)) {
        if (typeof node !== "object" || node === null) continue;
        const record = node as NodeRecord;
        if (!record.inputs) continue;
        for (const [inputKey, val] of Object.entries(record.inputs)) {
            if (!Array.isArray(val)) continue;
            let shouldPrune = false;
            const imgIn = /^ref_images\.ref_image_(\d+)$/.exec(inputKey);
            if (imgIn && Number(imgIn[1]) >= assignedImageCount) shouldPrune = true;
            const vidIn = /^ref_videos\.ref_video_(\d+)$/.exec(inputKey);
            if (vidIn && Number(vidIn[1]) >= assignedVideoCount) shouldPrune = true;
            const audIn = /^ref_audios\.ref_audio_(\d+)$/.exec(inputKey);
            if (audIn && Number(audIn[1]) >= assignedAudioCount) shouldPrune = true;
            if (shouldPrune) removedNodeIds.add(String(val[0]));
        }
    }

    // 通用反向级联：若某节点仅被已删除节点消费（无存活消费者），则一并抹除
    let hasMorePruning = true;
    while (hasMorePruning) {
        hasMorePruning = false;
        for (const [id] of Object.entries(cloned)) {
            if (removedNodeIds.has(id)) continue;
            let hasLiveConsumer = false;
            let hasRemovedConsumer = false;
            for (const [otherId, otherNode] of Object.entries(cloned)) {
                if (typeof otherNode !== "object" || otherNode === null) continue;
                const otherRec = otherNode as NodeRecord;
                for (const val of Object.values(otherRec.inputs || {})) {
                    if (Array.isArray(val) && String(val[0]) === id) {
                        if (removedNodeIds.has(otherId)) hasRemovedConsumer = true;
                        else hasLiveConsumer = true;
                        break;
                    }
                }
                if (hasLiveConsumer) break;
            }
            if (hasRemovedConsumer && !hasLiveConsumer) {
                removedNodeIds.add(id);
                hasMorePruning = true;
            }
        }
    }

    if (removedNodeIds.size > 0) {
        for (const id of removedNodeIds) {
            delete cloned[id];
        }
        for (const node of Object.values(cloned)) {
            if (typeof node !== "object" || node === null) continue;
            const record = node as NodeRecord;
            if (!record.inputs) continue;
            for (const [inputKey, val] of Object.entries(record.inputs)) {
                if (Array.isArray(val) && removedNodeIds.has(String(val[0]))) {
                    delete record.inputs[inputKey];
                }
            }
        }
    }

    return cloned;
}

export interface ComfyuiVideoRequest {
    config: AiConfig;
    prompt: string;
    references?: ReferenceImage[];
    referenceVideos?: ReferenceVideo[];
    referenceAudios?: ReferenceAudio[];
    firstFrame?: ReferenceImage;
    lastFrame?: ReferenceImage;
    videoMode?: "omni" | "frame";
    seed?: number;
    signal?: AbortSignal;
    jobId?: string;
    onProgress?: (status: string, detail?: { jobId?: string }) => void;
}

export async function submitComfyuiVideoJob(req: ComfyuiVideoRequest): Promise<{ jobId: string; baseUrl: string; token?: string }> {
    const channel = resolveModelChannel(req.config, req.config.videoModel || req.config.model);
    const videoMode = req.videoMode || (req.config.videoMode === "frame" ? "frame" : "omni");
    const videoWorkflow = videoMode === "frame"
        ? channel.comfyuiFrameVideoWorkflow ||
          channel.models.find((m) => m.name === "ComfyUI Frame Video" || m.name.toLowerCase().includes("frame") || m.name.includes("首尾帧"))?.comfyuiWorkflow ||
          DEFAULT_COMFYUI_FRAME_VIDEO_WORKFLOW
        : channel.comfyuiVideoWorkflow ||
          channel.models.find((m) => m.name === "ComfyUI Video" || m.capability === "video")?.comfyuiWorkflow ||
          DEFAULT_COMFYUI_VIDEO_WORKFLOW;

    if (!videoWorkflow) {
        throw new ComfyuiNoWorkflowError(i18n.t(videoMode === "frame" ? "comfyui.noFrameVideoWorkflow" : "comfyui.noVideoWorkflow"));
    }

    const baseUrl = (channel.comfyuiProxyUrl || "").trim();
    const token = channel.comfyuiProxyToken;

    let firstFrameAssetId: string | undefined;
    let lastFrameAssetId: string | undefined;
    const assetIds: string[] = [];
    const videoAssetIds: string[] = [];
    const audioAssetIds: string[] = [];

    if (videoMode === "frame") {
        // 首尾帧模式
        const firstFrameImg = req.firstFrame || req.references?.[0];
        const lastFrameImg = req.lastFrame || (req.references && req.references.length > 1 ? req.references[1] : undefined);
        if (firstFrameImg?.dataUrl) {
            firstFrameAssetId = await uploadComfyuiAsset(baseUrl, token, firstFrameImg.dataUrl, "first_frame.png", req.signal);
        }
        if (lastFrameImg?.dataUrl) {
            lastFrameAssetId = await uploadComfyuiAsset(baseUrl, token, lastFrameImg.dataUrl, "last_frame.png", req.signal);
        }
    } else {
        // 全能参考模式 - 严格校验（Fail-loud）
        if (req.references && req.references.length > 9) {
            throw new Error(`当前视频工作流最多支持 9 张参考图，已连接 ${req.references.length} 张，请精简连线后再生成`);
        }
        if (req.referenceVideos && req.referenceVideos.length > 3) {
            throw new Error(`当前视频工作流最多支持 3 个参考视频，已连接 ${req.referenceVideos.length} 个，请精简连线后再生成`);
        }
        if (req.referenceAudios && req.referenceAudios.length > 3) {
            throw new Error(`当前视频工作流最多支持 3 个参考音频，已连接 ${req.referenceAudios.length} 个，请精简连线后再生成`);
        }

        // 上传图片参考资产
        if (req.references?.length) {
            for (let i = 0; i < req.references.length; i++) {
                const dataUrl = req.references[i]?.dataUrl;
                if (dataUrl) {
                    const id = await uploadComfyuiAsset(baseUrl, token, dataUrl, `ref_${i + 1}.png`, req.signal);
                    assetIds.push(id);
                }
            }
        }

        // 上传视频参考资产
        if (req.referenceVideos?.length) {
            const { resolveMediaUrl } = await import("@/services/file-storage");
            for (let i = 0; i < req.referenceVideos.length; i++) {
                const ref = req.referenceVideos[i];
                const rawUrl = ref?.url || (ref as unknown as { dataUrl?: string })?.dataUrl || (ref as unknown as { src?: string })?.src || "";
                const resolvedUrl = await resolveMediaUrl(ref?.storageKey, rawUrl);
                if (resolvedUrl) {
                    const id = await uploadComfyuiAsset(baseUrl, token, resolvedUrl, `ref_video_${i + 1}.mp4`, req.signal);
                    videoAssetIds.push(id);
                }
            }
        }

        // 上传音频参考资产
        if (req.referenceAudios?.length) {
            const { resolveMediaUrl } = await import("@/services/file-storage");
            for (let i = 0; i < req.referenceAudios.length; i++) {
                const ref = req.referenceAudios[i];
                const rawUrl = ref?.url || (ref as unknown as { dataUrl?: string })?.dataUrl || (ref as unknown as { src?: string })?.src || "";
                const resolvedUrl = await resolveMediaUrl(ref?.storageKey, rawUrl);
                if (resolvedUrl) {
                    const id = await uploadComfyuiAsset(baseUrl, token, resolvedUrl, `ref_audio_${i + 1}.mp3`, req.signal);
                    audioAssetIds.push(id);
                }
            }
        }
    }

    const sizeMatch = (req.config.size || "").match(/^(\d+)x(\d+)$/);
    const width = sizeMatch ? Number(sizeMatch[1]) : 544;
    const height = sizeMatch ? Number(sizeMatch[2]) : 960;
    const duration = req.config.videoSeconds ? Number(req.config.videoSeconds) : 5;

    const seed = req.seed !== undefined ? req.seed : generateRandomSeed() % 1_000_000_000;
    const boundWorkflow = applyVideoBindings(videoWorkflow.json, {
        prompt: req.prompt,
        assetIds,
        videoAssetIds,
        audioAssetIds,
        firstFrameAssetId,
        lastFrameAssetId,
        videoMode,
        seed,
        width,
        height,
        duration,
    });

    const jobId = await submitJob(boundWorkflow, baseUrl, token);
    return { jobId, baseUrl, token };
}

export async function pollComfyuiVideoJob(jobId: string, baseUrl: string, token?: string, signal?: AbortSignal): Promise<{ url: string; mimeType: string }> {
    const assetIds = await pollJob(jobId, baseUrl, token, signal, Date.now() + JOB_TIMEOUT_MS, collectVideoAssetIds);
    if (!assetIds || assetIds.length === 0) {
        throw new ComfyuiAbortedError();
    }
    const { dataUrl, mimeType } = await downloadComfyuiVideo(assetIds[0], baseUrl, token);
    return { url: dataUrl, mimeType };
}

export async function requestComfyuiVideo(req: ComfyuiVideoRequest): Promise<{ url: string; mimeType: string; jobId: string }> {
    const channel = resolveModelChannel(req.config, req.config.videoModel || req.config.model);
    const baseUrl = (channel.comfyuiProxyUrl || "").trim();
    const token = channel.comfyuiProxyToken;

    let jobId = req.jobId;
    if (!jobId) {
        const submitted = await submitComfyuiVideoJob(req);
        jobId = submitted.jobId;
        req.onProgress?.("submitted", { jobId });
    }

    try {
        const result = await pollComfyuiVideoJob(jobId, baseUrl, token, req.signal);
        return { ...result, jobId };
    } catch (error) {
        if (error instanceof ComfyuiTimeoutError && !error.jobId) {
            throw new ComfyuiTimeoutError(error.timeoutMs, jobId);
        }
        throw error;
    }
}

export async function checkComfyuiConnection(baseUrl: string, token?: string): Promise<{ ok: boolean; error?: string }> {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    try {
        const res = await comfyuiFetch(`${normalizeBaseUrl(baseUrl)}/system_stats`, { headers }, baseUrl);
        if (res.ok) return { ok: true };
        return { ok: false, error: `HTTP ${res.status}` };
    } catch (error) {
        if (error instanceof ComfyuiMixedContentError) {
            return { ok: false, error: "MIXED_CONTENT" };
        }
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
}
