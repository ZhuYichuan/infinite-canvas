import { inflateSync } from "fflate";

export interface ComfyuiExtractedMetadata {
    workflow?: Record<string, unknown>;
    prompt?: Record<string, unknown>;
    raw?: string;
}

/**
 * Extracts embedded ComfyUI workflow or prompt metadata from PNG/WebP image files.
 */
export async function extractComfyMetadataFromImage(file: File | Blob): Promise<ComfyuiExtractedMetadata | null> {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // 1. Check PNG signature: 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A
    if (
        bytes.length >= 8 &&
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47 &&
        bytes[4] === 0x0d &&
        bytes[5] === 0x0a &&
        bytes[6] === 0x1a &&
        bytes[7] === 0x0a
    ) {
        return parsePngMetadata(bytes);
    }

    // 2. Check WebP/RIFF signature: 'RIFF' ... 'WEBP'
    if (
        bytes.length >= 12 &&
        bytes[0] === 0x52 &&
        bytes[1] === 0x49 &&
        bytes[2] === 0x46 &&
        bytes[3] === 0x46 &&
        bytes[8] === 0x57 &&
        bytes[9] === 0x45 &&
        bytes[10] === 0x42 &&
        bytes[11] === 0x50
    ) {
        return parseWebpMetadata(bytes);
    }

    // Fallback: search for JSON in raw bytes
    return fallbackJsonScan(bytes);
}

function parsePngMetadata(bytes: Uint8Array): ComfyuiExtractedMetadata | null {
    let offset = 8;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const decoder = new TextDecoder("utf-8");
    const result: ComfyuiExtractedMetadata = {};

    while (offset + 8 <= bytes.length) {
        const length = view.getUint32(offset);
        const type = decoder.decode(bytes.subarray(offset + 4, offset + 8));
        const dataOffset = offset + 8;
        const dataEnd = dataOffset + length;

        if (dataEnd > bytes.length) break;

        if (type === "tEXt") {
            const chunkData = bytes.subarray(dataOffset, dataEnd);
            const nullIdx = chunkData.indexOf(0);
            if (nullIdx > 0) {
                const keyword = decoder.decode(chunkData.subarray(0, nullIdx));
                const text = decoder.decode(chunkData.subarray(nullIdx + 1));
                assignMetadataKey(result, keyword, text);
            }
        } else if (type === "zTXt") {
            const chunkData = bytes.subarray(dataOffset, dataEnd);
            const nullIdx = chunkData.indexOf(0);
            if (nullIdx > 0 && nullIdx + 2 < chunkData.length) {
                const keyword = decoder.decode(chunkData.subarray(0, nullIdx));
                const compressed = chunkData.subarray(nullIdx + 2);
                try {
                    const decompressed = inflateSync(compressed);
                    const text = decoder.decode(decompressed);
                    assignMetadataKey(result, keyword, text);
                } catch {
                    // Ignore decompression errors
                }
            }
        }

        offset = dataEnd + 4; // Skip 4-byte CRC
    }

    if (result.workflow || result.prompt) return result;
    return fallbackJsonScan(bytes);
}

function parseWebpMetadata(bytes: Uint8Array): ComfyuiExtractedMetadata | null {
    let offset = 12;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const decoder = new TextDecoder("utf-8");
    const result: ComfyuiExtractedMetadata = {};

    while (offset + 8 <= bytes.length) {
        const fourcc = decoder.decode(bytes.subarray(offset, offset + 4));
        const chunkSize = view.getUint32(offset + 4, true); // Little-endian
        const dataOffset = offset + 8;
        const dataEnd = dataOffset + chunkSize;

        if (dataEnd > bytes.length) break;

        if (fourcc === "EXIF") {
            const chunkData = bytes.subarray(dataOffset, dataEnd);
            const text = decoder.decode(chunkData);
            extractJsonFromText(text, result);
        }

        offset = dataEnd + (chunkSize % 2 === 1 ? 1 : 0); // RIFF padding to even byte
    }

    if (result.workflow || result.prompt) return result;
    return fallbackJsonScan(bytes);
}

function assignMetadataKey(target: ComfyuiExtractedMetadata, keyword: string, text: string) {
    try {
        if (keyword === "workflow") {
            target.workflow = JSON.parse(text);
        } else if (keyword === "prompt") {
            target.prompt = JSON.parse(text);
        }
    } catch {
        // Ignore parse error
    }
}

function extractJsonFromText(text: string, target: ComfyuiExtractedMetadata) {
    const workflowMatch = text.match(/\{[\s\S]*"nodes"\s*:[\s\S]*\}/);
    if (workflowMatch) {
        try {
            target.workflow = JSON.parse(workflowMatch[0]);
        } catch {
            // Ignore
        }
    }
    const promptMatch = text.match(/\{[\s\S]*"class_type"\s*:[\s\S]*\}/);
    if (promptMatch) {
        try {
            target.prompt = JSON.parse(promptMatch[0]);
        } catch {
            // Ignore
        }
    }
}

function fallbackJsonScan(bytes: Uint8Array): ComfyuiExtractedMetadata | null {
    const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    const result: ComfyuiExtractedMetadata = {};
    extractJsonFromText(text, result);
    if (result.workflow || result.prompt) return result;
    return null;
}
