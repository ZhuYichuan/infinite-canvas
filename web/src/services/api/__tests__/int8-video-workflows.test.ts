import { describe, expect, it } from "vitest";

import {
    getWorkflowForModelProfile,
    DEFAULT_BUILTIN_COMFYUI_FRAME_VIDEO_INT8_PDMD_WORKFLOW,
    DEFAULT_BUILTIN_COMFYUI_FRAME_VIDEO_INT8_PIKA_WORKFLOW,
    DEFAULT_BUILTIN_COMFYUI_FRAME_VIDEO_INT8_SELFLIFT_WORKFLOW,
    DEFAULT_BUILTIN_COMFYUI_VIDEO_INT8_PDMD_WORKFLOW,
    DEFAULT_BUILTIN_COMFYUI_VIDEO_INT8_PIKA_WORKFLOW,
    DEFAULT_BUILTIN_COMFYUI_VIDEO_INT8_SELFLIFT_WORKFLOW,
} from "../comfyui-default-workflows";
import { dispatchComfyuiModelWorkflow, getModelProfile } from "../models";

type WorkflowNode = {
    class_type?: string;
    inputs?: Record<string, unknown>;
    _meta?: { title?: string };
};

function nodesOf(workflow: Record<string, unknown>): WorkflowNode[] {
    return Object.values(workflow) as WorkflowNode[];
}

function findNode(workflow: Record<string, unknown>, predicate: (node: WorkflowNode) => boolean) {
    return nodesOf(workflow).find(predicate);
}

describe("MiniMax H3 INT8 ConvRot built-in workflows", () => {
    it("routes both INT8 model profiles to their dedicated INT8 workflows", () => {
        expect(getWorkflowForModelProfile("omni-video-minimax-h3-int8-4step-pdmd")).toBe(
            DEFAULT_BUILTIN_COMFYUI_VIDEO_INT8_PDMD_WORKFLOW,
        );
        expect(getWorkflowForModelProfile("frame-video-minimax-h3-int8-4step-pdmd")).toBe(
            DEFAULT_BUILTIN_COMFYUI_FRAME_VIDEO_INT8_PDMD_WORKFLOW,
        );

        // FP8 models must keep pointing at their own workflows
        expect(getWorkflowForModelProfile("omni-video-minimax-h3-fp8-4step-pdmd")).not.toBe(
            DEFAULT_BUILTIN_COMFYUI_VIDEO_INT8_PDMD_WORKFLOW,
        );
    });

    it("loads the INT8 ConvRot diffusion weights while keeping PDMD LoRA and EasyCache", () => {
        const cases = [
            {
                workflow: DEFAULT_BUILTIN_COMFYUI_VIDEO_INT8_PDMD_WORKFLOW.json,
                unet: "minimax_h3_ref2va_int8_convrot.safetensors",
                expectsEasyCache: true,
            },
            {
                workflow: DEFAULT_BUILTIN_COMFYUI_FRAME_VIDEO_INT8_PDMD_WORKFLOW.json,
                unet: "minimax_h3_fl2va_int8_convrot.safetensors",
                expectsEasyCache: false,
            },
        ];

        for (const { workflow, unet, expectsEasyCache } of cases) {
            const unetLoader = findNode(workflow, (n) => n.class_type === "UNETLoader");
            expect(unetLoader?.inputs?.unet_name).toBe(unet);
            expect(unetLoader?.inputs?.weight_dtype).toBe("default");

            const lora = findNode(workflow, (n) => n.class_type === "LoraLoaderModelOnly");
            expect(String(lora?.inputs?.lora_name)).toContain("minimax_h3_pdmd_4step_lora");

            // 全能参考版集成 EasyCache，首尾帧版与 FP8 同类保持一致（不带 EasyCache）
            expect(Boolean(findNode(workflow, (n) => n.class_type === "EasyCache"))).toBe(expectsEasyCache);
        }
    });

    it("injects params and prunes slots on the INT8 omni workflow without touching the UNET", () => {
        const profile = getModelProfile("omni-video-minimax-h3-int8-4step-pdmd")!;
        const dispatched = dispatchComfyuiModelWorkflow(
            profile,
            DEFAULT_BUILTIN_COMFYUI_VIDEO_INT8_PDMD_WORKFLOW.json,
            {
                prompt: "INT8 管线连通性测试",
                width: 544,
                height: 960,
                duration: 5,
                seed: 1234,
                assetIds: ["img_a.png", "img_b.png"],
            },
        );

        const unetLoader = findNode(dispatched, (n) => n.class_type === "UNETLoader");
        expect(unetLoader?.inputs?.unet_name).toBe("minimax_h3_ref2va_int8_convrot.safetensors");

        const sampler = findNode(
            dispatched,
            (n) => typeof n.inputs?.ref_images !== "undefined" || n.class_type === "MiniMaxH3ReferenceToVideo",
        );
        expect(sampler).toBeDefined();

        // 2 张参考图：前两个插槽保留，其余被剔除
        const keptLoadImages = nodesOf(dispatched).filter(
            (n) => n.class_type === "LoadImage" && /^ref_image_0[12]$/.test(String(n._meta?.title ?? "")),
        );
        expect(keptLoadImages.map((n) => n.inputs?.image)).toEqual(["img_a.png", "img_b.png"]);

        const prunedLoadImages = nodesOf(dispatched).filter(
            (n) => n.class_type === "LoadImage" && /^ref_image_0[3-9]$/.test(String(n._meta?.title ?? "")),
        );
        expect(prunedLoadImages).toEqual([]);

        // 未连参考视频，视频桥接节点应被级联剔除
        expect(nodesOf(dispatched).filter((n) => n.class_type === "GetVideoComponents")).toEqual([]);
    });

    it("binds first and last frame on the INT8 frame workflow", () => {
        const profile = getModelProfile("frame-video-minimax-h3-int8-4step-pdmd")!;
        const dispatched = dispatchComfyuiModelWorkflow(
            profile,
            DEFAULT_BUILTIN_COMFYUI_FRAME_VIDEO_INT8_PDMD_WORKFLOW.json,
            {
                prompt: "INT8 首尾帧测试",
                firstFrameAssetId: "first.png",
                lastFrameAssetId: "last.png",
            },
        );

        const unetLoader = findNode(dispatched, (n) => n.class_type === "UNETLoader");
        expect(unetLoader?.inputs?.unet_name).toBe("minimax_h3_fl2va_int8_convrot.safetensors");

        const firstFrame = findNode(dispatched, (n) => n._meta?.title === "first_frame");
        const lastFrame = findNode(dispatched, (n) => n._meta?.title === "last_frame");
        expect(firstFrame?.inputs?.image).toBe("first.png");
        expect(lastFrame?.inputs?.image).toBe("last.png");
    });
});

