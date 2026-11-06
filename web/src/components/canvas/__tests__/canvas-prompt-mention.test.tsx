import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CanvasPromptChipInput } from "../canvas-prompt-chip-input";
import type { CategorizedCanvasResources } from "@/lib/canvas/canvas-resource-references";

vi.mock("@/stores/use-theme-store", () => ({
    useThemeStore: (selector: (state: { theme: string }) => unknown) => selector({ theme: "dark" }),
}));

vi.mock("react-i18next", async (importOriginal) => ({
    ...(await importOriginal<typeof import("react-i18next")>()),
    useTranslation: () => ({
        t: (key: string, defaultVal?: string) => defaultVal || key,
    }),
}));

describe("CanvasPromptChipInput mention bugs", () => {
    let container: HTMLDivElement;
    let root: Root;

    const sampleCategorized: CategorizedCanvasResources = {
        possible: [
            { id: "img-1", nodeId: "node-img-1", label: "image-01", title: "image-01", kind: "image", active: true, connected: true },
            { id: "vid-1", nodeId: "node-vid-1", label: "video-01", title: "video-01", kind: "video", active: true, connected: false },
        ],
        subjects: [],
        images: [
            { id: "img-1", nodeId: "node-img-1", label: "image-01", title: "image-01", kind: "image", active: true, connected: true },
        ],
        videos: [
            { id: "vid-1", nodeId: "node-vid-1", label: "video-01", title: "video-01", kind: "video", active: true, connected: false },
        ],
        audios: [],
        texts: [
            { id: "txt-1", nodeId: "node-txt-1", label: "text-01", title: "分镜剧本", kind: "text", active: true, connected: false, text: "分镜剧本内容" },
        ],
    };

    beforeEach(() => {
        vi.stubGlobal("React", React);
        vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(async () => {
        await act(async () => root.unmount());
        container.remove();
        vi.unstubAllGlobals();
    });

    it("Bug 2: clicking @ button while editor is focused does not get closed by blur timeout", async () => {
        const triggerRef = { current: null as (() => void) | null };
        const onChange = vi.fn();

        await act(async () => {
            root.render(
                <CanvasPromptChipInput
                    value=""
                    references={sampleCategorized.possible}
                    categorizedResources={sampleCategorized}
                    onChange={onChange}
                    triggerMentionRef={triggerRef}
                />
            );
        });

        const editor = container.querySelector("[contenteditable='true']") as HTMLDivElement;
        expect(editor).not.toBeNull();

        // 1. Editor is focused
        editor.focus();

        // 2. User clicks the @ button outside the editor: editor blurs with relatedTarget pointing to the button
        const button = document.createElement("button");
        button.setAttribute("aria-label", "召唤/引用画布资源");
        document.body.appendChild(button);

        await act(async () => {
            editor.dispatchEvent(new FocusEvent("blur", { relatedTarget: button }));
            // button click invokes triggerMentionRef
            triggerRef.current?.();
        });

        // Mention menu should be open
        expect(document.querySelector("[data-canvas-resource-mention-menu]")).not.toBeNull();

        // 3. Advance timers by 150ms (blur timer timeout)
        await act(async () => {
            await new Promise((r) => setTimeout(r, 150));
        });

        // BUG 2: In current code, blur timeout kills the menu!
        expect(document.querySelector("[data-canvas-resource-mention-menu]")).not.toBeNull();
        button.remove();
    });

    it("Bug 1: arrow keys can navigate from main menu into submenus and select items", async () => {
        const onChange = vi.fn();

        await act(async () => {
            root.render(
                <CanvasPromptChipInput
                    value=""
                    references={sampleCategorized.possible}
                    categorizedResources={sampleCategorized}
                    showMotionPresets={true}
                    onChange={onChange}
                />
            );
        });

        const editor = container.querySelector("[contenteditable='true']") as HTMLDivElement;

        // Type '@'
        await act(async () => {
            editor.focus();
            const textNode = document.createTextNode("@");
            editor.appendChild(textNode);
            const range = document.createRange();
            range.setStart(textNode, 1);
            range.collapse(true);
            const sel = window.getSelection();
            sel?.removeAllRanges();
            sel?.addRange(range);
            editor.dispatchEvent(new InputEvent("input", { bubbles: true }));
        });

        // Verify mention menu is open
        expect(document.querySelector("[data-canvas-resource-mention-menu]")).not.toBeNull();

        // Navigate Down past the 2 possible items:
        // index 0: img-1
        // index 1: vid-1
        // index 2: category "图片" (or "视频", "文本", "运镜")
        // Pressing ArrowDown multiple times should navigate into categories!
        // Pressing ArrowRight should open the category's submenu!
        // Pressing ArrowDown inside submenu should navigate submenu items!
        // Pressing Enter should select the submenu item!
        await act(async () => {
            // Down 1 -> vid-1 (index 1)
            editor.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
            // Down 2 -> category 0 (图片, index 2)
            editor.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
            // Down 3 -> category 1 (视频, index 3)
            editor.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
            // Down 4 -> category 2 (音频, index 4)
            editor.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
            // Down 5 -> category 3 (文本, index 5)
            editor.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
            // Down 6 -> category 4 (运镜, index 6)
            editor.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
            // Right -> enter submenu of "运镜"
            editor.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
            // Enter -> select first motion preset
            editor.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
        });

        expect(onChange).toHaveBeenCalledWith(expect.stringContaining("@[motion:"));
    });

    it("Bug 3: inserting mention between two chips when @ is in an isolated text node", async () => {
        let currentValue = "@[node:node-img-1] @[node:node-vid-1]";
        const onChange = vi.fn((next: string) => {
            currentValue = next;
        });

        await act(async () => {
            root.render(
                <CanvasPromptChipInput
                    value={currentValue}
                    references={sampleCategorized.possible}
                    categorizedResources={sampleCategorized}
                    onChange={onChange}
                />
            );
        });

        const editor = container.querySelector("[contenteditable='true']") as HTMLDivElement;
        // Editor has 2 chips: child 0 (chip 1), child 1 (chip 2)
        expect(editor.children.length).toBe(2);

        // User inserts "@" between chip 1 and chip 2
        await act(async () => {
            const atNode = document.createTextNode("@");
            editor.insertBefore(atNode, editor.children[1]);
            const range = document.createRange();
            range.setStart(atNode, 1);
            range.collapse(true);
            const sel = window.getSelection();
            sel?.removeAllRanges();
            sel?.addRange(range);
            editor.dispatchEvent(new InputEvent("input", { bubbles: true }));
        });

        expect(document.querySelector("[data-canvas-resource-mention-menu]")).not.toBeNull();

        // Press Enter to select img-1
        await act(async () => {
            editor.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
        });

        // The token MUST be between chip 1 and chip 2:
        // "@[node:node-img-1]@[node:node-img-1] @[node:node-vid-1]" or similar
        // NOT appended to the end: "@[node:node-img-1]@[node:node-vid-1]@[node:node-img-1] "
        expect(onChange).toHaveBeenLastCalledWith(
            expect.stringMatching(/^@\[node:node-img-1\]\s*@\[node:node-img-1\]\s*@\[node:node-vid-1\]/)
        );
    });

    it("search mode: typing query finds motion preset and Enter inserts it at caret", async () => {
        let currentValue = "Scene 1: @一镜 Scene 2";
        const onChange = vi.fn((next: string) => {
            currentValue = next;
        });

        await act(async () => {
            root.render(
                <CanvasPromptChipInput
                    value={currentValue}
                    references={sampleCategorized.possible}
                    categorizedResources={sampleCategorized}
                    onChange={onChange}
                />
            );
        });

        const editor = container.querySelector("[contenteditable='true']") as HTMLDivElement;

        await act(async () => {
            editor.textContent = "";
            const textNode = document.createTextNode("Scene 1: @一镜 Scene 2");
            editor.appendChild(textNode);
            // Caret right after '@一镜' (offset 12)
            const range = document.createRange();
            range.setStart(textNode, 12);
            range.collapse(true);
            const sel = window.getSelection();
            sel?.removeAllRanges();
            sel?.addRange(range);
            editor.dispatchEvent(new InputEvent("input", { bubbles: true }));
        });

        expect(document.querySelector("[data-canvas-resource-mention-menu]")).not.toBeNull();

        // Press Enter to select the matched motion preset "一镜到底"
        await act(async () => {
            editor.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
        });

        expect(onChange).toHaveBeenLastCalledWith(
            expect.stringMatching(/^Scene 1:\s*@\[motion:(oner|one-take)\]\s*Scene 2$/)
        );
    });

    it("clicking @ button toggles menu closed when already open", async () => {
        const triggerRef = { current: null as (() => void) | null };
        const onChange = vi.fn();

        await act(async () => {
            root.render(
                <CanvasPromptChipInput
                    value=""
                    references={sampleCategorized.possible}
                    categorizedResources={sampleCategorized}
                    onChange={onChange}
                    triggerMentionRef={triggerRef}
                />
            );
        });

        // 1. Click to open
        await act(async () => {
            triggerRef.current?.();
        });
        expect(document.querySelector("[data-canvas-resource-mention-menu]")).not.toBeNull();

        // 2. Click again to toggle close
        await act(async () => {
            triggerRef.current?.();
        });
        expect(document.querySelector("[data-canvas-resource-mention-menu]")).toBeNull();
    });
});
