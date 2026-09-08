import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "@/i18n";
import { applyBindings, cancelJob, ComfyuiAbortedError, ComfyuiApiError, ComfyuiJobError, ComfyuiNoWorkflowError, ComfyuiTimeoutError, downloadAsset, generateRandomSeed, parseSize, pollComfyuiVideoJob, pollJob, requestComfyuiImage, submitComfyuiVideoJob, submitJob } from "@/services/api/comfyui";
import type { ComfyuiWorkflowJson } from "@/services/api/comfyui";
import { defaultConfig, type AiConfig, type ModelChannel } from "@/stores/use-config-store";

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

    it("binds seed into KSampler, KSamplerAdvanced, and PrimitiveInt nodes", () => {
        const workflow: ComfyuiWorkflowJson = {
            "1": { inputs: { seed: 0 }, class_type: "KSampler", _meta: { title: "seed" } },
            "2": { inputs: { noise_seed: 0 }, class_type: "KSamplerAdvanced", _meta: { title: "seed" } },
            "3": { inputs: { value: 0 }, class_type: "PrimitiveInt", _meta: { title: "seed" } },
        };
        const bound = applyBindings(workflow, { seed: 123456789 });
        expect((bound["1"] as TestWorkflowNode).inputs.seed).toBe(123456789);
        expect((bound["2"] as TestWorkflowNode).inputs.noise_seed).toBe(123456789);
        expect((bound["3"] as TestWorkflowNode).inputs.value).toBe(123456789);
    });

    it("falls back to input property when class_type is unknown but title is seed", () => {
        const workflow: ComfyuiWorkflowJson = {
            "1": { inputs: { seed: 0 }, class_type: "CustomSampler", _meta: { title: "seed" } },
            "2": { inputs: { noise_seed: 0 }, class_type: "CustomNoise", _meta: { title: "seed" } },
        };
        const bound = applyBindings(workflow, { seed: 987654321 });
        expect((bound["1"] as TestWorkflowNode).inputs.seed).toBe(987654321);
        expect((bound["2"] as TestWorkflowNode).inputs.noise_seed).toBe(987654321);
    });

    it("falls back to KSampler numeric seed when no node is titled seed", () => {
        const workflow: ComfyuiWorkflowJson = {
            "57:3": { inputs: { seed: 989346441631141 }, class_type: "KSampler", _meta: { title: "K采样器" } },
        };
        const bound = applyBindings(workflow, { seed: 42 });
        expect((bound["57:3"] as TestWorkflowNode).inputs.seed).toBe(42);
    });

    it("skips missing titles without throwing and returns a deep copy", () => {
        const workflow: ComfyuiWorkflowJson = {};
        const params = { prompt: "一只猫", width: 1024, height: 1366, seed: 12345 };
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

    it("binds multiple reference images to ref_image_01 and ref_image_02", () => {
        const workflow: ComfyuiWorkflowJson = {
            "1": { inputs: { image: "old1.png" }, class_type: "LoadImage", _meta: { title: "ref_image_01" } },
            "2": { inputs: { image: "old2.png" }, class_type: "LoadImage", _meta: { title: "ref_image_02" } },
        };
        const bound = applyBindings(workflow, { refImages: ["asset_1", "asset_2"] });
        expect((bound["1"] as TestWorkflowNode).inputs.image).toBe("asset_1");
        expect((bound["2"] as TestWorkflowNode).inputs.image).toBe("asset_2");
    });

    it("dynamically prunes unassigned ref_image_02 and bridges ReferenceLatent conditioning", () => {
        const workflow: ComfyuiWorkflowJson = {
            "42": { inputs: { image: "img1.png" }, class_type: "LoadImage", _meta: { title: "ref_image_01" } },
            "46": { inputs: { image: "img2.png" }, class_type: "LoadImage", _meta: { title: "ref_image_02" } },
            "62:26": { inputs: { text: "prompt" }, class_type: "FluxGuidance", _meta: { title: "guidance" } },
            "62:44": { inputs: { image: ["42", 0] }, class_type: "VAEEncode", _meta: { title: "encode1" } },
            "62:43": { inputs: { conditioning: ["62:26", 0], latent: ["62:44", 0] }, class_type: "ReferenceLatent", _meta: { title: "ref_latent_1" } },
            "62:40": { inputs: { image: ["46", 0] }, class_type: "VAEEncode", _meta: { title: "encode2" } },
            "62:39": { inputs: { conditioning: ["62:43", 0], latent: ["62:40", 0] }, class_type: "ReferenceLatent", _meta: { title: "ref_latent_2" } },
            "62:22": { inputs: { conditioning: ["62:39", 0] }, class_type: "BasicGuider", _meta: { title: "guider" } },
        };

        const bound = applyBindings(workflow, { refImages: ["asset_1"] });
        // ref_image_01 should remain and be bound
        expect(bound["42"]).toBeDefined();
        expect((bound["42"] as TestWorkflowNode).inputs.image).toBe("asset_1");
        expect(bound["62:43"]).toBeDefined();

        // ref_image_02 branch should be pruned
        expect(bound["46"]).toBeUndefined();
        expect(bound["62:40"]).toBeUndefined();
        expect(bound["62:39"]).toBeUndefined();

        // BasicGuider should be re-routed directly to ref_latent_1 (62:43)
        expect((bound["62:22"] as TestWorkflowNode).inputs.conditioning).toEqual(["62:43", 0]);
    });

    it("binds a prompt by candidate input name regardless of class_type", () => {
        const workflow: ComfyuiWorkflowJson = {
            "1": { inputs: { text: "old" }, class_type: "UnknownClass", _meta: { title: "prompt" } },
        };
        const bound = applyBindings(workflow, { prompt: "新提示" });
        expect((bound["1"] as TestWorkflowNode).inputs.text).toBe("新提示");
        expect((workflow["1"] as TestWorkflowNode).inputs.text).toBe("old");
        expect(bound["1"]).not.toBe(workflow["1"]);
    });
});

