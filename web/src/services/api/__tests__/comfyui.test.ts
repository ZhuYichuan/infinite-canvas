import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { applyBindings, cancelJob, ComfyuiAbortedError, ComfyuiApiError, ComfyuiJobError, ComfyuiNoWorkflowError, ComfyuiTimeoutError, downloadAsset, parseSize, pollJob, requestComfyuiImage, resolveReferenceImage, submitJob, uploadAsset } from "@/services/api/comfyui";
import type { ComfyuiWorkflowJson } from "@/services/api/comfyui";
import { getImageBlob } from "@/services/image-storage";
import { defaultConfig, type AiConfig, type ModelChannel } from "@/stores/use-config-store";

vi.mock("@/services/image-storage", () => ({
    getImageBlob: vi.fn(),
}));

const mockedGetImageBlob = vi.mocked(getImageBlob);

// The generation log store the service writes to (same localforage structure as image-storage).
const { comfyuiLogStore } = vi.hoisted(() => ({
    comfyuiLogStore: {
        setItem: vi.fn(async (_key: string, _value: unknown) => undefined),
    },
}));

vi.mock("localforage", () => ({
    default: {
        createInstance: () => comfyuiLogStore,
    },
}));

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

describe("pollJob", () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it("polls immediately, waits 2s between rounds, and resolves with the image asset ids when the job completes", async () => {
        vi.useFakeTimers();
        fetchMock
            .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ status: "in_progress" }) })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ status: "completed", outputs: [{ image: [{ asset_id: "asset_1" }, { asset_id: "asset_2" }] }, { image: [] }] }),
            });
        const result = pollJob("job_1", "http://10.7.8.12:8189", "tok");
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
        expect(url).toBe("http://10.7.8.12:8189/api/v2/jobs/job_1");
        expect(init.headers.Authorization).toBe("Bearer tok");
        await vi.advanceTimersByTimeAsync(2000);
        await expect(result).resolves.toEqual(["asset_1", "asset_2"]);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("throws ComfyuiJobError when the job status is failed or cancelled", async () => {
        fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ status: "failed" }) });
        const failed: unknown = await pollJob("job_1", "http://10.7.8.12:8189").catch((reason) => reason);
        expect(failed).toBeInstanceOf(ComfyuiJobError);
        expect(failed).toMatchObject({ name: "ComfyuiJobError", status: "failed" });
        fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ status: "cancelled" }) });
        const cancelled: unknown = await pollJob("job_1", "http://10.7.8.12:8189").catch((reason) => reason);
        expect(cancelled).toBeInstanceOf(ComfyuiJobError);
        expect(cancelled).toMatchObject({ status: "cancelled" });
    });

    it("keeps polling every 2 seconds until the job completes", async () => {
        vi.useFakeTimers();
        let polls = 0;
        fetchMock.mockImplementation(async () => {
            polls += 1;
            return { ok: true, status: 200, json: async () => (polls < 3 ? { status: "in_progress" } : { status: "completed", outputs: [] }) };
        });
        const result = pollJob("job_1", "http://10.7.8.12:8189");
        await vi.advanceTimersByTimeAsync(4000);
        await expect(result).resolves.toEqual([]);
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it("resolves undefined without throwing when the signal is aborted", async () => {
        vi.useFakeTimers();
        fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ status: "in_progress" }) });
        const controller = new AbortController();
        const result = pollJob("job_1", "http://10.7.8.12:8189", "tok", controller.signal);
        controller.abort();
        await vi.advanceTimersByTimeAsync(2000);
        await expect(result).resolves.toBeUndefined();
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("throws ComfyuiApiError with the status on a non-2xx poll response", async () => {
        fetchMock.mockResolvedValue({ ok: false, status: 502, json: async () => ({}) });
        const error: unknown = await pollJob("job_1", "http://10.7.8.12:8189").catch((reason) => reason);
        expect(error).toBeInstanceOf(ComfyuiApiError);
        expect(error).toMatchObject({ name: "ComfyuiApiError", status: 502 });
    });
});

