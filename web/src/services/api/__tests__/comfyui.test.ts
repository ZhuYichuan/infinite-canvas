import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import i18n from "@/i18n";
import { adaptWorkflowModelPaths, applyBindings, cancelJob, collectVideoAssetIds, ComfyuiAbortedError, ComfyuiApiError, ComfyuiJobCancelledError, ComfyuiJobError, ComfyuiJobLostError, ComfyuiJobNotFoundError, ComfyuiNetworkError, ComfyuiNoWorkflowError, ComfyuiTimeoutError, downloadAsset, generateRandomSeed, parseSize, pollComfyuiVideoJob, pollJob, pollJobRaw, queryComfyuiJobStatus, requestComfyuiImage, resetComfyuiBatchPollers, submitComfyuiVideoJob, submitJob, validateComfyuiWorkflow } from "@/services/api/comfyui";
import type { ComfyuiWorkflowJson } from "@/services/api/comfyui";
import { defaultConfig, findWorkflow, type AiConfig, type ModelChannel } from "@/stores/use-config-store";
import { DEFAULT_BUILTIN_COMFYUI_DEPTH_VIDEO_WORKFLOW, DEFAULT_BUILTIN_COMFYUI_FACE_REFINE_WORKFLOW, DEFAULT_LOCAL_COMFYUI_T2I_WORKFLOW } from "@/services/api/comfyui-default-workflows";

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
        resetComfyuiBatchPollers();
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it("polls immediately, waits 2s between rounds, and resolves with the image asset ids when the job completes", async () => {
        vi.useFakeTimers();
        let rounds = 0;
        fetchMock.mockImplementation(async (url: string) => {
            if (url.includes("/queue")) {
                rounds += 1;
                return { ok: true, status: 200, json: async () => ({ queue_running: rounds === 1 ? [[0, "job_1"]] : [], queue_pending: [] }) };
            }
            if (url.includes("/history/job_1")) {
                return {
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
                };
            }
            return { ok: true, status: 200, json: async () => ({}) };
        });
        const result = pollJob("job_1", "http://10.7.8.12:8188", "tok");
        expect(fetchMock).toHaveBeenCalled();
        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
        expect(url).toBe("http://10.7.8.12:8188/queue");
        expect(init.headers.Authorization).toBe("Bearer tok");
        await vi.advanceTimersByTimeAsync(2000);
        await expect(result).resolves.toEqual(["/api/view?filename=asset_1.png&type=output&subfolder=", "/api/view?filename=asset_2.png&type=output&subfolder="]);
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

    it("throws ComfyuiJobCancelledError when the job in history contains execution_interrupted", async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({
                job_1: { status: { status_str: "error", messages: [["execution_interrupted", { node_id: "3" }]] } },
            }),
        });
        const error: unknown = await pollJob("job_1", "http://10.7.8.12:8188").catch((reason) => reason);
        expect(error).toBeInstanceOf(ComfyuiJobCancelledError);
        expect((error as ComfyuiJobCancelledError).jobId).toBe("job_1");
    });

    it("throws ComfyuiJobLostError when job is missing from both history and queue", async () => {
        fetchMock.mockImplementation(async (url: string) => {
            if (url.includes("/queue")) {
                return { ok: true, status: 200, json: async () => ({ queue_running: [], queue_pending: [] }) };
            }
            if (url.includes("/history/job_1")) {
                return { ok: true, status: 200, json: async () => ({}) };
            }
            return { ok: true, status: 200, json: async () => ({}) };
        });
        const promise = pollJob("job_1", "http://10.7.8.12:8188");
        // 推进让其超过未在 queue 出现的宽限轮次
        await vi.advanceTimersByTimeAsync(8000);
        const error: unknown = await promise.catch((reason) => reason);
        expect(error).toBeInstanceOf(ComfyuiJobLostError);
        expect((error as ComfyuiJobLostError).jobId).toBe("job_1");
    });

    it("keeps polling until the job completes while in queue", async () => {
        vi.useFakeTimers();
        let queueCalls = 0;
        const onProgress = vi.fn();
        fetchMock.mockImplementation(async (url: string) => {
            if (url.includes("/queue")) {
                queueCalls += 1;
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({
                        queue_running: [],
                        queue_pending: queueCalls < 2 ? [[1, "job_1"]] : [],
                    }),
                };
            }
            if (url.includes("/history/job_1")) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({ job_1: { status: { completed: true }, outputs: {} } }),
                };
            }
            return { ok: true, status: 200, json: async () => ({}) };
        });
        const result = pollJob("job_1", "http://10.7.8.12:8188", undefined, undefined, undefined, undefined, onProgress);
        await vi.advanceTimersByTimeAsync(100);
        expect(onProgress).toHaveBeenCalledWith("pending", { queuePosition: 1 });
        await vi.advanceTimersByTimeAsync(4000);
        await expect(result).resolves.toEqual([]);
    });

    it("batches multiple concurrent jobs into a single /queue request and dispatches progress", async () => {
        vi.useFakeTimers();
        let queueHits = 0;
        const progress1 = vi.fn();
        const progress2 = vi.fn();

        fetchMock.mockImplementation(async (url: string) => {
            if (url.includes("/queue")) {
                queueHits++;
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({
                        queue_running: [[0, "job_run"]],
                        queue_pending: [[1, "job_pend"]],
                    }),
                };
            }
            if (url.includes("/history/job_run")) {
                return { ok: true, status: 200, json: async () => ({ job_run: { status: { completed: true }, outputs: {} } }) };
            }
            return { ok: true, status: 200, json: async () => ({}) };
        });

        pollJob("job_run", "http://10.7.8.12:8188", undefined, undefined, undefined, undefined, progress1);
        pollJob("job_pend", "http://10.7.8.12:8188", undefined, undefined, undefined, undefined, progress2);

        await vi.advanceTimersByTimeAsync(50);
        expect(queueHits).toBe(1);
        expect(progress1).toHaveBeenCalledWith("running");
        expect(progress2).toHaveBeenCalledWith("pending", { queuePosition: 1 });
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

    it("retries on transient network errors in pollJobRaw and succeeds when connection recovers", async () => {
        vi.useFakeTimers();
        let attempts = 0;
        const onProgress = vi.fn();
        fetchMock.mockImplementation(async () => {
            attempts++;
            if (attempts <= 2) {
                throw new TypeError("Failed to fetch");
            }
            return {
                ok: true,
                status: 200,
                json: async () => ({
                    job_net: { status: { status_str: "success", completed: true }, outputs: {} },
                }),
            };
        });

        const promise = pollJobRaw("job_net", "http://192.168.31.188:8188", undefined, undefined, undefined, onProgress);
        // Advance timer for retries
        await vi.advanceTimersByTimeAsync(3000);
        await vi.advanceTimersByTimeAsync(3000);
        const res = await promise;
        expect(res).toBeDefined();
        expect(onProgress).toHaveBeenCalledWith("network_retry", expect.objectContaining({ retryCount: 1 }));
        expect(onProgress).toHaveBeenCalledWith("network_retry", expect.objectContaining({ retryCount: 2 }));
    });

    it("throws ComfyuiNetworkError when network failure exceeds max retries in pollJobRaw", async () => {
        vi.useFakeTimers();
        fetchMock.mockImplementation(async () => {
            throw new TypeError("Failed to fetch");
        });

        const promise = pollJobRaw("job_fail", "http://192.168.31.188:8188");
        // Advance past 5 retries
        for (let i = 0; i < 6; i++) {
            await vi.advanceTimersByTimeAsync(3000);
        }
        const error: unknown = await promise.catch((err) => err);
        expect(error).toBeInstanceOf(ComfyuiNetworkError);
        expect((error as ComfyuiNetworkError).message).toContain("192.168.31.188:8188");
    });
});

