import { describe, expect, it } from "vitest";
import {
    BUILTIN_TEXT_WORKFLOW_MODELS,
    evaluateModelAvailability,
    textQwen35Profile,
} from "@/services/api/models";
import {
    getConnectionRejectionDetail,
    validateInputConnection,
} from "@/lib/canvas/canvas-node-geometry";
import { CanvasNodeType, type CanvasNodeData } from "@/types/canvas";

describe("TextModelPicker Data Contract & Unified Qwen-3.5 Multimodal Constraints", () => {
    it("BUILTIN_TEXT_WORKFLOW_MODELS registers unified Qwen-3.5 multimodal model", () => {
        expect(BUILTIN_TEXT_WORKFLOW_MODELS).toHaveLength(1);
        const ids = BUILTIN_TEXT_WORKFLOW_MODELS.map((m) => m.id);
        expect(ids).toContain("text-qwen-35");
        expect(textQwen35Profile.capabilityConfig.references.minImages).toBe(0);
        expect(textQwen35Profile.capabilityConfig.references.maxImages).toBe(1);
        expect(textQwen35Profile.capabilityConfig.textConfig).toBeUndefined();
    });

    it("evaluates Qwen-3.5 availability (allows 0 images for text chat, allows 1 image for VLM reverse prompt, rejects 2+ images)", () => {
        // 0 images: valid for pure text chat
        const check0 = evaluateModelAvailability({
            targetModel: textQwen35Profile,
            connectedImages: 0,
            connectedVideos: 0,
            connectedAudios: 0,
            promptText: "帮我润色一段生图提示词",
        });
        expect(check0.isAvailable).toBe(true);
        expect(check0.isSelectable).toBe(true);
        expect(check0.reasons).toHaveLength(0);

        // 1 image: valid for VLM reverse prompt
        const check1 = evaluateModelAvailability({
            targetModel: textQwen35Profile,
            connectedImages: 1,
            connectedVideos: 0,
            connectedAudios: 0,
            promptText: "反推这段画面的主体与光影",
        });
        expect(check1.isAvailable).toBe(true);
        expect(check1.isSelectable).toBe(true);
        expect(check1.reasons).toHaveLength(0);

        // 2 images: rejected due to maxImages = 1
        const check2 = evaluateModelAvailability({
            targetModel: textQwen35Profile,
            connectedImages: 2,
            connectedVideos: 0,
            connectedAudios: 0,
            promptText: "提取两张图",
        });
        expect(check2.isAvailable).toBe(false);
        expect(check2.isSelectable).toBe(false);
        expect(check2.reasons).toContain("已连接 2 张参考图，该模型最多支持 1 张");
    });

    it("evaluates Qwen-3.5 media boundaries (rejects videos and audios)", () => {
        const checkVid = evaluateModelAvailability({
            targetModel: textQwen35Profile,
            connectedImages: 0,
            connectedVideos: 1,
            connectedAudios: 0,
            promptText: "test",
        });
        expect(checkVid.isAvailable).toBe(false);
        expect(checkVid.reasons).toContain("该模型不支持参考视频，当前已连接 1 个视频");

        const checkAud = evaluateModelAvailability({
            targetModel: textQwen35Profile,
            connectedImages: 0,
            connectedVideos: 0,
            connectedAudios: 1,
            promptText: "test",
        });
        expect(checkAud.isAvailable).toBe(false);
        expect(checkAud.reasons).toContain("该模型不支持参考音频，当前已连接 1 个音频");
    });

    it("evaluates prompt text length limits (max 4000 chars)", () => {
        const checkLong = evaluateModelAvailability({
            targetModel: textQwen35Profile,
            connectedImages: 0,
            connectedVideos: 0,
            connectedAudios: 0,
            promptText: "a".repeat(4001),
        });
        expect(checkLong.isAvailable).toBe(false);
        expect(checkLong.reasons[0]).toContain("4000");
    });

    it("evaluates host channel support rule", () => {
        const channelWithoutModel = {
            id: "host-1",
            name: "Host 1",
            baseUrl: "http://127.0.0.1:8188",
            apiKey: "",
            apiFormat: "comfyui" as const,
            models: [],
            supportedModelIds: ["image-qwen-2.1", "text-custom-other"], // explicitly configured text model does not include text-qwen-35
        };

        const check = evaluateModelAvailability({
            targetModel: textQwen35Profile,
            connectedImages: 0,
            connectedVideos: 0,
            connectedAudios: 0,
            promptText: "hello",
            activeChannel: channelWithoutModel,
        });
        expect(check.isAvailable).toBe(false);
        expect(check.reasons).toContain("当前主机「Host 1」未启用该模型支持");
    });

    it("allows connecting 1 image to text node seamlessly, rejects 2nd image and videos", () => {
        const img1: CanvasNodeData = {
            id: "img-1",
            type: CanvasNodeType.Image,
            title: "Photo 1",
            position: { x: 0, y: 0 },
            width: 200,
            height: 200,
        };
        const img2: CanvasNodeData = {
            id: "img-2",
            type: CanvasNodeType.Image,
            title: "Photo 2",
            position: { x: 0, y: 300 },
            width: 200,
            height: 200,
        };
        const videoNode: CanvasNodeData = {
            id: "vid-1",
            type: CanvasNodeType.Video,
            title: "Video 1",
            position: { x: 0, y: 600 },
            width: 200,
            height: 200,
        };
        const textNode: CanvasNodeData = {
            id: "text-node",
            type: CanvasNodeType.Text,
            title: "Text Node",
            position: { x: 400, y: 150 },
            width: 200,
            height: 200,
            metadata: {
                modelId: "text-qwen-35",
            },
        };
        const allNodes = [img1, img2, videoNode, textNode];

        // 1st connection: allowed (0 -> 1 image for multimodal understanding)
        const res1 = validateInputConnection(img1.id, textNode.id, allNodes, []);
        expect(res1).toEqual({ fromNodeId: img1.id, toNodeId: textNode.id });

        // 2nd connection: rejected because maxImages is 1
        const existingConns = [{ id: "c1", fromNodeId: img1.id, toNodeId: textNode.id, kind: "input" as const }];
        const res2 = validateInputConnection(img2.id, textNode.id, allNodes, existingConns);
        expect(res2).toBeNull();

        const rejection = getConnectionRejectionDetail(img2.id, textNode.id, allNodes, existingConns);
        expect(rejection?.key).toBe("connectionQuotaImagesExceeded");

        // Video connection: rejected because text node does not support videos
        const resVid = validateInputConnection(videoNode.id, textNode.id, allNodes, []);
        expect(resVid).toBeNull();
        const rejectionVid = getConnectionRejectionDetail(videoNode.id, textNode.id, allNodes, []);
        expect(rejectionVid?.key).toBe("connectionMediaTypeUnsupported");
        expect(rejectionVid?.defaultMessage).toContain("参考视频");
    });
});