describe("MiniMax H3 INT8 6步 Pika built-in workflows", () => {
    it("routes both Pika 6-step profiles to their dedicated workflows", () => {
        expect(getWorkflowForModelProfile("omni-video-minimax-h3-int8-6step-pika")).toBe(
            DEFAULT_BUILTIN_COMFYUI_VIDEO_INT8_PIKA_WORKFLOW,
        );
        expect(getWorkflowForModelProfile("frame-video-minimax-h3-int8-6step-pika")).toBe(
            DEFAULT_BUILTIN_COMFYUI_FRAME_VIDEO_INT8_PIKA_WORKFLOW,
        );
        // 4 步 PDMD 与 6 步 Pika 必须是不同工作流，不能互相回退
        expect(getWorkflowForModelProfile("omni-video-minimax-h3-int8-6step-pika")).not.toBe(
            DEFAULT_BUILTIN_COMFYUI_VIDEO_INT8_PDMD_WORKFLOW,
        );
        expect(getWorkflowForModelProfile("frame-video-minimax-h3-int8-6step-pika")).not.toBe(
            DEFAULT_BUILTIN_COMFYUI_FRAME_VIDEO_INT8_PDMD_WORKFLOW,
        );
    });

    it("loads Pika Flex LoRA with 6 sampling steps on the INT8 ConvRot base", () => {
        const cases = [
            {
                workflow: DEFAULT_BUILTIN_COMFYUI_VIDEO_INT8_PIKA_WORKFLOW.json,
                unet: "minimax_h3_ref2va_int8_convrot.safetensors",
                lora: "pika_h3_flex_ref2va_v1_bf16.safetensors",
            },
            {
                workflow: DEFAULT_BUILTIN_COMFYUI_FRAME_VIDEO_INT8_PIKA_WORKFLOW.json,
                unet: "minimax_h3_fl2va_int8_convrot.safetensors",
                lora: "pika_h3_flex_fl2va_v1_bf16.safetensors",
            },
        ];

        for (const { workflow, unet, lora } of cases) {
            expect(findNode(workflow, (n) => n.class_type === "UNETLoader")?.inputs?.unet_name).toBe(unet);

            const loraNode = findNode(workflow, (n) => n.class_type === "LoraLoaderModelOnly");
            expect(loraNode?.inputs?.lora_name).toBe(lora);
            expect(loraNode?.inputs?.strength_model).toBe(1);
            // 标题已对齐规范命名（原 loar1 拼写错误已修正）
            expect(loraNode?._meta?.title).toBe("lora1");

            // 采样步数由标题为 step 的 PrimitiveInt 节点提供，值为 6
            const stepNode = nodesOf(workflow).find((n) => n._meta?.title === "step");
            expect(stepNode?.class_type).toBe("PrimitiveInt");
            expect(stepNode?.inputs?.value).toBe(6);

            // 调度器的 steps 必须引用该节点，而不是写死
            const scheduler = findNode(workflow, (n) => n.class_type === "BasicScheduler");
            expect(Array.isArray(scheduler?.inputs?.steps)).toBe(true);
        }
    });

    it("exposes the CLIP loader with the normalized select_models_clip slot on both Pika workflows", () => {
        for (const workflow of [
            DEFAULT_BUILTIN_COMFYUI_VIDEO_INT8_PIKA_WORKFLOW.json,
            DEFAULT_BUILTIN_COMFYUI_FRAME_VIDEO_INT8_PIKA_WORKFLOW.json,
        ]) {
            const clipLoader = findNode(workflow, (n) => n.class_type === "CLIPLoader");
            expect(clipLoader?._meta?.title).toBe("select_models_clip");
            expect(clipLoader?.inputs?.clip_name).toBe("qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors");
        }
    });

    it("keeps the EasyCache block untouched on the omni Pika workflow", () => {
        const easyCache = findNode(
            DEFAULT_BUILTIN_COMFYUI_VIDEO_INT8_PIKA_WORKFLOW.json,
            (n) => n.class_type === "EasyCache",
        );
        expect(easyCache?.inputs).toMatchObject({
            reuse_threshold: 0.2,
            start_percent: 0.15,
            end_percent: 0.95,
        });
        // 首尾帧版与 4 步 PDMD 保持一致：不带 EasyCache
        expect(
            findNode(DEFAULT_BUILTIN_COMFYUI_FRAME_VIDEO_INT8_PIKA_WORKFLOW.json, (n) => n.class_type === "EasyCache"),
        ).toBeUndefined();
    });
});