describe("generateRandomSeed", () => {
    it("generates a safe non-negative integer", () => {
        for (let i = 0; i < 10; i++) {
            const seed = generateRandomSeed();
            expect(seed).toBeGreaterThanOrEqual(0);
            expect(seed).toBeLessThan(1_000_000_000_000_000);
            expect(Number.isInteger(seed)).toBe(true);
        }
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

    it("posts the bound workflow as { prompt, client_id } to /prompt and returns the prompt_id", async () => {
        fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ prompt_id: "job_abc" }) });
        const workflow: ComfyuiWorkflowJson = {
            "1": { inputs: { value: "一只猫" }, class_type: "PrimitiveStringMultiline", _meta: { title: "prompt" } },
        };
        await expect(submitJob(workflow, "http://10.7.8.12:8188", "tok")).resolves.toBe("job_abc");
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
        expect(url).toBe("http://10.7.8.12:8188/prompt");
        expect(init.method).toBe("POST");
        const parsed = JSON.parse(String(init.body));
        expect(parsed.prompt).toEqual(workflow);
        expect(parsed.client_id).toBeDefined();
        expect(init.headers["Content-Type"]).toBe("application/json");
        expect(init.headers.Authorization).toBe("Bearer tok");
    });

    it("throws ComfyuiApiError with the status on a 500 response", async () => {
        fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
        const error: unknown = await submitJob({ "1": {} }, "http://10.7.8.12:8188").then(
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
        await expect(submitJob({ "1": {} }, "http://10.7.8.12:8188")).rejects.toThrow(ComfyuiApiError);
    });

    it("trims whitespace from the base URL", async () => {
        fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ prompt_id: "job_abc" }) });
        await expect(submitJob({ "1": {} }, " http://10.7.8.12:8188 ")).resolves.toBe("job_abc");
        expect(fetchMock.mock.calls[0][0]).toBe("http://10.7.8.12:8188/prompt");
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
            .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    job_1: {
                        status: { status_str: "success", completed: true },
                        outputs: {
                            "9": { images: [{ filename: "asset_1.png", type: "output" }, { filename: "asset_2.png", type: "output" }] },
                        },
                    },
                }),
            });
        const result = pollJob("job_1", "http://10.7.8.12:8188", "tok");
        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
        expect(url).toBe("http://10.7.8.12:8188/history/job_1");
        expect(init.headers.Authorization).toBe("Bearer tok");
        await vi.advanceTimersByTimeAsync(2000);
        await expect(result).resolves.toEqual(["asset_1.png", "asset_2.png"]);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("throws ComfyuiJobError when the job status is failed", async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({
                job_1: { status: { status_str: "error", messages: ["Node error"] } },
            }),
        });
        const failed: unknown = await pollJob("job_1", "http://10.7.8.12:8188").catch((reason) => reason);
        expect(failed).toBeInstanceOf(ComfyuiJobError);
    });

    it("keeps polling every 2 seconds until the job completes", async () => {
        vi.useFakeTimers();
        let polls = 0;
        fetchMock.mockImplementation(async () => {
            polls += 1;
            return {
                ok: true,
                status: 200,
                json: async () => (polls < 3 ? {} : { job_1: { status: { completed: true }, outputs: {} } }),
            };
        });
        const result = pollJob("job_1", "http://10.7.8.12:8188");
        await vi.advanceTimersByTimeAsync(4000);
        await expect(result).resolves.toEqual([]);
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it("resolves undefined without throwing when the signal is aborted", async () => {
        vi.useFakeTimers();
        fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
        const controller = new AbortController();
        const result = pollJob("job_1", "http://10.7.8.12:8188", "tok", controller.signal);
        controller.abort();
        await vi.advanceTimersByTimeAsync(2000);
        await expect(result).resolves.toBeUndefined();
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("throws ComfyuiApiError with the status on a non-2xx poll response", async () => {
        fetchMock.mockResolvedValue({ ok: false, status: 502, json: async () => ({}) });
        const error: unknown = await pollJob("job_1", "http://10.7.8.12:8188").catch((reason) => reason);
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
        const result = await downloadAsset("asset_1.png", "http://10.7.8.12:8188/", "tok");
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
        expect(url).toBe("http://10.7.8.12:8188/view?filename=asset_1.png&subfolder=&type=output");
        expect(init.headers.Authorization).toBe("Bearer tok");
        expect(result.blob).toBe(png);
        expect(result.dataUrl).toBe("data:image/png;base64,ZmFrZS1wbmc=");
    });

    it("throws ComfyuiApiError with the status when the asset content is unavailable", async () => {
        fetchMock.mockResolvedValue({ ok: false, status: 404, blob: async () => new Blob() });
        const error: unknown = await downloadAsset("asset_404.png", "http://10.7.8.12:8188").catch((reason) => reason);
        expect(error).toBeInstanceOf(ComfyuiApiError);
        expect(error).toMatchObject({ status: 404 });
    });

    it("throws ComfyuiApiError when the downloaded asset is empty", async () => {
        fetchMock.mockResolvedValue({ ok: true, status: 200, blob: async () => new Blob() });
        await expect(downloadAsset("asset_empty.png", "http://10.7.8.12:8188")).rejects.toThrow(ComfyuiApiError);
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

    it("deletes only the matching pending job", async () => {
        fetchMock
            .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ queue_pending: [[0, "job_1", {}, {}]], queue_running: [] }) })
            .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });

        await expect(cancelJob("job_1", "http://10.7.8.12:8188", "tok")).resolves.toBeUndefined();

        expect(fetchMock).toHaveBeenCalledTimes(2);
        const [queueUrl, queueInit] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
        expect(queueUrl).toBe("http://10.7.8.12:8188/queue");
        expect(queueInit.method).toBeUndefined();
        expect(queueInit.headers.Authorization).toBe("Bearer tok");
        const [deleteUrl, deleteInit] = fetchMock.mock.calls[1] as [string, RequestInit];
        expect(deleteUrl).toBe("http://10.7.8.12:8188/queue");
        expect(deleteInit.method).toBe("POST");
        expect(JSON.parse(String(deleteInit.body))).toEqual({ delete: ["job_1"] });
        expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/interrupt"))).toBe(false);
    });

    it("interrupts only when the matching job is running", async () => {
        fetchMock
            .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ queue_pending: [], queue_running: [[0, "job_1", {}, {}]] }) })
            .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });

        await expect(cancelJob("job_1", "http://10.7.8.12:8188")).resolves.toBeUndefined();

        expect(fetchMock).toHaveBeenCalledTimes(2);
        const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
        expect(url).toBe("http://10.7.8.12:8188/interrupt");
        expect(init.method).toBe("POST");
    });

    it("does not mutate the queue when the target job is absent", async () => {
        fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ queue_pending: [[0, "other", {}, {}]], queue_running: [] }) });
        await expect(cancelJob("job_1", "http://10.7.8.12:8188")).resolves.toBeUndefined();
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBeUndefined();
    });

    it("resolves when queue inspection fails", async () => {
        fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });
        await expect(cancelJob("job_1", "http://10.7.8.12:8188")).resolves.toBeUndefined();
        fetchMock.mockRejectedValueOnce(new TypeError("network down"));
        await expect(cancelJob("job_1", "http://10.7.8.12:8188")).resolves.toBeUndefined();
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
        comfyuiProxyUrl: "http://10.7.8.12:8188",
        comfyuiProxyToken: "tok",
    };
    return { ...defaultConfig, channels: [channel], model: "comfy::ComfyUI T2I", imageModel: "comfy::ComfyUI T2I", models: ["comfy::ComfyUI T2I"] };
}

