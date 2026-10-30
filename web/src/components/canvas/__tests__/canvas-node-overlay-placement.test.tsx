import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { CanvasNodeType, type CanvasNodeData, type ViewportTransform } from "@/types/canvas";
import { CanvasNodeHoverToolbar } from "../canvas-node-hover-toolbar";
import { CanvasNodeInspectorOverlay } from "../canvas-node-inspector-overlay";

vi.mock("antd", () => ({
    App: { useApp: () => ({ message: { warning: vi.fn(), success: vi.fn() } }) },
    Tooltip: ({ children }: { children: React.ReactNode }) => children,
    Modal: () => null,
    Segmented: () => null,
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/stores/use-config-store", () => ({ defaultToolbarConfig: {}, useConfigStore: (select: (value: object) => unknown) => select({ config: { toolbar: {} }, updateToolbarConfig: vi.fn(), openConfigDialog: vi.fn() }) }));
vi.mock("@/stores/use-collab-store", () => ({ useCollabStore: (select: (value: object) => unknown) => select({}) }));
vi.mock("@/stores/use-theme-store", () => ({ useThemeStore: (select: (value: object) => unknown) => select({ theme: "light" }) }));
vi.mock("@/hooks/use-copy-text", () => ({ useCopyText: () => vi.fn() }));
vi.mock("@/services/api/models", () => ({ getModelProfile: () => undefined }));
vi.mock("@/lib/canvas/node-registry", () => ({ getNodeDefinition: () => undefined }));
vi.mock("@/lib/canvas/canvas-generation-helpers", () => ({ localizeErrorDetails: (value: string) => value }));
vi.mock("@/lib/image-utils", () => ({ formatBytes: (value: number) => String(value), getDataUrlByteSize: () => 0 }));
vi.mock("../canvas-image-toolbar-settings-modal", () => ({ ImageToolSettingsModal: () => null }));
vi.mock("../canvas-image-toolbar-tools", () => ({ IMAGE_QUICK_TOOLS_STORAGE_KEY: "test-tools", defaultImageQuickToolIds: [], buildImageToolbarTools: () => [] }));

let root: Root;
let container: HTMLDivElement;

// happy-dom has no layout engine. Supply only the CSS sizing/translation used by
// these real overlays; placement remains entirely in the production components.
function elementHeight(element: HTMLElement): number {
    const natural = Number.parseFloat(element.style.height) || (element.classList.contains("h-12") ? 48 : Math.max(0, ...Array.from(element.children, (child) => elementHeight(child as HTMLElement))));
    return element.style.maxHeight ? Math.min(natural, Number.parseFloat(element.style.maxHeight)) : natural;
}

function elementRect(element: HTMLElement): DOMRect {
    const height = elementHeight(element);
    const width = Math.min(Number.parseFloat(element.style.width) || 720, Number.parseFloat(element.style.maxWidth) || Infinity);
    const left = (Number.parseFloat(element.style.left) || 0) - (element.classList.contains("-translate-x-1/2") ? width / 2 : 0);
    const top = (Number.parseFloat(element.style.top) || 0) - (element.classList.contains("-translate-y-full") ? height : 0);
    return new DOMRect(left, top, width, height);
}

beforeEach(() => {
    vi.stubGlobal("React", React);
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("innerWidth", 1208);
    vi.stubGlobal("innerHeight", 877);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function () { return elementRect(this); });
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function () { return elementHeight(this); });
    vi.stubGlobal("ResizeObserver", class {
        constructor(private callback: ResizeObserverCallback) {}
        observe(element: Element) { this.callback([{ target: element } as ResizeObserverEntry], this as unknown as ResizeObserver); }
        disconnect() {}
    });
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

async function renderOverlays({ type = CanvasNodeType.Video, panelHeight = 316, nodeLeft = 489, nodeTop = 95, nodeHeight = 415, viewport = { x: 0, y: 0, k: 1 }, canvasSize = { width: 1208, height: 877 }, showToolbar = true }: {
    type?: CanvasNodeData["type"]; panelHeight?: number; nodeLeft?: number; nodeTop?: number; nodeHeight?: number;
    viewport?: ViewportTransform; canvasSize?: { width: number; height: number }; showToolbar?: boolean;
} = {}) {
    const node: CanvasNodeData = {
        id: "video", type, title: "测试节点", position: { x: nodeLeft, y: nodeTop }, width: 229, height: nodeHeight,
        metadata: { content: "blob:resource" },
    };
    const toolbarNode = showToolbar ? node : null;
    const toolbarActions = Object.fromEntries(["onKeep", "onLeave", "onInfo", "onDecreaseFont", "onIncreaseFont", "onToggleDialog", "onGenerateImage", "onUpload", "onDownload", "onSaveAsset", "onMaskEdit", "onCrop", "onSplit", "onUpscale", "onSuperResolve", "onAngle", "onViewImage", "onReversePrompt", "onRetry", "onToggleFreeResize", "onDelete"].map((name) => [name, vi.fn()]));
    await act(async () => root.render(React.createElement(React.Fragment, null,
        React.createElement(CanvasNodeHoverToolbar, { ...toolbarActions, node: toolbarNode, viewport, canvasSize } as React.ComponentProps<typeof CanvasNodeHoverToolbar>),
        React.createElement(CanvasNodeInspectorOverlay, { node, viewport, toolbarNode, canvasSize, renderPanel: () => React.createElement("div", { "data-testid": "prompt", style: { height: panelHeight } }) }),
    )));
    const toolbarElement = Array.from(container.children).find((element) => element.querySelector("button")) as HTMLElement | undefined;
    const inspectorElement = container.querySelector('[data-testid="prompt"]')!.parentElement!;
    return { toolbar: toolbarElement?.getBoundingClientRect(), toolbarElement, toolbarActions, inspector: inspectorElement.getBoundingClientRect(), inspectorElement };
}

it("keeps the prompt and toolbar separate when both must appear below a tall node", async () => {
    const { toolbar, inspector } = await renderOverlays();
    expect(toolbar!.top).toBe(526);
    expect(inspector.top).toBe(toolbar!.bottom + 12);
    expect(inspector.bottom).toBeLessThanOrEqual(877 - 92);
});

for (const type of [CanvasNodeType.Image, CanvasNodeType.Video, CanvasNodeType.Audio, CanvasNodeType.Text, CanvasNodeType.Config, "plugin:custom"]) {
    it(`${type}: preserves the bottom toolbar and places the prompt underneath`, async () => {
        const { toolbar, inspector } = await renderOverlays({ type });
        expect(toolbar!.top).toBe(526);
        expect(toolbar!.height).toBe(48);
        expect(inspector.top).toBeGreaterThanOrEqual(toolbar!.bottom + 12);
    });
}

it("keeps the prompt below the toolbar in a short canvas instead of moving it above", async () => {
    const { toolbar, inspector, inspectorElement } = await renderOverlays({ canvasSize: { width: 1208, height: 720 } });
    expect(toolbar!.top).toBe(526);
    expect(inspector.top).toBe(586);
    expect(inspector.bottom).toBe(720 - 92);
    expect(inspectorElement.classList.contains("overflow-y-auto")).toBe(true);
});

it("keeps the original top placement when the bottom toolbar does not occupy the prompt anchor", async () => {
    const { toolbar, inspector } = await renderOverlays({ nodeTop: 600, nodeHeight: 100 });
    expect(inspector.bottom + 12).toBe(toolbar!.top);
    expect(toolbar!.bottom).toBeLessThan(600);
});

it("does not reserve a toolbar row when the toolbar is hidden", async () => {
    const { toolbar, inspector } = await renderOverlays({ showToolbar: false });
    expect(toolbar).toBeUndefined();
    expect(inspector.top).toBe(526);
});

it("keeps the same vertical order when reference or plugin content grows", async () => {
    const before = await renderOverlays();
    const after = await renderOverlays({ panelHeight: 600 });
    expect(after.inspector.top).toBe(before.inspector.top);
    expect(after.inspector.top).toBe(after.toolbar!.bottom + 12);
    expect(after.inspector.bottom).toBe(877 - 92);
    expect(after.inspectorElement.firstElementChild?.getBoundingClientRect().height).toBe(600);
});

it("uses canvas dimensions when side panels make it smaller than the window", async () => {
    const { inspector } = await renderOverlays({ canvasSize: { width: 600, height: 780 } });
    expect(inspector.left).toBeGreaterThanOrEqual(16);
    expect(inspector.right).toBeLessThanOrEqual(600 - 16);
    expect(inspector.bottom).toBeLessThanOrEqual(780 - 92);
});

it.each([
    ["left edge", -114, 1208],
    ["right edge", 1500, 1208],
    ["narrow canvas", 489, 420],
] as const)("keeps the real toolbar inside the %s and retains its final action through horizontal scrolling", async (_edge, nodeLeft, width) => {
    const { toolbar, toolbarElement, toolbarActions } = await renderOverlays({ nodeLeft, canvasSize: { width, height: 877 } });
    expect(toolbar!.left).toBeGreaterThanOrEqual(16);
    expect(toolbar!.right).toBeLessThanOrEqual(width - 16);
    expect(toolbarElement!.classList.contains("overflow-x-auto")).toBe(true);
    expect(toolbarElement!.classList.contains("[&>*]:shrink-0")).toBe(true);
    const finalAction = Array.from(toolbarElement!.querySelectorAll("button")).at(-1)!;
    expect(finalAction.getAttribute("aria-label")).toBe("canvas.nodeToolbar.replaceVideo");
    await act(async () => finalAction.click());
    expect(toolbarActions.onUpload).toHaveBeenCalledWith(expect.objectContaining({ id: "video" }));
});

it("shares its available height with the actual panel rather than only clipping the overlay wrapper", async () => {
    const { inspectorElement } = await renderOverlays();
    expect(inspectorElement.style.getPropertyValue("--canvas-node-panel-max-height")).toBe(inspectorElement.style.maxHeight);
});

for (const k of [0.2, 1, 3]) {
    it(`keeps the toolbar height and bottom gap at 1:1 scale when the canvas zoom is ${k}`, async () => {
        const { toolbar, inspector } = await renderOverlays({ nodeHeight: 100, viewport: { x: 0, y: 95 - 95 * k, k } });
        expect(toolbar!.height).toBe(48);
        expect(inspector.top).toBe(toolbar!.bottom + 12);
    });
}
