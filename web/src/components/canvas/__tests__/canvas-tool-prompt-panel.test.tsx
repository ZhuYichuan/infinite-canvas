import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { defaultConfig } from "@/stores/use-config-store";
import { CanvasNodeType, type CanvasNodeData } from "@/types/canvas";
import zhCN from "@/i18n/locales/zh-CN";
import { CanvasNodePromptPanel } from "../canvas-node-prompt-panel";

const harness = vi.hoisted(() => ({
    config: null as unknown as typeof defaultConfig,
    availability: vi.fn(),
    chip: null as unknown as { onChange: (value: string) => void; onSubmit: () => void; references: unknown[] },
}));

vi.mock("@/stores/use-config-store", async (original) => ({
    ...await original<typeof import("@/stores/use-config-store")>(),
    useEffectiveConfig: () => harness.config,
    useConfigStore: (selector: (state: object) => unknown) => selector({ openConfigDialog: vi.fn() }),
}));
vi.mock("@/services/api/models", async (original) => ({ ...await original<typeof import("@/services/api/models")>(), evaluateModelAvailability: harness.availability }));
vi.mock("@/stores/use-theme-store", () => ({ useThemeStore: (selector: (state: object) => unknown) => selector({ theme: "light" }) }));
vi.mock("react-i18next", async (original) => ({ ...await original<typeof import("react-i18next")>(), useTranslation: () => ({ t: (key: string, values?: Record<string, unknown>) => String(key.split(".").reduce((value: any, part) => value?.[part], zhCN) || key).replace(/\{\{(\w+)\}\}/g, (_, name) => String(values?.[name] ?? name)) }) }));
vi.mock("antd", () => ({
    Button: ({ children, onClick, disabled, "aria-label": label }: React.ButtonHTMLAttributes<HTMLButtonElement>) => React.createElement("button", { onClick, disabled, "aria-label": label }, children),
    Tooltip: ({ children }: { children: React.ReactNode }) => children,
    Modal: Object.assign(() => null, { warning: vi.fn() }),
}));
vi.mock("@/components/video-model-picker", () => ({ VideoModelPicker: () => React.createElement("span", { "data-testid": "video-model" }) }));
vi.mock("@/components/image-model-picker", () => ({ ImageModelPicker: () => null }));
vi.mock("@/components/audio-model-picker", () => ({ AudioModelPicker: () => null }));
vi.mock("@/components/text-model-picker", () => ({ TextModelPicker: () => null }));
vi.mock("../canvas-video-settings-popover", () => ({ CanvasVideoSettingsPopover: () => React.createElement("span", { "data-testid": "video-settings" }) }));
vi.mock("../canvas-image-settings-popover", () => ({ CanvasImageSettingsPopover: () => null }));
vi.mock("../canvas-audio-settings-popover", () => ({ CanvasAudioSettingsPopover: () => null }));
vi.mock("../canvas-text-settings-popover", () => ({ CanvasTextSettingsPopover: () => null }));
vi.mock("../canvas-prompt-library", () => ({ CanvasPromptLibrary: () => null }));
vi.mock("../canvas-node-reference-bar", () => ({ CanvasNodeReferenceBar: () => React.createElement("span", { "data-testid": "references" }) }));
vi.mock("../canvas-prompt-chip-input", () => ({ CanvasPromptChipInput: (props: typeof harness.chip) => { harness.chip = props; return React.createElement("textarea"); } }));

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
    vi.stubGlobal("React", React);
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    harness.availability.mockReset().mockReturnValue({ isAvailable: false, reasons: ["普通视频模型未安装"] });
    harness.config = {
        ...defaultConfig,
        channels: [{ ...defaultConfig.channels[0], id: "tool-host", workflows: ["faceRefine", "depthVideo", "omniVideo"].map((category) => ({ id: category, name: category, category, json: {}, createdAt: 0 })) }],
    } as typeof defaultConfig;
    container = document.createElement("div");
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
});

async function render(workflowId: string, status: "idle" | "success" | "error" = "idle", prompt = "修复人物面部", hasContent = status === "success", connectedNodes: CanvasNodeData[] = []) {
    const node: CanvasNodeData = {
        id: "tool", type: CanvasNodeType.Video, title: "工具结果", position: { x: 0, y: 0 }, width: 360, height: 240,
        metadata: {
            workflowId, channelId: "tool-host", status, prompt, ...(hasContent ? { content: "blob:result" } : {}),
            generationReferences: [{ nodeId: "original", kind: "video", storageKey: "video:original" }, { nodeId: "face-1", kind: "image", storageKey: "image:face-1" }, { nodeId: "face-2", kind: "image", storageKey: "image:face-2" }],
        },
    };
    const onGenerate = vi.fn();
    const onConfigChange = vi.fn();
    await act(async () => root.render(React.createElement(CanvasNodePromptPanel, { node, nodes: [node, { ...node, id: "original", title: "待修复原片" }, ...connectedNodes], connectedNodes, mentionReferences: [{ id: "new-image", nodeId: "new-image", kind: "image", title: "新参考图", label: "图1", active: true }], isRunning: false, onGenerate, onConfigChange, onPromptChange: vi.fn(), onStop: vi.fn() })));
    return { onGenerate, onConfigChange };
}

