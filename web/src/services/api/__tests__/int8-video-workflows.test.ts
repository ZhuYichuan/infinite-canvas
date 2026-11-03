import { describe, expect, it } from "vitest";

import {
    getWorkflowForModelProfile,
    DEFAULT_BUILTIN_COMFYUI_FRAME_VIDEO_INT8_PDMD_WORKFLOW,
    DEFAULT_BUILTIN_COMFYUI_FRAME_VIDEO_INT8_PIKA_WORKFLOW,
    DEFAULT_BUILTIN_COMFYUI_VIDEO_INT8_PDMD_WORKFLOW,
    DEFAULT_BUILTIN_COMFYUI_VIDEO_INT8_PIKA_WORKFLOW,
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