describe("downloadAsset", () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("downloads the asset content and converts the blob to a data url", async () => {
        const png = new Blob(["fake-png"], { type: "image/png" });
        fetchMock.mockResolvedValue({ ok: true, status: 200, blob: async () => png });
        const result = await downloadAsset("asset_1", "http://10.7.8.12:8189/", "tok");
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
        expect(url).toBe("http://10.7.8.12:8189/api/v2/assets/asset_1/content");
        expect(init.headers.Authorization).toBe("Bearer tok");
        expect(result.blob).toBe(png);
        expect(result.dataUrl).toBe("data:image/png;base64,ZmFrZS1wbmc=");
    });

    it("throws ComfyuiApiError with the status when the asset content is unavailable", async () => {
        fetchMock.mockResolvedValue({ ok: false, status: 404, blob: async () => new Blob() });
        const error: unknown = await downloadAsset("asset_404", "http://10.7.8.12:8189").catch((reason) => reason);
        expect(error).toBeInstanceOf(ComfyuiApiError);
        expect(error).toMatchObject({ status: 404 });
    });

    it("throws ComfyuiApiError when the downloaded asset is empty", async () => {
        fetchMock.mockResolvedValue({ ok: true, status: 200, blob: async () => new Blob() });
        await expect(downloadAsset("asset_empty", "http://10.7.8.12:8189")).rejects.toThrow(ComfyuiApiError);
    });
});

describe("cancelJob", () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("posts to the job cancel endpoint with the bearer token", async () => {
        fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
        await expect(cancelJob("job_1", "http://10.7.8.12:8189", "tok")).resolves.toBeUndefined();
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
        expect(url).toBe("http://10.7.8.12:8189/api/v2/jobs/job_1/cancel");
        expect(init.method).toBe("POST");
        expect(init.headers.Authorization).toBe("Bearer tok");
    });

    it("resolves without throwing when the cancel response is not ok", async () => {
        fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
        await expect(cancelJob("job_1", "http://10.7.8.12:8189")).resolves.toBeUndefined();
    });

    it("resolves without throwing when the cancel request never reaches the proxy", async () => {
        fetchMock.mockRejectedValue(new TypeError("network down"));
        await expect(cancelJob("job_1", "http://10.7.8.12:8189")).resolves.toBeUndefined();
    });
});

const FULL_FLOW_WORKFLOW: ComfyuiWorkflowJson = {
    "1": { inputs: { text: "" }, class_type: "CLIPTextEncode", _meta: { title: "prompt" } },
    "2": { inputs: { value: 512 }, class_type: "PrimitiveInt", _meta: { title: "width" } },
    "3": { inputs: { value: 512 }, class_type: "PrimitiveInt", _meta: { title: "height" } },
};

function buildComfyuiConfig(options?: { withWorkflow?: boolean; workflow?: ComfyuiWorkflowJson }): AiConfig {
    const channel: ModelChannel = {
        id: "comfy",
        name: "ComfyUI channel",
        baseUrl: "",
        apiKey: "",
        apiFormat: "comfyui",
        models: [
            {
                name: "ComfyUI T2I",
                capability: "image",
                comfyuiWorkflow: options?.withWorkflow === false ? undefined : { name: "t2i", json: options?.workflow ?? FULL_FLOW_WORKFLOW, createdAt: 0 },
            },
        ],
        comfyuiProxyUrl: "http://10.7.8.12:8189",
        comfyuiProxyToken: "tok",
    };
    return { ...defaultConfig, channels: [channel], model: "comfy::ComfyUI T2I", imageModel: "comfy::ComfyUI T2I", models: ["comfy::ComfyUI T2I"] };
}

function proxyFlowWith(jobStatus: string, extra?: Record<string, unknown>) {
    const png = new Blob(["fake-png"], { type: "image/png" });
    return (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method || "GET";
        if (method === "POST" && url.endsWith("/api/v2/jobs")) return { ok: true, status: 200, json: async () => ({ id: "job_1" }) };
        if (method === "GET" && url.endsWith("/api/v2/jobs/job_1")) return { ok: true, status: 200, json: async () => ({ status: jobStatus, ...(jobStatus === "completed" ? { outputs: [{ image: [{ asset_id: "asset_1" }] }] } : {}), ...extra }) };
        if (method === "GET" && url.endsWith("/api/v2/assets/asset_1/content")) return { ok: true, status: 200, blob: async () => png };
        return { ok: false, status: 500, json: async () => ({}) };
    };
}

