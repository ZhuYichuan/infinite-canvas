import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CanvasNodeType, type CanvasNodeData } from "@/types/canvas";
import { CanvasNode } from "../canvas-node";

vi.mock("antd", () => ({
    App: { useApp: () => ({ message: { warning: vi.fn(), success: vi.fn() } }) },
    Tooltip: ({ children }: { children: React.ReactNode }) => children,
    Modal: () => null,
    Segmented: () => null,
}));
vi.mock("react-i18next", async (importOriginal) => ({
    ...(await importOriginal<typeof import("react-i18next")>()),
    useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/stores/use-collab-store", () => ({ useCollabStore: (select: (value: object) => unknown) => select({}) }));
vi.mock("@/stores/use-theme-store", () => ({ useThemeStore: (select: (value: object) => unknown) => select({ theme: "light" }) }));
vi.mock("@/lib/canvas/node-registry", () => ({ getNodeDefinition: () => ({ hasSourceHandle: true }) }));
vi.mock("@/lib/image-utils", () => ({ formatBytes: (value: number) => String(value), getDataUrlByteSize: () => 0 }));

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
    vi.stubGlobal("React", React);
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
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

describe("CanvasNode connection handle placement", () => {
    const defaultNode: CanvasNodeData = {
        id: "image-01",
        type: CanvasNodeType.Image,
        title: "image-01",
        position: { x: 100, y: 100 },
        width: 300,
        height: 200,
        metadata: {},
    };

    const defaultHandlers = {
        onMouseDown: vi.fn(),
        onHoverStart: vi.fn(),
        onHoverEnd: vi.fn(),
        onConnectStart: vi.fn(),
        onResizeStart: vi.fn(),
        onResize: vi.fn(),
        onResizeEnd: vi.fn(),
        onContentChange: vi.fn(),
        onTitleChange: vi.fn(),
        onContextMenu: vi.fn(),
        onConnectClick: vi.fn(),
    };

    it("anchors right handle strictly outside the node boundary without interior intrusion", async () => {
        await act(async () => {
            root.render(
                <CanvasNode
                    data={defaultNode}
                    isSelected={true}
                    {...defaultHandlers}
                />,
            );
        });

        const handles = container.querySelectorAll<HTMLElement>("[data-connection-handle]");
        expect(handles.length).toBe(2);

        // Find the right handle (source handle)
        const rightHandle = Array.from(handles).find((el) => el.style.left === "100%");
        expect(rightHandle).toBeDefined();
        expect(rightHandle!.style.transformOrigin).toBe("left center");
        expect(rightHandle!.classList.contains("justify-start")).toBe(true);

        // Verify there is no bridge element extending into the node (-left-8, -right-6)
        const bridges = rightHandle!.querySelectorAll(".pointer-events-auto.absolute");
        expect(bridges.length).toBe(0);

        // Verify the button has left-center transform origin
        const button = rightHandle!.querySelector<HTMLElement>(".rounded-full");
        expect(button).toBeDefined();
        expect(button!.style.transformOrigin).toBe("left center");
    });

    it("anchors left handle strictly outside the node boundary without interior intrusion", async () => {
        await act(async () => {
            root.render(
                <CanvasNode
                    data={defaultNode}
                    isSelected={true}
                    {...defaultHandlers}
                />,
            );
        });

        const handles = container.querySelectorAll<HTMLElement>("[data-connection-handle]");
        const leftHandle = Array.from(handles).find((el) => el.style.right === "100%");
        expect(leftHandle).toBeDefined();
        expect(leftHandle!.style.transformOrigin).toBe("right center");
        expect(leftHandle!.classList.contains("justify-end")).toBe(true);

        // Verify no bridge element
        const bridges = leftHandle!.querySelectorAll(".pointer-events-auto.absolute");
        expect(bridges.length).toBe(0);

        // Verify the dot has right-center transform origin
        const dot = leftHandle!.querySelector<HTMLElement>(".rounded-full");
        expect(dot).toBeDefined();
        expect(dot!.style.transformOrigin).toBe("right center");
    });

    it("toggles handle hover state on mouse enter and leave without inward sticky stretch", async () => {
        await act(async () => {
            root.render(
                <CanvasNode
                    data={defaultNode}
                    isSelected={true}
                    {...defaultHandlers}
                />,
            );
        });

        const handles = container.querySelectorAll<HTMLElement>("[data-connection-handle]");
        const rightHandle = Array.from(handles).find((el) => el.style.left === "100%")!;
        const button = rightHandle.querySelector<HTMLElement>(".rounded-full")!;

        // Initially not hovered or scaled up
        expect(button.className.includes("scale-125")).toBe(false);

        // Hover onto the handle container outside the node
        act(() => {
            rightHandle.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
        });
        expect(button.className.includes("scale-125")).toBe(true);

        // Pointer move inward (dx <= 0, moving towards node) should keep transform at rest (0, 0)
        vi.spyOn(button, "getBoundingClientRect").mockReturnValue(new DOMRect(400, 200, 26, 26));
        act(() => {
            rightHandle.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: 380, clientY: 213 }));
        });
        expect(button.style.transform).toBe("translate(0, 0)");

        // Pointer leave resets hover state
        act(() => {
            rightHandle.dispatchEvent(new PointerEvent("pointerout", { bubbles: true }));
        });
        expect(button.className.includes("scale-125")).toBe(false);
    });
});
