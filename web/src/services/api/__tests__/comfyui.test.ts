import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { applyBindings, ComfyuiApiError, parseSize, resolveReferenceImage, submitJob, uploadAsset } from "@/services/api/comfyui";
import type { ComfyuiWorkflowJson } from "@/services/api/comfyui";
import { getImageBlob } from "@/services/image-storage";

vi.mock("@/services/image-storage", () => ({
    getImageBlob: vi.fn(),
}));

const mockedGetImageBlob = vi.mocked(getImageBlob);

describe("parseSize", () => {
    it("parses pixel sizes", () => {
        expect(parseSize("1024x1024")).toEqual({ width: 1024, height: 1024 });
        expect(parseSize("1024x1536")).toEqual({ width: 1024, height: 1536 });
        expect(parseSize(" 1536 x 1024 ")).toEqual({ width: 1536, height: 1024 });
    });

    it("parses aspect ratios with a 1024 base edge", () => {
        expect(parseSize("1:1")).toEqual({ width: 1024, height: 1024 });
        expect(parseSize("3:4")).toEqual({ width: 1024, height: 1366 });
        expect(parseSize("4:3")).toEqual({ width: 1366, height: 1024 });
        expect(parseSize("16:9")).toEqual({ width: 1820, height: 1024 });
    });

    it("falls back to 1024x1024 for empty or auto input", () => {
        expect(parseSize()).toEqual({ width: 1024, height: 1024 });
        expect(parseSize("")).toEqual({ width: 1024, height: 1024 });
        expect(parseSize("   ")).toEqual({ width: 1024, height: 1024 });
        expect(parseSize("auto")).toEqual({ width: 1024, height: 1024 });
        expect(parseSize("AUTO")).toEqual({ width: 1024, height: 1024 });
    });

    it("parses 2k/4k ratio tiers with a long-edge base", () => {
        expect(parseSize("1:1-2k")).toEqual({ width: 2048, height: 2048 });
        expect(parseSize("16:9-2k")).toEqual({ width: 2048, height: 1152 });
        expect(parseSize("9:16-2k")).toEqual({ width: 1152, height: 2048 });
        expect(parseSize("16:9-4k")).toEqual({ width: 3840, height: 2160 });
        expect(parseSize("9:16-4k")).toEqual({ width: 2160, height: 3840 });
    });

    it("rounds explicit pixel sizes to even and rejects oversized input", () => {
        expect(parseSize("1025x1024")).toEqual({ width: 1026, height: 1024 });
        expect(() => parseSize("9000x1024")).toThrow();
    });

    it("throws for invalid input", () => {
        expect(() => parseSize("garbage")).toThrow();
        expect(() => parseSize("0x1024")).toThrow();
        expect(() => parseSize("1:0")).toThrow();
        expect(() => parseSize("1024")).toThrow();
    });
});

describe("resolveReferenceImage", () => {
    beforeEach(() => {
        mockedGetImageBlob.mockReset();
        vi.unstubAllGlobals();
    });

    it("reads a stored image by storage key", async () => {
        const blob = new Blob(["fake-png"], { type: "image/png" });
        mockedGetImageBlob.mockResolvedValue(blob);
        const reference = await resolveReferenceImage("image:abc123");
        expect(mockedGetImageBlob).toHaveBeenCalledWith("image:abc123");
        expect(reference.blob).toBe(blob);
        expect(reference.dataUrl).toBe("data:image/png;base64,ZmFrZS1wbmc=");
    });

    it("throws when the stored image is missing", async () => {
        mockedGetImageBlob.mockResolvedValue(null);
        await expect(resolveReferenceImage("image:missing")).rejects.toThrow("not found");
    });

    it("resolves a data URL without re-encoding", async () => {
        const png = new Blob(["fake-png"], { type: "image/png" });
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, blob: async () => png, status: 200 }));
        const reference = await resolveReferenceImage("data:image/png;base64,ZmFsa2UtcG5n");
        expect(reference.blob).toBe(png);
        expect(reference.dataUrl).toBe("data:image/png;base64,ZmFsa2UtcG5n");
    });

    it("fetches a remote URL and encodes the blob", async () => {
        const png = new Blob(["fake-png"], { type: "image/png" });
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, blob: async () => png, status: 200 }));
        const reference = await resolveReferenceImage("http://10.7.8.12:8189/output/x.png");
        expect(reference.blob).toBe(png);
        expect(reference.dataUrl).toBe("data:image/png;base64,ZmFrZS1wbmc=");
    });

    it("throws on a failed fetch", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, blob: async () => new Blob() }));
        await expect(resolveReferenceImage("http://10.7.8.12:8189/output/x.png")).rejects.toThrow("Failed to load reference image: 500");
    });

    it("throws on an empty blob", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, blob: async () => new Blob() }));
        await expect(resolveReferenceImage("http://10.7.8.12:8189/output/x.png")).rejects.toThrow("Reference image is empty");
    });

    it("throws on empty input", async () => {
        await expect(resolveReferenceImage("  ")).rejects.toThrow("Empty reference image");
    });
});

