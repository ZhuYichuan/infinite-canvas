import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import CanvasPage from "../project";
import { ComfyuiApiError, ComfyuiNetworkError } from "@/services/api/comfyui";
import { defaultConfig } from "@/stores/use-config-store";
import { CanvasNodeType, type CanvasNodeData } from "@/types/canvas";
import type { CanvasProject } from "@/stores/canvas/use-canvas-store";

const harness = vi.hoisted(() => ({
    project: null as unknown as CanvasProject,
    config: null as unknown as typeof defaultConfig,
    generateRef: null as unknown as { current: (id: string, mode: string, prompt: string) => Promise<void> },
    nodeProps: new Map<string, { data: CanvasNodeData; onRetry: (node: CanvasNodeData) => void; onRetryBatchImage: (node: CanvasNodeData, imageId: string) => void }>(),
    requestImage: vi.fn(), requestText: vi.fn(), requestVideo: vi.fn(), requestAudio: vi.fn(),
    uploadImage: vi.fn(),
    message: { error: vi.fn(), warning: vi.fn(), success: vi.fn(), info: vi.fn() },
    noop: () => {},
    t: (key: string) => key,
}));

vi.mock("localforage", () => ({ default: { createInstance: () => ({ getItem: async () => null, setItem: async () => undefined }) } }));
vi.mock("react-router-dom", () => ({ useParams: () => ({ id: "test-project" }), useNavigate: () => harness.noop, useSearchParams: () => [new URLSearchParams(), harness.noop] }));
vi.mock("react-i18next", async (original) => ({ ...await original<typeof import("react-i18next")>(), useTranslation: () => ({ t: harness.t }) }));
vi.mock("antd", () => ({ App: { useApp: () => ({ message: harness.message, modal: {} }) }, Button: () => null, Modal: () => null }));
vi.mock("@/stores/use-config-store", async (original) => ({
    ...await original<typeof import("@/stores/use-config-store")>(),
    useConfigStore: (selector: (state: unknown) => unknown) => selector({ config: harness.config, isAiConfigReady: () => true, openConfigDialog: harness.noop }),
    useEffectiveConfig: () => harness.config,
}));
vi.mock("@/stores/canvas/use-canvas-store", () => {
    const openProject = () => harness.project;
    return { useCanvasStore: (selector: (state: unknown) => unknown) => selector({ hydrated: true, projects: [harness.project], openProject, updateProject: harness.noop }) };
});
vi.mock("@/stores/use-agent-store", () => ({ useAgentStore: (selector: (state: unknown) => unknown) => selector({}) }));
vi.mock("@/stores/use-asset-store", () => ({ useAssetStore: (selector: (state: unknown) => unknown) => selector({ addAsset: harness.noop, cleanupImages: harness.noop }) }));
vi.mock("@/stores/use-theme-store", () => ({ useThemeStore: (selector: (state: unknown) => unknown) => selector({ theme: "light" }) }));
vi.mock("@/stores/use-collab-store", () => ({ useCollabStore: (selector: (state: unknown) => unknown) => selector({}) }));
vi.mock("@/pages/canvas/hooks/use-canvas-collab", () => ({ useCanvasCollab: () => ({ broadcastCanvasSync: harness.noop, broadcastNodesPatch: harness.noop, broadcastGenerationStatus: harness.noop, broadcastCursor: harness.noop }) }));
vi.mock("@/pages/canvas/hooks/use-agent-bridge", () => ({ useAgentBridge: ({ generateNodeRef }: { generateNodeRef: typeof harness.generateRef }) => { harness.generateRef = generateNodeRef; return { applyAgentOps: harness.noop }; } }));
vi.mock("@/pages/canvas/hooks/use-plugin-host", () => ({ usePluginHost: () => ({ pluginHost: {}, renderPluginPanel: harness.noop, buildNodeToolbarItems: harness.noop }) }));
vi.mock("@/services/api/image", () => ({ requestGeneration: harness.requestImage, requestEdit: harness.requestImage, requestImageQuestion: harness.requestText }));
vi.mock("@/services/api/video", () => ({ requestVideoGeneration: harness.requestVideo, storeGeneratedVideo: vi.fn() }));
vi.mock("@/services/api/audio", () => ({ requestAudioGeneration: harness.requestAudio, storeGeneratedAudio: vi.fn() }));
vi.mock("@/services/image-storage", async (original) => ({ ...await original<typeof import("@/services/image-storage")>(), uploadImage: harness.uploadImage }));
vi.mock("@/components/canvas/nodes/builtin-nodes", () => ({ registerBuiltinNodes: harness.noop }));
vi.mock("@/components/canvas/infinite-canvas", () => ({ InfiniteCanvas: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("@/components/canvas/canvas-node", () => ({ CanvasNode: (props: typeof harness.nodeProps extends Map<string, infer Props> ? Props : never) => { harness.nodeProps.set(props.data.id, props); return null; } }));
vi.mock("@/components/canvas/canvas-config-composer", () => ({ CanvasConfigComposer: () => null }));
vi.mock("@/components/canvas/canvas-config-node-panel", () => ({ CanvasConfigNodePanel: () => null }));
vi.mock("@/components/canvas/canvas-connections", () => ({ ActiveConnectionPath: () => null, ConnectionPath: () => null }));
vi.mock("@/components/canvas/canvas-context-menu", () => ({ CanvasNodeContextMenu: () => null }));
vi.mock("@/components/canvas/canvas-node-crop-dialog", () => ({ CanvasNodeCropDialog: () => null }));
vi.mock("@/components/canvas/canvas-node-mask-edit-dialog", () => ({ CanvasNodeMaskEditDialog: () => null }));
vi.mock("@/components/canvas/canvas-node-split-dialog", () => ({ CanvasNodeSplitDialog: () => null }));
vi.mock("@/components/canvas/canvas-node-upscale-dialog", () => ({ CanvasNodeUpscaleDialog: () => null }));
vi.mock("@/components/canvas/canvas-face-refine-modal", () => ({ CanvasFaceRefineModal: () => null }));
vi.mock("@/components/canvas/canvas-depth-video-modal", () => ({ CanvasDepthVideoModal: () => null }));
vi.mock("@/components/canvas/canvas-node-hover-toolbar", () => ({ CanvasNodeHoverToolbar: () => null, CanvasNodeInfoModal: () => null }));
vi.mock("@/components/canvas/canvas-node-inspector-overlay", () => ({ CanvasNodeInspectorOverlay: () => null }));
vi.mock("@/components/canvas/canvas-mini-map", () => ({ Minimap: () => null }));
vi.mock("@/components/canvas/canvas-alignment-guides", () => ({ CanvasAlignmentGuides: () => null }));
vi.mock("@/components/canvas/canvas-multi-selection-overlay", () => ({ CanvasMultiSelectionOverlay: () => null }));
vi.mock("@/components/canvas/canvas-node-prompt-panel", () => ({ CanvasNodePromptPanel: () => null }));
vi.mock("@/components/canvas/canvas-toolbar", () => ({ CanvasToolbar: () => null }));
vi.mock("@/components/canvas/asset-picker-modal", () => ({ AssetPickerModal: () => null }));
vi.mock("@/components/canvas/canvas-side-panel", () => ({ CanvasSidePanel: () => null }));
vi.mock("@/components/canvas/canvas-zoom-controls", () => ({ CanvasZoomControls: () => null }));
vi.mock("@/components/canvas/canvas-collab-cursors", () => ({ CanvasCollabCursors: () => null, CanvasCollabSelectionOutlines: () => null }));
vi.mock("@/components/canvas/canvas-collab-modal", () => ({ CanvasCollabModal: () => null }));
vi.mock("@/components/canvas/canvas-interrupted-banner", () => ({ CanvasInterruptedBanner: () => null }));
vi.mock("@/components/canvas/canvas-plugin-manager-modal", () => ({ CanvasPluginManagerModal: () => null }));
vi.mock("@/components/canvas/canvas-refresh-shell", () => ({ CanvasRefreshShell: () => null }));
vi.mock("@/components/canvas/canvas-top-bar", () => ({ CanvasTopBar: () => null }));
vi.mock("@/components/canvas/canvas-create-menus", () => ({ ConnectionCreateMenu: () => null, NodeCreateMenu: () => null }));

let root: Root;
const nodeTypes = { image: CanvasNodeType.Image, audio: CanvasNodeType.Audio, video: CanvasNodeType.Video, text: CanvasNodeType.Text };

function failure(kind: "network" | 401 | 503 = "network") {
    const url = "http://127.0.0.1:8189/prompt";
    const error = kind === "network"
        ? new ComfyuiNetworkError("http://127.0.0.1:8189", undefined, new TypeError("Failed to fetch"), { url, method: "POST" })
        : new ComfyuiApiError("请求失败", kind, { url, method: "POST" });
    error.message = `渠道「第二台 ComfyUI」：${error.message}`;
    return error;
}

function rejectRequests(error: Error) {
    for (const request of [harness.requestImage, harness.requestText, harness.requestVideo, harness.requestAudio]) request.mockRejectedValue(error);
}

function makeNode(type: CanvasNodeData["type"], metadata: CanvasNodeData["metadata"] = {}): CanvasNodeData {
    return { id: "source", type, title: "测试节点", position: { x: 0, y: 0 }, width: 340, height: 240, metadata: { prompt: "测试提示词", count: 1, channelId: "builtin", ...metadata } };
}

async function mount(node: CanvasNodeData) {
    harness.project.nodes = [node];
    await act(async () => root.render(React.createElement(CanvasPage)));
}

beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal("React", React);
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    harness.nodeProps.clear();
    harness.config = { ...defaultConfig, count: "1", canvasImageCount: "1" };
    harness.project = { id: "test-project", title: "测试画布", nodes: [], connections: [], chatSessions: [], activeChatId: null, backgroundMode: "lines", showImageInfo: false, viewport: { x: 0, y: 0, k: 1 }, createdAt: "", updatedAt: "" };
    root = createRoot(document.createElement("div"));
    rejectRequests(failure());
    harness.uploadImage.mockResolvedValue({ url: "data:image/png;base64,AA==", storageKey: "image:success", width: 256, height: 256, bytes: 1, mimeType: "image/png" });
});

afterEach(async () => {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
});

describe("canvas submission failure settlement through the page callbacks", () => {
    for (const mode of ["image", "audio", "video", "text"] as const) {
        for (const kind of ["network", 401, 503] as const) {
            it(`${mode}: keeps the failed result node and Config source details on ${kind} rejection`, async () => {
                const error = failure(kind);
                rejectRequests(error);
                await mount(makeNode(CanvasNodeType.Config, { generationMode: mode }));
                await act(async () => harness.generateRef.current("source", mode, "测试提示词"));
                const nodes = [...harness.nodeProps.values()].map(({ data }) => data);
                const result = nodes.find((node) => node.id !== "source");
                expect(result, "submission must leave a visible result node").toBeDefined();
                expect(result?.metadata?.status).toBe("error");
                expect(result?.metadata?.errorDetails).toContain(error.message);
                expect(result?.metadata?.jobId).toBeUndefined();
                expect(nodes.find((node) => node.id === "source")?.metadata).toMatchObject({ status: "error", errorDetails: expect.stringContaining(error.message) });
            });
        }

        it(`${mode}: settles the reused empty result node on rejected submission`, async () => {
            const error = failure();
            rejectRequests(error);
            await mount(makeNode(nodeTypes[mode]));
            await act(async () => harness.generateRef.current("source", mode, "测试提示词"));
            expect(harness.nodeProps.get("source")?.data.metadata).toMatchObject({ status: "error", errorDetails: expect.stringContaining(error.message) });
            expect(harness.nodeProps.size).toBe(1);
        });

        it(`${mode}: failed retry settles the same node with the actual rejection and no unconfirmed task ID`, async () => {
            const error = failure();
            rejectRequests(error);
            await mount(makeNode(nodeTypes[mode], { status: "error", errorDetails: "之前的错误", effectivePrompt: "保存的请求", generationReferences: [] }));
            await act(async () => { const props = harness.nodeProps.get("source")!; props.onRetry(props.data); });
            expect(harness.nodeProps.get("source")?.data.metadata).toMatchObject({ status: "error", errorDetails: expect.stringContaining(error.message) });
            expect(harness.nodeProps.get("source")?.data.metadata?.jobId).toBeUndefined();
            expect(harness.nodeProps.size).toBe(1);
        });
    }

    it("preserves the successful source while its derived result records the failed request", async () => {
        const content = "data:image/png;base64,AA==";
        await mount(makeNode(CanvasNodeType.Image, { status: "success", content }));
        await act(async () => harness.generateRef.current("source", "image", "测试提示词"));
        expect(harness.nodeProps.get("source")?.data.metadata).toMatchObject({ status: "success", content });
        const result = [...harness.nodeProps.values()].find(({ data }) => data.id !== "source")?.data;
        expect(result?.metadata).toMatchObject({ status: "error", errorDetails: expect.stringContaining("第二台 ComfyUI") });
    });

    it("preserves successful batch content and exposes the failed image's exact cause", async () => {
        const error = failure();
        await mount(makeNode(CanvasNodeType.Config, { count: 2 }));
        harness.requestImage.mockResolvedValueOnce([{ dataUrl: "data:image/png;base64,AA==" }]).mockRejectedValueOnce(error);
        await act(async () => harness.generateRef.current("source", "image", "测试提示词"));
        const result = [...harness.nodeProps.values()].find(({ data }) => data.id !== "source")?.data;
        expect(result?.metadata?.status).toBe("success");
        expect(result?.metadata?.content).toBe("data:image/png;base64,AA==");
        expect(result?.metadata?.errorDetails).toContain(error.message);
        expect(result?.metadata?.images?.map((image) => image.status).sort()).toEqual(["error", "success"]);
    });

    it("retains the confirmed task ID when submission progress precedes a network failure", async () => {
        await mount(makeNode(CanvasNodeType.Config));
        harness.requestImage.mockImplementationOnce(async (_config, _prompt, options) => {
            options.onProgress("submitted", { jobId: "confirmed-job" });
            throw failure();
        });
        await act(async () => harness.generateRef.current("source", "image", "测试提示词"));
        const result = [...harness.nodeProps.values()].find(({ data }) => data.id !== "source")?.data;
        expect(result?.metadata).toMatchObject({ status: "error", jobId: "confirmed-job" });
        expect(result?.metadata?.images?.[0]).toMatchObject({ status: "error", jobId: "confirmed-job" });
    });

    it("continues querying the accepted audio task instead of submitting a replacement", async () => {
        await mount(makeNode(CanvasNodeType.Audio, { status: "error", errorDetails: "连接中断", jobId: "accepted-audio", effectivePrompt: "保存的请求", generationReferences: [] }));
        await act(async () => { const props = harness.nodeProps.get("source")!; props.onRetry(props.data); });
        expect(harness.requestAudio).toHaveBeenCalledWith(expect.anything(), expect.any(String), expect.objectContaining({ jobId: "accepted-audio", onProgress: expect.any(Function) }));
        expect(harness.nodeProps.get("source")?.data.metadata).toMatchObject({ status: "error", jobId: "accepted-audio" });
    });

    it("preserves successful batch text and exposes the failed text's exact cause", async () => {
        const error = failure();
        await mount(makeNode(CanvasNodeType.Config, { textCount: 2 }));
        harness.requestText.mockResolvedValueOnce("成功文本").mockRejectedValueOnce(error);
        await act(async () => harness.generateRef.current("source", "text", "测试提示词"));
        const result = [...harness.nodeProps.values()].find(({ data }) => data.id !== "source")?.data;
        expect(result?.metadata).toMatchObject({ status: "success", content: "成功文本", errorDetails: expect.stringContaining(error.message) });
        expect(result?.metadata?.texts?.map((text) => text.status).sort()).toEqual(["error", "success"]);
    });

    it("successful retry clears the single image slot and Config source failure", async () => {
        await mount(makeNode(CanvasNodeType.Config));
        await act(async () => harness.generateRef.current("source", "image", "测试提示词"));
        const failed = [...harness.nodeProps.values()].find(({ data }) => data.id !== "source")!;
        expect(failed.data.metadata?.images?.[0]?.status).toBe("error");
        harness.requestImage.mockResolvedValueOnce([{ dataUrl: "data:image/png;base64,AA==" }]);
        await act(async () => failed.onRetryBatchImage(failed.data, failed.data.metadata!.images![0].id));
        const recovered = harness.nodeProps.get(failed.data.id)!.data;
        expect(recovered.metadata).toMatchObject({ status: "success", content: "data:image/png;base64,AA==" });
        expect(recovered.metadata?.errorDetails).toBeUndefined();
        expect(recovered.metadata?.images?.[0]?.status).toBe("success");
        expect(recovered.metadata?.images?.[0]?.errorDetails).toBeUndefined();
        expect(harness.nodeProps.get("source")?.data.metadata).toMatchObject({ status: "success" });
        expect(harness.nodeProps.get("source")?.data.metadata?.errorDetails).toBeUndefined();
    });

    for (const mode of ["image", "text"] as const) {
        it(`${mode}: successful whole-node retry replaces the failed slot and clears its error`, async () => {
            await mount(makeNode(CanvasNodeType.Config));
            await act(async () => harness.generateRef.current("source", mode, "测试提示词"));
            const failed = [...harness.nodeProps.values()].find(({ data }) => data.id !== "source")!;
            if (mode === "image") harness.requestImage.mockResolvedValueOnce([{ dataUrl: "data:image/png;base64,AA==" }]);
            else harness.requestText.mockResolvedValueOnce("重新生成成功");
            await act(async () => failed.onRetry(failed.data));
            const recovered = harness.nodeProps.get(failed.data.id)!.data;
            expect(recovered.metadata?.status).toBe("success");
            expect(recovered.metadata?.errorDetails).toBeUndefined();
            const slots = mode === "image" ? recovered.metadata?.images : recovered.metadata?.texts;
            expect(slots).toHaveLength(1);
            expect(slots?.[0]?.status).toBe("success");
            expect(slots?.[0]?.errorDetails).toBeUndefined();
        });
    }
});
