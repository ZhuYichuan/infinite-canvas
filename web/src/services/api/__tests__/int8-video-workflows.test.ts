import { describe, expect, it } from "vitest";

import {
    getWorkflowForModelProfile,
    DEFAULT_BUILTIN_COMFYUI_FRAME_VIDEO_INT8_PDMD_WORKFLOW,
    DEFAULT_BUILTIN_COMFYUI_VIDEO_INT8_PDMD_WORKFLOW,
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
