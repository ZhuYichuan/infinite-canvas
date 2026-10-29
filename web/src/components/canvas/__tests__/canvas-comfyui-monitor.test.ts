import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { CanvasComfyuiMonitor } from "../canvas-comfyui-monitor";

const { state } = vi.hoisted(() => ({
    state: { config: { channels: [
        { id: "local", name: "本机", apiFormat: "comfyui", comfyuiProxyUrl: "http://127.0.0.1:8188" },
        { id: "second", name: "第二台", apiFormat: "comfyui", comfyuiProxyUrl: "http://127.0.0.1:8189" },
    ] } },
}));

vi.mock("@/stores/use-config-store", () => ({ useConfigStore: (selector: (value: typeof state) => unknown) => selector(state) }));
vi.mock("react-i18next", async (importOriginal) => ({
    ...await importOriginal<typeof import("react-i18next")>(),
    useTranslation: () => ({ t: translate }),
}));
vi.mock("antd", () => ({
    Button: () => null, Modal: () => null, Progress: () => null, Select: () => null,
    Tooltip: ({ children }: { children: React.ReactNode }) => children,
    Popover: ({ children, content }: { children: React.ReactNode; content: React.ReactNode }) => React.createElement("div", null, children, content),
    message: { success: vi.fn(), error: vi.fn() },
}));

const translate = (key: string) => key;
const initialChannels = state.config.channels;
let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
    state.config.channels = initialChannels;
    vi.stubGlobal("React", React);
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    vi.spyOn(window.location, "protocol", "get").mockReturnValue("https:");
    container = document.createElement("div");
    root = createRoot(container);
});

function healthyResponse(input: RequestInfo | URL) {
    const url = new URL(String(input));
    if (url.pathname === "/system_stats") return Response.json({ system: { os: "linux" }, devices: [] });
    if (url.pathname === "/queue") return Response.json({ queue_running: [], queue_pending: [] });
    return new Response(null, { status: 404 });
}

it("does not label a reachable channel without GPU devices as disconnected", async () => {
    vi.mocked(fetch).mockImplementation(async (input) => healthyResponse(input));
    await act(async () => root.render(React.createElement(CanvasComfyuiMonitor)));
    expect(container.textContent).not.toContain("其他渠道未连接");
    expect(container.textContent).not.toContain("暂未连接：");
    expect(container.textContent).toContain("canvas.monitor.ready");
});

afterEach(async () => {
    await act(async () => root.unmount());
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

it("keeps multi-channel background failures non-blocking on mount and return to canvas", async () => {
    const warning = vi.fn();
    window.addEventListener("comfyui:mixed-content-blocked", warning);
    try {
        await act(async () => root.render(React.createElement(CanvasComfyuiMonitor)));
        await act(async () => document.dispatchEvent(new Event("visibilitychange")));
        expect(fetch).toHaveBeenCalledWith("http://127.0.0.1:8189/system_stats", expect.anything());
        expect(container.textContent).toContain("canvas.monitor.offline");
        expect(warning).not.toHaveBeenCalled();
    } finally {
        window.removeEventListener("comfyui:mixed-content-blocked", warning);
    }
});

it("shows another unavailable channel inline and opens its guide only on request", async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
        if (String(input).startsWith(initialChannels[0].comfyuiProxyUrl)) return healthyResponse(input);
        throw new TypeError("Failed to fetch");
    });
    const warning = vi.fn();
    window.addEventListener("comfyui:mixed-content-blocked", warning);
    try {
        await act(async () => root.render(React.createElement(CanvasComfyuiMonitor)));
        expect(container.textContent).toContain("本机 · canvas.monitor.ready · 1 个其他渠道未连接");
        expect(container.textContent).toContain("暂未连接：第二台。");
        expect(warning).not.toHaveBeenCalled();

        const guideButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "查看连接排查指引");
        expect(guideButton).toBeDefined();
        await act(async () => guideButton!.click());
        expect(warning).toHaveBeenCalledTimes(1);
        expect(warning.mock.calls[0][0].detail).toEqual({ url: initialChannels[1].comfyuiProxyUrl });
    } finally {
        window.removeEventListener("comfyui:mixed-content-blocked", warning);
    }
});

it("keeps adding an unavailable channel and returning to canvas non-blocking", async () => {
    state.config.channels = initialChannels.slice(0, 1);
    const warning = vi.fn();
    window.addEventListener("comfyui:mixed-content-blocked", warning);
    try {
        await act(async () => root.render(React.createElement(CanvasComfyuiMonitor)));
        expect(fetch).not.toHaveBeenCalledWith("http://127.0.0.1:8189/system_stats", expect.anything());

        state.config.channels = [...initialChannels];
        await act(async () => root.render(React.createElement(CanvasComfyuiMonitor)));
        await act(async () => document.dispatchEvent(new Event("visibilitychange")));
        expect(fetch).toHaveBeenCalledWith("http://127.0.0.1:8189/system_stats", expect.anything());
        expect(container.textContent).toContain("暂未连接：本机、第二台。");
        expect(warning).not.toHaveBeenCalled();
    } finally {
        window.removeEventListener("comfyui:mixed-content-blocked", warning);
    }
});
