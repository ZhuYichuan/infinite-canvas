import { describe, expect, it } from "vitest";
import {
    BUILTIN_TEXT_WORKFLOW_MODELS,
    evaluateModelAvailability,
    textQwen35ChatProfile,
    textQwen35VlmProfile,
} from "@/services/api/models";
import {
    getConnectionRejectionDetail,
    validateInputConnection,
} from "@/lib/canvas/canvas-node-geometry";
import { CanvasNodeType, type CanvasNodeData } from "@/types/canvas";

describe("TextModelPicker Data Contract & Constraints", () => {
    it("BUILTIN_TEXT_WORKFLOW_MODELS registers 2 text models", () => {
        expect(BUILTIN_TEXT_WORKFLOW_MODELS).toHaveLength(2);
        const ids = BUILTIN_TEXT_WORKFLOW_MODELS.map((m) => m.id);
        expect(ids).toContain("text-qwen-35-chat");
        expect(ids).toContain("text-qwen-35-vlm");
    });

    it("evaluates Qwen-3.5 Chat availability (allows 0 images, rejects connected images)", () => {
        const check0 = evaluateModelAvailability({
            targetModel: textQwen35ChatProfile,
            connectedImages: 0,
            connectedVideos: 0,
            connectedAudios: 0,
            promptText: "帮我润色一段生图提示词",
        });
        expect(check0.isAvailable).toBe(true);

        const check1 = evaluateModelAvailability({
            targetModel: textQwen35ChatProfile,
            connectedImages: 1,
            connectedVideos: 0,
            connectedAudios: 0,
            promptText: "帮我润色一段生图提示词",
        });
        expect(check1.isAvailable).toBe(false);
        expect(check1.reasons).toContain("纯文本模型不支持连入参考图片，当前已连接 1 张");
    });

    it("evaluates Qwen-3.5 Chat media boundaries (rejects videos and audios)", () => {
        const checkVid = evaluateModelAvailability({
            targetModel: textQwen35ChatProfile,
            connectedImages: 0,
            connectedVideos: 1,
            connectedAudios: 0,
            promptText: "test",
        });
        expect(checkVid.isAvailable).toBe(false);
        expect(checkVid.reasons).toContain("该模型不支持参考视频，当前已连接 1 个视频");

        const checkAud = evaluateModelAvailability({
            targetModel: textQwen35ChatProfile,
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
            targetModel: textQwen35ChatProfile,
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
            supportedModelIds: ["image-qwen-2.1", "text-qwen-35-vlm"], // explicitly configured text model does not include chat
        };

        const check = evaluateModelAvailability({
            targetModel: textQwen35ChatProfile,
            connectedImages: 0,
            connectedVideos: 0,
            connectedAudios: 0,
            promptText: "hello",
            activeChannel: channelWithoutModel,
        });
        expect(check.isAvailable).toBe(false);
        expect(check.reasons).toContain("当前主机「Host 1」未启用该模型支持");
    });

    it("rejects image wire connection to pure text chat node in canvas validation", () => {
        const imageNode: CanvasNodeData = {
            id: "img-node",
            type: CanvasNodeType.Image,
            title: "Reference Image",
            position: { x: 0, y: 0 },
            width: 200,
            height: 200,
        };
        const textNode: CanvasNodeData = {
            id: "text-node",
            type: CanvasNodeType.Text,
            title: "Text Node",
            position: { x: 300, y: 0 },
            width: 200,
            height: 200,
            metadata: {
                modelId: "text-qwen-35-chat",
            },
        };

        const result = validateInputConnection(imageNode.id, textNode.id, [imageNode, textNode]);
        expect(result).toBeNull();

        const rejection = getConnectionRejectionDetail(imageNode.id, textNode.id, [imageNode, textNode]);
        expect(rejection?.key).toBe("connectionMediaTypeUnsupported");
        expect(rejection?.defaultMessage).toBe("连接被拒绝：纯文本模型不支持连入参考图片（如需识图反推，请在节点工具栏切换为「Qwen-3.5 视觉反推」）");
    });

    it("evaluates Qwen-3.5 VLM availability (requires exactly 1 image, allows selection when 0 images)", () => {
        const check0 = evaluateModelAvailability({
            targetModel: textQwen35VlmProfile,
            connectedImages: 0,
            connectedVideos: 0,
            connectedAudios: 0,
            promptText: "提取主体与光影",
        });
        expect(check0.isAvailable).toBe(false);
        expect(check0.isSelectable).toBe(true);
        expect(check0.reasons).toContain("该模型为视觉反推模型，需要连入至少 1 张参考图片");
        expect(check0.warningReasons).toContain("该模型为视觉反推模型，需要连入至少 1 张参考图片");
        expect(check0.blockingReasons).toHaveLength(0);

        const check1 = evaluateModelAvailability({
            targetModel: textQwen35VlmProfile,
            connectedImages: 1,
            connectedVideos: 0,
            connectedAudios: 0,
            promptText: "提取主体与光影",
        });
        expect(check1.isAvailable).toBe(true);
        expect(check1.isSelectable).toBe(true);
        expect(check1.reasons).toHaveLength(0);

        const check2 = evaluateModelAvailability({
            targetModel: textQwen35VlmProfile,
            connectedImages: 2,
            connectedVideos: 0,
            connectedAudios: 0,
            promptText: "提取主体与光影",
        });
        expect(check2.isAvailable).toBe(false);
        expect(check2.isSelectable).toBe(false);
        expect(check2.reasons).toContain("已连接 2 张参考图，该模型最多支持 1 张");
        expect(check2.blockingReasons).toContain("已连接 2 张参考图，该模型最多支持 1 张");
    });

    it("allows connecting 1 image to VLM text node but rejects the 2nd image", () => {
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
        const vlmNode: CanvasNodeData = {
            id: "vlm-node",
            type: CanvasNodeType.Text,
            title: "VLM Prompt Node",
            position: { x: 400, y: 150 },
            width: 200,
            height: 200,
            metadata: {
                modelId: "text-qwen-35-vlm",
            },
        };
        const allNodes = [img1, img2, vlmNode];

        // 1st connection: allowed
        const res1 = validateInputConnection(img1.id, vlmNode.id, allNodes, []);
        expect(res1).toEqual({ fromNodeId: img1.id, toNodeId: vlmNode.id });

        // 2nd connection: rejected because maxImages is 1
        const existingConns = [{ id: "c1", fromNodeId: img1.id, toNodeId: vlmNode.id, kind: "input" as const }];
        const res2 = validateInputConnection(img2.id, vlmNode.id, allNodes, existingConns);
        expect(res2).toBeNull();

        const rejection = getConnectionRejectionDetail(img2.id, vlmNode.id, allNodes, existingConns);
        expect(rejection?.key).toBe("connectionQuotaImagesExceeded");
    });
});
