import { getImageBlob } from "@/services/image-storage";

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

export class ComfyuiApiError extends Error {
    readonly status?: number;

    constructor(message: string, status?: number) {
        super(message);
        this.name = "ComfyuiApiError";
        this.status = status;
    }
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
    const response = await fetch(`${baseUrl.trim().replace(/\/+$/, "")}/api/v2/assets`, { method: "POST", headers, body: form });
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
    const response = await fetch(`${baseUrl.trim().replace(/\/+$/, "")}/api/v2/jobs`, { method: "POST", headers, body: JSON.stringify({ prompt: workflow }) });
    if (!response.ok) throw new ComfyuiApiError(`Failed to submit job: ${response.status}`, response.status);
    const data = (await response.json()) as { id?: unknown };
    if (typeof data?.id !== "string") throw new ComfyuiApiError("Job submit response is missing an id");
    return data.id;
}
