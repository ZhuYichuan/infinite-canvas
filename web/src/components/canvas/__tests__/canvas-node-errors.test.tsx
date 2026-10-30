import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { CanvasNodeType, type CanvasNodeData, type CanvasNodeImage, type CanvasNodeMetadata } from "@/types/canvas";
import { CanvasNode } from "../canvas-node";

vi.mock("@/stores/use-theme-store", () => ({ useThemeStore: (selector: (state: { theme: "light" }) => unknown) => selector({ theme: "light" }) }));
vi.mock("@/stores/use-collab-store", () => ({ useCollabStore: (selector: (state: object) => unknown) => selector({}) }));
vi.mock("@/lib/canvas/node-registry", () => ({ getNodeDefinition: () => undefined }));
vi.mock("../canvas-resource-mention-textarea", () => ({ CanvasResourceMentionTextarea: () => null }));
vi.mock("../canvas-video-player", () => ({ CanvasVideoPlayer: ({ src }: { src: string }) => React.createElement("video", { src }) }));
vi.mock("antd", () => ({ Tooltip: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("react-i18next", async (importOriginal) => ({
    ...await importOriginal<typeof import("react-i18next")>(),
    useTranslation: () => ({ t: (key: string) => ({ "canvas.node.failed": "生成失败", "canvas.node.retry": "重试", "canvas.node.resumePolling": "继续查询" } as Record<string, string>)[key] || key }),
}));

const reason = "提交未确认：渠道「第二台」请求 POST http://127.0.0.1:8189/prompt，原因：无法连接 ComfyUI 服务，未收到响应";
let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    container = document.createElement("div");
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
});

function node(type: CanvasNodeType, metadata: CanvasNodeMetadata): CanvasNodeData {
    return { id: "result", type, title: "结果", position: { x: 0, y: 0 }, width: 360, height: 300, metadata };
}

async function render(data: CanvasNodeData, extra: Partial<React.ComponentProps<typeof CanvasNode>> = {}) {
    const noop = () => {};
    await act(async () => root.render(React.createElement(CanvasNode, {
        data, scale: 1, isSelected: false, isRelated: false, isFocusRelated: false, isConnectionTarget: false,
        isConnecting: false, showImageInfo: false, onMouseDown: noop, onHoverStart: noop, onHoverEnd: noop,
        onConnectStart: noop, onResizeStart: noop, onResize: noop, onResizeEnd: noop, onContentChange: noop,
        onTitleChange: noop, onContextMenu: noop, ...extra,
    })));
}

function image(id: string, content: string, status: "success" | "error"): CanvasNodeImage {
    return { id, content, status, storageKey: "", naturalWidth: 512, naturalHeight: 512, bytes: 0, mimeType: "image/png", ...(status === "error" ? { errorDetails: reason } : {}) };
}

it.each([CanvasNodeType.Image, CanvasNodeType.Audio, CanvasNodeType.Video, CanvasNodeType.Text])("shows the full submit error on an empty %s Node Card and retries without a job id", async (type) => {
    const data = node(type, { status: "error", errorDetails: reason });
    const onRetry = vi.fn();
    await render(data, { onRetry });
    expect(container.textContent).toContain(reason);
    const retry = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "重试");
    expect(retry).toBeDefined();
    await act(async () => retry!.click());
    expect(onRetry).toHaveBeenCalledWith(data);
});

it("keeps the Config form visible with its persistent error and no unsupported retry action", async () => {
    await render(node(CanvasNodeType.Config, { status: "error", errorDetails: reason }), {
        renderNodeContent: () => React.createElement("form", null, React.createElement("input", { defaultValue: "保留的配置" })),
        onRetry: vi.fn(),
    });
    expect(container.querySelector("form input")).not.toBeNull();
    expect(container.textContent).toContain(reason);
    expect(container.textContent).not.toContain("重试");
});

it("shows a Config partial failure even when its successful output keeps the source status successful", async () => {
    await render(node(CanvasNodeType.Config, { status: "success", errorDetails: `部分生成失败：${reason}` }), {
        renderNodeContent: () => React.createElement("form", null, "配置表单"),
    });
    expect(container.querySelector("form")).not.toBeNull();
    expect(container.textContent).toContain(reason);
});

it("keeps the failed Node Card draggable outside its selectable error details and actions", async () => {
    const onMouseDown = vi.fn();
    await render(node(CanvasNodeType.Image, { status: "error", errorDetails: reason }), { onMouseDown });
    await act(async () => container.querySelector('[role="alert"]')!.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 })));
    expect(onMouseDown).toHaveBeenCalled();
});

it.each([CanvasNodeType.Image, CanvasNodeType.Audio, CanvasNodeType.Video, CanvasNodeType.Text])("preserves existing %s content after a failed generation and shows the new error", async (type) => {
    const content = type === CanvasNodeType.Text ? "原来的文本" : "blob:previous-result";
    await render(node(type, { content, status: "error", errorDetails: reason }));
    if (type === CanvasNodeType.Text) expect(container.textContent).toContain(content);
    else expect(container.querySelector("img, audio, video")?.getAttribute("src")).toBe(content);
    expect(container.textContent).toContain(reason);
});