type TestWorkflowNode = {
    inputs: Record<string, unknown>;
    class_type: string;
    _meta: { title: string };
};

describe("applyBindings", () => {
    it("binds prompt into the node and does not mutate the original workflow", () => {
        const workflow: ComfyuiWorkflowJson = {
            "1": { inputs: { value: "" }, class_type: "PrimitiveStringMultiline", _meta: { title: "prompt" } },
        };
        const bound = applyBindings(workflow, { prompt: "一只猫" });
        expect((bound["1"] as TestWorkflowNode).inputs.value).toBe("一只猫");
        expect((workflow["1"] as TestWorkflowNode).inputs.value).toBe("");
    });

    it("binds width and height into PrimitiveInt nodes", () => {
        const workflow: ComfyuiWorkflowJson = {
            "1": { inputs: { value: 512 }, class_type: "PrimitiveInt", _meta: { title: "width" } },
            "2": { inputs: { value: 512 }, class_type: "PrimitiveInt", _meta: { title: "height" } },
        };
        const bound = applyBindings(workflow, { width: 1024, height: 1366 });
        expect((bound["1"] as TestWorkflowNode).inputs.value).toBe(1024);
        expect((bound["2"] as TestWorkflowNode).inputs.value).toBe(1366);
    });

    it("binds reference image asset ids into LoadImage nodes by index", () => {
        const workflow: ComfyuiWorkflowJson = {
            "1": { inputs: { image: "" }, class_type: "LoadImage", _meta: { title: "ref_image_01" } },
            "2": { inputs: { image: "" }, class_type: "LoadImage", _meta: { title: "ref_image_02" } },
        };
        const bound = applyBindings(workflow, { refImageAssetIds: ["asset_a", "asset_b"] });
        expect((bound["1"] as TestWorkflowNode).inputs.image).toBe("asset_a");
        expect((bound["2"] as TestWorkflowNode).inputs.image).toBe("asset_b");
    });

    it("leaves a reference image node untouched when the asset list is shorter", () => {
        const workflow: ComfyuiWorkflowJson = {
            "1": { inputs: { image: "" }, class_type: "LoadImage", _meta: { title: "ref_image_01" } },
            "2": { inputs: { image: "" }, class_type: "LoadImage", _meta: { title: "ref_image_02" } },
        };
        const bound = applyBindings(workflow, { refImageAssetIds: ["asset_a"] });
        expect((bound["1"] as TestWorkflowNode).inputs.image).toBe("asset_a");
        expect((bound["2"] as TestWorkflowNode).inputs.image).toBe("");
    });

    it("skips missing titles without throwing and returns a deep copy", () => {
        const workflow: ComfyuiWorkflowJson = {};
        const params = { prompt: "一只猫", width: 1024, height: 1366, refImageAssetIds: ["asset_a"] };
        const bound = applyBindings(workflow, params);
        expect(bound).not.toBe(workflow);
        expect(bound).toEqual(workflow);

        const other: ComfyuiWorkflowJson = {
            "1": { inputs: { text: "old" }, class_type: "CLIPTextEncode", _meta: { title: "SomeOther" } },
        };
        const boundOther = applyBindings(other, params);
        expect(boundOther).not.toBe(other);
        expect(boundOther["1"]).toEqual(other["1"]);
    });

    it("skips a prompt node with an unrecognized class_type", () => {
        const workflow: ComfyuiWorkflowJson = {
            "1": { inputs: { text: "old" }, class_type: "UnknownClass", _meta: { title: "prompt" } },
        };
        const bound = applyBindings(workflow, { prompt: "新提示" });
        expect(bound["1"]).toEqual(workflow["1"]);
        expect(bound["1"]).not.toBe(workflow["1"]);
    });
});

