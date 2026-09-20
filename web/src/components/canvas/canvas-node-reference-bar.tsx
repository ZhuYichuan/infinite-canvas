import { useState, useMemo, useRef, type DragEvent } from "react";
import { FileText, Image as ImageIcon, Music2, Plus, Puzzle, Video, X } from "lucide-react";
import { Popover } from "antd";
import { useTranslation } from "react-i18next";

import { canvasThemes } from "@/lib/canvas-theme";
import { getNodeDefinition } from "@/lib/canvas/node-registry";
import { getGroupResourceNodes } from "@/lib/canvas/canvas-resource-references";
import { useThemeStore } from "@/stores/use-theme-store";
import { CanvasNodeType, type CanvasNodeData } from "@/types/canvas";

export type CanvasReferenceItemData = {
    node: CanvasNodeData;
    sourceNodeId: string;
    badge: string;
    kind: string;
};

export function CanvasNodeReferenceBar({
    nodeId,
    nodes,
    connectedNodes,
    onDisconnect,
    onStartSelection,
    onReorder,
    onLocateNode,
}: {
    nodeId: string;
    nodes: CanvasNodeData[];
    connectedNodes: CanvasNodeData[];
    onDisconnect?: (fromNodeId: string, toNodeId: string) => void;
    onStartSelection?: (nodeId: string) => void;
    onReorder?: (toNodeId: string, orderedSourceNodeIds: string[]) => void;
    onLocateNode?: (nodeId: string) => void;
}) {
    const { t } = useTranslation();
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const [dragIndex, setDragIndex] = useState<number | null>(null);
    const [dropTarget, setDropTarget] = useState<{ index: number; position: "before" | "after" } | null>(null);

    const items = useMemo<CanvasReferenceItemData[]>(() => {
        const counts: Record<string, number> = { image: 0, video: 0, audio: 0, text: 0 };
        const raw = connectedNodes.flatMap((sourceNode) =>
            (sourceNode.type === CanvasNodeType.Group ? getGroupResourceNodes(sourceNode.id, nodes) : [sourceNode]).map((node) => ({
                node,
                sourceNodeId: sourceNode.id,
            }))
        );
        return raw.map(({ node, sourceNodeId }) => {
            const resource = getNodeDefinition(node.type)?.resource?.(node);
            const kind =
                (resource?.kind as string) ||
                (node.type === CanvasNodeType.Image
                    ? "image"
                    : node.type === CanvasNodeType.Video
                      ? "video"
                      : node.type === CanvasNodeType.Audio
                        ? "audio"
                        : node.type === CanvasNodeType.Text
                          ? "text"
                          : "other");
            const count = counts[kind] ?? 0;
            counts[kind] = count + 1;
            const badge =
                kind === "image"
                    ? `图${count + 1}`
                    : kind === "video"
                      ? `视频${count + 1}`
                      : kind === "audio"
                        ? `音频${count + 1}`
                        : kind === "text"
                          ? `文本${count + 1}`
                          : `${count + 1}`;
            return { node, sourceNodeId, badge, kind };
        });
    }, [connectedNodes, nodes]);

    const handleDragStart = (e: DragEvent, index: number) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", String(index));
        setDragIndex(index);
    };

    const handleDragOver = (e: DragEvent, index: number) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "move";

        if (dragIndex === null || dragIndex === index) {
            setDropTarget(null);
            return;
        }

        const rect = e.currentTarget.getBoundingClientRect();
        const midX = rect.left + rect.width / 2;
        const position = e.clientX < midX ? "before" : "after";
        setDropTarget({ index, position });
    };

    const handleDrop = (e: DragEvent, targetIndex: number) => {
        e.preventDefault();
        e.stopPropagation();

        if (dragIndex === null || dragIndex === targetIndex) {
            setDragIndex(null);
            setDropTarget(null);
            return;
        }

        const rect = e.currentTarget.getBoundingClientRect();
        const midX = rect.left + rect.width / 2;
        const position = e.clientX < midX ? "before" : "after";

        const newItems = [...items];
        const [moved] = newItems.splice(dragIndex, 1);
        let destIndex = targetIndex;
        if (dragIndex < targetIndex) {
            destIndex = position === "before" ? targetIndex - 1 : targetIndex;
        } else {
            destIndex = position === "before" ? targetIndex : targetIndex + 1;
        }
        newItems.splice(destIndex, 0, moved);

        const newOrderedSourceIds = Array.from(new Set(newItems.map((item) => item.sourceNodeId)));
        onReorder?.(nodeId, newOrderedSourceIds);

        setDragIndex(null);
        setDropTarget(null);
    };

    const handleDragEnd = () => {
        setDragIndex(null);
        setDropTarget(null);
    };

    return (
        <div className="mb-2 select-none">
            <div className="mb-1.5 flex items-center justify-between text-[11px] font-medium" style={{ color: theme.node.muted }}>
                <span>{t("canvas.references.title")}</span>
                {items.length > 1 && (
                    <span className="text-[10px] opacity-60">
                        {t("canvas.references.locateOrDrag", "点击定位 · 拖拽重排")}
                    </span>
                )}
            </div>
            <div
                className="thin-scrollbar flex min-h-12 items-center gap-2 overflow-x-auto pb-1"
                onDragOver={(e) => e.preventDefault()}
                onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                        setDropTarget(null);
                    }
                }}
            >
                {items.map((item, index) => {
                    const isDragging = dragIndex === index;
                    const showBefore = dropTarget?.index === index && dropTarget.position === "before";
                    const showAfter = dropTarget?.index === index && dropTarget.position === "after";
                    return (
                        <div key={`${item.sourceNodeId}:${item.node.id}`} className="flex items-center gap-2 shrink-0">
                            {showBefore && (
                                <div
                                    className="h-10 w-1 shrink-0 rounded-full shadow-sm transition-all"
                                    style={{ background: theme.node.activeStroke }}
                                />
                            )}
                            <ReferenceItem
                                item={item}
                                isDragging={isDragging}
                                isAnyDragging={dragIndex !== null}
                                onRemove={() => onDisconnect?.(item.sourceNodeId, nodeId)}
                                onLocate={() => onLocateNode?.(item.node.id)}
                                onDragStart={(e) => handleDragStart(e, index)}
                                onDragOver={(e) => handleDragOver(e, index)}
                                onDrop={(e) => handleDrop(e, index)}
                                onDragEnd={handleDragEnd}
                            />
                            {showAfter && (
                                <div
                                    className="h-10 w-1 shrink-0 rounded-full shadow-sm transition-all"
                                    style={{ background: theme.node.activeStroke }}
                                />
                            )}
                        </div>
                    );
                })}
                <button
                    type="button"
                    className="grid size-12 shrink-0 place-items-center rounded-xl border bg-transparent transition hover:opacity-70"
                    style={{ borderColor: theme.toolbar.border, color: theme.node.muted }}
                    title={t("canvas.references.select")}
                    onClick={() => onStartSelection?.(nodeId)}
                >
                    <Plus className="size-4" />
                </button>
            </div>
        </div>
    );
}

