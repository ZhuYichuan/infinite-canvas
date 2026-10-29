import { describe, expect, it, vi } from "vitest";
import type { ModelChannel } from "@/stores/use-config-store";
import {
    ComfyuiAbortedError,
    ComfyuiJobCancelledError,
    ComfyuiJobError,
    ComfyuiJobLostError,
    ComfyuiJobNotFoundError,
    ComfyuiNetworkError,
    ComfyuiTimeoutError,
} from "../../comfyui";
import {
    comfyuiTaskDriver,
    mapComfyErrorToTaskError,
    mapComfyOutputsToArtifacts,
} from "../drivers/comfyui-driver";
import { TaskExecutionError } from "../errors";

const mockChannel: ModelChannel = {
    id: "comfy-test",
    name: "Comfy Test",
    baseUrl: "http://127.0.0.1:8188",
    apiKey: "test-token",
    apiFormat: "comfyui",
    models: [],
};

describe("ComfyuiTaskDriver", () => {
    describe("mapComfyOutputsToArtifacts", () => {
        it("maps text outputs", () => {
            const outputs = [
                {
                    id: "text_1",
                    text: "A beautiful landscape",
                },
            ];
            const artifacts = mapComfyOutputsToArtifacts(outputs, "http://127.0.0.1:8188");
            expect(artifacts).toEqual([
                {
                    type: "text",
                    text: "A beautiful landscape",
                },
            ]);
        });

        it("maps image outputs with proper view URL", () => {
            const outputs = [
                {
                    id: "/api/view?filename=test.png&type=output&subfolder=sub",
                    filename: "test.png",
                    subfolder: "sub",
                    type: "output",
                    output_type: "output",
                    content_type: "image/png",
                },
            ];
            const artifacts = mapComfyOutputsToArtifacts(outputs, "http://127.0.0.1:8188/");
            expect(artifacts).toHaveLength(1);
            expect(artifacts[0]).toEqual({
                type: "image",
                url: "http://127.0.0.1:8188/api/view?filename=test.png&type=output&subfolder=sub",
                assetId: "test.png",
            });
        });

        it("maps video outputs detecting mp4 extension and content type", () => {
            const outputs = [
                {
                    id: "gen_video",
                    filename: "result.mp4",
                    subfolder: "",
                    type: "video",
                    content_type: "video/mp4",
                },
            ];
            const artifacts = mapComfyOutputsToArtifacts(outputs, "http://127.0.0.1:8188");
            expect(artifacts).toHaveLength(1);
            expect(artifacts[0]).toEqual({
                type: "video",
                url: "http://127.0.0.1:8188/view?filename=result.mp4&subfolder=&type=output",
                assetId: "result.mp4",
            });
        });

        it("maps audio outputs detecting audio content type", () => {
            const outputs = [
                {
                    id: "gen_audio",
                    filename: "speech.wav",
                    subfolder: "audio_dir",
                    type: "audio",
                    content_type: "audio/wav",
                },
            ];
            const artifacts = mapComfyOutputsToArtifacts(outputs, "http://127.0.0.1:8188");
            expect(artifacts).toHaveLength(1);
            expect(artifacts[0]).toEqual({
                type: "audio",
                url: "http://127.0.0.1:8188/view?filename=speech.wav&subfolder=audio_dir&type=output",
                assetId: "speech.wav",
            });
        });

        it("handles full absolute URLs", () => {
            const outputs = [
                {
                    id: "https://oss.example.com/images/1.png",
                    url: "https://oss.example.com/images/1.png",
                },
            ];
            const artifacts = mapComfyOutputsToArtifacts(outputs, "http://127.0.0.1:8188");
            expect(artifacts).toEqual([
                {
                    type: "image",
                    url: "https://oss.example.com/images/1.png",
                    assetId: "https://oss.example.com/images/1.png",
                },
            ]);
        });
    });

    describe("mapComfyErrorToTaskError", () => {
        it("maps ComfyuiNetworkError to network category with isRetryable = true", () => {
            const err = new ComfyuiNetworkError("http://127.0.0.1:8188", "job_123");
            const mapped = mapComfyErrorToTaskError(err, "job_123");
            expect(mapped).toBeInstanceOf(TaskExecutionError);
            expect(mapped.category).toBe("network");
            expect(mapped.isRetryable).toBe(true);
            expect(mapped.jobId).toBe("job_123");
        });

        it("maps ComfyuiTimeoutError to timeout category with isRetryable = true", () => {
            const err = new ComfyuiTimeoutError(30000, "job_123");
            const mapped = mapComfyErrorToTaskError(err, "job_123");
            expect(mapped.category).toBe("timeout");
            expect(mapped.isRetryable).toBe(true);
        });

        it("maps ComfyuiJobCancelledError to cancelled category with isRetryable = false", () => {
            const err = new ComfyuiJobCancelledError("job_123");
            const mapped = mapComfyErrorToTaskError(err, "job_123");
            expect(mapped.category).toBe("cancelled");
            expect(mapped.isRetryable).toBe(false);
        });

        it("maps ComfyuiAbortedError to cancelled category", () => {
            const err = new ComfyuiAbortedError();
            const mapped = mapComfyErrorToTaskError(err, "job_123");
            expect(mapped.category).toBe("cancelled");
        });

        it("maps ComfyuiJobLostError and ComfyuiJobNotFoundError to lost category", () => {
            const lostErr = new ComfyuiJobLostError("job_123");
            const notFoundErr = new ComfyuiJobNotFoundError("job_123");
            expect(mapComfyErrorToTaskError(lostErr, "job_123").category).toBe("lost");
            expect(mapComfyErrorToTaskError(notFoundErr, "job_123").category).toBe("lost");
        });

        it("maps ComfyuiJobError to execution_failed category", () => {
            const err = new ComfyuiJobError("Syntax error in node", { details: "bad node" });
            const mapped = mapComfyErrorToTaskError(err, "job_123");
            expect(mapped.category).toBe("execution_failed");
            expect(mapped.isRetryable).toBe(false);
        });

        it("preserves already instantiated TaskExecutionError", () => {
            const original = new TaskExecutionError("custom", "cancelled", { jobId: "job_99" });
            const mapped = mapComfyErrorToTaskError(original, "job_99");
            expect(mapped).toBe(original);
        });
    });

    describe("TaskLifecycleDriver methods", () => {
        it("queries status successfully via comfyui module", async () => {
            vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
                const urlStr = String(url);
                if (urlStr.includes("/history/job_done")) {
                    return {
                        ok: true,
                        status: 200,
                        json: async () => ({
                            job_done: {
                                status: { status_str: "success", completed: true, messages: [] },
                                outputs: {
                                    "9": {
                                        images: [{ filename: "done.png", subfolder: "", type: "output" }],
                                    },
                                },
                            },
                        }),
                    } as unknown as Response;
                }
                return {
                    ok: false,
                    status: 404,
                    json: async () => ({}),
                } as unknown as Response;
            });

            const snapshot = await comfyuiTaskDriver.queryStatus("job_done", mockChannel);
            expect(snapshot.phase).toBe("success");
            expect(snapshot.jobId).toBe("job_done");
            expect(snapshot.artifacts).toHaveLength(1);
            expect(snapshot.artifacts?.[0].type).toBe("image");
            expect(snapshot.artifacts?.[0].url).toContain("filename=done.png");

            vi.restoreAllMocks();
        });

        it("handles poll progress events bridging network_retry and pending", async () => {
            let fetchCallCount = 0;
            vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
                const urlStr = String(url);
                if (urlStr.includes("/queue")) {
                    fetchCallCount++;
                    if (fetchCallCount === 1) {
                        return {
                            ok: true,
                            status: 200,
                            json: async () => ({
                                queue_running: [],
                                queue_pending: [["id", "job_poll", {}]],
                            }),
                        } as unknown as Response;
                    }
                    return {
                        ok: true,
                        status: 200,
                        json: async () => ({
                            queue_running: [],
                            queue_pending: [],
                        }),
                    } as unknown as Response;
                }
                if (urlStr.includes("/history/job_poll")) {
                    if (fetchCallCount >= 2) {
                        return {
                            ok: true,
                            status: 200,
                            json: async () => ({
                                job_poll: {
                                    status: { status_str: "success", completed: true, messages: [] },
                                    outputs: {
                                        "3": { text: ["result text"] },
                                    },
                                },
                            }),
                        } as unknown as Response;
                    }
                    return {
                        ok: true,
                        status: 200,
                        json: async () => ({}),
                    } as unknown as Response;
                }
                return { ok: false, status: 404 } as unknown as Response;
            });

            const progressSnapshots: any[] = [];
            const snapshot = await comfyuiTaskDriver.poll("job_poll", mockChannel, {
                onProgress: (snap) => progressSnapshots.push(snap),
            });

            expect(snapshot.phase).toBe("success");
            expect(snapshot.artifacts?.[0]).toEqual({
                type: "text",
                text: "result text",
            });
            expect(progressSnapshots.length).toBeGreaterThan(0);
            expect(progressSnapshots[0].phase).toBe("pending");
            expect(progressSnapshots[0].queuePosition).toBe(1);

            vi.restoreAllMocks();
        });
    });
});
