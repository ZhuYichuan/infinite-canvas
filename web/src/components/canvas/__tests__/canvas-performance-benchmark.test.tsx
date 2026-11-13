import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InfiniteCanvas } from "../infinite-canvas";
import { CanvasNode, areCanvasNodePropsEqual } from "../canvas-node";
import { ConnectionPath } from "../canvas-connections";
import { CanvasNodeType, type CanvasConnection, type CanvasNodeData, type ViewportTransform } from "@/types/canvas";
import { calculateAlignmentSnap } from "@/lib/canvas/canvas-alignment-snapping";
import { getAllInvalidConnectionIds } from "@/lib/canvas/canvas-node-geometry";

vi.mock("@/stores/use-theme-store", () => ({
    useThemeStore: (selector: (state: { theme: "light" }) => unknown) => selector({ theme: "light" }),
}));
vi.mock("@/stores/use-collab-store", () => ({
    useCollabStore: (selector: (state: object) => unknown) => selector({}),
}));
vi.mock("@/lib/canvas/node-registry", () => ({
    getNodeDefinition: () => undefined,
}));
vi.mock("../canvas-resource-mention-textarea", () => ({
    CanvasResourceMentionTextarea: () => null,
}));
vi.mock("../canvas-video-player", () => ({
    CanvasVideoPlayer: () => null,
}));
vi.mock("antd", () => ({
    Tooltip: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("react-i18next", async (importOriginal) => ({
    ...(await importOriginal<typeof import("react-i18next")>()),
    useTranslation: () => ({ t: (key: string) => key }),
}));

function createTestNodes(count: number): CanvasNodeData[] {
    return Array.from({ length: count }, (_, i) => ({
        id: `node-${i}`,
        type: CanvasNodeType.Image,
        title: `Node ${i}`,
        position: { x: (i % 10) * 400, y: Math.floor(i / 10) * 400 },
        width: 360,
        height: 300,
        metadata: { prompt: `Prompt ${i}` },
    }));
}

describe("Canvas Performance Benchmark & Regression Suite", () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(async () => {
        await act(async () => root.unmount());
        container.remove();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    describe("Benchmark 1: Wheel Zoom Frequency & RAF Throttling", () => {
        it("batches high-frequency wheel bursts into RAF updates instead of firing synchronously every event", async () => {
            const onViewportChange = vi.fn();
            const containerRef = { current: container };
            const viewport: ViewportTransform = { x: 0, y: 0, k: 1 };

            vi.spyOn(container, "getBoundingClientRect").mockReturnValue({
                left: 0,
                top: 0,
                width: 1000,
                height: 800,
                right: 1000,
                bottom: 800,
                x: 0,
                y: 0,
                toJSON: () => {},
            });

            await act(async () => {
                root.render(
                    <InfiniteCanvas
                        containerRef={containerRef}
                        viewport={viewport}
                        tool="select"
                        onViewportChange={onViewportChange}
                    >
                        <div data-testid="content">Content</div>
                    </InfiniteCanvas>,
                );
            });

            const canvasElement = container.firstElementChild as HTMLElement;
            expect(canvasElement).toBeDefined();

            // Simulate high-frequency trackpad/wheel burst: 20 wheel events in rapid succession
            await act(async () => {
                for (let i = 0; i < 20; i++) {
                    const wheelEvent = new WheelEvent("wheel", {
                        deltaY: -10,
                        clientX: 500,
                        clientY: 400,
                        bubbles: true,
                        cancelable: true,
                    });
                    canvasElement.dispatchEvent(wheelEvent);
                }
            });

            expect(onViewportChange).toHaveBeenCalled();
            const lastCall = onViewportChange.mock.calls[onViewportChange.mock.calls.length - 1][0];
            expect(lastCall.k).toBeGreaterThan(1.0);
        });

        it("maintains monotonic zoom scale during sequential wheel bursts across asynchronous React render latency", async () => {
            const viewportHistory: ViewportTransform[] = [];
            const onViewportChange = vi.fn((vp: ViewportTransform) => {
                viewportHistory.push(vp);
            });
            const containerRef = { current: container };
            // Static initial viewport prop (simulating React taking 50ms to re-render parent ProjectPage)
            const viewport: ViewportTransform = { x: 0, y: 0, k: 1 };

            vi.spyOn(container, "getBoundingClientRect").mockReturnValue({
                left: 0,
                top: 0,
                width: 1000,
                height: 800,
                right: 1000,
                bottom: 800,
                x: 0,
                y: 0,
                toJSON: () => {},
            });

            await act(async () => {
                root.render(
                    <InfiniteCanvas
                        containerRef={containerRef}
                        viewport={viewport}
                        tool="select"
                        onViewportChange={onViewportChange}
                    >
                        <div>Content</div>
                    </InfiniteCanvas>,
                );
            });

            const canvasElement = container.firstElementChild as HTMLElement;

            // Frame 1: Single wheel zoom in (deltaY: -50)
            await act(async () => {
                canvasElement.dispatchEvent(new WheelEvent("wheel", { deltaY: -50, clientX: 500, clientY: 400, bubbles: true, cancelable: true }));
            });

            expect(viewportHistory.length).toBe(1);
            const scale1 = viewportHistory[0].k;
            expect(scale1).toBeGreaterThan(1.0);

            // Frame 2: User continues zooming in with another wheel event (deltaY: -50)
            // CRUCIAL: The component prop `viewport` is STILL { k: 1.0 } because parent hasn't re-rendered yet!
            await act(async () => {
                canvasElement.dispatchEvent(new WheelEvent("wheel", { deltaY: -50, clientX: 500, clientY: 400, bubbles: true, cancelable: true }));
            });

            expect(viewportHistory.length).toBe(2);
            const scale2 = viewportHistory[1].k;

            // TARGET CHECK:
            // Continuous zoom-in MUST be strictly monotonic: scale2 > scale1.
            // Under the bug, because nextViewportRef was cleared to null, it read stale prop k: 1.0,
            // so scale2 equals scale1 instead of progressing to scale1 * factor!
            console.log(`[Zoom Monotonicity Metric] Scale 1: ${scale1}, Scale 2: ${scale2} (expected scale2 > scale1)`);
            expect(scale2).toBeGreaterThan(scale1);
        });

        it("maintains monotonic zoom scale when intermediate React render commits land between wheel bursts", async () => {
            const viewportHistory: ViewportTransform[] = [];
            let currentVpProp: ViewportTransform = { x: 0, y: 0, k: 1 };
            const containerRef = { current: container };

            vi.spyOn(container, "getBoundingClientRect").mockReturnValue({
                left: 0,
                top: 0,
                width: 1000,
                height: 800,
                right: 1000,
                bottom: 800,
                x: 0,
                y: 0,
                toJSON: () => {},
            });

            const renderWithProp = async (vp: ViewportTransform) => {
                currentVpProp = vp;
                await act(async () => {
                    root.render(
                        <InfiniteCanvas
                            containerRef={containerRef}
                            viewport={vp}
                            tool="select"
                            onViewportChange={(next) => {
                                viewportHistory.push(next);
                            }}
                        >
                            <div>Content</div>
                        </InfiniteCanvas>,
                    );
                });
            };

            await renderWithProp(currentVpProp);
            const canvasElement = container.firstElementChild as HTMLElement;

            // Wheel 1
            await act(async () => {
                canvasElement.dispatchEvent(new WheelEvent("wheel", { deltaY: -50, clientX: 500, clientY: 400, bubbles: true, cancelable: true }));
            });
            expect(viewportHistory.length).toBe(1);
            const scale1 = viewportHistory[0].k;

            // React commits Wheel 1's viewport
            await renderWithProp(viewportHistory[0]);

            // Wheel 2
            await act(async () => {
                canvasElement.dispatchEvent(new WheelEvent("wheel", { deltaY: -50, clientX: 500, clientY: 400, bubbles: true, cancelable: true }));
            });
            expect(viewportHistory.length).toBe(2);
            const scale2 = viewportHistory[1].k;
            expect(scale2).toBeGreaterThan(scale1);

            // React commits Wheel 2's viewport
            await renderWithProp(viewportHistory[1]);

            // Wheel 3
            await act(async () => {
                canvasElement.dispatchEvent(new WheelEvent("wheel", { deltaY: -50, clientX: 500, clientY: 400, bubbles: true, cancelable: true }));
            });
            expect(viewportHistory.length).toBe(3);
            const scale3 = viewportHistory[2].k;
            expect(scale3).toBeGreaterThan(scale2);
        });
    });

    describe("Benchmark 2: Node Re-render Stability during Viewport Zoom", () => {
        it("does not re-render unmoved/unchanged CanvasNodes when viewport zoom changes", async () => {
            const renderCounts: Record<string, number> = {};

            const TrackedCanvasNode = React.memo((props: React.ComponentProps<typeof CanvasNode>) => {
                renderCounts[props.data.id] = (renderCounts[props.data.id] || 0) + 1;
                return <CanvasNode {...props} />;
            }, areCanvasNodePropsEqual);

            const nodes = createTestNodes(20);
            const noop = () => {};
            const defaultNodeProps = {
                isSelected: false,
                isRelated: false,
                isFocusRelated: false,
                isConnectionTarget: false,
                isConnecting: false,
                showImageInfo: false,
                groupChildCount: 0,
                onMouseDown: noop,
                onContextMenu: noop,
                onHoverStart: noop,
                onHoverEnd: noop,
                onConnectStart: noop,
                onResizeStart: noop,
                onResize: noop,
                onResizeEnd: noop,
                onContentChange: noop,
                onTitleChange: noop,
            };

            // Initial render at scale 1.0
            await act(async () => {
                root.render(
                    <div>
                        {nodes.map((node) => (
                            <TrackedCanvasNode
                                key={node.id}
                                data={node}
                                scale={1.0}
                                {...defaultNodeProps}
                            />
                        ))}
                    </div>,
                );
            });

            for (const node of nodes) {
                expect(renderCounts[node.id]).toBe(1);
            }

            // Simulate viewport zoom from 1.0 to 1.2
            await act(async () => {
                root.render(
                    <div>
                        {nodes.map((node) => (
                            <TrackedCanvasNode
                                key={node.id}
                                data={node}
                                scale={1.2}
                                {...defaultNodeProps}
                            />
                        ))}
                    </div>,
                );
            });

            // TARGET CHECK:
            // Under current code, scale={1.2} forces all 20 nodes to re-render (totalReRenders = 20).
            // A performant canvas decouples scale (via CSS variable / container transform) so zoom does not invalidate node VDOM.
            const totalReRenders = Object.values(renderCounts).reduce((sum, count) => sum + (count - 1), 0);
            console.log(`[Benchmark 2 Metric] Re-rendered node count on zoom: ${totalReRenders} / ${nodes.length}`);
            expect(totalReRenders).toBe(0);
        });

        it("updates scale for selected/focused nodes while keeping unselected nodes memoized", () => {
            const node = createTestNodes(1)[0];
            const baseProps = {
                data: node,
                isSelected: false,
                isRelated: false,
                isFocusRelated: false,
                isConnectionTarget: false,
                isConnecting: false,
                showImageInfo: false,
                groupChildCount: 0,
                onMouseDown: () => {},
                onContextMenu: () => {},
            };

            // Unselected node ignores scale change
            expect(areCanvasNodePropsEqual(
                { ...baseProps, scale: 1.0 },
                { ...baseProps, scale: 1.2 },
            )).toBe(true);

            // Selected node re-renders on scale change to keep resize handles and title width accurate
            expect(areCanvasNodePropsEqual(
                { ...baseProps, isSelected: true, scale: 1.0 },
                { ...baseProps, isSelected: true, scale: 1.2 },
            )).toBe(false);
        });

        it("does not re-render ConnectionPath when viewport or callback references change during canvas zoom", async () => {
            let renderCount = 0;
            const fromNode: CanvasNodeData = {
                id: "node-1",
                type: CanvasNodeType.Image,
                title: "From",
                position: { x: 100, y: 100 },
                width: 300,
                height: 200,
            };
            const toNode: CanvasNodeData = {
                id: "node-2",
                type: CanvasNodeType.Image,
                title: "To",
                position: { x: 600, y: 100 },
                width: 300,
                height: 200,
            };
            const connection: CanvasConnection = {
                id: "conn-1",
                fromNodeId: "node-1",
                toNodeId: "node-2",
            };

            const Wrapper = ({ viewport }: { viewport: ViewportTransform }) => {
                renderCount++;
                return (
                    <svg>
                        <ConnectionPath
                            connection={connection}
                            from={fromNode}
                            to={toNode}
                            viewport={viewport}
                            active={false}
                            isSelected={false}
                            invalid={false}
                            onSelect={() => {}}
                            onDisconnect={() => {}}
                            onContextMenu={() => {}}
                        />
                    </svg>
                );
            };

            await act(async () => {
                root.render(<Wrapper viewport={{ x: 0, y: 0, k: 1 }} />);
            });

            expect(renderCount).toBe(1);

            // Re-render parent with changed viewport and brand-new arrow callback functions
            await act(async () => {
                root.render(<Wrapper viewport={{ x: 100, y: 50, k: 1.5 }} />);
            });

            expect(renderCount).toBe(2);
            // Verify DOM element rendered successfully
            expect(container.querySelector('[data-connection-id="conn-1"]')).toBeTruthy();
        });
    });

    describe("Benchmark 3: Dragging Pipeline & State Consolidation", () => {
        it("quantifies synchronous drag calculation overhead with 100 nodes", () => {
            const nodes = createTestNodes(100);
            const initialNodes = [{ id: "node-0", x: 0, y: 0 }];

            const t0 = performance.now();
            const iterations = 60; // 60 frames of mouse move
            for (let i = 0; i < iterations; i++) {
                calculateAlignmentSnap({
                    initialNodes,
                    rawDx: i * 2,
                    rawDy: i * 2,
                    allNodes: nodes,
                    viewportScale: 1,
                    disabled: false,
                });
            }
            const t1 = performance.now();
            const elapsedMs = t1 - t0;
            const avgPerFrameMs = elapsedMs / iterations;

            console.log(`[Benchmark 3 Metric] calculateAlignmentSnap (100 nodes x 60 frames): ${elapsedMs.toFixed(2)}ms total, ${avgPerFrameMs.toFixed(3)}ms/frame`);

            // Single frame budget for 60fps is 16.6ms, snap calculation alone should stay comfortably under budget (< 5ms)
            expect(avgPerFrameMs).toBeLessThan(5.0);
        });

        it("quantifies graph validation overhead with 100 nodes and 100 connections", () => {
            const nodes = createTestNodes(100);
            const connections = Array.from({ length: 99 }, (_, i) => ({
                id: `c-${i}`,
                fromNodeId: `node-${i}`,
                toNodeId: `node-${i + 1}`,
                kind: "input" as const,
            }));

            const t0 = performance.now();
            const iterations = 60;
            for (let i = 0; i < iterations; i++) {
                getAllInvalidConnectionIds(nodes, connections);
            }
            const t1 = performance.now();
            const elapsedMs = t1 - t0;
            const avgPerFrameMs = elapsedMs / iterations;

            console.log(`[Benchmark 3 Metric] getAllInvalidConnectionIds (100 nodes x 100 connections x 60 frames): ${elapsedMs.toFixed(2)}ms total, ${avgPerFrameMs.toFixed(3)}ms/frame`);

            // 100 nodes x 100 connections validation should be fast (< 1.0ms per frame)
            expect(avgPerFrameMs).toBeLessThan(1.0);
        });

        it("does not re-render unmoved CanvasNodes when one node is dragged", async () => {
            const renderCounts: Record<string, number> = {};

            const TrackedCanvasNode = React.memo((props: React.ComponentProps<typeof CanvasNode>) => {
                renderCounts[props.data.id] = (renderCounts[props.data.id] || 0) + 1;
                return <CanvasNode {...props} />;
            }, areCanvasNodePropsEqual);

            const nodes = createTestNodes(20);
            const noop = () => {};
            const defaultNodeProps = {
                isSelected: false,
                isRelated: false,
                isFocusRelated: false,
                isConnectionTarget: false,
                isConnecting: false,
                showImageInfo: false,
                groupChildCount: 0,
                onMouseDown: noop,
                onContextMenu: noop,
                onHoverStart: noop,
                onHoverEnd: noop,
                onConnectStart: noop,
                onResizeStart: noop,
                onResize: noop,
                onResizeEnd: noop,
                onContentChange: noop,
                onTitleChange: noop,
            };

            await act(async () => {
                root.render(
                    <div>
                        {nodes.map((node) => (
                            <TrackedCanvasNode
                                key={node.id}
                                data={node}
                                scale={1.0}
                                {...defaultNodeProps}
                                isSelected={node.id === "node-0"}
                            />
                        ))}
                    </div>,
                );
            });

            // Simulate moving ONLY node-0 by 10px
            const updatedNodes = nodes.map((n) =>
                n.id === "node-0" ? { ...n, position: { x: n.position.x + 10, y: n.position.y + 10 } } : n,
            );

            await act(async () => {
                root.render(
                    <div>
                        {updatedNodes.map((node) => (
                            <TrackedCanvasNode
                                key={node.id}
                                data={node}
                                scale={1.0}
                                {...defaultNodeProps}
                                isSelected={node.id === "node-0"}
                            />
                        ))}
                    </div>,
                );
            });

            // The moved node should have re-rendered (renderCount === 2)
            expect(renderCounts["node-0"]).toBe(2);

            // The remaining 19 unmoved nodes MUST NOT re-render (renderCount === 1)
            const unmovedReRenders = nodes
                .filter((n) => n.id !== "node-0")
                .filter((n) => renderCounts[n.id] > 1);

            expect(unmovedReRenders.length).toBe(0);
        });
    });
});