function ReferenceItem({
    item,
    isDragging,
    isAnyDragging,
    onRemove,
    onLocate,
    onDragStart,
    onDragOver,
    onDrop,
    onDragEnd,
}: {
    item: CanvasReferenceItemData;
    isDragging: boolean;
    isAnyDragging: boolean;
    onRemove: () => void;
    onLocate?: () => void;
    onDragStart: (e: DragEvent) => void;
    onDragOver: (e: DragEvent) => void;
    onDrop: (e: DragEvent) => void;
    onDragEnd: () => void;
}) {
    const { t } = useTranslation();
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const node = item.node;
    const resource = getNodeDefinition(node.type)?.resource?.(node);
    const content = node.metadata?.content || resource?.url;
    const draggedRef = useRef(false);

    const Icon =
        resource?.kind === "image" || node.type === CanvasNodeType.Image
            ? ImageIcon
            : resource?.kind === "video" || node.type === CanvasNodeType.Video
              ? Video
              : resource?.kind === "audio" || node.type === CanvasNodeType.Audio
                ? Music2
                : resource?.kind === "text" || node.type === CanvasNodeType.Text
                  ? FileText
                  : Puzzle;

    return (
        <Popover
            placement="topLeft"
            mouseEnterDelay={0.2}
            open={isAnyDragging ? false : undefined}
            content={<ReferencePreview node={node} content={content} badge={item.badge} />}
        >
            <div
                draggable
                onDragStart={(e) => {
                    draggedRef.current = true;
                    onDragStart(e);
                }}
                onDragOver={onDragOver}
                onDrop={onDrop}
                onDragEnd={() => {
                    onDragEnd();
                    setTimeout(() => {
                        draggedRef.current = false;
                    }, 100);
                }}
                onClick={() => {
                    if (draggedRef.current) return;
                    onLocate?.();
                }}
                className={`group relative grid size-12 shrink-0 cursor-grab place-items-center rounded-xl border transition-all active:cursor-grabbing ${
                    isDragging ? "opacity-35 scale-95" : "hover:shadow-sm"
                }`}
                style={{ background: theme.toolbar.activeBg, borderColor: theme.toolbar.border }}
                title={t("canvas.references.locateOrDrag", "点击定位节点，按住拖拽重排")}
            >
                {/* 编号角标 */}
                <span className="pointer-events-none absolute left-0.5 top-0.5 z-10 rounded px-1 py-0.5 text-[9px] font-semibold leading-none text-white bg-black/65 backdrop-blur-xs select-none shadow-xs">
                    {item.badge}
                </span>

                <span className="grid size-full place-items-center overflow-hidden rounded-[inherit] pointer-events-none">
                    {(resource?.kind === "image" || node.type === CanvasNodeType.Image) && content ? (
                        <img src={content} alt="" draggable={false} className="size-full object-cover" />
                    ) : (resource?.kind === "video" || node.type === CanvasNodeType.Video) && content ? (
                        <video src={content} draggable={false} className="size-full object-cover" muted />
                    ) : (
                        <Icon className="size-4 opacity-65" />
                    )}
                </span>

                {/* 移除按钮 */}
                <button
                    type="button"
                    className="absolute right-0 top-0 z-20 grid size-5 place-items-center rounded-full border opacity-0 shadow-sm transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                    style={{ background: theme.toolbar.panel, borderColor: theme.toolbar.border }}
                    aria-label={t("canvas.references.disconnect")}
                    title={t("canvas.references.disconnect")}
                    onMouseDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                        event.stopPropagation();
                        onRemove();
                    }}
                >
                    <X className="size-3" />
                </button>
            </div>
        </Popover>
    );
}

