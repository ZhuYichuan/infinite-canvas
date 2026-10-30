import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { ComfyuiAbortedError, requestComfyuiVideo, resetComfyuiBatchPollers, submitComfyuiVideoJob, type ComfyuiVideoRequest } from "@/services/api/comfyui";
import { defaultConfig, type AiConfig, type ModelChannel, type WorkflowCategory } from "@/stores/use-config-store";
import faceRefineWorkflow from "@/assets/workflows/video_h3_face_refine_api.json";

vi.mock("localforage", () => ({ default: { createInstance: () => ({ setItem: vi.fn(async () => undefined), getItem: vi.fn(async () => null) }) } }));

const toolWorkflow = {
    "1": { class_type: "PrimitiveStringMultiline", inputs: { value: "" }, _meta: { title: "prompt" } },
    "2": { class_type: "H3FaceTrackCrop", inputs: { images: ["5", 0] } },
    "3": { class_type: "LoadImage", inputs: { image: "stale.png" }, _meta: { title: "ref_image_01" } },
    "4": { class_type: "LoadVideo", inputs: { file: "stale.mp4" }, _meta: { title: "ref_video_01" } },
    "5": { class_type: "GetVideoComponents", inputs: { video: ["4", 0] } },
};
const image = { id: "face", name: "face.png", type: "image/png", dataUrl: "data:image/png;base64,AA==" };
const video = { id: "source", name: "source.mp4", type: "video/mp4", url: "blob:source-video" };

function request(category: WorkflowCategory = "faceRefine", model = "custom"): ComfyuiVideoRequest {
    const channel: ModelChannel = {
        id: "selected", name: "工具渠道", baseUrl: "", apiKey: "", apiFormat: "comfyui", models: [],
        comfyuiProxyUrl: "http://tool-host:8188", workflows: [{ id: "tool", name: "tool", category, json: toolWorkflow, createdAt: 0 }],
    };
    const config: AiConfig = { ...defaultConfig, channels: [channel], channelId: channel.id, size: "1280x736", videoMode: "frame", videoModel: model };
    return { config, model, prompt: "修复人物面部", channelId: channel.id, workflowId: "tool", videoMode: "frame", references: [image], referenceVideos: [video] };
}

beforeEach(() => {
    let uploadingVideo = false;
    vi.stubGlobal("fetch", vi.fn(async (input) => {
        const url = String(input);
        if (url.startsWith("blob:") || url.startsWith("data:")) {
            uploadingVideo = url.startsWith("blob:");
            return new Response(new Blob(["asset"]));
        }
        if (url.endsWith("/upload/image")) return Response.json({ name: uploadingVideo ? "uploaded-video.mp4" : "uploaded-image.png" });
        if (url.endsWith("/prompt")) return Response.json({ prompt_id: "tool-job" });
        if (url.endsWith("/system_stats")) return Response.json({ system: { os: "nt" } });
        if (url.endsWith("/queue")) return new Response(null, { status: 404 });
        if (url.includes("/history/")) {
            const jobId = url.split("/").pop()!;
            return Response.json({ [jobId]: { status: { status_str: "success", completed: true }, outputs: { "23": { videos: [{ filename: "result.mp4", subfolder: "", type: "output" }] } } } });
        }
        if (url.includes("/view?")) return new Response(new Blob(["video bytes"], { type: "video/mp4" }));
        throw new Error(`Unexpected URL: ${url}`);
    }));
});
afterEach(() => { resetComfyuiBatchPollers(); vi.unstubAllGlobals(); });

for (const category of ["faceRefine", "depthVideo"] as const) {
    it(`binds ${category}'s original video despite an inherited frame model and frame mode`, async () => {
        const req = request(category, "frame-video-minimax-h3-fp8-4step-pdmd");
        if (category === "depthVideo") { req.prompt = ""; req.references = []; }
        await expect(submitComfyuiVideoJob(req)).resolves.toMatchObject({ jobId: "tool-job" });
        const post = vi.mocked(fetch).mock.calls.find(([input]) => String(input).endsWith("/prompt"))!;
        const submitted = JSON.parse(String(post[1]?.body)).prompt;
        expect(submitted["4"].inputs.file).toBe("uploaded-video.mp4");
        expect(submitted["5"].inputs.video).toEqual(["4", 0]);
        expect(submitted["2"].inputs.images).toEqual(["5", 0]);
        if (category === "faceRefine") expect(submitted["3"].inputs.image).toBe("uploaded-image.png");
    });
}

for (const [name, patch, reason] of [
    ["missing source", { referenceVideos: [] }, "源视频"],
    ["multiple sources", { referenceVideos: [video, { ...video, id: "second" }] }, "源视频"],
    ["blank source", { referenceVideos: [{ ...video, url: "" }] }, "源视频"],
    ["unavailable stored source", { referenceVideos: [{ ...video, url: "", storageKey: "deleted-video" }] }, "源视频"],
    ["missing face image", { references: [] }, "参考图"],
    ["blank face prompt", { prompt: "  " }, "提示词"],
] as const) {
    it(`rejects a face tool's ${name} before any upload or submission with channel context`, async () => {
        const req = { ...request(), ...patch } as ComfyuiVideoRequest;
        const error = await submitComfyuiVideoJob(req).catch((caught: unknown) => caught);
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("渠道「工具渠道」");
        expect((error as Error).message).toContain(reason);
        expect(fetch).not.toHaveBeenCalled();
    });
}

