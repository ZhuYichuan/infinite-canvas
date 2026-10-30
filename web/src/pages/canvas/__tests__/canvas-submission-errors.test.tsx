import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import CanvasPage from "../project";
import { ComfyuiApiError, ComfyuiNetworkError } from "@/services/api/comfyui";
import { defaultConfig } from "@/stores/use-config-store";
import { CanvasNodeType, type CanvasConnection, type CanvasNodeData } from "@/types/canvas";
import type { CanvasProject } from "@/stores/canvas/use-canvas-store";

const harness = vi.hoisted(() => ({
    project: null as unknown as CanvasProject,
    config: null as unknown as typeof defaultConfig,
    generateRef: null as unknown as { current: (id: string, mode: string, prompt: string, intent?: "repeat") => Promise<void> },
    faceRefineProps: null as unknown as import("@/components/canvas/canvas-face-refine-modal").CanvasFaceRefineModalProps,
    depthVideoProps: null as unknown as import("@/components/canvas/canvas-depth-video-modal").CanvasDepthVideoModalProps,
    toolbarProps: null as unknown as { onFaceRefine: (node: CanvasNodeData) => void; onDepthVideo: (node: CanvasNodeData) => void },
    nodesRef: null as unknown as { current: CanvasNodeData[] },
    connectionsRef: null as unknown as { current: CanvasConnection[] },
    setNodes: null as unknown as React.Dispatch<React.SetStateAction<CanvasNodeData[]>>,
    setConnections: null as unknown as React.Dispatch<React.SetStateAction<CanvasConnection[]>>,
    nodeProps: new Map<string, { data: CanvasNodeData; onRetry: (node: CanvasNodeData) => void; onRetryBatchImage: (node: CanvasNodeData, imageId: string) => void }>(),
    requestImage: vi.fn(), requestText: vi.fn(), requestVideo: vi.fn(), requestAudio: vi.fn(),
    uploadImage: vi.fn(), storeVideo: vi.fn(), readImage: vi.fn(), storedImages: new Map<string, string>(),
    message: { error: vi.fn(), warning: vi.fn(), success: vi.fn(), info: vi.fn(), loading: vi.fn() },
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
vi.mock("@/pages/canvas/hooks/use-agent-bridge", () => ({ useAgentBridge: ({ generateNodeRef, nodesRef, connectionsRef, setNodes, setConnections }: { generateNodeRef: typeof harness.generateRef; nodesRef: typeof harness.nodesRef; connectionsRef: typeof harness.connectionsRef; setNodes: typeof harness.setNodes; setConnections: typeof harness.setConnections }) => { harness.generateRef = generateNodeRef; harness.nodesRef = nodesRef; harness.connectionsRef = connectionsRef; harness.setNodes = setNodes; harness.setConnections = setConnections; return { applyAgentOps: harness.noop }; } }));
vi.mock("@/pages/canvas/hooks/use-plugin-host", () => ({ usePluginHost: () => ({ pluginHost: {}, renderPluginPanel: harness.noop, buildNodeToolbarItems: harness.noop }) }));
vi.mock("@/services/api/image", () => ({ requestGeneration: harness.requestImage, requestEdit: harness.requestImage, requestImageQuestion: harness.requestText }));
vi.mock("@/services/api/video", () => ({ requestVideoGeneration: harness.requestVideo, storeGeneratedVideo: harness.storeVideo }));
vi.mock("@/services/api/audio", () => ({ requestAudioGeneration: harness.requestAudio, storeGeneratedAudio: vi.fn() }));
vi.mock("@/services/image-storage", async (original) => {
    const actual = await original<typeof import("@/services/image-storage")>();
    return {
        ...actual,
        uploadImage: harness.uploadImage,
        imageToDataUrl: async (image: Parameters<typeof actual.imageToDataUrl>[0]) => {
            harness.readImage(image);
            return image.storageKey && harness.storedImages.has(image.storageKey) ? harness.storedImages.get(image.storageKey) : actual.imageToDataUrl(image);
        },
    };
});
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
vi.mock("@/components/canvas/canvas-face-refine-modal", () => ({ CanvasFaceRefineModal: (props: typeof harness.faceRefineProps) => { harness.faceRefineProps = props; return null; } }));
vi.mock("@/components/canvas/canvas-depth-video-modal", () => ({ CanvasDepthVideoModal: (props: typeof harness.depthVideoProps) => { harness.depthVideoProps = props; return null; } }));
vi.mock("@/components/canvas/canvas-node-hover-toolbar", () => ({ CanvasNodeHoverToolbar: (props: typeof harness.toolbarProps) => { harness.toolbarProps = props; return null; }, CanvasNodeInfoModal: () => null }));
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

async function mount(node: CanvasNodeData, otherNodes: CanvasNodeData[] = []) {
    harness.project.nodes = [node, ...otherNodes];
    await act(async () => root.render(React.createElement(CanvasPage)));
}

beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal("React", React);
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    harness.nodeProps.clear();
    harness.storedImages.clear();
    harness.config = { ...defaultConfig, count: "1", canvasImageCount: "1" };
    harness.project = { id: "test-project", title: "测试画布", nodes: [], connections: [], chatSessions: [], activeChatId: null, backgroundMode: "lines", showImageInfo: false, viewport: { x: 0, y: 0, k: 1 }, createdAt: "", updatedAt: "" };
    root = createRoot(document.createElement("div"));
    rejectRequests(failure());
    harness.uploadImage.mockImplementation(async (dataUrl: string) => {
        harness.storedImages.set("image:success", dataUrl);
        return { url: dataUrl, storageKey: "image:success", width: 256, height: 256, bytes: 1, mimeType: "image/png" };
    });
});

afterEach(async () => {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
});

describe("canvas submission failure settlement through the page callbacks", () => {
    for (const action of ["repeat", "retry"] as const) it(`${action}: keeps face refinement's original video and selected tool workflow`, async () => {
        configureVideoTools();
        const originalVideo = "http://127.0.0.1:8188/view?filename=original.mp4";
        const referenceImage = "data:image/png;base64,AA==";
        await mount(makeNode(CanvasNodeType.Video, { status: "success", content: originalVideo, references: [referenceImage], generationReferences: [] }));
        harness.requestVideo.mockResolvedValue({});
        harness.storeVideo.mockResolvedValue({ url: "http://127.0.0.1:8188/view?filename=refined.mp4", width: 640, height: 360, bytes: 1, mimeType: "video/mp4" });
        await act(async () => harness.toolbarProps.onFaceRefine(harness.nodeProps.get("source")!.data));
        await act(async () => harness.faceRefineProps.onConfirm({ channelId: "face-host", workflowId: "face-refine-workflow", prompt: "修复面部细节" }));
        const result = [...harness.nodeProps.values()].find(({ data }) => data.id !== "source")!.data;
        expect(result.metadata?.status).toBe("success");
        expect(harness.requestVideo).toHaveBeenCalledTimes(1);
        expect(harness.requestVideo.mock.calls[0][3]).toMatchObject({ channelId: "face-host", workflowId: "face-refine-workflow", referenceVideos: [{ id: "source", url: originalVideo }] });

        await act(async () => {
            if (action === "repeat") await harness.generateRef.current(result.id, "video", "修复面部细节", "repeat");
            else harness.nodeProps.get(result.id)!.onRetry(result);
        });
        expect(harness.requestVideo).toHaveBeenCalledTimes(2);
        const [config, , images, options] = harness.requestVideo.mock.calls[1];
        expect(config).toMatchObject({ channelId: "face-host", workflowId: "face-refine-workflow" });
        expect(options.referenceVideos).toEqual([expect.objectContaining({ id: "source", url: originalVideo })]);
        expect(images).toEqual([expect.objectContaining({ dataUrl: referenceImage })]);
    });

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

const originalVideo = "http://127.0.0.1:8188/view?filename=original.mp4";
const referenceImage = "data:image/png;base64,AA==";
const toolPrompt = "修复面部细节";
const frameModelId = "frame-video-minimax-h3-fp8-4step-pdmd";

function configureVideoTools() {
    harness.config = {
        ...harness.config,
        channelId: "face-host",
        channels: [{
            id: "face-host", name: "人脸与深度主机", baseUrl: "http://127.0.0.1:8188", apiKey: "", apiFormat: "comfyui", models: [],
            workflows: [
                { id: "face-refine-workflow", name: "人脸修复", category: "faceRefine", createdAt: 0, json: { "1": { class_type: "LoadVideo", inputs: { video: "" }, _meta: { title: "ref_video_01" } }, "2": { class_type: "LoadImage", inputs: { image: "" }, _meta: { title: "ref_image_01" } }, "3": { class_type: "Text", inputs: { text: "" }, _meta: { title: "prompt" } } } },
                { id: "depth-video-workflow", name: "深度视频", category: "depthVideo", createdAt: 0, json: { "1": { class_type: "LoadVideo", inputs: { video: "" }, _meta: { title: "ref_video_01" } } } },
            ],
        }],
    };
}

async function mountToolSource(metadata: CanvasNodeData["metadata"] = {}, connectedImage = false) {
    configureVideoTools();
    harness.requestVideo.mockResolvedValue({});
    harness.storeVideo.mockResolvedValue({ url: "http://127.0.0.1:8188/view?filename=refined.mp4", width: 640, height: 360, bytes: 1, mimeType: "video/mp4" });
    const imageNode = { ...makeNode(CanvasNodeType.Image, { content: referenceImage, status: "success" }), id: "reference-image" };
    if (connectedImage) harness.project.connections = [{ id: "image-source", fromNodeId: imageNode.id, toNodeId: "source", kind: "input" }];
    await mount(makeNode(CanvasNodeType.Video, {
        status: "success", content: originalVideo, references: connectedImage ? [] : [referenceImage],
        generationReferences: [{ nodeId: "original-generation-text", kind: "text", text: "原生成过程的文本" }],
        channelId: "face-host", modelId: frameModelId, videoMode: "frame", ...metadata,
    }), connectedImage ? [imageNode] : []);
}

async function executeFaceRefine(prompt = toolPrompt) {
    await act(async () => harness.toolbarProps.onFaceRefine(harness.nodesRef.current.find((node) => node.id === "source")!));
    await act(async () => harness.faceRefineProps.onConfirm({ channelId: "face-host", workflowId: "face-refine-workflow", prompt }));
    return harness.nodesRef.current.find((node) => node.id !== "source" && node.type === CanvasNodeType.Video)!;
}

async function executeDepthVideo() {
    await act(async () => harness.toolbarProps.onDepthVideo(harness.nodesRef.current.find((node) => node.id === "source")!));
    await act(async () => harness.depthVideoProps.onConfirm({ channelId: "face-host", workflowId: "depth-video-workflow" }));
    return harness.nodesRef.current.find((node) => node.id !== "source" && node.type === CanvasNodeType.Video)!;
}

function expectFaceInputs(callIndex: number) {
    const [config, prompt, images, options] = harness.requestVideo.mock.calls[callIndex];
    expect(config).toMatchObject({ channelId: "face-host", workflowId: "face-refine-workflow", videoMode: "omni" });
    expect(prompt).toBe(toolPrompt);
    expect(options.model).not.toBe(frameModelId);
    expect(options.videoMode).toBe("omni");
    expect(options.referenceVideos).toEqual([expect.objectContaining({ id: "source", url: originalVideo })]);
    expect(images).toEqual([expect.objectContaining({ dataUrl: referenceImage })]);
}

describe("video tool operation submission", () => {
    it("face: snapshots actual tool inputs instead of inheriting the source generation", async () => {
        await mountToolSource();
        const result = await executeFaceRefine();
        expect(result.metadata?.generationReferences).toEqual(expect.arrayContaining([
            expect.objectContaining({ kind: "video", nodeId: "source", url: originalVideo }),
            expect.objectContaining({ kind: "image", url: referenceImage }),
        ]));
        expect(result.metadata?.generationReferences?.some((reference) => reference.nodeId === "original-generation-text")).toBe(false);
        expect(result.metadata?.modelId).toBeUndefined();
        expectFaceInputs(0);
    });

    for (const connectedImage of [false, true]) {
        it(`face: repeats a frame-model source with ${connectedImage ? "connected" : "metadata"} images through the selected tool`, async () => {
            await mountToolSource({}, connectedImage);
            const result = await executeFaceRefine();
            await act(async () => harness.generateRef.current(result.id, "video", toolPrompt, "repeat"));
            expect(harness.requestVideo).toHaveBeenCalledTimes(2);
            expectFaceInputs(1);
        });
    }

    it("face: retry after the first failed submission retains the original video and image", async () => {
        await mountToolSource();
        harness.requestVideo.mockRejectedValueOnce(failure(503));
        const failed = await executeFaceRefine();
        expect(failed.metadata).toMatchObject({ status: "error", errorDetails: expect.stringContaining("503") });
        await act(async () => harness.nodeProps.get(failed.id)!.onRetry(failed));
        expect(harness.requestVideo).toHaveBeenCalledTimes(2);
        expectFaceInputs(1);
        expect(harness.nodesRef.current.find((node) => node.id === failed.id)?.metadata?.status).toBe("success");
    });

    it("face: the panel's new submission after failure retains metadata-only reference images", async () => {
        await mountToolSource();
        harness.requestVideo.mockRejectedValueOnce(failure(503));
        const failed = await executeFaceRefine();
        expect(failed.metadata?.status).toBe("error");
        await act(async () => harness.generateRef.current(failed.id, "video", toolPrompt));
        expect(harness.requestVideo).toHaveBeenCalledTimes(2);
        expectFaceInputs(1);
        expect(harness.nodesRef.current.find((node) => node.id === failed.id)?.metadata?.status).toBe("success");
    });

    it("face: filling the draft prompt preserves its metadata-only reference image", async () => {
        await mountToolSource();
        const draft = await executeFaceRefine("");
        expect(harness.requestVideo).not.toHaveBeenCalled();
        await act(async () => harness.generateRef.current(draft.id, "video", toolPrompt));
        expect(harness.requestVideo).toHaveBeenCalledTimes(1);
        expectFaceInputs(0);
    });

    it("face: a newly connected image takes priority over the failed operation's metadata-only image", async () => {
        await mountToolSource();
        harness.requestVideo.mockRejectedValueOnce(failure(503));
        const failed = await executeFaceRefine();
        const replacementImage = "data:image/png;base64,AQ==";
        const image = { ...makeNode(CanvasNodeType.Image, { content: replacementImage, status: "success" }), id: "replacement-reference-image" };
        await act(async () => {
            harness.setNodes((nodes) => [...nodes, image]);
            harness.setConnections((connections) => [...connections, { id: "replacement-reference-link", fromNodeId: image.id, toNodeId: failed.id, kind: "input" }]);
        });
        await act(async () => harness.generateRef.current(failed.id, "video", toolPrompt));
        expect(harness.requestVideo).toHaveBeenCalledTimes(2);
        expect(harness.requestVideo.mock.calls[1][2]).toEqual([expect.objectContaining({ id: image.id, dataUrl: replacementImage })]);
    });

    it("face: disconnecting a canvas image does not silently restore it from the failed operation's snapshot", async () => {
        await mountToolSource({}, true);
        harness.requestVideo.mockRejectedValueOnce(failure(503));
        const failed = await executeFaceRefine();
        await act(async () => harness.setConnections((connections) => connections.filter((connection) => connection.fromNodeId !== "reference-image" || connection.toNodeId !== failed.id)));
        expect(harness.nodesRef.current.some((node) => node.id === "reference-image")).toBe(true);
        await act(async () => harness.generateRef.current(failed.id, "video", toolPrompt));
        expect(harness.requestVideo).toHaveBeenCalledTimes(1);
        expect(harness.nodesRef.current.find((node) => node.id === failed.id)?.metadata).toMatchObject({ status: "error", errorDetails: expect.any(String) });
    });

    it("face: a missing saved image remains an explicit error instead of receiving a fabricated fixture image", async () => {
        await mountToolSource({}, true);
        const result = await executeFaceRefine();
        await act(async () => harness.setNodes((nodes) => nodes.map((node) => node.id === result.id ? { ...node, metadata: { ...node.metadata, generationReferences: node.metadata?.generationReferences?.map((reference) => reference.kind === "image" ? { ...reference, storageKey: "image:missing", url: undefined } : reference) } } : node)));
        const current = harness.nodesRef.current.find((node) => node.id === result.id)!;
        await act(async () => harness.nodeProps.get(result.id)!.onRetry(current));
        expect(harness.requestVideo).toHaveBeenCalledTimes(1);
        expect(harness.nodesRef.current.find((node) => node.id === result.id)?.metadata).toMatchObject({ status: "error", errorDetails: expect.any(String), content: result.metadata?.content });
    });

    it("face: a successful result keeps its video and a persistent error when repeat cannot restore its saved image", async () => {
        await mountToolSource({}, true);
        const result = await executeFaceRefine();
        await act(async () => harness.setNodes((nodes) => nodes.map((node) => node.id === result.id ? { ...node, metadata: { ...node.metadata, generationReferences: node.metadata?.generationReferences?.map((reference) => reference.kind === "image" ? { ...reference, storageKey: "image:missing", url: undefined } : reference) } } : node)));
        await act(async () => harness.generateRef.current(result.id, "video", toolPrompt, "repeat"));
        expect(harness.requestVideo).toHaveBeenCalledTimes(1);
        expect(harness.nodesRef.current.find((node) => node.id === result.id)?.metadata).toMatchObject({ status: "error", errorDetails: expect.any(String), content: result.metadata?.content });
    });

    for (const tool of ["face", "depth"] as const) {
        it(`${tool}: resumes an accepted task after inputs disappear without reading or uploading them again`, async () => {
            await mountToolSource({}, true);
            harness.requestVideo.mockImplementationOnce(async (_config, _prompt, _images, options) => {
                options.onProgress("submitted", { jobId: `accepted-${tool}` });
                throw failure();
            });
            const failed = tool === "face" ? await executeFaceRefine() : await executeDepthVideo();
            expect(failed.metadata).toMatchObject({ status: "error", jobId: `accepted-${tool}` });
            await act(async () => {
                harness.setNodes(() => [{ ...failed, metadata: { ...failed.metadata, generationReferences: failed.metadata?.generationReferences?.map((reference) => ({ ...reference, url: undefined, storageKey: `${reference.kind}:missing` })) } }]);
                harness.setConnections(() => []);
            });
            harness.storedImages.clear();
            harness.readImage.mockClear();
            harness.uploadImage.mockClear();
            await act(async () => harness.nodeProps.get(failed.id)!.onRetry(harness.nodesRef.current[0]));
            expect(harness.requestVideo).toHaveBeenCalledTimes(2);
            const [, , images, options] = harness.requestVideo.mock.calls[1];
            expect(options).toMatchObject({ jobId: `accepted-${tool}`, referenceVideos: [], referenceAudios: [] });
            expect(images).toEqual([]);
            expect(harness.readImage).not.toHaveBeenCalled();
            expect(harness.uploadImage).not.toHaveBeenCalled();
            expect(harness.nodesRef.current[0].metadata).toMatchObject({ status: "success" });
        });

        it(`${tool}: repeating a successful repeat keeps the original inputs and sibling connections`, async () => {
            await mountToolSource({}, true);
            const first = tool === "face" ? await executeFaceRefine() : await executeDepthVideo();
            const prompt = tool === "face" ? toolPrompt : "";
            const beforeRepeat = new Set(harness.nodesRef.current.map((node) => node.id));
            await act(async () => harness.generateRef.current(first.id, "video", prompt, "repeat"));
            const second = harness.nodesRef.current.find((node) => !beforeRepeat.has(node.id))!;
            expect(second.metadata?.status).toBe("success");
            const beforeSecondRepeat = new Set(harness.nodesRef.current.map((node) => node.id));
            await act(async () => harness.generateRef.current(second.id, "video", prompt, "repeat"));
            const third = harness.nodesRef.current.find((node) => !beforeSecondRepeat.has(node.id))!;
            expect(third.metadata?.status).toBe("success");
            expect(harness.requestVideo).toHaveBeenCalledTimes(3);
            if (tool === "face") expectFaceInputs(2);
            else expect(harness.requestVideo.mock.calls[2][3].referenceVideos).toEqual([expect.objectContaining({ id: "source", url: originalVideo })]);
            const parents = harness.connectionsRef.current.filter((connection) => connection.toNodeId === third.id).map((connection) => connection.fromNodeId).sort();
            expect(parents).toEqual(tool === "face" ? ["reference-image", "source"] : ["source"]);
            expect(third.metadata?.generationReferences).toEqual(first.metadata?.generationReferences);
        });
    }

    it("face: a draft accepts newly connected images and its original video before manual submission", async () => {
        await mountToolSource({ references: [], generationReferences: [] });
        const draft = await executeFaceRefine();
        expect(harness.requestVideo).not.toHaveBeenCalled();
        const image = { ...makeNode(CanvasNodeType.Image, { content: referenceImage, status: "success" }), id: "new-reference-image" };
        await act(async () => {
            harness.setNodes((nodes) => [...nodes, image]);
            harness.setConnections((connections) => [...connections, { id: "new-reference-link", fromNodeId: image.id, toNodeId: draft.id, kind: "input" }]);
        });
        await act(async () => harness.generateRef.current(draft.id, "video", toolPrompt));
        expect(harness.requestVideo).toHaveBeenCalledTimes(1);
        expectFaceInputs(0);
    });

    it("face: a draft missing its original video records an error without submitting an empty tool request", async () => {
        await mountToolSource({ references: [], generationReferences: [] });
        const draft = await executeFaceRefine();
        const image = { ...makeNode(CanvasNodeType.Image, { content: referenceImage, status: "success" }), id: "new-reference-image" };
        await act(async () => {
            harness.setNodes((nodes) => [...nodes.filter((node) => node.id !== "source"), image]);
            harness.setConnections(() => [{ id: "new-reference-link", fromNodeId: image.id, toNodeId: draft.id, kind: "input" }]);
        });
        await act(async () => harness.generateRef.current(draft.id, "video", toolPrompt));
        expect(harness.requestVideo).not.toHaveBeenCalled();
        expect(harness.nodesRef.current.find((node) => node.id === draft.id)?.metadata).toMatchObject({ status: "error", errorDetails: expect.any(String) });
    });

    it("depth: snapshots the original video without inherited image, text or frame-model inputs", async () => {
        await mountToolSource();
        const result = await executeDepthVideo();
        expect(result.metadata?.generationReferences).toEqual([expect.objectContaining({ kind: "video", nodeId: "source", url: originalVideo })]);
        expect(result.metadata?.modelId).toBeUndefined();
        const [config, prompt, images, options] = harness.requestVideo.mock.calls[0];
        expect(config).toMatchObject({ channelId: "face-host", workflowId: "depth-video-workflow" });
        expect(prompt).toBe("");
        expect(images).toEqual([]);
        expect(options.referenceVideos).toEqual([expect.objectContaining({ id: "source", url: originalVideo })]);
    });

    for (const action of ["repeat", "retry"] as const) {
        it(`depth: ${action} preserves the original video with an empty prompt`, async () => {
            await mountToolSource({ prompt: "", effectivePrompt: "", references: [], generationReferences: [] });
            if (action === "retry") harness.requestVideo.mockRejectedValueOnce(failure(503));
            const result = await executeDepthVideo();
            await act(async () => {
                if (action === "repeat") await harness.generateRef.current(result.id, "video", "", "repeat");
                else harness.nodeProps.get(result.id)!.onRetry(result);
            });
            expect(harness.requestVideo).toHaveBeenCalledTimes(2);
            const [config, prompt, images, options] = harness.requestVideo.mock.calls[1];
            expect(config).toMatchObject({ channelId: "face-host", workflowId: "depth-video-workflow", videoMode: "omni" });
            expect(prompt).toBe("");
            expect(images).toEqual([]);
            expect(options.model).not.toBe(frameModelId);
            expect(options.referenceVideos).toEqual([expect.objectContaining({ id: "source", url: originalVideo })]);
        });
    }
});
