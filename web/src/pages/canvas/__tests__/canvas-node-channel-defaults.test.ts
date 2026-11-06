import { describe, it, expect } from "vitest";
import { CanvasNodeType } from "@/types/canvas";
import { createDefaultNodeMetadata } from "@/lib/canvas/canvas-node-factory";
import { resolveModelIdFromWorkflowId, getModelProfile } from "@/services/api/models";
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

        // 1. 默认情况下是 4step pdmd
        const initialMetadata = createDefaultNodeMetadata(CanvasNodeType.Video, store.config);
        expect(initialMetadata?.workflowId).toContain("omni-video-minimax-h3-fp8-4step-pdmd");
        expect(initialMetadata?.modelId).toBe("omni-video-minimax-h3-fp8-4step-pdmd");

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
});
