import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { CanvasImageSettingsPopover } from "../canvas-image-settings-popover";
import { defaultConfig } from "@/stores/use-config-store";

vi.mock("antd", () => ({
    Button: ({ children, onClick, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) =>
        React.createElement("button", { onClick, ...rest }, children),
    Tooltip: ({ children }: { children: React.ReactNode }) => children,
    Modal: () => null,
}));
vi.mock("react-i18next", async (importOriginal) => ({
    ...await importOriginal<typeof import("react-i18next")>(),
    useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/stores/use-theme-store", () => ({ useThemeStore: (select: (value: object) => unknown) => select({ theme: "light" }) }));
vi.mock("@/components/image-settings-panel", () => ({
    ImageSettingsPanel: () => React.createElement("div", { "data-testid": "image-settings-panel" }, "Panel"),
    imageSizeLabel: (size: string) => size,
}));

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

it("does not block clicking external buttons (click-through) and automatically closes the popover", async () => {
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

    // 1. Open the settings popover by clicking its trigger button
    const triggerButton = container.querySelector("button")!;
    await act(async () => {
        triggerButton.click();
    });
    expect(document.querySelector(".canvas-image-settings-popover")).not.toBeNull();
    expect(onOpenChange).toHaveBeenCalledWith(true);

    // 2. Click the external "再次生成" button
    const generateButton = container.querySelector<HTMLButtonElement>("[data-testid='generate-button']")!;
    await act(async () => {
        // Dispatch pointerdown (triggers outside-click listener in capture phase)
        generateButton.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
        // Dispatch click (native browser sequence)
        generateButton.click();
    });

    // The external button click MUST fire immediately
    expect(onExternalClick).toHaveBeenCalledTimes(1);

    // 3. Fast-forward the deferred close timer (0ms)
    await act(async () => {
        vi.advanceTimersByTime(0);
    });

    // The popover MUST automatically close
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(document.querySelector(".canvas-image-settings-popover")).toBeNull();
});