function buildFrameVideoConfig(): AiConfig {
    const workflow: ComfyuiWorkflowJson = {
        "1": { inputs: { text: "" }, class_type: "PrimitiveStringMultiline", _meta: { title: "prompt" } },
    };
    const channel: ModelChannel = {
        id: "comfy",
        name: "ComfyUI channel",
        baseUrl: "",
        apiKey: "",
        apiFormat: "comfyui",
        models: [{ name: "ComfyUI Frame Video", capability: "video", comfyuiWorkflow: { name: "frame", json: workflow, createdAt: 0 } }],
        comfyuiProxyUrl: "http://10.7.8.12:8188",
        comfyuiProxyToken: "tok",
    };
    return { ...defaultConfig, channels: [channel], model: "comfy::ComfyUI Frame Video", videoModel: "comfy::ComfyUI Frame Video", models: ["comfy::ComfyUI Frame Video"] };
}

function nativeFlowWith(jobStatus: "success" | "error", extra?: Record<string, unknown>) {
    const png = new Blob(["fake-png"], { type: "image/png" });
    return (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method || "GET";
        if (method === "POST" && url.endsWith("/prompt")) return { ok: true, status: 200, json: async () => ({ prompt_id: "job_1" }) };
        if (method === "GET" && url.endsWith("/history/job_1")) {
            const job = jobStatus === "success"
                ? { status: { status_str: "success", completed: true }, outputs: { "9": { images: [{ filename: "asset_1.png", subfolder: "", type: "output" }] } }, ...extra }
                : { status: { status_str: "error", messages: ["boom"] }, ...extra };
            return { ok: true, status: 200, json: async () => ({ job_1: job }) };
        }
        if (method === "GET" && url.includes("/api/view?")) return { ok: true, status: 200, blob: async () => png };
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

    it("cancels the matching native job and throws ComfyuiAbortedError when the signal aborts after submit", async () => {
        vi.useFakeTimers();
        fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input);
            const method = init?.method || "GET";
            if (method === "POST" && url.endsWith("/prompt")) return { ok: true, status: 200, json: async () => ({ prompt_id: "job_1" }) };
            if (method === "GET" && url.endsWith("/history/job_1")) return { ok: true, status: 200, json: async () => ({}) };
            if (method === "GET" && url.endsWith("/queue")) return { ok: true, status: 200, json: async () => ({ queue_pending: [], queue_running: [[0, "job_1", {}, {}]] }) };
            if (method === "POST" && url.endsWith("/interrupt")) return { ok: true, status: 200, json: async () => ({}) };
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
        const interruptCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/interrupt"));
        expect(interruptCall).toBeDefined();
        expect((interruptCall?.[1] as RequestInit).method).toBe("POST");
    });

    it("throws ComfyuiTimeoutError after the 2 hour deadline without calling the cancel endpoint", async () => {
        vi.useFakeTimers();
        fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input);
            const method = init?.method || "GET";
            if (method === "POST" && url.endsWith("/prompt")) return { ok: true, status: 200, json: async () => ({ prompt_id: "job_1" }) };
            if (method === "GET" && url.endsWith("/history/job_1")) return { ok: true, status: 200, json: async () => ({}) };
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
        await vi.advanceTimersByTimeAsync(7_200_000);
        await expect(settled).resolves.toBeInstanceOf(ComfyuiTimeoutError);
        expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/queue") || String(url).endsWith("/interrupt"))).toBe(false);
    });

    it("reports the timeout window in the ComfyuiTimeoutError message", async () => {
        vi.useFakeTimers();
        fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input);
            const method = init?.method || "GET";
            if (method === "POST" && url.endsWith("/prompt")) return { ok: true, status: 200, json: async () => ({ prompt_id: "job_1" }) };
            if (method === "GET" && url.endsWith("/history/job_1")) return { ok: true, status: 200, json: async () => ({}) };
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
        await vi.advanceTimersByTimeAsync(7_200_000);
        const error: unknown = await settled;
        expect(error).toBeInstanceOf(ComfyuiTimeoutError);
        expect(error).toMatchObject({ name: "ComfyuiTimeoutError", timeoutMs: 7_200_000 });
        expect((error as Error).message).toMatch(/2h|7200/);
    });

    it("completes the request without ever calling the cancel endpoint", async () => {
        fetchMock.mockImplementation(nativeFlowWith("success"));
        const result = requestComfyuiImage({ config: buildComfyuiConfig(), model: "comfy::ComfyUI T2I", prompt: "一只猫", size: "1024x768" });
        await expect(result).resolves.toMatchObject({
            jobId: "job_1",
            items: [{ id: expect.any(String), dataUrl: "data:image/png;base64,ZmFrZS1wbmc=" }],
        });
        expect(fetchMock.mock.calls.every(([url]) => !String(url).endsWith("/queue") && !String(url).endsWith("/interrupt"))).toBe(true);
    });

    it("treats a completed job without image outputs as a failed generation", async () => {
        fetchMock.mockImplementation(nativeFlowWith("success", { outputs: {} }));
        const result = requestComfyuiImage({ config: buildComfyuiConfig(), model: "comfy::ComfyUI T2I", prompt: "一只猫" });
        await expect(result).rejects.toThrow(i18n.t("comfyui.noImageOutput"));
        const [, record] = comfyuiLogStore.setItem.mock.calls[0] as [string, Record<string, unknown>];
        expect(record).toMatchObject({ status: "failed", jobId: "job_1" });
    });

    it("does not call the cancel endpoint when a never-aborted signal is provided", async () => {
        fetchMock.mockImplementation(nativeFlowWith("success"));
        const controller = new AbortController();
        const result = requestComfyuiImage({ config: buildComfyuiConfig(), model: "comfy::ComfyUI T2I", prompt: "一只猫", signal: controller.signal });
        await expect(result).resolves.toMatchObject({ jobId: "job_1" });
        expect(fetchMock.mock.calls.every(([url]) => !String(url).endsWith("/queue") && !String(url).endsWith("/interrupt"))).toBe(true);
    });

    it("resumes an existing job by polling history without submitting a new prompt", async () => {
        fetchMock.mockImplementation(nativeFlowWith("success"));
        const result = requestComfyuiImage({ config: buildComfyuiConfig(), model: "comfy::ComfyUI T2I", prompt: "一只猫", jobId: "job_1" });
        await expect(result).resolves.toMatchObject({ jobId: "job_1" });
        expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/prompt"))).toBe(false);
        expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/history/job_1"))).toBe(true);
    });

    it("calls the guarded interrupt endpoint exactly once across repeated abort() invocations", async () => {
        vi.useFakeTimers();
        fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input);
            const method = init?.method || "GET";
            if (method === "POST" && url.endsWith("/prompt")) return { ok: true, status: 200, json: async () => ({ prompt_id: "job_1" }) };
            if (method === "GET" && url.endsWith("/history/job_1")) return { ok: true, status: 200, json: async () => ({}) };
            if (method === "GET" && url.endsWith("/queue")) return { ok: true, status: 200, json: async () => ({ queue_pending: [], queue_running: [[0, "job_1", {}, {}]] }) };
            if (method === "POST" && url.endsWith("/interrupt")) return { ok: true, status: 200, json: async () => ({}) };
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
        const interruptCalls = fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/interrupt"));
        expect(interruptCalls).toHaveLength(1);
    });

    it("throws ComfyuiAbortedError immediately when the signal is already aborted before submit", async () => {
        fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input);
            const method = init?.method || "GET";
            if (method === "POST" && url.endsWith("/prompt")) return { ok: true, status: 200, json: async () => ({ prompt_id: "job_1" }) };
            if (method === "GET" && url.endsWith("/queue")) return { ok: true, status: 200, json: async () => ({ queue_pending: [[0, "job_1", {}, {}]], queue_running: [] }) };
            if (method === "POST" && url.endsWith("/queue")) return { ok: true, status: 200, json: async () => ({}) };
            return { ok: false, status: 500, json: async () => ({}) };
        });
        const controller = new AbortController();
        controller.abort();
        const settled = requestComfyuiImage({ config: buildComfyuiConfig(), model: "comfy::ComfyUI T2I", prompt: "一只猫", signal: controller.signal });
        await expect(settled).rejects.toBeInstanceOf(ComfyuiAbortedError);
        const deleteCalls = fetchMock.mock.calls.filter(([url, init]) => String(url).endsWith("/queue") && (init as RequestInit | undefined)?.method === "POST");
        expect(deleteCalls).toHaveLength(1);
    });

    it("writes a success log entry with the job id and duration", async () => {
        fetchMock.mockImplementation(nativeFlowWith("success"));
        const result = requestComfyuiImage({ config: buildComfyuiConfig(), model: "comfy::ComfyUI T2I", prompt: "一只猫" });
        await expect(result).resolves.toMatchObject({ jobId: "job_1" });
        expect(comfyuiLogStore.setItem).toHaveBeenCalledTimes(1);
        const [key, record] = comfyuiLogStore.setItem.mock.calls[0] as [string, Record<string, unknown>];
        expect(key).toBe(String(record.id));
        expect(record).toMatchObject({ status: "success", provider: "comfyui", model: "ComfyUI T2I", prompt: "一只猫", jobId: "job_1", successCount: 1 });
        expect(typeof record.durationMs).toBe("number");
    });

    it("writes a failed log entry with the error message when the job fails", async () => {
        fetchMock.mockImplementation(nativeFlowWith("error"));
        const result = requestComfyuiImage({ config: buildComfyuiConfig(), model: "comfy::ComfyUI T2I", prompt: "一只猫" });
        await expect(result).rejects.toBeInstanceOf(ComfyuiJobError);
        expect(comfyuiLogStore.setItem).toHaveBeenCalledTimes(1);
        const [key, record] = comfyuiLogStore.setItem.mock.calls[0] as [string, Record<string, unknown>];
        expect(key).toBe(String(record.id));
        expect(record).toMatchObject({ status: "failed", provider: "comfyui", model: "ComfyUI T2I", prompt: "一只猫", jobId: "job_1" });
        expect(String(record.errorMessage)).toContain("ComfyUI 执行失败");
    });

    it("throws ComfyuiNoWorkflowError and logs a failed entry without a job id when the model has no workflow", async () => {
        const result = requestComfyuiImage({ config: buildComfyuiConfig({ withWorkflow: false }), model: "comfy::ComfyUI T2I", prompt: "一只猫" });
        await expect(result).rejects.toBeInstanceOf(ComfyuiNoWorkflowError);
        expect(fetchMock).not.toHaveBeenCalled();
        expect(comfyuiLogStore.setItem).toHaveBeenCalledTimes(1);
        const [, record] = comfyuiLogStore.setItem.mock.calls[0] as [string, Record<string, unknown>];
        expect(record).toMatchObject({ status: "failed", jobId: "" });
        expect(String(record.errorMessage)).toContain("ComfyUI T2I");
        expect(String(record.errorMessage)).toContain("workflow");
    });

    it("submits the workflow with the prompt, pixel size, and random seed bound into the nodes", async () => {
        fetchMock.mockImplementation(nativeFlowWith("success"));
        const config = buildComfyuiConfig({
            workflow: {
                "1": { inputs: { text: "" }, class_type: "CLIPTextEncode", _meta: { title: "prompt" } },
                "2": { inputs: { value: 0 }, class_type: "PrimitiveInt", _meta: { title: "width" } },
                "3": { inputs: { value: 0 }, class_type: "PrimitiveInt", _meta: { title: "height" } },
                "4": { inputs: { seed: 0 }, class_type: "KSampler", _meta: { title: "seed" } },
            },
        });
        const result = await requestComfyuiImage({ config, model: "comfy::ComfyUI T2I", prompt: "一只猫", size: "1024x768" });
        expect(result).toMatchObject({ jobId: "job_1" });
        expect(typeof result.seed).toBe("number");
        expect(result.seed).toBeGreaterThanOrEqual(0);
        expect(result.items[0].seed).toBe(result.seed);

        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url).toBe("http://10.7.8.12:8188/prompt");
        const body = JSON.parse(String(init.body)) as { prompt: Record<string, { inputs: Record<string, unknown> }>; client_id: string };
        expect(body.client_id).toEqual(expect.any(String));
        expect(body.prompt["1"].inputs.text).toBe("一只猫");
        expect(body.prompt["2"].inputs.value).toBe(1024);
        expect(body.prompt["3"].inputs.value).toBe(768);
        expect(body.prompt["4"].inputs.seed).toBe(result.seed);
    });
});

