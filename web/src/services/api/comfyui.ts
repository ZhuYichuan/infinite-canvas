import localforage from "localforage";

import { nanoid } from "nanoid";
import i18n from "@/i18n";
import { getImageBlob } from "@/services/image-storage";
import { resolveModelChannel, resolveModelRequestConfig, type AiConfig } from "@/stores/use-config-store";

export type ComfyuiSize = {
    width: number;
    height: number;
};

export type ComfyuiReference = {
    blob: Blob;
    dataUrl: string;
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

/**
 * Resolve a reference image given as a data URL, an http(s)/blob URL, or an
 * `image:` storage key into an uploadable Blob plus a data URL copy.
 */
export async function resolveReferenceImage(input: string): Promise<ComfyuiReference> {
    const value = (input || "").trim();
    if (!value) throw new Error("Empty reference image");
    if (value.startsWith("data:")) {
        const blob = await fetchBlob(value);
        return { blob, dataUrl: value };
    }
    if (value.startsWith("image:")) {
        const blob = await getImageBlob(value);
        if (!blob) throw new Error(`Reference image not found: ${value}`);
        return { blob, dataUrl: await blobToDataUrl(blob) };
    }
    const blob = await fetchBlob(value);
    return { blob, dataUrl: await blobToDataUrl(blob) };
}

async function fetchBlob(url: string): Promise<Blob> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to load reference image: ${response.status}`);
    const blob = await response.blob();
    if (!blob.size) throw new Error("Reference image is empty");
    return blob;
}

function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("Failed to read reference image"));
        reader.readAsDataURL(blob);
    });
}

export type ComfyuiWorkflowJson = Record<string, unknown>;

export type ComfyuiBindings = {
    prompt?: string;
    width?: number;
    height?: number;
    refImageAssetIds?: string[];
};

/**
 * _meta.title → class_type → input slot. Image-phase subset of the
 * TITLE_TO_INPUT_SLOT in tools/comfyui-task/src/binding.ts; the reserved
 * ref_video/ref_audio titles are not needed for image generation yet.
 */
const BINDING_TITLE_TO_INPUT_SLOT: Record<string, Record<string, string>> = {
    prompt: { CLIPTextEncode: "text", PrimitiveStringMultiline: "value", PrimitiveString: "value", TextEncodeBooguEdit: "prompt", TextEncodeQwenImageEditPlus: "prompt" },
    width: { PrimitiveInt: "value", PrimitiveFloat: "value" },
    height: { PrimitiveInt: "value", PrimitiveFloat: "value" },
    ref_image: { LoadImage: "image", LoadImageMask: "image" },
};

const REF_IMAGE_TITLE_PATTERN = /^ref_image_(0[1-9])$/;

/**
 * Deep-copy a workflow and write generation params into the nodes marked by
 * _meta.title ("prompt", "width", "height", "ref_image_01..09"). Nodes with a
 * known title but an unrecognized class_type are skipped, and missing titles
 * are skipped too. The original workflow object is never mutated.
 */
export function applyBindings(workflow: ComfyuiWorkflowJson, params: ComfyuiBindings): ComfyuiWorkflowJson {
    const cloned = structuredClone(workflow);
    for (const node of Object.values(cloned)) {
        if (typeof node !== "object" || node === null) continue;
        const record = node as { class_type?: string; inputs?: Record<string, unknown>; _meta?: { title?: unknown } };
        const title = record._meta?.title;
        if (typeof title !== "string" || !record.class_type || !record.inputs) continue;
        let slot: string | undefined;
        let value: unknown;
        if (title === "prompt" && params.prompt !== undefined) {
            slot = BINDING_TITLE_TO_INPUT_SLOT.prompt[record.class_type];
            value = params.prompt;
        } else if (title === "width" && params.width !== undefined) {
            slot = BINDING_TITLE_TO_INPUT_SLOT.width[record.class_type];
            value = params.width;
        } else if (title === "height" && params.height !== undefined) {
            slot = BINDING_TITLE_TO_INPUT_SLOT.height[record.class_type];
            value = params.height;
        } else if (REF_IMAGE_TITLE_PATTERN.test(title)) {
            const match = REF_IMAGE_TITLE_PATTERN.exec(title)!;
            const assetId = params.refImageAssetIds?.[Number(match[1]) - 1];
            if (assetId !== undefined) {
                slot = BINDING_TITLE_TO_INPUT_SLOT.ref_image[record.class_type];
                value = assetId;
            }
        }
        if (slot) record.inputs[slot] = value;
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

    constructor(timeoutMs: number) {
        super(`${i18n.t("comfyui.timeout")} (after ${Math.floor(timeoutMs / 1000)}s)`);
        this.name = "ComfyuiTimeoutError";
        this.timeoutMs = timeoutMs;
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

function normalizeBaseUrl(baseUrl: string) {
    return baseUrl.trim().replace(/\/+$/, "");
}

/**
 * Upload a reference image to the proxy's asset store; returns the new asset id.
 * The proxy expects a multipart/form-data body with the file in the "image" field.
 */
export async function uploadAsset(blob: Blob, baseUrl: string, token?: string): Promise<string> {
    const form = new FormData();
    form.append("image", blob);
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`${normalizeBaseUrl(baseUrl)}/api/v2/assets`, { method: "POST", headers, body: form });
    if (!response.ok) throw new ComfyuiApiError(`Failed to upload asset: ${response.status}`, response.status);
    const data = (await response.json()) as { id?: unknown };
    if (typeof data?.id !== "string") throw new ComfyuiApiError("Asset upload response is missing an id");
    return data.id;
}

/**
 * Submit a bound workflow to the proxy's job queue; returns the new job id.
 * The proxy expects the workflow object under the "prompt" field.
 */
export async function submitJob(workflow: ComfyuiWorkflowJson, baseUrl: string, token?: string): Promise<string> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`${normalizeBaseUrl(baseUrl)}/api/v2/jobs`, { method: "POST", headers, body: JSON.stringify({ prompt: workflow }) });
    if (!response.ok) throw new ComfyuiApiError(`Failed to submit job: ${response.status}`, response.status);
    const data = (await response.json()) as { id?: unknown };
    if (typeof data?.id !== "string") throw new ComfyuiApiError("Job submit response is missing an id");
    return data.id;
}

/** How often the job status is polled while the job is pending or in progress. */
const JOB_POLL_INTERVAL_MS = 2_000;
/** Total window allowed for the job to complete before the request times out (10 minutes). */
const JOB_TIMEOUT_MS = 600_000;

type ComfyuiJobResponse = {
    status?: unknown;
    outputs?: unknown;
};

/** Collect the image asset ids from a completed job response (`outputs[].image[].asset_id`). */
function collectImageAssetIds(outputs: unknown): string[] {
    const ids: string[] = [];
    if (!Array.isArray(outputs)) return ids;
    for (const entry of outputs) {
        if (!entry || typeof entry !== "object") continue;
        const images = (entry as { image?: unknown }).image;
        if (!Array.isArray(images)) continue;
        for (const image of images) {
            const assetId = image && typeof image === "object" ? (image as { asset_id?: unknown }).asset_id : undefined;
            if (typeof assetId === "string") ids.push(assetId);
        }
    }
    return ids;
}

/**
 * Poll the proxy job endpoint until the job reaches a terminal state.
 *
 * - pending / in_progress → wait 2s and poll again
 * - completed → resolve with the image asset ids from `outputs[].image[].asset_id`
 * - failed / cancelled → reject with ComfyuiJobError carrying the status
 * - signal already / newly aborted → resolve `undefined` silently; the caller owns
 *   the cancel call, so no error is raised here
 * - Date.now() past deadlineMs → reject with ComfyuiTimeoutError (the job is NOT
 *   cancelled on the proxy)
 * - non-2xx response → reject with ComfyuiApiError carrying the status
 *
 * The first poll happens immediately; the 2s delay goes through an awaited setTimeout
 * so fake timers can advance it in tests.
 */
export async function pollJob(jobId: string, baseUrl: string, token?: string, signal?: AbortSignal, deadlineMs?: number): Promise<string[] | undefined> {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const startedAt = Date.now();
    for (;;) {
        if (signal?.aborted) return undefined;
        if (deadlineMs !== undefined && Date.now() >= deadlineMs) throw new ComfyuiTimeoutError(Math.max(0, deadlineMs - startedAt));
        const response = await fetch(`${normalizeBaseUrl(baseUrl)}/api/v2/jobs/${jobId}`, { headers });
        if (!response.ok) throw new ComfyuiApiError(`Failed to poll job: ${response.status}`, response.status);
        const data = (await response.json()) as ComfyuiJobResponse;
        const status = typeof data?.status === "string" ? data.status : "";
        if (status === "completed") return collectImageAssetIds(data.outputs);
        if (status === "failed" || status === "cancelled") throw new ComfyuiJobError(`ComfyUI job ${status}`, status);
        await new Promise((resolve) => setTimeout(resolve, JOB_POLL_INTERVAL_MS));
    }
}

/**
 * Download an asset's content from the proxy and convert it to a data URL.
 */
export async function downloadAsset(assetId: string, baseUrl: string, token?: string): Promise<{ blob: Blob; dataUrl: string }> {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`${normalizeBaseUrl(baseUrl)}/api/v2/assets/${assetId}/content`, { headers });
    if (!response.ok) throw new ComfyuiApiError(`Failed to download asset: ${response.status}`, response.status);
    const blob = await response.blob();
    if (!blob.size) throw new ComfyuiApiError("Downloaded asset is empty");
    return { blob, dataUrl: await blobToDataUrl(blob) };
}

/**
 * Best-effort cancel of a submitted job, used from the abort path. A failed cancel
 * (non-2xx response or network error) must not mask the abort, so it always resolves.
 */
export async function cancelJob(jobId: string, baseUrl: string, token?: string): Promise<void> {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    try {
        await fetch(`${normalizeBaseUrl(baseUrl)}/api/v2/jobs/${jobId}/cancel`, { method: "POST", headers });
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
    images?: Array<{ id: string; dataUrl: string }>;
    errorMessage?: string;
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
    await generationLogStore.setItem(id, record);
    return id;
}

export interface ComfyuiImageRequest {
    config: AiConfig;
    model: string;
    prompt: string;
    images?: string[];
    size?: string;
    signal?: AbortSignal;
    onProgress?: (status: string, detail?: Record<string, unknown>) => void;
}

export interface ComfyuiImageResult {
    items: Array<{ id: string; dataUrl: string }>;
    jobId: string;
}

/**
 * Run a full ComfyUI image generation: resolve the channel and model, bind the
 * generation params into the model's workflow, upload reference images, submit
 * the job, poll it until completion (10 minute deadline) and download the
 * outputs as data urls.
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
    let jobId = "";
    try {
        requestConfig = resolveModelRequestConfig(req.config, req.model);
        const channel = resolveModelChannel(req.config, req.model);
        const requestModel = requestConfig.model;
        const channelModel = channel.models.find((model) => model.name === requestModel);
        const workflow = channelModel?.comfyuiWorkflow;
        if (!workflow) throw new ComfyuiNoWorkflowError(`Model "${requestModel}" has no ComfyUI workflow attached`);
        const baseUrl = (channel.comfyuiProxyUrl || "").trim();
        const token = channel.comfyuiProxyToken;

        const size = parseSize(req.size);
        const assetIds: string[] = [];
        for (const image of req.images || []) {
            const reference = await resolveReferenceImage(image);
            assetIds.push(await uploadAsset(reference.blob, baseUrl, token));
        }

        const boundWorkflow = applyBindings(workflow.json, { prompt: req.prompt, width: size.width, height: size.height, refImageAssetIds: assetIds });
        jobId = await submitJob(boundWorkflow, baseUrl, token);
        req.onProgress?.("submitted", { jobId });

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

        const items: Array<{ id: string; dataUrl: string }> = [];
        for (const assetId of resultAssetIds) {
            const { dataUrl } = await downloadAsset(assetId, baseUrl, token);
            items.push({ id: nanoid(), dataUrl });
        }

        void logImageGeneration({ model: requestConfig.model, prompt: req.prompt, provider: "comfyui", jobId, durationMs: Date.now() - startedAt, status: "success", imageCount: items.length, images: items }).catch(() => undefined);
        return { items, jobId };
    } catch (error) {
        void logImageGeneration({
            model: requestConfig?.model ?? req.model,
            prompt: req.prompt,
            provider: "comfyui",
            jobId: jobId || undefined,
            durationMs: Date.now() - startedAt,
            status: "failed",
            errorMessage: error instanceof Error ? error.message : String(error),
        }).catch(() => undefined);
        throw error;
    }
}