function ReferencePreview({ node, content, badge }: { node: CanvasNodeData; content?: string; badge: string }) {
    const { t } = useTranslation();
    const theme = canvasThemes[useThemeStore((state) => state.theme)];
    const resource = getNodeDefinition(node.type)?.resource?.(node);
    return (
        <div className="space-y-1.5" style={{ color: theme.node.text }}>
            <div
                className="flex items-center justify-between gap-2 border-b pb-1 text-xs font-medium"
                style={{ borderColor: theme.toolbar.border, color: theme.node.muted }}
            >
                <span className="font-semibold" style={{ color: theme.node.text }}>
                    {badge}
                </span>
                <span className="truncate max-w-[180px]">{node.title || t("canvas.references.empty")}</span>
            </div>
            {(resource?.kind === "image" || node.type === CanvasNodeType.Image) && content ? (
                <img src={content} alt={node.title} className="max-h-52 w-72 rounded-lg object-contain" />
            ) : (resource?.kind === "video" || node.type === CanvasNodeType.Video) && content ? (
                <video src={content} className="max-h-52 w-72 rounded-lg" muted controls />
            ) : (resource?.kind === "audio" || node.type === CanvasNodeType.Audio) && content ? (
                <audio src={content} className="w-72" controls />
            ) : (
                <div className="max-h-52 w-72 overflow-auto whitespace-pre-wrap text-sm">
                    {resource?.text || node.metadata?.content || node.metadata?.prompt || node.title || t("canvas.references.empty")}
                </div>
            )}
        </div>
    );
}
