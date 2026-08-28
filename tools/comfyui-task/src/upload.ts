// Reference image / audio / video upload via proxy `POST /api/v2/assets` (multipart).
// Supports three input kinds: local path, HTTP(S) URL, data: URL.
//
// Uses Bun-native `Bun.file()` for local reads (Bun runtime target). At Web build time,
// this file is consumed via the tsconfig path alias and is not executed — only type-checked.

import type { ReferenceInput } from "./types.ts";

/** Result of a single asset upload. */
export interface UploadedAsset {
    id: string;
    content_type: string;
    file_path: string;
}

/** Decode data: URL to {mimeType, bytes}. */
function decodeDataUrl(dataUrl: string): { mimeType: string; bytes: Uint8Array } {
    const m = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(dataUrl);
    if (!m) throw new Error(`Invalid data URL: ${dataUrl.slice(0, 32)}...`);
    const mimeType = m[1] ?? "application/octet-stream";
    const isBase64 = m[2] === ";base64";
    const payload = m[3] ?? "";
    if (!isBase64) {
        const text = decodeURIComponent(payload);
        return { mimeType, bytes: new TextEncoder().encode(text) };
    }
    const bin = atob(payload);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return { mimeType, bytes: out };
}

function basename(path: string): string {
    const idx = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
    return idx >= 0 ? path.slice(idx + 1) : path;
}

/** Resolve a `ReferenceInput` to {bytes, content_type, file_path}. */
export async function resolveReference(ref: ReferenceInput): Promise<{ bytes: Uint8Array; content_type: string; file_path: string }> {
    if (ref.kind === "data") {
        const { mimeType, bytes } = decodeDataUrl(ref.value);
        return { bytes, content_type: mimeType, file_path: extFromMime(mimeType) };
    }
    if (ref.kind === "url") {
        const res = await fetch(ref.value);
        if (!res.ok) throw new Error(`Failed to fetch URL ${ref.value}: ${res.status} ${res.statusText}`);
        const buf = new Uint8Array(await res.arrayBuffer());
        const ct = res.headers.get("content-type") ?? "application/octet-stream";
        const urlPath = ref.value.split("?")[0] ?? ref.value;
        return { bytes: buf, content_type: ct, file_path: basename(urlPath) };
    }
    // path — Bun-native file read
    const file = Bun.file(ref.value);
    const buf = new Uint8Array(await file.arrayBuffer());
    const ct = mimeFromPath(ref.value);
    return { bytes: buf, content_type: ct, file_path: basename(ref.value) };
}

function extFromMime(mime: string): string {
    const m = mime.toLowerCase();
    if (m.includes("png")) return "png";
    if (m.includes("jpeg") || m.includes("jpg")) return "jpg";
    if (m.includes("webp")) return "webp";
    if (m.includes("mp4")) return "mp4";
    if (m.includes("mpeg") || m.includes("mp3")) return "mp3";
    if (m.includes("wav")) return "wav";
    if (m.includes("ogg")) return "ogg";
    return "bin";
}

function mimeFromPath(filePath: string): string {
    const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
    const map: Record<string, string> = {
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        webp: "image/webp",
        mp4: "video/mp4",
        mov: "video/quicktime",
        mp3: "audio/mpeg",
        wav: "audio/wav",
        ogg: "audio/ogg",
    };
    return map[ext] ?? "application/octet-stream";
}

/** Upload a single asset to the proxy. */
export async function uploadAsset(
    baseUrl: string,
    token: string | undefined,
    asset: { bytes: Uint8Array; content_type: string; file_path: string },
    signal?: AbortSignal,
): Promise<UploadedAsset> {
    const form = new FormData();
    // Buffer cast to satisfy TS5's stricter Uint8Array<ArrayBufferLike> typing under BlobPart.
    form.append("file", new Blob([asset.bytes.buffer as ArrayBuffer], { type: asset.content_type }), asset.file_path);
    form.append("content_type", asset.content_type);
    form.append("file_path", asset.file_path);

    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${baseUrl}/api/v2/assets`, {
        method: "POST",
        headers,
        body: form,
        signal,
    });
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Upload failed (${res.status}): ${text || res.statusText}`);
    }
    const data = (await res.json()) as { id: string; content_type: string; file_path: string };
    return { id: data.id, content_type: data.content_type, file_path: data.file_path };
}