describe("queryComfyuiJobStatus", () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("returns 'success' when job completed in history", async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({
                job_123: {
                    status: { status_str: "success", completed: true },
                    outputs: { "9": { images: [{ filename: "out.png", type: "output" }] } },
                },
            }),
        });
        const res = await queryComfyuiJobStatus("job_123", "http://127.0.0.1:8188");
        expect(res.status).toBe("success");
        expect(res.outputs?.length).toBe(1);
    });

    it("returns 'error' when job errored in history", async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({
                job_123: {
                    status: { status_str: "error", messages: ["CUDA out of memory"] },
                },
            }),
        });
        const res = await queryComfyuiJobStatus("job_123", "http://127.0.0.1:8188");
        expect(res.status).toBe("error");
        expect(res.error).toContain("CUDA out of memory");
    });

    it("returns 'cancelled' when job has execution_interrupted in history", async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({
                job_123: {
                    status: { status_str: "error", messages: [["execution_interrupted", { node_id: "3" }]] },
                },
            }),
        });
        const res = await queryComfyuiJobStatus("job_123", "http://127.0.0.1:8188");
        expect(res.status).toBe("cancelled");
    });

    it("returns 'pending' with queuePosition when job is in queue_pending", async () => {
        fetchMock.mockImplementation(async (url: string) => {
            if (url.includes("/history/job_123")) {
                return { ok: true, status: 200, json: async () => ({}) };
            }
            if (url.includes("/queue")) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({
                        queue_running: [],
                        queue_pending: [
                            [0, "other_job"],
                            [1, "job_123"],
                        ],
                    }),
                };
            }
            return { ok: true, status: 200, json: async () => ({}) };
        });
        const res = await queryComfyuiJobStatus("job_123", "http://127.0.0.1:8188");
        expect(res.status).toBe("pending");
        expect(res.queuePosition).toBe(2);
    });

    it("returns 'running' when job is in queue_running", async () => {
        fetchMock.mockImplementation(async (url: string) => {
            if (url.includes("/history/job_123")) {
                return { ok: true, status: 200, json: async () => ({}) };
            }
            if (url.includes("/queue")) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({
                        queue_running: [[0, "job_123"]],
                        queue_pending: [],
                    }),
                };
            }
            return { ok: true, status: 200, json: async () => ({}) };
        });
        const res = await queryComfyuiJobStatus("job_123", "http://127.0.0.1:8188");
        expect(res.status).toBe("running");
    });

    it("returns 'lost' when missing from both history and queue and isLocallyActive is true", async () => {
        fetchMock.mockImplementation(async (url: string) => {
            if (url.includes("/history/job_123")) {
                return { ok: true, status: 200, json: async () => ({}) };
            }
            if (url.includes("/queue")) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({ queue_running: [], queue_pending: [] }),
                };
            }
            return { ok: true, status: 200, json: async () => ({}) };
        });
        const res = await queryComfyuiJobStatus("job_123", "http://127.0.0.1:8188", undefined, { isLocallyActive: true });
        expect(res.status).toBe("lost");
    });

    it("returns 'cancelled' when missing from both history and queue and isLocallyCancelled is true", async () => {
        fetchMock.mockImplementation(async (url: string) => {
            if (url.includes("/history/job_123")) {
                return { ok: true, status: 200, json: async () => ({}) };
            }
            if (url.includes("/queue")) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({ queue_running: [], queue_pending: [] }),
                };
            }
            return { ok: true, status: 200, json: async () => ({}) };
        });
        const res = await queryComfyuiJobStatus("job_123", "http://127.0.0.1:8188", undefined, { isLocallyCancelled: true });
        expect(res.status).toBe("cancelled");
    });

    it("returns 'not_found' when missing and no local context", async () => {
        fetchMock.mockImplementation(async (url: string) => {
            if (url.includes("/history/job_123")) {
                return { ok: true, status: 200, json: async () => ({}) };
            }
            if (url.includes("/queue")) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({ queue_running: [], queue_pending: [] }),
                };
            }
            return { ok: true, status: 200, json: async () => ({}) };
        });
        const res = await queryComfyuiJobStatus("job_123", "http://127.0.0.1:8188");
        expect(res.status).toBe("not_found");
    });

    it("throws ComfyuiNetworkError with clear message on server crash/network failure", async () => {
        fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
        const error: unknown = await queryComfyuiJobStatus("job_123", "http://192.168.31.188:8188").catch((err) => err);
        expect(error).toBeInstanceOf(ComfyuiNetworkError);
        expect((error as ComfyuiNetworkError).message).toContain("无法连接 ComfyUI 服务（http://192.168.31.188:8188）");
        expect((error as ComfyuiNetworkError).message).toContain("服务可能已崩溃或未启动");
    });

    it("throws ComfyuiNetworkError with offline message when navigator.onLine is false", async () => {
        const originalOnLine = navigator.onLine;
        Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
        fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
        const error: unknown = await queryComfyuiJobStatus("job_123", "http://192.168.31.188:8188").catch((err) => err);
        Object.defineProperty(navigator, "onLine", { value: originalOnLine, configurable: true });
        expect(error).toBeInstanceOf(ComfyuiNetworkError);
        expect((error as ComfyuiNetworkError).isOffline).toBe(true);
        expect((error as ComfyuiNetworkError).message).toBe("本地网络连接已断开，请检查网络设置");
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
        resetComfyuiBatchPollers();
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

    it("throws ComfyuiTimeoutError after the 18 hour deadline without calling the cancel endpoint", async () => {
        vi.useFakeTimers();
        fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input);
            const method = init?.method || "GET";
            if (method === "POST" && url.endsWith("/prompt")) return { ok: true, status: 200, json: async () => ({ prompt_id: "job_1" }) };
            if (method === "GET" && url.endsWith("/history/job_1")) return { ok: true, status: 200, json: async () => ({}) };
            if (method === "GET" && url.endsWith("/queue")) return { ok: true, status: 200, json: async () => ({ queue_running: [], queue_pending: [[0, "job_1"]] }) };
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
        await vi.advanceTimersByTimeAsync(64_800_000);
        await expect(settled).resolves.toBeInstanceOf(ComfyuiTimeoutError);
        expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/interrupt"))).toBe(false);
    });

    it("reports the timeout window in the ComfyuiTimeoutError message", async () => {
        vi.useFakeTimers();
        fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input);
            const method = init?.method || "GET";
            if (method === "POST" && url.endsWith("/prompt")) return { ok: true, status: 200, json: async () => ({ prompt_id: "job_1" }) };
            if (method === "GET" && url.endsWith("/history/job_1")) return { ok: true, status: 200, json: async () => ({}) };
            if (method === "GET" && url.endsWith("/queue")) return { ok: true, status: 200, json: async () => ({ queue_running: [], queue_pending: [[0, "job_1"]] }) };
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
        await vi.advanceTimersByTimeAsync(64_800_000);
        const error: unknown = await settled;
        expect(error).toBeInstanceOf(ComfyuiTimeoutError);
        expect(error).toMatchObject({ name: "ComfyuiTimeoutError", timeoutMs: 64_800_000 });
        expect((error as Error).message).toMatch(/18h|64800/);
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

    it("submits video job with model profile and default workflow successfully", async () => {
        fetchMock.mockImplementation(async (url: string) => {
            if (String(url).includes("/prompt")) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({ prompt_id: "job_video_123" }),
                };
            }
            return { ok: true, status: 200, json: async () => ({}) };
        });

        const result = await submitComfyuiVideoJob({
            config: { ...buildFrameVideoConfig(), size: "1280x736" },
            prompt: "生成一段超酷动画",
            model: "omni-video-minimax-h3-fp8-4step-pdmd",
            videoMode: "omni",
        });

        expect(result.jobId).toBe("job_video_123");
        expect(result.baseUrl).toBe("http://10.7.8.12:8188");
        expect(fetchMock).toHaveBeenCalled();
    });

    it("reports a completed job without video output as no-video-output rather than cancellation", async () => {
        fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ job_1: { status: { status_str: "success", completed: true }, outputs: {} } }) });
        const error: unknown = await pollComfyuiVideoJob("job_1", "http://10.7.8.12:8188").catch((reason) => reason);
        expect(error).toBeInstanceOf(Error);
        expect(error).not.toBeInstanceOf(ComfyuiAbortedError);
        expect((error as Error).message).toBe(i18n.t("comfyui.noVideoOutput"));
    });

    it("prioritizes type = 'output' when outputs contain both input and output nodes", async () => {
        fetchMock.mockImplementation(async (url: string) => {
            if (url.includes("/history/job_multi")) {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({
                        job_multi: {
                            status: { status_str: "success", completed: true },
                            outputs: {
                                "1": {
                                    videos: [{ filename: "input_ref.mp4", subfolder: "", type: "input" }],
                                },
                                "4": {
                                    videos: [{ filename: "depth_generated.mp4", subfolder: "reshot", type: "output" }],
                                },
                            },
                        },
                    }),
                };
            }
            if (url.includes("/view?") || url.includes("/api/view?")) {
                return {
                    ok: true,
                    status: 200,
                    blob: async () => new Blob(["fake-mp4"], { type: "video/mp4" }),
                };
            }
            return { ok: false, status: 404 };
        });

        const res = await pollComfyuiVideoJob("job_multi", "http://10.7.8.12:8188");
        expect(res).toBeDefined();
        const viewCalls = fetchMock.mock.calls.filter((c: unknown[]) => typeof c[0] === "string" && (c[0].includes("/view?") || c[0].includes("/api/view?")));
        expect(viewCalls.length).toBeGreaterThan(0);
        expect(viewCalls[0][0]).toContain("filename=depth_generated.mp4");
        expect(viewCalls[0][0]).toContain("type=output");
    });
});

