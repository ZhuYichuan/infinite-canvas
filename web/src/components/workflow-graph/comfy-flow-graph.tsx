import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type MouseEvent as ReactMouseEvent,
} from "react";
import { Button, Modal, Tooltip } from "antd";
import {
    Focus,
    Maximize2,
    Minimize2,
    Plus,
    Minus,
    RotateCcw,
    Layers,
    X,
} from "lucide-react";
import { parseWorkflowToGraph } from "./dag-layout";
import { ComfyFlowNode } from "./comfy-flow-node";
import { ComfyFlowConnections } from "./comfy-flow-connections";
import { ComfyFlowDrawer } from "./comfy-flow-drawer";
import type { ComfyFlowNodeData } from "./comfy-flow-types";
import type { ComfyuiModelItem, ComfyuiWorkflowJson } from "@/services/api/comfyui";

interface ComfyFlowCanvasProps {
    workflowJson: ComfyuiWorkflowJson;
    modelsMap?: Record<string, { loading: boolean; error?: string; items: ComfyuiModelItem[] }>;
    onModelChange?: (nodeId: string, inputKey: string, nextValue: string) => void;
    onReloadModels?: (category: string, force?: boolean) => void;
    onSlotOverride?: (nodeId: string, slotTitle: string) => void;
    className?: string;
    isFullscreen: boolean;
    onToggleFullscreen: () => void;
}