it.each([CanvasNodeType.Image, CanvasNodeType.Text])("shows the partial %s failure count and actual error while keeping successful content", async (type) => {
    const metadata: CanvasNodeMetadata = type === CanvasNodeType.Image
        ? { images: [image("ok", "blob:successful", "success"), image("bad", "", "error")] }
        : { texts: [{ id: "ok", content: "成功的文本", status: "success" }, { id: "bad", content: "", status: "error", errorDetails: reason }] };
    await render(node(type, { ...metadata, status: "success", errorDetails: "部分生成失败" }));
    expect(container.textContent).toContain("1/2 项失败");
    expect(container.textContent).toContain(reason);
    if (type === CanvasNodeType.Image) expect(container.querySelector("img")?.getAttribute("src")).toBe("blob:successful");
    else expect(container.textContent).toContain("成功的文本");
});

it.each([CanvasNodeType.Image, CanvasNodeType.Text])("shows the first actual %s batch error when every slot failed", async (type) => {
    const metadata: CanvasNodeMetadata = type === CanvasNodeType.Image
        ? { images: [image("a", "", "error"), image("b", "", "error")] }
        : { texts: ["a", "b"].map((id) => ({ id, content: "", status: "error", errorDetails: reason })) };
    await render(node(type, { ...metadata, status: "error", errorDetails: "全部生成失败" }));
    expect(container.textContent).toContain("2/2 项失败");
    expect(container.textContent).toContain(reason);
});

it.each([CanvasNodeType.Image, CanvasNodeType.Text])("shows each failed %s slot reason when a partial batch is expanded", async (type) => {
    const secondReason = "生成阶段：渠道「第三台」请求 GET http://127.0.0.1:8190/history/job 返回 HTTP 500";
    const metadata: CanvasNodeMetadata = type === CanvasNodeType.Image
        ? { images: [image("ok", "blob:successful", "success"), image("a", "", "error"), { ...image("b", "", "error"), errorDetails: secondReason }] }
        : { texts: [{ id: "ok", content: "成功的文本", status: "success" }, { id: "a", content: "", status: "error", errorDetails: reason }, { id: "b", content: "", status: "error", errorDetails: secondReason }] };
    await render(node(type, { ...metadata, status: "success" }), { batchExpanded: true });
    expect(container.textContent).toContain("2/3 项失败");
    expect(container.textContent).toContain(reason);
    expect(container.textContent).toContain(secondReason);
});

it.each([CanvasNodeType.Image, CanvasNodeType.Text])("keeps an entirely failed %s batch expandable to inspect every error", async (type) => {
    const secondReason = "生成失败：第二项缺少模型文件，请在渠道「第三台」检查工作流";
    const metadata: CanvasNodeMetadata = type === CanvasNodeType.Image
        ? { images: [image("a", "", "error"), { ...image("b", "", "error"), errorDetails: secondReason }] }
        : { texts: [{ id: "a", content: "", status: "error", errorDetails: reason }, { id: "b", content: "", status: "error", errorDetails: secondReason }] };
    const data = node(type, { ...metadata, status: "error" });
    const onToggleBatch = vi.fn();
    await render(data, { onToggleBatch });
    const label = type === CanvasNodeType.Image ? "canvas.node.batchCollapsed" : "canvas.node.textBatchCollapsed";
    const toggle = container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
    expect(toggle).not.toBeNull();
    await act(async () => toggle!.click());
    expect(onToggleBatch).toHaveBeenCalledWith(data.id);
    await render(data, { batchExpanded: true });
    expect(container.textContent).toContain(reason);
    expect(container.textContent).toContain(secondReason);
});

it.each([CanvasNodeType.Image, CanvasNodeType.Text])("uses the first failed %s slot's accepted job for the retry caption", async (type) => {
    const metadata: CanvasNodeMetadata = type === CanvasNodeType.Image
        ? { images: [image("ok", "blob:successful", "success"), { ...image("bad", "", "error"), jobId: "accepted-slot" }] }
        : { texts: [{ id: "ok", content: "成功的文本", status: "success" }, { id: "bad", content: "", status: "error", errorDetails: reason, jobId: "accepted-slot" }] };
    await render(node(type, { ...metadata, status: "success" }), { onRetry: vi.fn() });
    expect(container.textContent).toContain("继续查询");
    expect(container.textContent).not.toContain("重试");
});

it("does not label a failed slot as resumable using a different root job id", async () => {
    await render(node(CanvasNodeType.Image, { images: [image("ok", "blob:successful", "success"), image("bad", "", "error")], status: "success", jobId: "other-job" }), { onRetry: vi.fn() });
    expect(container.textContent).toContain("重试");
    expect(container.textContent).not.toContain("继续查询");
});

it("labels an accepted task action as continuing the query", async () => {
    await render(node(CanvasNodeType.Video, { status: "error", errorDetails: reason, jobId: "accepted-job" }), { onRetry: vi.fn() });
    expect(container.textContent).toContain("继续查询");
    expect(container.textContent).not.toContain("重试");
});

it("keeps the single-image loading indicator visible before submission settles", async () => {
    await render(node(CanvasNodeType.Image, { status: "loading", images: [{ ...image("a", "", "error"), status: "loading", errorDetails: undefined }] }));
    expect(container.querySelector(".animate-spin")).not.toBeNull();
    expect(container.querySelector('[role="alert"]')).toBeNull();
});