describe("collectVideoAssetIds prioritization", () => {
    it("returns output node over input or temp nodes", () => {
        const outputs = [
            { id: "/api/view?filename=input.mp4&type=input", output_type: "input", type: "video" },
            { id: "/api/view?filename=preview.mp4&type=temp", output_type: "temp", type: "video" },
            { id: "/api/view?filename=result.mp4&type=output", output_type: "output", type: "video" },
        ];
        const res = collectVideoAssetIds(outputs);
        expect(res).toEqual(["/api/view?filename=result.mp4&type=output"]);
    });

    it("falls back to temp when no output type exists", () => {
        const outputs = [
            { id: "/api/view?filename=input.mp4&type=input", output_type: "input", type: "video" },
            { id: "/api/view?filename=preview.mp4&type=temp", output_type: "temp", type: "video" },
        ];
        const res = collectVideoAssetIds(outputs);
        expect(res).toEqual(["/api/view?filename=preview.mp4&type=temp"]);
    });
});

describe("validateComfyuiWorkflow & findWorkflow", () => {
    it("validates built-in t2i workflow successfully", () => {
        const result = validateComfyuiWorkflow(DEFAULT_LOCAL_COMFYUI_T2I_WORKFLOW.json, "t2i");
        expect(result.ok).toBe(true);
    });

    it("validates built-in faceRefine workflow successfully", () => {
        const result = validateComfyuiWorkflow(DEFAULT_BUILTIN_COMFYUI_FACE_REFINE_WORKFLOW.json, "faceRefine");
        expect(result.ok).toBe(true);
    });

    it("rejects faceRefine workflow missing ref_video slot", () => {
        const invalidWf = {
            "1": { class_type: "PrimitiveStringMultiline", inputs: { value: "test" }, _meta: { title: "prompt" } },
            "2": { class_type: "VHS_VideoCombine", inputs: {}, _meta: { title: "output_video" } },
        };
        const result = validateComfyuiWorkflow(invalidWf as unknown as ComfyuiWorkflowJson, "faceRefine");
        expect(result.ok).toBe(false);
        expect(result.error).toContain("ref_video_01");
    });

    it("validates built-in depthVideo workflow successfully", () => {
        const result = validateComfyuiWorkflow(DEFAULT_BUILTIN_COMFYUI_DEPTH_VIDEO_WORKFLOW.json, "depthVideo");
        expect(result.ok).toBe(true);
    });

    it("rejects depthVideo workflow missing ref_video slot", () => {
        const invalidWf = {
            "1": { class_type: "SaveVideo", inputs: {}, _meta: { title: "output_video" } },
        };
        const result = validateComfyuiWorkflow(invalidWf as unknown as ComfyuiWorkflowJson, "depthVideo");
        expect(result.ok).toBe(false);
        expect(result.error).toContain("ref_video_01");
    });

    it("rejects t2i workflow missing prompt slot", () => {
        const invalidWf = {
            "1": { class_type: "KSampler", inputs: { seed: 123 }, _meta: { title: "seed" } },
            "2": { class_type: "SaveImage", inputs: {}, _meta: { title: "output_image" } },
        };
        const result = validateComfyuiWorkflow(invalidWf as unknown as ComfyuiWorkflowJson, "t2i");
        expect(result.ok).toBe(false);
        expect(result.error).toContain("缺少");
        expect(result.error).toContain("prompt");
    });

    it("rejects t2i workflow containing forbidden inpaint ref_mask slot", () => {
        const wfWithMask = {
            ...DEFAULT_LOCAL_COMFYUI_T2I_WORKFLOW.json,
            "999": { class_type: "LoadImage", inputs: {}, _meta: { title: "ref_mask" } },
        };
        const result = validateComfyuiWorkflow(wfWithMask as unknown as ComfyuiWorkflowJson, "t2i");
        expect(result.ok).toBe(false);
        expect(result.error).toContain("ref_mask");
    });

    it("finds default workflow for a category when no specific workflowId is given", () => {
        const config: AiConfig = {
            ...defaultConfig,
            channels: [
                {
                    ...defaultConfig.channels[0],
                    workflows: [
                        { id: "wf-1", name: "WF 1", category: "t2i", json: DEFAULT_LOCAL_COMFYUI_T2I_WORKFLOW.json, isDefault: false },
                        { id: "wf-2", name: "WF 2 (Default)", category: "t2i", json: DEFAULT_LOCAL_COMFYUI_T2I_WORKFLOW.json, isDefault: true },
                    ],
                },
            ],
        };
        const found = findWorkflow(config, config.channels[0].id, undefined, "t2i");
        expect(found?.id).toBe("wf-2");
    });

    it("finds specific workflow by workflowId", () => {
        const config: AiConfig = {
            ...defaultConfig,
            channels: [
                {
                    ...defaultConfig.channels[0],
                    workflows: [
                        { id: "wf-1", name: "WF 1", category: "t2i", json: DEFAULT_LOCAL_COMFYUI_T2I_WORKFLOW.json, isDefault: false },
                        { id: "wf-2", name: "WF 2 (Default)", category: "t2i", json: DEFAULT_LOCAL_COMFYUI_T2I_WORKFLOW.json, isDefault: true },
                    ],
                },
            ],
        };
        const found = findWorkflow(config, config.channels[0].id, "wf-1", "t2i");
        expect(found?.id).toBe("wf-1");
    });
});