describe("requestComfyuiImage", () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
        comfyuiLogStore.setItem.mockReset();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it("cancels the job on the proxy and throws ComfyuiAbortedError when the signal aborts after submit", async () => {
        vi.useFakeTimers();
        fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input);
            const method = init?.method || "GET";
            if (method === "POST" && url.endsWith("/api/v2/jobs")) return { ok: true, status: 200, json: async () => ({ id: "job_1" }) };
            if (method === "POST" && url.endsWith("/api/v2/jobs/job_1/cancel")) return { ok: true, status: 200, json: async () => ({}) };
            if (method === "GET" && url.endsWith("/api/v2/jobs/job_1")) return { ok: true, status: 200, json: async () => ({ status: "in_progress" }) };
            return { ok: false, status: 500, json: async () => ({}) };
        });
        const controller = new AbortController();
        const onProgress = vi.fn();
        let resolveSubmitted: () => void = () => undefined;
        const submitted = new Promise<void>((resolve) => {
            resolveSubmitted = resolve;
        });
        const result = requestComfyuiImage({
            config: buildComfyuiConfig(),
            model: "comfy::ComfyUI T2I",
            prompt: "一只猫",
            signal: controller.signal,
            onProgress: (status, detail) => {
                onProgress(status, detail);
                if (status === "submitted") resolveSubmitted();
            },
        });
        // Attach the rejection handler before the abort so the rejection is never unhandled.
        const settled = result.catch((reason: unknown) => reason);
        await submitted;
        controller.abort();
        await vi.advanceTimersByTimeAsync(2000);
        await expect(settled).resolves.toBeInstanceOf(ComfyuiAbortedError);
        expect(onProgress).toHaveBeenCalledWith("submitted", { jobId: "job_1" });
        const cancelCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/api/v2/jobs/job_1/cancel"));
        expect(cancelCall).toBeDefined();
        expect((cancelCall?.[1] as RequestInit).method).toBe("POST");
    });

    it("throws ComfyuiTimeoutError after the 10 minute deadline without calling the cancel endpoint", async () => {
        vi.useFakeTimers();
        fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input);
            const method = init?.method || "GET";
            if (method === "POST" && url.endsWith("/api/v2/jobs")) return { ok: true, status: 200, json: async () => ({ id: "job_1" }) };
            if (method === "GET" && url.endsWith("/api/v2/jobs/job_1")) return { ok: true, status: 200, json: async () => ({ status: "in_progress" }) };
            return { ok: false, status: 500, json: async () => ({}) };
        });
        let resolveSubmitted: () => void = () => undefined;
        const submitted = new Promise<void>((resolve) => {
            resolveSubmitted = resolve;
        });
        const result = requestComfyuiImage({
            config: buildComfyuiConfig(),
            model: "comfy::ComfyUI T2I",
            prompt: "一只猫",
            onProgress: (status) => {
                if (status === "submitted") resolveSubmitted();
            },
        });
        // Attach the rejection handler before the clock advances so the rejection is never unhandled.
        const settled = result.catch((reason: unknown) => reason);
        await submitted;
        await vi.advanceTimersByTimeAsync(600_000);
        await expect(settled).resolves.toBeInstanceOf(ComfyuiTimeoutError);
        expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/cancel"))).toBe(false);
    });

    it("reports the timeout window in the ComfyuiTimeoutError message", async () => {
        vi.useFakeTimers();
        fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input);
            const method = init?.method || "GET";
            if (method === "POST" && url.endsWith("/api/v2/jobs")) return { ok: true, status: 200, json: async () => ({ id: "job_1" }) };
            if (method === "GET" && url.endsWith("/api/v2/jobs/job_1")) return { ok: true, status: 200, json: async () => ({ status: "in_progress" }) };
            return { ok: false, status: 500, json: async () => ({}) };
        });
        let resolveSubmitted: () => void = () => undefined;
        const submitted = new Promise<void>((resolve) => {
            resolveSubmitted = resolve;
        });
        const result = requestComfyuiImage({
            config: buildComfyuiConfig(),
            model: "comfy::ComfyUI T2I",
            prompt: "一只猫",
            onProgress: (status) => {
                if (status === "submitted") resolveSubmitted();
            },
        });
        // Attach the rejection handler before the clock advances so the rejection is never unhandled.
        const settled = result.catch((reason: unknown) => reason);
        await submitted;
        await vi.advanceTimersByTimeAsync(600_000);
        const error: unknown = await settled;
        expect(error).toBeInstanceOf(ComfyuiTimeoutError);
        expect(error).toMatchObject({ name: "ComfyuiTimeoutError", timeoutMs: 600_000 });
        expect((error as Error).message).toMatch(/600s|600秒/);
    });

    it("completes the request without ever calling the cancel endpoint", async () => {
        fetchMock.mockImplementation(proxyFlowWith("completed"));
        const result = requestComfyuiImage({ config: buildComfyuiConfig(), model: "comfy::ComfyUI T2I", prompt: "一只猫", size: "1024x768" });
        await expect(result).resolves.toMatchObject({
            jobId: "job_1",
            items: [{ id: expect.any(String), dataUrl: "data:image/png;base64,ZmFrZS1wbmc=" }],
        });
        expect(fetchMock.mock.calls.every(([url]) => !String(url).includes("/cancel"))).toBe(true);
    });

    it("does not call the cancel endpoint when a never-aborted signal is provided", async () => {
        fetchMock.mockImplementation(proxyFlowWith("completed"));
        const controller = new AbortController();
        const result = requestComfyuiImage({ config: buildComfyuiConfig(), model: "comfy::ComfyUI T2I", prompt: "一只猫", signal: controller.signal });
        await expect(result).resolves.toMatchObject({ jobId: "job_1" });
        expect(fetchMock.mock.calls.every(([url]) => !String(url).includes("/cancel"))).toBe(true);
    });

    it("calls the cancel endpoint exactly once across repeated abort() invocations", async () => {
        vi.useFakeTimers();
        fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input);
            const method = init?.method || "GET";
            if (method === "POST" && url.endsWith("/api/v2/jobs")) return { ok: true, status: 200, json: async () => ({ id: "job_1" }) };
            if (method === "POST" && url.endsWith("/api/v2/jobs/job_1/cancel")) return { ok: true, status: 200, json: async () => ({}) };
            if (method === "GET" && url.endsWith("/api/v2/jobs/job_1")) return { ok: true, status: 200, json: async () => ({ status: "in_progress" }) };
            return { ok: false, status: 500, json: async () => ({}) };
        });
        const controller = new AbortController();
        const result = requestComfyuiImage({ config: buildComfyuiConfig(), model: "comfy::ComfyUI T2I", prompt: "一只猫", signal: controller.signal });
        const settled = result.catch((reason: unknown) => reason);
        await vi.advanceTimersByTimeAsync(2000);
        controller.abort();
        controller.abort();
        await vi.advanceTimersByTimeAsync(2000);
        await expect(settled).resolves.toBeInstanceOf(ComfyuiAbortedError);
        const cancelCalls = fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/api/v2/jobs/job_1/cancel"));
        expect(cancelCalls).toHaveLength(1);
    });

    it("throws ComfyuiAbortedError immediately when the signal is already aborted before submit", async () => {
        fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input);
            const method = init?.method || "GET";
            if (method === "POST" && url.endsWith("/api/v2/jobs")) return { ok: true, status: 200, json: async () => ({ id: "job_1" }) };
            if (method === "POST" && url.endsWith("/api/v2/jobs/job_1/cancel")) return { ok: true, status: 200, json: async () => ({}) };
            return { ok: false, status: 500, json: async () => ({}) };
        });
        const controller = new AbortController();
        controller.abort();
        const settled = requestComfyuiImage({ config: buildComfyuiConfig(), model: "comfy::ComfyUI T2I", prompt: "一只猫", signal: controller.signal });
        await expect(settled).rejects.toBeInstanceOf(ComfyuiAbortedError);
        const cancelCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes("/cancel"));
        expect(cancelCalls).toHaveLength(1);
    });

    it("writes a success log entry with the job id and duration", async () => {
        fetchMock.mockImplementation(proxyFlowWith("completed"));
        const result = requestComfyuiImage({ config: buildComfyuiConfig(), model: "comfy::ComfyUI T2I", prompt: "一只猫" });
        await expect(result).resolves.toMatchObject({ jobId: "job_1" });
        expect(comfyuiLogStore.setItem).toHaveBeenCalledTimes(1);
        const [key, record] = comfyuiLogStore.setItem.mock.calls[0] as [string, Record<string, unknown>];
        expect(key).toBe(String(record.id));
        expect(record).toMatchObject({ status: "success", provider: "comfyui", model: "ComfyUI T2I", prompt: "一只猫", jobId: "job_1", successCount: 1 });
        expect(typeof record.durationMs).toBe("number");
    });

    it("writes a failed log entry with the error message when the job fails", async () => {
        fetchMock.mockImplementation(proxyFlowWith("failed"));
        const result = requestComfyuiImage({ config: buildComfyuiConfig(), model: "comfy::ComfyUI T2I", prompt: "一只猫" });
        await expect(result).rejects.toBeInstanceOf(ComfyuiJobError);
        expect(comfyuiLogStore.setItem).toHaveBeenCalledTimes(1);
        const [key, record] = comfyuiLogStore.setItem.mock.calls[0] as [string, Record<string, unknown>];
        expect(key).toBe(String(record.id));
        expect(record).toMatchObject({ status: "failed", provider: "comfyui", model: "ComfyUI T2I", prompt: "一只猫", jobId: "job_1" });
        expect(String(record.errorMessage)).toContain("ComfyUI job failed");
    });

    it("throws ComfyuiNoWorkflowError and logs a failed entry without a job id when the model has no workflow", async () => {
        const result = requestComfyuiImage({ config: buildComfyuiConfig({ withWorkflow: false }), model: "comfy::ComfyUI T2I", prompt: "一只猫" });
        await expect(result).rejects.toBeInstanceOf(ComfyuiNoWorkflowError);
        expect(fetchMock).not.toHaveBeenCalled();
        expect(comfyuiLogStore.setItem).toHaveBeenCalledTimes(1);
        const [, record] = comfyuiLogStore.setItem.mock.calls[0] as [string, Record<string, unknown>];
        expect(record).toMatchObject({ status: "failed", jobId: "" });
        expect(String(record.errorMessage)).toContain("workflow");
    });

    it("submits the workflow with the prompt and pixel size bound into the nodes", async () => {
        fetchMock.mockImplementation(proxyFlowWith("completed"));
        const result = requestComfyuiImage({ config: buildComfyuiConfig(), model: "comfy::ComfyUI T2I", prompt: "一只猫", size: "1024x768" });
        await expect(result).resolves.toMatchObject({ jobId: "job_1" });
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url).toBe("http://10.7.8.12:8189/api/v2/jobs");
        const body = JSON.parse(String(init.body)) as { prompt: Record<string, { inputs: Record<string, unknown> }> };
        expect(body.prompt["1"].inputs.text).toBe("一只猫");
        expect(body.prompt["2"].inputs.value).toBe(1024);
        expect(body.prompt["3"].inputs.value).toBe(768);
    });

    it("uploads each reference image and binds the asset ids into the ref nodes", async () => {
        const uploadedAssetIds = ["asset_a", "asset_b"];
        const png = new Blob(["fake-png"], { type: "image/png" });
        fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input);
            const method = init?.method || "GET";
            if (url.startsWith("data:")) return { ok: true, status: 200, blob: async () => png };
            if (method === "POST" && url.endsWith("/api/v2/assets")) return { ok: true, status: 200, json: async () => ({ id: uploadedAssetIds.shift() }) };
            if (method === "POST" && url.endsWith("/api/v2/jobs")) return { ok: true, status: 200, json: async () => ({ id: "job_1" }) };
            if (method === "GET" && url.endsWith("/api/v2/jobs/job_1")) return { ok: true, status: 200, json: async () => ({ status: "completed", outputs: [] }) };
            return { ok: false, status: 500, json: async () => ({}) };
        });
        const config = buildComfyuiConfig({
            workflow: {
                "1": { inputs: { text: "" }, class_type: "CLIPTextEncode", _meta: { title: "prompt" } },
                "4": { inputs: { image: "" }, class_type: "LoadImage", _meta: { title: "ref_image_01" } },
                "5": { inputs: { image: "" }, class_type: "LoadImage", _meta: { title: "ref_image_02" } },
            },
        });
        const result = requestComfyuiImage({ config, model: "comfy::ComfyUI T2I", prompt: "一只猫", images: ["data:image/png;base64,ZmFrZS1wbmc", "data:image/png;base64,ZmFrZS1wbmc"] });
        await expect(result).resolves.toMatchObject({ jobId: "job_1" });
        const assetCalls = fetchMock.mock.calls.filter(([url, init]) => String(url).endsWith("/api/v2/assets") && init?.method === "POST");
        expect(assetCalls).toHaveLength(2);
        const submitCall = fetchMock.mock.calls.find(([url, init]) => String(url).endsWith("/api/v2/jobs") && init?.method === "POST") as [string, RequestInit];
        const body = JSON.parse(String(submitCall[1].body)) as { prompt: Record<string, { inputs: Record<string, unknown> }> };
        expect(body.prompt["4"].inputs.image).toBe("asset_a");
        expect(body.prompt["5"].inputs.image).toBe("asset_b");
    });
});