it.each([
    ["faceRefine", "idle", "开始人脸修复"],
    ["faceRefine", "success", "再次修复"],
    ["depthVideo", "idle", "开始提取"],
    ["depthVideo", "success", "再次提取"],
] as const)("keeps %s %s as a tool action without ordinary video model controls", async (workflowId, status, label) => {
    const { onGenerate } = await render(workflowId, status);
    expect(container.querySelector('[data-testid="video-model"]')).toBeNull();
    expect(container.querySelector('[data-testid="video-settings"]')).toBeNull();
    if (status === "success") expect(container.querySelector('[data-testid="references"]')).toBeNull();
    else expect(container.querySelector('[data-testid="references"]')).not.toBeNull();
    expect(container.textContent).toContain(workflowId === "faceRefine" ? "人脸修复" : "深度视频");
    const button = Array.from(container.querySelectorAll("button")).find((item) => item.textContent === label);
    expect(button).toBeDefined();
    expect(button!.disabled).toBe(false);
    await act(async () => button!.click());
    expect(onGenerate).toHaveBeenCalledWith("tool", "video", "修复人物面部", status === "success" ? "repeat" : "new");
    expect(harness.availability).not.toHaveBeenCalled();
});

it("submits depth extraction with no prompt from its button and keyboard action", async () => {
    const { onGenerate } = await render("depthVideo", "idle", "");
    const button = Array.from(container.querySelectorAll("button")).find((item) => item.textContent === "开始提取");
    expect(button?.disabled).toBe(false);
    await act(async () => { button!.click(); harness.chip.onSubmit(); });
    expect(onGenerate).toHaveBeenCalledTimes(2);
    expect(onGenerate).toHaveBeenLastCalledWith("tool", "video", "", "new");
});

it("keeps a successful tool's prompt editable before repeating", async () => {
    const { onGenerate, onConfigChange } = await render("faceRefine", "success");
    await act(async () => harness.chip.onChange("更清晰的面部"));
    expect(onConfigChange).toHaveBeenCalledWith("tool", { composerContent: "更清晰的面部" });
    await act(async () => harness.chip.onSubmit());
    expect(onGenerate).toHaveBeenCalledWith("tool", "video", "更清晰的面部", "repeat");
});

it.each(["success", "error"] as const)("shows saved inputs as read-only when a tool retains video content with %s status", async (status) => {
    await render("faceRefine", status, "修复人物面部", true);
    expect(container.textContent).toContain("原视频：待修复原片 · 参考图：2 张");
    expect(container.textContent).toContain("再次操作沿用保存的原视频和参考图");
    expect(container.textContent).toContain("更换素材请从目标视频重新打开工具");
    expect(container.textContent).toContain("再次修复");
    expect(container.querySelector('[data-testid="references"]')).toBeNull();
    expect(harness.chip.references).toEqual([]);
});

it("keeps resource editing and mention candidates available for an unfinished tool", async () => {
    await render("faceRefine");
    expect(container.querySelector('[data-testid="references"]')).not.toBeNull();
    expect(container.textContent).not.toContain("再次操作沿用保存的原视频和参考图");
    expect(harness.chip.references).toHaveLength(1);
});

it("reveals implicit saved images on unfinished tools until connected images replace them", async () => {
    await render("faceRefine");
    expect(container.textContent).toContain("已保存参考图 2 张，连接新参考图可替换");
    await render("faceRefine", "error");
    expect(container.textContent).toContain("已保存参考图 2 张，连接新参考图可替换");
    const image: CanvasNodeData = { id: "replacement", type: CanvasNodeType.Image, title: "新参考图", position: { x: 0, y: 0 }, width: 256, height: 256, metadata: { content: "blob:new-image" } };
    await render("faceRefine", "idle", "修复人物面部", false, [image]);
    expect(container.textContent).not.toContain("已保存参考图");
    expect(container.querySelector('[data-testid="references"]')).not.toBeNull();
});

it("retains the normal video model controls and availability guard for video generation", async () => {
    const { onGenerate } = await render("omniVideo", "success");
    expect(container.querySelector('[data-testid="video-model"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="video-settings"]')).not.toBeNull();
    const button = Array.from(container.querySelectorAll("button")).find((item) => item.textContent === "再次生成");
    expect(button?.disabled).toBe(true);
    expect(onGenerate).not.toHaveBeenCalled();
});