describe("Qwen-Image-2.1 and submitJob validation", () => {
    it("safely binds Qwen-Image-2.1 for text-to-image without cascade deleting nodes", async () => {
        const qwenJson = (await import("@/assets/workflows/qwen_image_21_api.json")).default;
        const bound = applyBindings(qwenJson as unknown as ComfyuiWorkflowJson, {
            prompt: "ancient chinese portrait",
            width: 1024,
            height: 1024,
            seed: 42,
        });

        expect(Object.keys(bound).length).toBe(14);
        expect(bound["481"]).toBeDefined(); // SaveImageAdvanced
        expect((bound["480:468"]?.inputs as Record<string, unknown>)?.switch).toBe(true);
        expect((bound["480:474"]?.inputs as Record<string, unknown>)?.["images.image_1"]).toBeUndefined();
    });

    it("safely binds Qwen-Image-2.1 for image-to-image with reference image and custom size (honoring EmptyLatentImage)", async () => {
        const qwenJson = (await import("@/assets/workflows/qwen_image_21_api.json")).default;
        const bound = applyBindings(qwenJson as unknown as ComfyuiWorkflowJson, {
            prompt: "portrait based on photo",
            width: 1024,
            height: 1024,
            seed: 42,
            refImages: ["uploaded_asset.png"],
        });

        expect(Object.keys(bound).length).toBe(15);
        expect(bound["481"]).toBeDefined();
        // 指定了宽高尺寸时，保持 switch = true 走 EmptyLatentImage 遵循指定尺寸
        expect((bound["480:468"]?.inputs as Record<string, unknown>)?.switch).toBe(true);
        expect((bound["480:474"]?.inputs as Record<string, unknown>)?.["images.image_1"]).toEqual(["495", 0]);
        expect((bound["480:474"]?.inputs as Record<string, unknown>)?.["images.image_2"]).toBeUndefined();
    });

    it("safely binds Qwen-Image-2.1 for image-to-image without custom size (falling back to reference latent)", async () => {
        const qwenJson = (await import("@/assets/workflows/qwen_image_21_api.json")).default;
        const bound = applyBindings(qwenJson as unknown as ComfyuiWorkflowJson, {
            prompt: "portrait based on photo",
            seed: 42,
            refImages: ["uploaded_asset.png"],
        });

        expect(Object.keys(bound).length).toBe(15);
        expect(bound["481"]).toBeDefined();
        // 未指定尺寸时，切到 switch = false 走参考图 Latent
        expect((bound["480:468"]?.inputs as Record<string, unknown>)?.switch).toBe(false);
    });

    it("safely binds Qwen-Image-2.1 Int8 for text-to-image and image-to-image", async () => {
        const t2iJson = (await import("@/assets/workflows/t2i_qwen_image_21_int8_api.json")).default;
        const i2iJson = (await import("@/assets/workflows/i2i_qwen_image_21_int8_api.json")).default;

        // Dedicated text-to-image (pure T2I without ref image nodes)
        const pureT2iBound = applyBindings(t2iJson as unknown as ComfyuiWorkflowJson, {
            prompt: "a majestic golden dragon",
            width: 1024,
            height: 1024,
            seed: 1234,
        });
        expect(pureT2iBound["1"]).toBeDefined(); // SaveImageAdvanced
        expect((pureT2iBound["24"]?.inputs as Record<string, unknown>)?.switch).toBe(true);
        expect(pureT2iBound["10"]).toBeUndefined(); // ref_image nodes completely omitted
        expect((pureT2iBound["26"]?.inputs as Record<string, unknown>)?.["images.image_1"]).toBeUndefined();

        // Image-to-image with 1 reference image and custom size
        const i2iBound = applyBindings(i2iJson as unknown as ComfyuiWorkflowJson, {
            prompt: "character redesign",
            width: 1024,
            height: 1024,
            seed: 1234,
            refImages: ["uploaded_int8_asset.png"],
        });
        expect(i2iBound["1"]).toBeDefined();
        expect((i2iBound["24"]?.inputs as Record<string, unknown>)?.switch).toBe(true);
        expect((i2iBound["26"]?.inputs as Record<string, unknown>)?.["images.image_1"]).toEqual(["10", 0]);
        expect((i2iBound["26"]?.inputs as Record<string, unknown>)?.["images.image_2"]).toBeUndefined();

        // Image-to-image without custom size (fallback to reference latent)
        const fallbackBound = applyBindings(i2iJson as unknown as ComfyuiWorkflowJson, {
            prompt: "character redesign",
            seed: 1234,
            refImages: ["uploaded_int8_asset.png"],
        });
        expect((fallbackBound["24"]?.inputs as Record<string, unknown>)?.switch).toBe(false);
    });

    it("rejects empty workflow in submitJob", async () => {
        await expect(submitJob({}, "http://127.0.0.1:8188")).rejects.toThrow(ComfyuiNoWorkflowError);
    });

    it("adapts model paths to Windows backslashes and Linux forward slashes", () => {
        const testWorkflow: ComfyuiWorkflowJson = {
            "2": {
                class_type: "H3FaceTrackCrop",
                inputs: {
                    detector: "segm/person_yolov8m-seg.pt",
                    fallback_detector: "bbox/face_yolov8m.pt",
                    confidence: 0.35,
                    prompt: "a smiling person",
                },
            },
        };

        // 转为 Windows 路径
        const winWf = adaptWorkflowModelPaths(testWorkflow, "windows");
        expect((winWf["2"]?.inputs as Record<string, unknown>)?.detector).toBe("segm\\person_yolov8m-seg.pt");
        expect((winWf["2"]?.inputs as Record<string, unknown>)?.fallback_detector).toBe("bbox\\face_yolov8m.pt");
        expect((winWf["2"]?.inputs as Record<string, unknown>)?.prompt).toBe("a smiling person");

        // 从 Windows 路径转回 Linux 路径
        const linuxWf = adaptWorkflowModelPaths(winWf, "linux");
        expect((linuxWf["2"]?.inputs as Record<string, unknown>)?.detector).toBe("segm/person_yolov8m-seg.pt");
        expect((linuxWf["2"]?.inputs as Record<string, unknown>)?.fallback_detector).toBe("bbox/face_yolov8m.pt");
        expect((linuxWf["2"]?.inputs as Record<string, unknown>)?.prompt).toBe("a smiling person");
    });
});



