import { afterEach, expect, it, vi } from "vitest";

import {
    ComfyuiAssetTooLargeError,
    MAX_COMFYUI_ASSET_BYTES,
    uploadComfyuiAsset,
} from "../comfyui";

const baseUrl = "http://127.0.0.1:8188";

/** 生成一个体积恰好为 bytes 的 base64 data URL（内容无需合法）。 */
function makeDataUrl(bytes: number, mime = "image/png") {
    const payload = Buffer.alloc(bytes, 1).toString("base64");
    return `data:${mime};base64,${payload}`;
}

function stubUploadFetch(fileSize: number, status = 200) {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        // 源素材取流（data URL 或远端 URL）返回固定体积的 blob
        if (init?.method !== "POST") {
            return { blob: async () => new Blob([new Uint8Array(fileSize)]) } as unknown as Response;
        }
        return {
            ok: status >= 200 && status < 300,
            status,
            json: async () => ({ name: "uploaded.png" }),
        } as unknown as Response;
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
}

afterEach(() => {
    vi.unstubAllGlobals();
});

it("uploads assets under the limit unchanged", async () => {
    const fetchMock = stubUploadFetch(1024);
    const name = await uploadComfyuiAsset(baseUrl, undefined, makeDataUrl(1024), "small.png");
    expect(name).toBe("uploaded.png");
    // data URL 取流 + 上传请求，共两次 fetch
    expect(fetchMock).toHaveBeenCalledTimes(2);
});

it("rejects an oversized data URL before decoding it into a blob", async () => {
    const fetchMock = stubUploadFetch(MAX_COMFYUI_ASSET_BYTES * 3);
    const error = await uploadComfyuiAsset(baseUrl, undefined, makeDataUrl(MAX_COMFYUI_ASSET_BYTES + 1024), "huge.png").catch((err) => err);
    expect(error).toBeInstanceOf(ComfyuiAssetTooLargeError);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(error.message).toContain("参考图片「huge.png」");
    expect(error.message).toContain("50.0 MB");
    expect(error.message).toContain("--max-upload-size");
});

it("rejects an oversized blob resolved from a remote URL", async () => {
    stubUploadFetch(MAX_COMFYUI_ASSET_BYTES + 1);
    const error = await uploadComfyuiAsset(baseUrl, undefined, "https://cdn.example.com/big.mp4", "ref_video_1.mp4").catch((err) => err);
    expect(error).toBeInstanceOf(ComfyuiAssetTooLargeError);
    expect(error.kind).toBe("video");
    expect(error.message).toContain("参考视频「ref_video_1.mp4」");
});

it("labels audio references and reports the actual size", async () => {
    stubUploadFetch(MAX_COMFYUI_ASSET_BYTES + 5 * 1024 * 1024);
    const error = await uploadComfyuiAsset(baseUrl, undefined, "https://cdn.example.com/big.mp3", "ref_audio_1.mp3").catch((err) => err);
    expect(error).toBeInstanceOf(ComfyuiAssetTooLargeError);
    expect(error.kind).toBe("audio");
    expect(error.message).toContain("55.0 MB");
});

it("turns a readable 413 response into the friendly oversize error", async () => {
    stubUploadFetch(1024, 413);
    const error = await uploadComfyuiAsset(baseUrl, undefined, makeDataUrl(1024), "ref_1.png").catch((err) => err);
    expect(error).toBeInstanceOf(ComfyuiAssetTooLargeError);
    expect(error.rejectedByServer).toBe(true);
    expect(error.message).toContain("ComfyUI 拒绝上传");
});
