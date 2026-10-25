import { describe, expect, it } from "vitest";
import { ingestWorkflow } from "../comfyui-adapter";
import type { ComfyuiWorkflowJson } from "../comfyui";

describe("WorkflowIngestionAdapter (Candidate 1 Seam)", () => {
    // 1. 存量已标注合规工作流：直接透传并保持 100% 置信度
    it("preserves already valid workflows with full confidence", () => {
        const validT2i: ComfyuiWorkflowJson = {
            "1": {
                class_type: "PrimitiveStringMultiline",
                inputs: { value: "a cinematic landscape" },
                _meta: { title: "prompt" },
            },
            "2": {
                class_type: "PrimitiveInt",
                inputs: { value: 12345 },
                _meta: { title: "seed" },
            },
            "3": {
                class_type: "SaveImage",
                inputs: { images: ["4", 0] },
                _meta: { title: "output_image" },
            },
        };

        const result = ingestWorkflow(validT2i, { categoryHint: "t2i" });
        expect(result.ok).toBe(true);
        expect(result.confidence).toBe(1.0);
        expect(result.detectedCategory).toBe("t2i");
        expect(result.workflow).toBeDefined();
        expect(result.detectedSlots.some((s) => s.slot === "prompt")).toBe(true);
    });

    // 2. 社区常见未标注原生文生图工作流 (API 格式)
    it("auto-detects prompt, seed, output_image, and models in raw unlabeled T2I workflow", () => {
        const rawT2i: ComfyuiWorkflowJson = {
            "10": {
                class_type: "UNETLoader",
                inputs: { unet_name: "flux1-dev.safetensors" },
                _meta: { title: "Load Diffusion Model" },
            },
            "11": {
                class_type: "CLIPLoader",
                inputs: { clip_name: "t5xxl_fp8_e4m3fn.safetensors" },
                _meta: { title: "Load CLIP" },
            },
            "20": {
                class_type: "CLIPTextEncode",
                inputs: {
                    text: "a beautiful golden retriever puppy playing in the grass",
                    clip: ["11", 0],
                },
                _meta: { title: "Positive Conditioning" },
            },
            "21": {
                class_type: "CLIPTextEncode",
                inputs: {
                    text: "blurry, low quality, deformed",
                    clip: ["11", 0],
                },
                _meta: { title: "Negative Conditioning" },
            },
            "30": {
                class_type: "EmptyLatentImage",
                inputs: { width: 1024, height: 1024, batch_size: 1 },
                _meta: { title: "Empty Latent Image" },
            },
            "40": {
                class_type: "KSampler",
                inputs: {
                    model: ["10", 0],
                    positive: ["20", 0],
                    negative: ["21", 0],
                    latent_image: ["30", 0],
                    seed: 42,
                    steps: 20,
                    cfg: 7.0,
                    sampler_name: "euler",
                    scheduler: "normal",
                    denoise: 1.0,
                },
                _meta: { title: "KSampler" },
            },
            "50": {
                class_type: "VAEDecode",
                inputs: { samples: ["40", 0], vae: ["10", 1] },
                _meta: { title: "VAE Decode" },
            },
            "60": {
                class_type: "SaveImage",
                inputs: { images: ["50", 0], filename_prefix: "ComfyUI" },
                _meta: { title: "Save Image" },
            },
        };

        const result = ingestWorkflow(rawT2i);
        expect(result.ok).toBe(true);
        expect(result.detectedCategory).toBe("t2i");
        expect(result.workflow).toBeDefined();

        const workflow = result.workflow as Record<string, { class_type: string; inputs: Record<string, unknown>; _meta?: { title?: string } }>;
        // 正向文本节点应被自动打标为 prompt
        expect(workflow["20"]?._meta?.title?.toLowerCase()).toBe("prompt");
        // 保存节点应被自动打标为 output_image
        expect(workflow["60"]?._meta?.title?.toLowerCase()).toBe("output_image");
        // UNETLoader 节点应被自动挂载 select_models_diffusion_models
        expect(workflow["10"]?._meta?.title?.toLowerCase()).toContain("select_models_diffusion_models");
        // CLIPLoader 节点应被自动挂载 select_models_clip
        expect(workflow["11"]?._meta?.title?.toLowerCase()).toContain("select_models_clip");
    });

    // 3. UI 流程图格式 JSON（包含 nodes 和 links）自动编译为 API 格式并适配
    it("normalizes and adapts UI graph format (with nodes and links)", () => {
        const uiGraph = {
            nodes: [
                {
                    id: 1,
                    type: "CLIPTextEncode",
                    title: "CLIP Text Encode (Prompt)",
                    widgets_values: ["cyberpunk city at neon midnight"],
                },
                {
                    id: 2,
                    type: "KSampler",
                    title: "KSampler",
                    widgets_values: [123456, "randomize", 20, 8, "euler", "normal", 1],
                },
                {
                    id: 3,
                    type: "SaveImage",
                    title: "Save Image",
                    widgets_values: ["ComfyUI"],
                },
            ],
            links: [
                [101, 1, 0, 2, 1, "CONDITIONING"], // node 1 output 0 -> node 2 input 1 (positive)
                [102, 2, 0, 3, 0, "IMAGE"], // node 2 output 0 -> node 3 input 0 (images)
            ],
        };

        const result = ingestWorkflow(uiGraph);
        expect(result.ok).toBe(true);
        expect(result.workflow).toBeDefined();
        const wf = result.workflow as Record<string, { class_type: string; _meta?: { title?: string } }>;
        expect(wf["1"]?._meta?.title?.toLowerCase()).toBe("prompt");
        expect(wf["3"]?._meta?.title?.toLowerCase()).toBe("output_image");
    });

    // 4. 多图参考图生图：自动识别并按顺序排序 ref_image_01..02
    it("auto-identifies image-to-image and sequences reference images", () => {
        const rawI2i: ComfyuiWorkflowJson = {
            "1": {
                class_type: "LoadImage",
                inputs: { image: "base_portrait.png" },
                _meta: { title: "Base Image" },
            },
            "2": {
                class_type: "LoadImage",
                inputs: { image: "style_ref.png" },
                _meta: { title: "Style Reference" },
            },
            "3": {
                class_type: "CLIPTextEncode",
                inputs: { text: "oil painting style portrait" },
                _meta: { title: "Positive" },
            },
            "4": {
                class_type: "VAEEncode",
                inputs: { pixels: ["1", 0] },
                _meta: { title: "VAE Encode" },
            },
            "5": {
                class_type: "KSampler",
                inputs: {
                    positive: ["3", 0],
                    latent_image: ["4", 0],
                    seed: 100,
                },
                _meta: { title: "KSampler" },
            },
            "6": {
                class_type: "SaveImage",
                inputs: { images: ["5", 0] },
                _meta: { title: "Save Image" },
            },
        };

        const result = ingestWorkflow(rawI2i);
        expect(result.ok).toBe(true);
        expect(result.detectedCategory).toBe("i2i");
        const wf = result.workflow as Record<string, { _meta?: { title?: string } }>;
        // 连接到 VAEEncode 的图 1 应优先作为 ref_image_01
        expect(wf["1"]?._meta?.title?.toLowerCase()).toBe("ref_image_01");
        expect(wf["2"]?._meta?.title?.toLowerCase()).toBe("ref_image_02");
        expect(wf["3"]?._meta?.title?.toLowerCase()).toBe("prompt");
        expect(wf["6"]?._meta?.title?.toLowerCase()).toBe("output_image");
    });

    // 5. 局部重绘 (Inpaint)：单节点 Mask 自动分流重构 (Auto-split ref_mask)
    it("auto-splits inpaint mask from single LoadImage node into dedicated ref_mask node", () => {
        const singleNodeInpaint: ComfyuiWorkflowJson = {
            "1": {
                class_type: "LoadImage",
                inputs: { image: "target.png" },
                _meta: { title: "Load Image" },
            },
            "2": {
                class_type: "CLIPTextEncode",
                inputs: { text: "fix eyes and smile" },
                _meta: { title: "Prompt" },
            },
            "3": {
                class_type: "InpaintModelConditioning",
                inputs: {
                    positive: ["2", 0],
                    pixels: ["1", 0], // IMAGE pin
                    mask: ["1", 1], // MASK pin from the same node!
                },
                _meta: { title: "Inpaint Conditioning" },
            },
            "4": {
                class_type: "KSampler",
                inputs: {
                    positive: ["3", 0],
                    seed: 999,
                },
                _meta: { title: "KSampler" },
            },
            "5": {
                class_type: "SaveImage",
                inputs: { images: ["4", 0] },
                _meta: { title: "Save Image" },
            },
        };

        const result = ingestWorkflow(singleNodeInpaint);
        expect(result.ok).toBe(true);
        expect(result.detectedCategory).toBe("inpaint");
        const wf = result.workflow as Record<string, { class_type: string; inputs: Record<string, unknown>; _meta?: { title?: string } }>;
        expect(wf["1"]?._meta?.title?.toLowerCase()).toBe("ref_image_01");
        // 必须自动分流生成一个 ref_mask 节点
        const maskNodeEntry = Object.entries(wf).find(([_, n]) => n._meta?.title?.toLowerCase() === "ref_mask");
        expect(maskNodeEntry).toBeDefined();
        const [maskNodeId] = maskNodeEntry!;
        // 下游 InpaintModelConditioning 的 mask 连线应已被重写为指向新分流出的 ref_mask 节点
        expect(wf["3"]?.inputs?.mask).toEqual([maskNodeId, 0]);
    });

    // 6. 首尾帧视频 (Frame Video)：自动识别并按时序分配 first_frame / last_frame
    it("auto-detects first_frame, last_frame, and output_video in frame video workflow", () => {
        const frameWf: ComfyuiWorkflowJson = {
            "1": {
                class_type: "LoadImage",
                inputs: { image: "start.png" },
                _meta: { title: "First Frame" },
            },
            "2": {
                class_type: "LoadImage",
                inputs: { image: "end.png" },
                _meta: { title: "Last Frame" },
            },
            "3": {
                class_type: "CLIPTextEncode",
                inputs: { text: "smooth camera transition" },
                _meta: { title: "Prompt" },
            },
            "4": {
                class_type: "FirstLastFrameConditioning",
                inputs: {
                    first_image: ["1", 0],
                    last_image: ["2", 0],
                    positive: ["3", 0],
                },
                _meta: { title: "Frame Conditioning" },
            },
            "5": {
                class_type: "VHS_VideoCombine",
                inputs: { images: ["4", 0] },
                _meta: { title: "Video Output" },
            },
        };

        const result = ingestWorkflow(frameWf);
        expect(result.ok).toBe(true);
        expect(result.detectedCategory).toBe("frameVideo");
        const wf = result.workflow as Record<string, { _meta?: { title?: string } }>;
        expect(wf["1"]?._meta?.title?.toLowerCase()).toBe("first_frame");
        expect(wf["2"]?._meta?.title?.toLowerCase()).toBe("last_frame");
        expect(wf["5"]?._meta?.title?.toLowerCase()).toBe("output_video");
    });

    // 7. 音乐与音频生成：自动分离 caption, lyrics 与 output_audio
    it("auto-detects audio workflow with caption and lyrics separation", () => {
        const musicWf: ComfyuiWorkflowJson = {
            "1": {
                class_type: "PrimitiveStringMultiline",
                inputs: { value: "ambient cyberpunk synthwave, upbeat tempo" },
                _meta: { title: "Style / Caption" },
            },
            "2": {
                class_type: "PrimitiveStringMultiline",
                inputs: { value: "[Verse 1]\nNeon lights in the rain..." },
                _meta: { title: "Song Lyrics" },
            },
            "3": {
                class_type: "MiniMaxMusicDiT",
                inputs: {
                    style_prompt: ["1", 0],
                    lyrics: ["2", 0],
                    seed: 555,
                },
                _meta: { title: "MiniMax Music 03" },
            },
            "4": {
                class_type: "SaveAudioAdvanced",
                inputs: { audio: ["3", 0] },
                _meta: { title: "Save Audio" },
            },
        };

        const result = ingestWorkflow(musicWf);
        expect(result.ok).toBe(true);
        expect(result.detectedCategory).toBe("audio");
        const wf = result.workflow as Record<string, { _meta?: { title?: string } }>;
        expect(wf["1"]?._meta?.title?.toLowerCase()).toBe("caption");
        expect(wf["2"]?._meta?.title?.toLowerCase()).toBe("lyrics");
        expect(wf["4"]?._meta?.title?.toLowerCase()).toBe("output_audio");
    });

    // 8. 视频深度提取 (Depth Video)：自动免除 prompt 校验
    it("auto-detects depth video and exempts prompt requirement", () => {
        const depthWf: ComfyuiWorkflowJson = {
            "1": {
                class_type: "VHS_LoadVideo",
                inputs: { video: "source_action.mp4" },
                _meta: { title: "Load Video" },
            },
            "2": {
                class_type: "VideoDepthAnythingEstimator",
                inputs: { video_frames: ["1", 0] },
                _meta: { title: "Video Depth Anything" },
            },
            "3": {
                class_type: "VHS_VideoCombine",
                inputs: { images: ["2", 0] },
                _meta: { title: "Combine Video" },
            },
        };

        const result = ingestWorkflow(depthWf);
        expect(result.ok).toBe(true);
        expect(result.detectedCategory).toBe("depthVideo");
        const wf = result.workflow as Record<string, { _meta?: { title?: string } }>;
        expect(wf["1"]?._meta?.title?.toLowerCase()).toBe("ref_video_01");
        expect(wf["3"]?._meta?.title?.toLowerCase()).toBe("output_video");
    });

    // 9. 视频人脸精修 (Face Refine)
    it("auto-detects face refine workflow and maps source video and prompt", () => {
        const faceWf: ComfyuiWorkflowJson = {
            "1": {
                class_type: "VHS_LoadVideo",
                inputs: { video: "blurry_face.mp4" },
                _meta: { title: "Load Source Video" },
            },
            "2": {
                class_type: "PrimitiveStringMultiline",
                inputs: { value: "detailed eyes, photorealistic skin texture" },
                _meta: { title: "Face Prompt" },
            },
            "3": {
                class_type: "UltralyticsDetectorProvider",
                inputs: { model_name: "yolov8_face.pt" },
                _meta: { title: "YOLO Face Detector" },
            },
            "4": {
                class_type: "FaceDetailer",
                inputs: {
                    image: ["1", 0],
                    prompt: ["2", 0],
                    detector: ["3", 0],
                },
                _meta: { title: "Face Detailer" },
            },
            "5": {
                class_type: "VHS_VideoCombine",
                inputs: { images: ["4", 0] },
                _meta: { title: "Combine Output" },
            },
        };

        const result = ingestWorkflow(faceWf);
        expect(result.ok).toBe(true);
        expect(result.detectedCategory).toBe("faceRefine");
        const wf = result.workflow as Record<string, { _meta?: { title?: string } }>;
        expect(wf["1"]?._meta?.title?.toLowerCase()).toBe("ref_video_01");
        expect(wf["2"]?._meta?.title?.toLowerCase()).toBe("prompt");
        expect(wf["5"]?._meta?.title?.toLowerCase()).toBe("output_video");
    });

    // 10. 异常输入校验 (Fail-loud)
    it("fails loud on invalid or empty JSON", () => {
        expect(ingestWorkflow("not a json").ok).toBe(false);
        expect(ingestWorkflow(null).ok).toBe(false);
        expect(ingestWorkflow({}).ok).toBe(false);
    });
});