function ComfyFlowCanvas({
    workflowJson,
    modelsMap,
    onModelChange,
    onReloadModels,
    onSlotOverride,
    className = "",
    isFullscreen,
    onToggleFullscreen,
}: ComfyFlowCanvasProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    // 解析 DAG 布局
    const rawLayout = useMemo(() => {
        return parseWorkflowToGraph(workflowJson);
    }, [workflowJson]);

    // 允许用户拖拽微调节点位置的本地状态
    const [draggedPositions, setDraggedPositions] = useState<Map<string, { x: number; y: number }>>(
        new Map(),
    );

    // 当工作流 JSON 改变时重置拖拽位置
    useEffect(() => {
        setDraggedPositions(new Map());
    }, [workflowJson]);

    // 计算应用了微调位置后的节点列表与映射
    const { nodes, nodesMap, edges } = useMemo(() => {
        const updatedNodes: ComfyFlowNodeData[] = rawLayout.nodes.map((node) => {
            const customPos = draggedPositions.get(node.id);
            if (!customPos) return node;

            const dx = customPos.x - node.x;
            const dy = customPos.y - node.y;

            return {
                ...node,
                x: customPos.x,
                y: customPos.y,
                inputPorts: node.inputPorts.map((p) => ({
                    ...p,
                    x: (p.x ?? node.x) + dx,
                    y: (p.y ?? node.y) + dy,
                })),
                outputPorts: node.outputPorts.map((p) => ({
                    ...p,
                    x: (p.x ?? node.x + node.width) + dx,
                    y: (p.y ?? node.y) + dy,
                })),
            };
        });

        const map = new Map<string, ComfyFlowNodeData>();
        for (const n of updatedNodes) {
            map.set(n.id, n);
        }

        return {
            nodes: updatedNodes,
            nodesMap: map,
            edges: rawLayout.edges,
        };
    }, [rawLayout, draggedPositions]);

    // 计算当前所有节点的动态绝对外接矩形与几何中心（兼容用户手动拖拽位移）
    const currentBounds = useMemo(() => {
        if (nodes.length === 0) return rawLayout.bounds;
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (const n of nodes) {
            if (n.x < minX) minX = n.x;
            if (n.y < minY) minY = n.y;
            if (n.x + n.width > maxX) maxX = n.x + n.width;
            if (n.y + n.height > maxY) maxY = n.y + n.height;
        }
        return {
            minX,
            minY,
            maxX,
            maxY,
            width: Math.max(maxX - minX, 400),
            height: Math.max(maxY - minY, 300),
            centerX: (minX + maxX) / 2,
            centerY: (minY + maxY) / 2,
        };
    }, [nodes, rawLayout.bounds]);

    // 视口状态 (平移与缩放，全屏模式默认 1.0)
    const [viewport, setViewport] = useState(() => ({
        x: 60,
        y: 60,
        zoom: isFullscreen ? 1.0 : 0.85,
    }));
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);

    // 交互拖拽状态 (画布平移 / 节点拖拽)
    const dragStateRef = useRef<{
        isPanning: boolean;
        isDraggingNode: boolean;
        targetNodeId?: string;
        startX: number;
        startY: number;
        nodeInitialX?: number;
        nodeInitialY?: number;
        hasMoved: boolean;
    }>({
        isPanning: false,
        isDraggingNode: false,
        startX: 0,
        startY: 0,
        hasMoved: false,
    });

    // 获取视口容器当前物理像素尺寸
    const getContainerSize = useCallback(() => {
        if (!containerRef.current) {
            return {
                width: isFullscreen ? window.innerWidth : 800,
                height: isFullscreen ? window.innerHeight : 600,
            };
        }
        const rect = containerRef.current.getBoundingClientRect();
        return {
            width: rect.width > 0 ? rect.width : (isFullscreen ? window.innerWidth : 800),
            height: rect.height > 0 ? rect.height : (isFullscreen ? window.innerHeight : 600),
        };
    }, [isFullscreen]);

    // 重置并以 100% 原始比例在屏幕正中居中呈现（全屏模式默认）
    const handleCenter100 = useCallback(() => {
        if (nodes.length === 0) return;
        const { width, height } = getContainerSize();
        const zoom = 1.0;
        const centerX = width / 2 - currentBounds.centerX * zoom;
        const centerY = height / 2 - currentBounds.centerY * zoom;

        setViewport({
            x: Math.round(centerX),
            y: Math.round(centerY),
            zoom: 1.0,
        });
    }, [nodes.length, getContainerSize, currentBounds]);

    // 自适应居中视口 (Fit View)
    const handleFitView = useCallback(() => {
        if (nodes.length === 0) return;
        const { width, height } = getContainerSize();

        const padding = 60;
        const availableW = Math.max(width - padding * 2, 200);
        const availableH = Math.max(height - padding * 2, 200);

        const scaleX = availableW / currentBounds.width;
        const scaleY = availableH / currentBounds.height;
        const fitZoom = Math.min(Math.max(Math.min(scaleX, scaleY), 0.2), 1.0);

        const centerX = width / 2 - currentBounds.centerX * fitZoom;
        const centerY = height / 2 - currentBounds.centerY * fitZoom;

        setViewport({
            x: Math.round(centerX),
            y: Math.round(centerY),
            zoom: Number(fitZoom.toFixed(2)),
        });
    }, [nodes.length, getContainerSize, currentBounds]);

    // 根据模式执行初始对齐：全屏模式以 100% 比例在屏幕正中居中呈现，小窗口模式 Fit View 看全
    const applyInitialView = useCallback(() => {
        if (isFullscreen) {
            handleCenter100();
        } else {
            handleFitView();
        }
    }, [isFullscreen, handleCenter100, handleFitView]);

    // 初始化时执行初始对齐（微任务定时器兼容模态框过渡）
    useEffect(() => {
        const timer1 = setTimeout(applyInitialView, 30);
        const timer2 = setTimeout(applyInitialView, 120);
        return () => {
            clearTimeout(timer1);
            clearTimeout(timer2);
        };
    }, [applyInitialView]);

    // 使用 ResizeObserver 监听容器真实尺寸变化
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        let hasHandledFirstResize = false;
        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
                    if (!hasHandledFirstResize) {
                        hasHandledFirstResize = true;
                        applyInitialView();
                    }
                }
            }
        });

        observer.observe(container);
        return () => observer.disconnect();
    }, [applyInitialView]);

    // 窗口尺寸变化时重新自适应居中
    useEffect(() => {
        const handleResize = () => {
            applyInitialView();
        };
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, [applyInitialView]);

    // 监听原生非 passive 滚轮事件，彻底阻止页面联动滚动并进行平滑缩放
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            e.stopPropagation();

            const rect = container.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            const zoomDelta = e.deltaY < 0 ? 1.1 : 0.9;
            setViewport((prev) => {
                const nextZoom = Math.min(Math.max(prev.zoom * zoomDelta, 0.2), 2.5);
                const newX = mouseX - (mouseX - prev.x) * (nextZoom / prev.zoom);
                const newY = mouseY - (mouseY - prev.y) * (nextZoom / prev.zoom);

                return {
                    x: Math.round(newX),
                    y: Math.round(newY),
                    zoom: Number(nextZoom.toFixed(2)),
                };
            });
        };

        container.addEventListener("wheel", onWheel, { passive: false });
        return () => container.removeEventListener("wheel", onWheel);
    }, []);

    // 画布背景拖拽开始 (Pan)
    const handleCanvasMouseDown = (e: ReactMouseEvent) => {
        if (e.button !== 0) return;
        dragStateRef.current = {
            isPanning: true,
            isDraggingNode: false,
            startX: e.clientX - viewport.x,
            startY: e.clientY - viewport.y,
            hasMoved: false,
        };
    };

    // 节点卡片拖拽开始 (Node Drag)
    const handleNodeDragStart = (e: ReactMouseEvent, nodeId: string) => {
        const node = nodesMap.get(nodeId);
        if (!node) return;
        e.stopPropagation();

        dragStateRef.current = {
            isPanning: false,
            isDraggingNode: true,
            targetNodeId: nodeId,
            startX: e.clientX,
            startY: e.clientY,
            nodeInitialX: node.x,
            nodeInitialY: node.y,
            hasMoved: false,
        };
    };

    // 鼠标移动全局监听 (处理平移与节点移动)
    const handleMouseMove = (e: ReactMouseEvent) => {
        const state = dragStateRef.current;
        if (state.isPanning) {
            setViewport((prev) => ({
                ...prev,
                x: e.clientX - state.startX,
                y: e.clientY - state.startY,
            }));
        } else if (
            state.isDraggingNode &&
            state.targetNodeId &&
            state.nodeInitialX !== undefined &&
            state.nodeInitialY !== undefined
        ) {
            const dist = Math.hypot(e.clientX - state.startX, e.clientY - state.startY);
            if (dist > 4) {
                state.hasMoved = true;
            }

            const dx = (e.clientX - state.startX) / viewport.zoom;
            const dy = (e.clientY - state.startY) / viewport.zoom;
            const newX = Math.round(state.nodeInitialX + dx);
            const newY = Math.round(state.nodeInitialY + dy);

            setDraggedPositions((prev) => {
                const next = new Map(prev);
                next.set(state.targetNodeId!, { x: newX, y: newY });
                return next;
            });
        }
    };

    // 拖拽释放
    const handleMouseUp = () => {
        const wasMoved = dragStateRef.current.hasMoved;
        dragStateRef.current.isPanning = false;
        dragStateRef.current.isDraggingNode = false;

        // 延时重置 hasMoved，以拦截拖拽后随之触发的 onClick 冒泡事件
        if (wasMoved) {
            setTimeout(() => {
                if (dragStateRef.current) {
                    dragStateRef.current.hasMoved = false;
                }
            }, 80);
        }
    };

    // 节点选中并调出侧边详情 (若发生拖动则抑制点击选中)
    const handleSelectNode = (nodeId: string) => {
        if (dragStateRef.current.hasMoved) return;
        setSelectedNodeId(nodeId);
        setDrawerOpen(true);
    };

    const selectedNodeData = selectedNodeId ? nodesMap.get(selectedNodeId) || null : null;

    return (
        <div
            ref={containerRef}
            className={`relative size-full overflow-hidden select-none overscroll-contain bg-stone-100/70 dark:bg-stone-950/80 ${className}`}
            style={{ overscrollBehavior: "contain" }}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
            {/* 网格背景 */}
            <div
                className="absolute inset-0 pointer-events-none opacity-40 dark:opacity-20"
                style={{
                    backgroundImage: `radial-gradient(circle, currentColor 1px, transparent 1px)`,
                    backgroundSize: `${24 * viewport.zoom}px ${24 * viewport.zoom}px`,
                    backgroundPosition: `${viewport.x}px ${viewport.y}px`,
                }}
            />

            {/* 核心缩放平移图层 */}
            <div
                className="absolute origin-top-left will-change-transform"
                style={{
                    transform: `translate3d(${viewport.x}px, ${viewport.y}px, 0) scale(${viewport.zoom})`,
                }}
            >
                {/* SVG 导线层 */}
                <svg
                    className="absolute inset-0 pointer-events-none overflow-visible"
                    style={{
                        width: rawLayout.bounds.width + 800,
                        height: rawLayout.bounds.height + 800,
                    }}
                >
                    <ComfyFlowConnections
                        edges={edges}
                        nodesMap={nodesMap}
                        selectedNodeId={selectedNodeId}
                        hoveredEdgeId={hoveredEdgeId}
                        onEdgeHover={setHoveredEdgeId}
                    />
                </svg>

                {/* HTML 节点卡片层 */}
                <div className="absolute inset-0 pointer-events-auto">
                    {nodes.map((node) => (
                        <ComfyFlowNode
                            key={node.id}
                            node={node}
                            isSelected={selectedNodeId === node.id}
                            onSelect={handleSelectNode}
                            onNodeDragStart={handleNodeDragStart}
                        />
                    ))}
                </div>
            </div>

            {/* 全屏退出按钮 (仅在全屏模态框内显示) */}
            {isFullscreen && (
                <div
                    className="absolute top-3 right-3 z-30 flex items-center gap-2 rounded-xl border border-stone-200/90 bg-white/95 px-3 py-1.5 shadow-lg backdrop-blur-md dark:border-stone-800 dark:bg-stone-900/95"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                >
                    <span className="text-xs text-stone-500 dark:text-stone-400">按 ESC 键或点击退出</span>
                    <Button
                        size="small"
                        type="primary"
                        danger
                        icon={<X className="size-3.5" />}
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleFullscreen();
                        }}
                    >
                        退出全屏
                    </Button>
                </div>
            )}

            {/* 顶部统计状态徽章 */}
            <div
                className="absolute top-3 left-3 z-20 flex items-center gap-2 rounded-xl border border-stone-200/80 bg-white/90 px-3 py-1.5 text-xs shadow-xs backdrop-blur-md dark:border-stone-800 dark:bg-stone-900/90"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
            >
                <Layers className="size-3.5 text-blue-500" />
                <span className="font-semibold text-stone-800 dark:text-stone-200">
                    {rawLayout.stats.totalNodes} 个节点
                </span>
                <span className="text-stone-300 dark:text-stone-700">|</span>
                <span className="text-stone-500 dark:text-stone-400">
                    {rawLayout.stats.totalEdges} 条连线
                </span>
                {rawLayout.stats.detectedSlots > 0 && (
                    <>
                        <span className="text-stone-300 dark:text-stone-700">|</span>
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">
                            {rawLayout.stats.detectedSlots} 个标注槽位
                        </span>
                    </>
                )}
            </div>

            {/* 悬浮工具栏 (缩放与控制) */}
            <div
                className="absolute bottom-4 right-4 z-20 flex items-center gap-1 rounded-xl border border-stone-200/90 bg-white/95 p-1 shadow-lg backdrop-blur-md dark:border-stone-800 dark:bg-stone-900/95"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
            >
                <Tooltip title="缩小 (滚轮下滑)">
                    <Button
                        size="small"
                        type="text"
                        icon={<Minus className="size-3.5" />}
                        onClick={(e) => {
                            e.stopPropagation();
                            setViewport((prev) => ({
                                ...prev,
                                zoom: Math.max(Number((prev.zoom - 0.1).toFixed(2)), 0.2),
                            }));
                        }}
                    />
                </Tooltip>

                <span className="min-w-[48px] text-center font-mono text-[11px] font-semibold text-stone-600 dark:text-stone-300">
                    {Math.round(viewport.zoom * 100)}%
                </span>

                <Tooltip title="放大 (滚轮上滑)">
                    <Button
                        size="small"
                        type="text"
                        icon={<Plus className="size-3.5" />}
                        onClick={(e) => {
                            e.stopPropagation();
                            setViewport((prev) => ({
                                ...prev,
                                zoom: Math.min(Number((prev.zoom + 0.1).toFixed(2)), 2.5),
                            }));
                        }}
                    />
                </Tooltip>

                <div className="h-4 w-px bg-stone-200 dark:bg-stone-800 mx-0.5" />

                <Tooltip title="自适应居中">
                    <Button
                        size="small"
                        type="text"
                        icon={<Focus className="size-3.5" />}
                        onClick={(e) => {
                            e.stopPropagation();
                            handleFitView();
                        }}
                    />
                </Tooltip>

                <Tooltip title="重置为 100% 居中">
                    <Button
                        size="small"
                        type="text"
                        icon={<RotateCcw className="size-3.5" />}
                        onClick={(e) => {
                            e.stopPropagation();
                            handleCenter100();
                        }}
                    />
                </Tooltip>

                <div className="h-4 w-px bg-stone-200 dark:bg-stone-800 mx-0.5" />

                <Tooltip title={isFullscreen ? "退出全屏 (ESC)" : "全屏放大审查"}>
                    <Button
                        size="small"
                        type="text"
                        icon={isFullscreen ? <Minimize2 className="size-3.5 text-blue-500" /> : <Maximize2 className="size-3.5" />}
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleFullscreen();
                        }}
                    />
                </Tooltip>
            </div>

            {/* 节点详情抽屉 */}
            <ComfyFlowDrawer
                node={selectedNodeData}
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                edges={edges}
                allNodesMap={nodesMap}
                onSelectNode={handleSelectNode}
                modelsMap={modelsMap}
                onModelChange={onModelChange}
                onReloadModels={onReloadModels}
                onSlotOverride={onSlotOverride}
            />
        </div>
    );
}