describe("native ComfyUI video validation", () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("rejects more than two frame images before upload or submission", async () => {
        const references = ["1", "2", "3"].map((id) => ({ id, name: `${id}.png`, type: "image/png", dataUrl: `data:image/png;base64,${id}` }));
        await expect(submitComfyuiVideoJob({ config: buildFrameVideoConfig(), prompt: "动画", videoMode: "frame", references })).rejects.toThrow("最多支持 2 张参考图");
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("rejects video or audio references in frame mode before upload or submission", async () => {
        const references = [{ id: "1", name: "1.png", type: "image/png", dataUrl: "data:image/png;base64,1" }];
        const referenceVideos = [{ id: "video-1", name: "video.mp4", type: "video/mp4", url: "blob:video" }];
        await expect(submitComfyuiVideoJob({ config: buildFrameVideoConfig(), prompt: "动画", videoMode: "frame", references, referenceVideos })).rejects.toThrow("不支持视频或音频参考");
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("reports a completed job without video output as no-video-output rather than cancellation", async () => {
        fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ job_1: { status: { status_str: "success", completed: true }, outputs: {} } }) });
        const error: unknown = await pollComfyuiVideoJob("job_1", "http://10.7.8.12:8188").catch((reason) => reason);
        expect(error).toBeInstanceOf(Error);
        expect(error).not.toBeInstanceOf(ComfyuiAbortedError);
        expect((error as Error).message).toBe(i18n.t("comfyui.noVideoOutput"));
    });
});