describe("MiniMax H3 INT8 6步 SelfLift built-in workflows", () => {
    it("routes both SelfLift 6-step profiles to their dedicated workflows", () => {
        expect(getWorkflowForModelProfile("omni-video-minimax-h3-int8-6step-selflift")).toBe(
            DEFAULT_BUILTIN_COMFYUI_VIDEO_INT8_SELFLIFT_WORKFLOW,
        );
        expect(getWorkflowForModelProfile("frame-video-minimax-h3-int8-6step-selflift")).toBe(
            DEFAULT_BUILTIN_COMFYUI_FRAME_VIDEO_INT8_SELFLIFT_WORKFLOW,
        );
        // 确保不会与 Pika 或 PDMD 互相回退混淆
        expect(getWorkflowForModelProfile("omni-video-minimax-h3-int8-6step-selflift")).not.toBe(
            DEFAULT_BUILTIN_COMFYUI_VIDEO_INT8_PIKA_WORKFLOW,
        );
        expect(getWorkflowForModelProfile("frame-video-minimax-h3-int8-6step-selflift")).not.toBe(
            DEFAULT_BUILTIN_COMFYUI_FRAME_VIDEO_INT8_PIKA_WORKFLOW,
        );
    });

    it("loads Singularity INT8 base, SelfLift sampler, dual LoRAs and step=6", () => {
        const cases = [
            {
                workflow: DEFAULT_BUILTIN_COMFYUI_VIDEO_INT8_SELFLIFT_WORKFLOW.json,
                lora1: "pika_h3_flex_ref2va_v1_bf16.safetensors",
            },
            {
                workflow: DEFAULT_BUILTIN_COMFYUI_FRAME_VIDEO_INT8_SELFLIFT_WORKFLOW.json,
                lora1: "pika_h3_flex_fl2va_v1_bf16.safetensors",
            },
        ];

        for (const { workflow, lora1 } of cases) {
            // UNet
            const unetLoader = findNode(workflow, (n) => n.class_type === "UNETLoader");
            expect(unetLoader?.inputs?.unet_name).toBe("Minimax-h3_Singularity_ref2va_v1.3_int8.safetensors");

            // SelfLiftH3Sampler
            const sampler = findNode(workflow, (n) => n.class_type === "SelfLiftH3Sampler");
            expect(sampler).toBeDefined();
            expect(sampler?.inputs?.upscaler_model).toBe("minimax_h3_latent_upscaler_3d_conv_v1_fp32.pth");

            // Dual LoRAs
            const loras = nodesOf(workflow).filter((n) => n.class_type === "LoraLoaderModelOnly");
            expect(loras.length).toBe(2);
            expect(loras.some((l) => l.inputs?.lora_name === lora1)).toBe(true);
            expect(loras.some((l) => l.inputs?.lora_name === "H3-Licon-VBVR-I2V.safetensors")).toBe(true);

            // step = 6
            const stepNode = nodesOf(workflow).find((n) => n._meta?.title === "step");
            expect(stepNode?.class_type).toBe("PrimitiveInt");
            expect(stepNode?.inputs?.value).toBe(6);

            // EasyCache
            expect(findNode(workflow, (n) => n.class_type === "EasyCache")).toBeDefined();
        }
    });

    it("correctly injects and prunes slots on SelfLift workflows via dispatchComfyuiModelWorkflow", () => {
        // 1. Omni dispatch
        const omniProfile = getModelProfile("omni-video-minimax-h3-int8-6step-selflift")!;
        const dispatchedOmni = dispatchComfyuiModelWorkflow(
            omniProfile,
            DEFAULT_BUILTIN_COMFYUI_VIDEO_INT8_SELFLIFT_WORKFLOW.json,
            {
                prompt: "SelfLift 全能生成测试",
                width: 960,
                height: 544,
                duration: 5,
                seed: 9999,
                step: 8,
                assetIds: ["ref_1.png"],
            },
        );

        const stepNode = nodesOf(dispatchedOmni).find((n) => n._meta?.title === "step");
        expect(stepNode?.inputs?.value).toBe(8);

        const promptNode = nodesOf(dispatchedOmni).find((n) => n._meta?.title === "prompt");
        expect(promptNode?.inputs?.value).toBe("SelfLift 全能生成测试");

        // 仅保留 ref_image_01，其余被修剪
        const keptImages = nodesOf(dispatchedOmni).filter(
            (n) => n.class_type === "LoadImage" && /^ref_image_01$/.test(String(n._meta?.title ?? "")),
        );
        expect(keptImages.length).toBe(1);
        expect(keptImages[0].inputs?.image).toBe("ref_1.png");

        // 2. Frame dispatch
        const frameProfile = getModelProfile("frame-video-minimax-h3-int8-6step-selflift")!;
        const dispatchedFrame = dispatchComfyuiModelWorkflow(
            frameProfile,
            DEFAULT_BUILTIN_COMFYUI_FRAME_VIDEO_INT8_SELFLIFT_WORKFLOW.json,
            {
                prompt: "SelfLift 首尾帧测试",
                firstFrameAssetId: "start.png",
                lastFrameAssetId: "end.png",
            },
        );

        const first = nodesOf(dispatchedFrame).find((n) => n._meta?.title === "first_frame");
        const last = nodesOf(dispatchedFrame).find((n) => n._meta?.title === "last_frame");
        expect(first?.inputs?.image).toBe("start.png");
        expect(last?.inputs?.image).toBe("end.png");
    });
});