export interface ComfyFlowGraphProps {
    workflowJson: ComfyuiWorkflowJson;
    modelsMap?: Record<string, { loading: boolean; error?: string; items: ComfyuiModelItem[] }>;
    onModelChange?: (nodeId: string, inputKey: string, nextValue: string) => void;
    onReloadModels?: (category: string, force?: boolean) => void;
    onSlotOverride?: (nodeId: string, slotTitle: string) => void;
    className?: string;
}

export function ComfyFlowGraph({
    workflowJson,
    modelsMap,
    onModelChange,
    onReloadModels,
    onSlotOverride,
    className = "",
}: ComfyFlowGraphProps) {
    const [isFullscreen, setIsFullscreen] = useState(false);

    return (
        <>
            {/* 常规嵌入式画布（永不消失，不展示任何遮挡占位符） */}
            <ComfyFlowCanvas
                workflowJson={workflowJson}
                modelsMap={modelsMap}
                onModelChange={onModelChange}
                onReloadModels={onReloadModels}
                onSlotOverride={onSlotOverride}
                className={className}
                isFullscreen={false}
                onToggleFullscreen={() => setIsFullscreen(true)}
            />

            {/* 全屏放大审查模态窗口（100vw x 100vh，原生 Ant Design Modal 顶级挂载） */}
            <Modal
                open={isFullscreen}
                onCancel={() => setIsFullscreen(false)}
                footer={null}
                width="100vw"
                style={{ top: 0, padding: 0, maxWidth: "100vw", margin: 0 }}
                styles={{
                    content: {
                        height: "100vh",
                        padding: 0,
                        borderRadius: 0,
                        overflow: "hidden",
                    },
                    body: {
                        height: "100vh",
                        padding: 0,
                        overflow: "hidden",
                    },
                }}
                destroyOnClose
                closeIcon={null}
            >
                <div className="relative size-full overflow-hidden bg-stone-100 dark:bg-stone-950">
                    <ComfyFlowCanvas
                        workflowJson={workflowJson}
                        modelsMap={modelsMap}
                        onModelChange={onModelChange}
                        onReloadModels={onReloadModels}
                        onSlotOverride={onSlotOverride}
                        className="size-full"
                        isFullscreen={true}
                        onToggleFullscreen={() => setIsFullscreen(false)}
                    />
                </div>
            </Modal>
        </>
    );
}
