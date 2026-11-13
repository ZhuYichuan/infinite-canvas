import { describe, it, expect } from "vitest";
import { CanvasNodeType, type CanvasNodeData } from "@/types/canvas";
import { createDefaultNodeMetadata } from "@/lib/canvas/canvas-node-factory";
import { buildGenerationConfig } from "@/lib/canvas/canvas-generation-helpers";
import { resolveModelIdFromWorkflowId, getModelProfile, validateModelExecution } from "@/services/api/models";
import { defaultConfig, getDefaultWorkflow, useConfigStore } from "@/stores/use-config-store";

describe("Channel default workflow binding on node creation", () => {
    it("resolves modelId from workflowId across all categories", () => {
        expect(resolveModelIdFromWorkflowId("builtin-t2i-qwen-image-21")).toBe("image-qwen-2.1");
        expect(resolveModelIdFromWorkflowId("builtin-t2i-z-image-turbo")).toBe("image-z-turbo");
        expect(resolveModelIdFromWorkflowId("builtin-i2i-flux2-dev")).toBe("image-flux2-dev");
        expect(resolveModelIdFromWorkflowId("builtin-inpaint-qwen-image")).toBe("image-qwen-inpaint");
        expect(resolveModelIdFromWorkflowId("builtin-text-qwen3-5")).toBe("text-qwen-35");
        expect(resolveModelIdFromWorkflowId("builtin-audio-minimax-music-3")).toBe("audio-minimax-music-3");
        expect(resolveModelIdFromWorkflowId("builtin-omni-video-minimax-h3-fp8-4step-pdmd")).toBe("omni-video-minimax-h3-fp8-4step-pdmd");
        expect(resolveModelIdFromWorkflowId("builtin-omni-video-minimax-h3-fp8")).toBe("omni-video-minimax-h3-fp8");
    });

    it("creates image node metadata using channel default workflow", () => {
        const store = useConfigStore.getState();
        const channel = store.config.channels[0];

        // 1. 默认情况下，渠道默认生图工作流是 qwen-image-21
        const initialMetadata = createDefaultNodeMetadata(CanvasNodeType.Image, store.config);
        expect(initialMetadata?.workflowId).toContain("qwen-image-21");
        expect(initialMetadata?.modelId).toBe("image-qwen-2.1");

        // 2. 将渠道默认生图工作流切换为 z-image-turbo
        store.setChannelDefaultWorkflow(channel.id, "t2i", `${channel.id}-t2i-z-image-turbo`);
        const updatedConfig = useConfigStore.getState().config;

        // 3. 再次生成图片节点默认 metadata，必须生效为 z-image-turbo
        const zTurboMetadata = createDefaultNodeMetadata(CanvasNodeType.Image, updatedConfig);
        expect(zTurboMetadata?.workflowId).toContain("z-image-turbo");
        expect(zTurboMetadata?.modelId).toBe("image-z-turbo");
    });

    it("creates video node metadata using channel default workflow", () => {
        const store = useConfigStore.getState();
        const channel = store.config.channels[0];

        // 1. 默认情况下是 int8 6step selflift
        const initialMetadata = createDefaultNodeMetadata(CanvasNodeType.Video, store.config);
        expect(initialMetadata?.workflowId).toContain("omni-video-minimax-h3-int8-6step-selflift");
        expect(initialMetadata?.modelId).toBe("omni-video-minimax-h3-int8-6step-selflift");

        // 2. 将渠道默认视频工作流切换为 20step
        store.setChannelDefaultWorkflow(channel.id, "omniVideo", `${channel.id}-omni-video-minimax-h3-fp8`);
        const updatedConfig = useConfigStore.getState().config;

        // 3. 再次生成视频节点默认 metadata，必须跟随渠道默认生效为 20step
        const video20Metadata = createDefaultNodeMetadata(CanvasNodeType.Video, updatedConfig);
        expect(video20Metadata?.workflowId).toContain("omni-video-minimax-h3-fp8");
        expect(video20Metadata?.modelId).toBe("omni-video-minimax-h3-fp8");
    });

    it("creates text and audio node metadata using channel defaults", () => {
        const store = useConfigStore.getState();
        const textMetadata = createDefaultNodeMetadata(CanvasNodeType.Text, store.config);
        expect(textMetadata?.workflowId).toContain("text");
        expect(textMetadata?.modelId).toBe("text-qwen-35");

        const audioMetadata = createDefaultNodeMetadata(CanvasNodeType.Audio, store.config);
        expect(audioMetadata?.workflowId).toContain("audio");
        expect(audioMetadata?.modelId).toBe("audio-minimax-music-3");
    });

    it("ensures newly created video node defaults to a valid video size and does not throw on submission when global config.size is 2048x1152", () => {
        const store = useConfigStore.getState();
        const configWithImageSize = { ...store.config, size: "2048x1152" };
        const videoMetadata = createDefaultNodeMetadata(CanvasNodeType.Video, configWithImageSize);

        // 1. A video node should never inherit an incompatible image resolution like 2048x1152
        expect(videoMetadata?.size).toBe("1344x768");

        // 2. buildGenerationConfig on newly created video node produces a valid size
        const mockNewNode: CanvasNodeData = {
            id: "video-new",
            type: CanvasNodeType.Video,
            title: "video-01",
            position: { x: 0, y: 0 },
            width: 480,
            height: 270,
            metadata: videoMetadata,
        };
        const generationConfig = buildGenerationConfig(configWithImageSize, mockNewNode, "video");
        expect(generationConfig.size).toBe("1344x768");

        // 3. MiniMax H3 全能 (INT8 6步 Pika) profile validates successfully without throwing
        const pikaProfile = getModelProfile("omni-video-minimax-h3-int8-6step-pika")!;
        expect(() => {
            validateModelExecution(pikaProfile, { size: generationConfig.size });
        }).not.toThrow();

        // 4. Even if an existing legacy node had size: "2048x1152" in metadata, buildGenerationConfig sanitizes it
        const mockLegacyNode: CanvasNodeData = {
            id: "video-legacy",
            type: CanvasNodeType.Video,
            title: "video-02",
            position: { x: 0, y: 0 },
            width: 480,
            height: 270,
            metadata: {
                modelId: "omni-video-minimax-h3-int8-6step-pika",
                size: "2048x1152",
            },
        };
        const sanitizedConfig = buildGenerationConfig(configWithImageSize, mockLegacyNode, "video");
        expect(sanitizedConfig.size).toBe("1344x768");
        expect(() => {
            validateModelExecution(pikaProfile, { size: sanitizedConfig.size });
        }).not.toThrow();
    });
});
