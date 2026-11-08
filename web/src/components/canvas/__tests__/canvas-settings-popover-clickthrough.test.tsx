import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { CanvasImageSettingsPopover } from "../canvas-image-settings-popover";
import { CanvasVideoSettingsPopover } from "../canvas-video-settings-popover";
import { CanvasAudioSettingsPopover } from "../canvas-audio-settings-popover";
import { CanvasTextSettingsPopover } from "../canvas-text-settings-popover";
import { CanvasSizePicker } from "../canvas-size-picker";
import { CanvasResourceMentionMenu } from "../canvas-resource-mention-menu";
import { defaultConfig } from "@/stores/use-config-store";
import { canvasThemes } from "@/lib/canvas-theme";

vi.mock("antd", () => ({
    Button: ({ children, onClick, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) =>
        React.createElement("button", { onClick, ...rest }, children),
    Tooltip: ({ children }: { children: React.ReactNode }) => children,
    Modal: () => null,
    InputNumber: () => null,
    Select: ({ open, onOpenChange }: { open?: boolean; onOpenChange?: (open: boolean) => void }) =>
        React.createElement("div", {
            "data-testid": "mock-select",
            "data-open": String(Boolean(open)),
            onClick: () => onOpenChange?.(!open),
        }),
}));
vi.mock("react-i18next", async (importOriginal) => ({
    ...await importOriginal<typeof import("react-i18next")>(),
    useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/stores/use-theme-store", () => ({ useThemeStore: (select: (value: object) => unknown) => select({ theme: "light" }) }));
vi.mock("@/components/image-settings-panel", () => ({
    ImageSettingsPanel: () => React.createElement("div", { "data-testid": "image-settings-panel" }, "Panel"),
    ImageSettingsTheme: ({ children }: { children: React.ReactNode }) => children,
    imageSizeLabel: (size: string) => size,
}));
vi.mock("@/components/text-settings-panel", () => ({
    TextSettingsPanel: () => React.createElement("div", { "data-testid": "text-settings-panel" }, "TextPanel"),
}));
vi.mock("@/components/video-settings-panel", () => ({
    VideoSettingsPanel: () => React.createElement("div", { "data-testid": "video-settings-panel" }, "VideoPanel"),
    videoSecondsLabel: (seconds: unknown) => `${seconds}s`,
    videoSizeLabel: (size: unknown) => `${size}`,
}));
vi.mock("@/components/audio-settings-panel", () => ({
    AudioSettingsPanel: () => React.createElement("div", { "data-testid": "audio-settings-panel" }, "AudioPanel"),
    audioSecondsLabel: (seconds: unknown) => `${seconds}s`,
}));
vi.mock("@/services/api/models", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/services/api/models")>();
    return {
        ...actual,
        getModelProfile: (id?: string) => {
            const profile = actual.getModelProfile(id);
            if (id === "mock-text-model" || (!profile && id?.includes("text"))) {
                return {
                    id: "mock-text-model",
                    name: "Mock Text",
                    category: "text",
                    capabilityConfig: {
                        textConfig: {
                            maxLength: { default: 512 },
                            thinkingSupported: true,
                        },
                    },
                };
            }
            return profile;
        },
    };
});

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("React", React);
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

it("does not block clicking external buttons (click-through) and automatically closes CanvasImageSettingsPopover", async () => {
    const onExternalClick = vi.fn();
    const onOpenChange = vi.fn();

    function TestHarness() {
        return (
            <div>
                <CanvasImageSettingsPopover
                    config={defaultConfig}
                    onConfigChange={vi.fn()}
                    onOpenChange={onOpenChange}
                />
                <button data-testid="generate-button" onClick={onExternalClick}>
                    再次生成
                </button>
            </div>
        );
    }

    await act(async () => {
        root.render(React.createElement(TestHarness));
    });

    const triggerButton = container.querySelector("button")!;
    await act(async () => {
        triggerButton.click();
    });
    expect(document.querySelector(".canvas-image-settings-popover")).not.toBeNull();
    expect(onOpenChange).toHaveBeenCalledWith(true);

    const generateButton = container.querySelector<HTMLButtonElement>("[data-testid='generate-button']")!;
    await act(async () => {
        generateButton.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
        generateButton.click();
    });

    expect(onExternalClick).toHaveBeenCalledTimes(1);

    await act(async () => {
        vi.advanceTimersByTime(0);
    });

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(document.querySelector(".canvas-image-settings-popover")).toBeNull();
});

it("supports click-through and deferred auto-close on CanvasVideoSettingsPopover", async () => {
    const onExternalClick = vi.fn();
    const onOpenChange = vi.fn();

    function TestHarness() {
        return (
            <div>
                <CanvasVideoSettingsPopover
                    config={defaultConfig}
                    onOpenChange={onOpenChange}
                />
                <button data-testid="external-btn" onClick={onExternalClick}>
                    外部按钮
                </button>
            </div>
        );
    }

    await act(async () => {
        root.render(React.createElement(TestHarness));
    });

    const triggerButton = container.querySelector("button")!;
    await act(async () => {
        triggerButton.click();
    });
    expect(document.querySelector("[data-testid='video-settings-panel']")).not.toBeNull();
    expect(onOpenChange).toHaveBeenCalledWith(true);

    const extButton = container.querySelector<HTMLButtonElement>("[data-testid='external-btn']")!;
    await act(async () => {
        extButton.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
        extButton.click();
    });

    expect(onExternalClick).toHaveBeenCalledTimes(1);

    await act(async () => {
        vi.advanceTimersByTime(0);
    });

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(document.querySelector("[data-testid='video-settings-panel']")).toBeNull();
});

it("supports click-through and deferred auto-close on CanvasAudioSettingsPopover", async () => {
    const onExternalClick = vi.fn();
    const onOpenChange = vi.fn();

    function TestHarness() {
        return (
            <div>
                <CanvasAudioSettingsPopover
                    config={defaultConfig}
                    onConfigChange={vi.fn()}
                    onOpenChange={onOpenChange}
                />
                <button data-testid="external-btn" onClick={onExternalClick}>
                    外部按钮
                </button>
            </div>
        );
    }

    await act(async () => {
        root.render(React.createElement(TestHarness));
    });

    const triggerButton = container.querySelector("button")!;
    await act(async () => {
        triggerButton.click();
    });
    expect(document.querySelector("[data-testid='audio-settings-panel']")).not.toBeNull();
    expect(onOpenChange).toHaveBeenCalledWith(true);

    const extButton = container.querySelector<HTMLButtonElement>("[data-testid='external-btn']")!;
    await act(async () => {
        extButton.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
        extButton.click();
    });

    expect(onExternalClick).toHaveBeenCalledTimes(1);

    await act(async () => {
        vi.advanceTimersByTime(0);
    });

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(document.querySelector("[data-testid='audio-settings-panel']")).toBeNull();
});

it("supports click-through and deferred auto-close on CanvasTextSettingsPopover", async () => {
    const onExternalClick = vi.fn();
    const onOpenChange = vi.fn();

    function TestHarness() {
        return (
            <div>
                <CanvasTextSettingsPopover
                    modelId="mock-text-model"
                    config={defaultConfig}
                    onOpenChange={onOpenChange}
                />
                <button data-testid="external-btn" onClick={onExternalClick}>
                    外部按钮
                </button>
            </div>
        );
    }

    await act(async () => {
        root.render(React.createElement(TestHarness));
    });

    const triggerButton = container.querySelector("button")!;
    await act(async () => {
        triggerButton.click();
    });
    expect(document.querySelector("[data-testid='text-settings-panel']")).not.toBeNull();
    expect(onOpenChange).toHaveBeenCalledWith(true);

    const extButton = container.querySelector<HTMLButtonElement>("[data-testid='external-btn']")!;
    await act(async () => {
        extButton.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
        extButton.click();
    });

    expect(onExternalClick).toHaveBeenCalledTimes(1);

    await act(async () => {
        vi.advanceTimersByTime(0);
    });

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(document.querySelector("[data-testid='text-settings-panel']")).toBeNull();
});

it("supports click-through and deferred auto-close on CanvasSizePicker", async () => {
    const onExternalClick = vi.fn();

    function TestHarness() {
        return (
            <div>
                <CanvasSizePicker value="1:1" onChange={vi.fn()} />
                <button data-testid="external-btn" onClick={onExternalClick}>
                    外部按钮
                </button>
            </div>
        );
    }

    await act(async () => {
        root.render(React.createElement(TestHarness));
    });

    const select = container.querySelector("[data-testid='mock-select']")!;
    await act(async () => {
        select.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(select.getAttribute("data-open")).toBe("true");

    const extButton = container.querySelector<HTMLButtonElement>("[data-testid='external-btn']")!;
    await act(async () => {
        extButton.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
        extButton.click();
    });

    expect(onExternalClick).toHaveBeenCalledTimes(1);

    await act(async () => {
        vi.advanceTimersByTime(0);
    });

    expect(select.getAttribute("data-open")).toBe("false");
});

it("supports click-through and preserves close timer during parent re-render for CanvasResourceMentionMenu", async () => {
    const onExternalClick = vi.fn();
    const onClose = vi.fn();
    const emptyCategorized = { subjects: [], images: [], videos: [], audios: [], texts: [], possible: [] };
    const rect = { top: 100, left: 100, bottom: 120, right: 120, width: 20, height: 20 } as DOMRect;

    function TestHarness({ count }: { count: number }) {
        return (
            <div>
                <CanvasResourceMentionMenu
                    rect={rect}
                    query=""
                    categorized={emptyCategorized}
                    theme={canvasThemes.light}
                    onSelect={vi.fn()}
                    onClose={onClose}
                />
                <button data-testid="external-btn" onClick={onExternalClick}>
                    外部按钮 {count}
                </button>
            </div>
        );
    }

    await act(async () => {
        root.render(React.createElement(TestHarness, { count: 1 }));
    });

    const menu = document.querySelector("[data-canvas-resource-mention-menu]");
    expect(menu).not.toBeNull();

    const extButton = container.querySelector<HTMLButtonElement>("[data-testid='external-btn']")!;
    await act(async () => {
        extButton.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
        extButton.click();
    });

    expect(onExternalClick).toHaveBeenCalledTimes(1);

    // Simulate parent re-render before the timer fires (re-creating props)
    await act(async () => {
        root.render(React.createElement(TestHarness, { count: 2 }));
    });

    // Fire the deferred timer
    await act(async () => {
        vi.advanceTimersByTime(0);
    });

    // onClose MUST have been called even after parent re-render!
    expect(onClose).toHaveBeenCalledTimes(1);
});