describe("uploadAsset", () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("posts the blob as multipart form data and returns the asset id", async () => {
        fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: "asset_123" }) });
        const blob = new Blob(["fake-png"], { type: "image/png" });
        await expect(uploadAsset(blob, "http://10.7.8.12:8189", "tok")).resolves.toBe("asset_123");
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
        expect(url).toBe("http://10.7.8.12:8189/api/v2/assets");
        expect(init.method).toBe("POST");
        expect(init.body).toBeInstanceOf(FormData);
        // happy-dom wraps appended Blobs in a File, so compare by type/size instead of identity.
        const image = (init.body as FormData).get("image");
        expect(image).toBeInstanceOf(Blob);
        expect((image as Blob).type).toBe(blob.type);
        expect((image as Blob).size).toBe(blob.size);
        expect(init.headers.Authorization).toBe("Bearer tok");
    });

    it("omits the Authorization header without a token and strips a trailing slash from the base URL", async () => {
        fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: "asset_456" }) });
        const blob = new Blob(["fake-png"], { type: "image/png" });
        await expect(uploadAsset(blob, "http://10.7.8.12:8189/")).resolves.toBe("asset_456");
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
        expect(url).toBe("http://10.7.8.12:8189/api/v2/assets");
        expect(init.headers.Authorization).toBeUndefined();
    });

    it("throws ComfyuiApiError when the response has no asset id", async () => {
        fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
        await expect(uploadAsset(new Blob(), "http://10.7.8.12:8189")).rejects.toThrow(ComfyuiApiError);
    });

    it("throws ComfyuiApiError with the status on a 401 response", async () => {
        fetchMock.mockResolvedValue({ ok: false, status: 401, json: async () => ({}) });
        const error: unknown = await uploadAsset(new Blob(), "http://10.7.8.12:8189").then(
            () => {
                throw new Error("uploadAsset should have rejected");
            },
            (reason) => reason,
        );
        expect(error).toBeInstanceOf(ComfyuiApiError);
        expect(error).toMatchObject({ name: "ComfyuiApiError", status: 401 });
    });
});

describe("submitJob", () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("posts the bound workflow as { prompt } and returns the job id", async () => {
        fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: "job_abc" }) });
        const workflow: ComfyuiWorkflowJson = {
            "1": { inputs: { value: "一只猫" }, class_type: "PrimitiveStringMultiline", _meta: { title: "prompt" } },
        };
        await expect(submitJob(workflow, "http://10.7.8.12:8189", "tok")).resolves.toBe("job_abc");
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
        expect(url).toBe("http://10.7.8.12:8189/api/v2/jobs");
        expect(init.method).toBe("POST");
        expect(JSON.parse(String(init.body))).toEqual({ prompt: workflow });
        expect(init.headers["Content-Type"]).toBe("application/json");
        expect(init.headers.Authorization).toBe("Bearer tok");
    });

    it("throws ComfyuiApiError with the status on a 500 response", async () => {
        fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
        const error: unknown = await submitJob({ "1": {} }, "http://10.7.8.12:8189").then(
            () => {
                throw new Error("submitJob should have rejected");
            },
            (reason) => reason,
        );
        expect(error).toBeInstanceOf(ComfyuiApiError);
        expect(error).toMatchObject({ status: 500 });
        const init = fetchMock.mock.calls[0][1] as { headers: Record<string, string> };
        expect(init.headers.Authorization).toBeUndefined();
    });

    it("throws ComfyuiApiError when the response has no job id", async () => {
        fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
        await expect(submitJob({ "1": {} }, "http://10.7.8.12:8189")).rejects.toThrow(ComfyuiApiError);
    });

    it("trims whitespace from the base URL", async () => {
        fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: "job_abc" }) });
        await expect(submitJob({ "1": {} }, " http://10.7.8.12:8189 ")).resolves.toBe("job_abc");
        expect(fetchMock.mock.calls[0][0]).toBe("http://10.7.8.12:8189/api/v2/jobs");
    });
});
