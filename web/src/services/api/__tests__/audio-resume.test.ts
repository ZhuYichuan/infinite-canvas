import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { requestAudioGeneration } from "@/services/api/audio";
import { ComfyuiNetworkError, requestComfyuiAudio, resetComfyuiBatchPollers } from "@/services/api/comfyui";
import { defaultConfig } from "@/stores/use-config-store";

vi.mock("localforage", () => ({ default: { createInstance: () => ({ setItem: vi.fn(async () => undefined) }) } }));

const existingJobId = "accepted-audio-job";

beforeEach(() => vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    if (url.pathname === "/prompt") return Response.json({ prompt_id: "duplicate-job" });
    if (url.pathname === "/queue") return new Response(null, { status: 404 });
    if (url.pathname.startsWith("/history/")) {
        const jobId = url.pathname.split("/").pop()!;
        return Response.json({ [jobId]: { status: { status_str: "success", completed: true }, outputs: { "1": { audio: [{ filename: "result.wav", type: "output", subfolder: "audio" }] } } } });
    }
    if (url.pathname.endsWith("/view")) return new Response(new Blob(["audio bytes"], { type: "audio/wav" }));
    return Response.json({ system: { os: "linux" } });
})));

afterEach(() => {
    resetComfyuiBatchPollers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

for (const direct of [true, false]) {
    it(`resumes the accepted audio task without submitting again through ${direct ? "ComfyUI" : "audio generation"}`, async () => {
        const onProgress = vi.fn();
        const result = direct
            ? await requestComfyuiAudio({ config: defaultConfig, prompt: "测试音频", seed: 42, jobId: existingJobId, onProgress })
            : await requestAudioGeneration(defaultConfig, "测试音频", { seed: 42, jobId: existingJobId, onProgress });
        expect(result.jobId).toBe(existingJobId);
        expect(result.blob.type).toBe("audio/wav");
        expect(result.blob.size).toBeGreaterThan(0);
        expect(fetch).toHaveBeenCalledWith(expect.stringContaining(`/history/${existingJobId}`), expect.anything());
        expect(vi.mocked(fetch).mock.calls.some(([input]) => new URL(String(input)).pathname === "/prompt")).toBe(false);
        expect(onProgress).not.toHaveBeenCalledWith("submitted", expect.anything());
    });
}

it("forwards the newly accepted audio task ID immediately through audio generation progress", async () => {
    const onProgress = vi.fn();
    const result = await requestAudioGeneration(defaultConfig, "测试音频", { seed: 42, onProgress });
    expect(result.jobId).toBe("duplicate-job");
    expect(onProgress).toHaveBeenCalledWith("submitted", { jobId: result.jobId });
});

it("keeps the original accepted audio task ID when polling exhausts its existing network retries", async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockRejectedValue(new TypeError("Failed to fetch"));
    const result = requestAudioGeneration(defaultConfig, "测试音频", { seed: 42, jobId: existingJobId }).catch((error: unknown) => error);
    await vi.runAllTimersAsync();
    const error = await result;
    expect(error).toBeInstanceOf(ComfyuiNetworkError);
    expect(error).toMatchObject({ jobId: existingJobId });
    expect(vi.mocked(fetch).mock.calls.some(([input]) => new URL(String(input)).pathname === "/prompt")).toBe(false);
});