it("uses the explicitly selected tool channel for both workflow and API endpoint", async () => {
    const req = request("depthVideo");
    const other = { ...req.config.channels[0], id: "original", name: "原渠道", comfyuiProxyUrl: "http://original-host:8188" };
    req.config = { ...req.config, channelId: other.id, channels: [other, ...req.config.channels] };
    req.prompt = "";
    await expect(submitComfyuiVideoJob(req)).resolves.toMatchObject({ baseUrl: "http://tool-host:8188" });
    expect(vi.mocked(fetch).mock.calls.some(([input]) => String(input).startsWith("http://original-host"))).toBe(false);
});

it("keeps the built-in face workflow's video frames, original audio, stitch base and size inputs connected", async () => {
    const req = request("faceRefine", "frame-video-minimax-h3-fp8-4step-pdmd");
    req.config.channels[0].workflows![0].json = faceRefineWorkflow;
    await expect(submitComfyuiVideoJob(req)).resolves.toMatchObject({ jobId: "tool-job" });
    const post = vi.mocked(fetch).mock.calls.find(([input]) => String(input).endsWith("/prompt"))!;
    const submitted = JSON.parse(String(post[1]?.body)).prompt;
    expect(submitted["112"].inputs.file).toBe("uploaded-video.mp4");
    expect(submitted["113"].inputs.video).toEqual(["112", 0]);
    for (const [id, input, output] of [["2", "images", 0], ["13", "audio", 1], ["22", "base_images", 0], ["116", "image", 0]] as const) {
        expect(submitted[id].inputs[input]).toEqual(["113", output]);
    }
});

for (const resume of [false, true]) {
    it(`${resume ? "resumes an accepted" : "submits a new"} tool task and polls/downloads only from its explicitly selected channel`, async () => {
        const req = request();
        const other = { ...req.config.channels[0], id: "original", name: "原渠道", comfyuiProxyUrl: "http://original-host:8188" };
        req.config = { ...req.config, channelId: other.id, channels: [other, ...req.config.channels] };
        req.jobId = resume ? "accepted-tool-job" : undefined;
        const result = await requestComfyuiVideo(req);
        expect(result).toMatchObject({ jobId: resume ? "accepted-tool-job" : "tool-job", mimeType: "video/mp4" });
        const apiCalls = vi.mocked(fetch).mock.calls.filter(([input]) => String(input).startsWith("http:"));
        expect(apiCalls.every(([input]) => String(input).startsWith("http://tool-host:8188/"))).toBe(true);
        expect(apiCalls.some(([input]) => String(input).includes(`/history/${result.jobId}`))).toBe(true);
        expect(apiCalls.some(([input]) => String(input).includes("/view?"))).toBe(true);
        expect(apiCalls.filter(([input]) => String(input).endsWith("/prompt"))).toHaveLength(resume ? 0 : 1);
    });
}

for (const submit of [submitComfyuiVideoJob, requestComfyuiVideo]) {
    it(`${submit.name} rejects a removed explicit channel before any request`, async () => {
        const req = request();
        req.channelId = "removed-channel";
        const error = await submit(req).catch((caught: unknown) => caught);
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("渠道");
        expect((error as Error).message).toContain("不存在");
        expect(fetch).not.toHaveBeenCalled();
    });
    it(`${submit.name} rejects a removed explicit workflow instead of executing the first channel workflow`, async () => {
        const req = request();
        req.workflowId = "removed-workflow";
        const error = await submit(req).catch((caught: unknown) => caught);
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("渠道「工具渠道」");
        expect((error as Error).message).toContain("工作流");
        expect((error as Error).message).toContain("不存在");
        expect(fetch).not.toHaveBeenCalled();
    });
}

it("cancels an accepted tool task on the explicitly selected channel", async () => {
    const req = request();
    const other = { ...req.config.channels[0], id: "original", name: "原渠道", comfyuiProxyUrl: "http://original-host:8188" };
    req.config = { ...req.config, channelId: other.id, channels: [other, ...req.config.channels] };
    req.jobId = "accepted-tool-job";
    const controller = new AbortController();
    controller.abort();
    req.signal = controller.signal;
    await expect(requestComfyuiVideo(req)).rejects.toBeInstanceOf(ComfyuiAbortedError);
    expect(fetch).toHaveBeenCalledWith("http://tool-host:8188/queue", expect.anything());
    expect(vi.mocked(fetch).mock.calls.some(([input]) => String(input).startsWith("http://original-host"))).toBe(false);
});
