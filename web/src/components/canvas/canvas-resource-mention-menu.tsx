import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronRight, FileText, Image as ImageIcon, Music2, UserRound, Video } from "lucide-react";

import { canvasThemes } from "@/lib/canvas-theme";
import type { CanvasResourceReference, CategorizedCanvasResources } from "@/lib/canvas/canvas-resource-references";

type Props = {
    rect: DOMRect | null;
    query: string;
    categorized: CategorizedCanvasResources;
    theme: (typeof canvasThemes)[keyof typeof canvasThemes];
    activeIndex?: number;
    onSelect: (reference: CanvasResourceReference) => void;
    onClose: () => void;
};

type CategoryKey = "subjects" | "images" | "videos" | "audios" | "texts";

export function CanvasResourceMentionMenu({ rect, query, categorized, theme, activeIndex = 0, onSelect, onClose }: Props) {
    const [activeCategory, setActiveCategory] = useState<CategoryKey | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);

    const trimmedQuery = query.trim().toLowerCase();

    // 当输入关键词搜索时，对所有候选资源进行过滤
    const filteredResults = useMemo(() => {
        if (!trimmedQuery) return null;
        const allItems = [
            ...categorized.images,
            ...categorized.videos,
            ...categorized.audios,
            ...categorized.texts,
            ...categorized.subjects,
        ];
        const seen = new Set<string>();
        const unique = allItems.filter((item) => {
            if (seen.has(item.nodeId)) return false;
            seen.add(item.nodeId);
            return true;
        });
        return unique.filter((item) => {
            const haystack = `${item.label} ${item.title} ${item.text || ""}`.toLowerCase();
            return haystack.includes(trimmedQuery);
        });
    }, [trimmedQuery, categorized]);

    // 监听外部点击与 Esc 关闭
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                onClose();
            }
        };
        const handlePointerDown = (event: PointerEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("pointerdown", handlePointerDown, true);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("pointerdown", handlePointerDown, true);
        };
    }, [onClose]);

    const stopPropagation = (event: ReactPointerEvent | ReactMouseEvent) => {
        event.stopPropagation();
    };

    const menuWidth = 260;
    const submenuWidth = 240;
    const maxMenuHeight = 360;
    const gap = 8;
    const anchor = rect || new DOMRect(16, 16, 0, 0);

    // 弹窗定位计算（防溢出）
    const showAbove = anchor.bottom + gap + maxMenuHeight > window.innerHeight && anchor.top - gap - maxMenuHeight >= 0;
    const top = showAbove ? Math.max(8, anchor.top - gap - maxMenuHeight) : Math.min(window.innerHeight - maxMenuHeight - 8, anchor.bottom + gap);
    const left = Math.max(8, Math.min(window.innerWidth - menuWidth - 8, anchor.left));

    // 二级菜单展示侧向判定（右侧空间不足则向左弹）
    const subLeft = left + menuWidth + gap + submenuWidth > window.innerWidth ? left - submenuWidth - gap : left + menuWidth + gap;

    const categoriesConfig: { key: CategoryKey; label: string; icon: typeof UserRound; count: number }[] = [
        ...(categorized.subjects.length > 0 ? [{ key: "subjects" as const, label: "主体", icon: UserRound, count: categorized.subjects.length }] : []),
        { key: "images", label: "图片", icon: ImageIcon, count: categorized.images.length },
        { key: "videos", label: "视频", icon: Video, count: categorized.videos.length },
        { key: "audios", label: "音频", icon: Music2, count: categorized.audios.length },
        { key: "texts", label: "文本", icon: FileText, count: categorized.texts.length },
    ];

    const currentSubmenuItems = activeCategory ? categorized[activeCategory] : [];

    return createPortal(
        <div
            ref={containerRef}
            data-canvas-no-zoom="true"
            data-canvas-resource-mention-menu="true"
            className="fixed z-[1200] flex text-xs select-none outline-none"
            style={{ left, top }}
            onPointerDown={stopPropagation}
            onMouseDown={stopPropagation}
            onClick={stopPropagation}
        >
            {/* 主菜单 */}
            <div
                className="w-64 overflow-y-auto rounded-2xl border p-2 shadow-2xl backdrop-blur-md transition-all"
                style={{
                    maxHeight: maxMenuHeight,
                    background: theme.toolbar.panel,
                    borderColor: theme.toolbar.border,
                    color: theme.node.text,
                }}
            >
                {/* 搜索状态 */}
                {trimmedQuery ? (
                    <div>
                        <div className="px-2 py-1.5 text-[11px] font-medium opacity-60" style={{ color: theme.node.muted }}>
                            可能的@内容
                        </div>
                        {filteredResults && filteredResults.length > 0 ? (
                            <div className="space-y-0.5">
                                {filteredResults.map((item, idx) => (
                                    <ResourceItemRow
                                        key={item.id}
                                        item={item}
                                        isActive={idx === activeIndex}
                                        theme={theme}
                                        onSelect={() => onSelect(item)}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="px-3 py-4 text-center text-xs opacity-50" style={{ color: theme.node.muted }}>
                                未在画布上找到匹配的资源
                            </div>
                        )}
                    </div>
                ) : (
                    <>
                        {/* 1. 可能的@内容 */}
                        {categorized.possible.length > 0 && (
                            <div className="mb-2">
                                <div className="px-2 py-1 text-[11px] font-medium opacity-60" style={{ color: theme.node.muted }}>
                                    可能的@内容
                                </div>
                                <div className="space-y-0.5">
                                    {categorized.possible.slice(0, 3).map((item, idx) => (
                                        <ResourceItemRow
                                            key={item.id}
                                            item={item}
                                            isActive={idx === activeIndex && activeCategory === null}
                                            theme={theme}
                                            onSelect={() => onSelect(item)}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 2. 添加参考分类 */}
                        <div>
                            <div className="px-2 py-1 text-[11px] font-medium opacity-60" style={{ color: theme.node.muted }}>
                                添加参考
                            </div>
                            <div className="space-y-0.5">
                                {categoriesConfig.map((cat) => {
                                    const Icon = cat.icon;
                                    const isHovered = activeCategory === cat.key;
                                    return (
                                        <button
                                            key={cat.key}
                                            type="button"
                                            className="flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left transition hover:bg-black/5 dark:hover:bg-white/10"
                                            style={{
                                                background: isHovered ? theme.toolbar.activeBg : "transparent",
                                                color: isHovered ? theme.toolbar.activeText : theme.node.text,
                                            }}
                                            onMouseEnter={() => setActiveCategory(cat.key)}
                                            onClick={() => setActiveCategory((prev) => (prev === cat.key ? null : cat.key))}
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <Icon className="size-4 opacity-70" />
                                                <span className="font-medium">{cat.label}</span>
                                                {cat.count > 0 && (
                                                    <span className="text-[10px] opacity-45">({cat.count})</span>
                                                )}
                                            </div>
                                            <ChevronRight className="size-3.5 opacity-40" />
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* 二级子菜单：按分类展示画布中的节点列表 */}
            {activeCategory && !trimmedQuery && (
                <div
                    className="fixed z-[1210] w-60 overflow-y-auto rounded-2xl border p-2 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-100"
                    style={{
                        left: subLeft,
                        top,
                        maxHeight: maxMenuHeight,
                        background: theme.toolbar.panel,
                        borderColor: theme.toolbar.border,
                        color: theme.node.text,
                    }}
                >
                    <div className="mb-1 flex items-center justify-between border-b pb-1.5 px-2 text-[11px] font-semibold opacity-60" style={{ borderColor: theme.toolbar.border, color: theme.node.muted }}>
                        <span>
                            {categoriesConfig.find((c) => c.key === activeCategory)?.label} ({currentSubmenuItems.length})
                        </span>
                    </div>

                    {currentSubmenuItems.length > 0 ? (
                        <div className="space-y-0.5">
                            {currentSubmenuItems.map((item) => (
                                <ResourceItemRow
                                    key={item.id}
                                    item={item}
                                    theme={theme}
                                    onSelect={() => onSelect(item)}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="px-2 py-6 text-center text-xs opacity-50" style={{ color: theme.node.muted }}>
                            画布中暂无此类资源
                        </div>
                    )}
                </div>
            )}
        </div>,
        document.body,
    );
}

function ResourceItemRow({
    item,
    isActive = false,
    theme,
    onSelect,
}: {
    item: CanvasResourceReference;
    isActive?: boolean;
    theme: (typeof canvasThemes)[keyof typeof canvasThemes];
    onSelect: () => void;
}) {
    return (
        <button
            type="button"
            className="flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition hover:bg-black/5 dark:hover:bg-white/10"
            style={{
                background: isActive ? theme.toolbar.activeBg : "transparent",
                color: isActive ? theme.toolbar.activeText : theme.node.text,
            }}
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onSelect();
            }}
        >
            <ItemThumbnail item={item} />
            <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                    <span className="truncate font-medium">{item.title || item.label}</span>
                    {item.connected && (
                        <span className="flex items-center gap-0.5 rounded px-1 py-0.2 text-[9px] text-sky-400 bg-sky-500/15 shrink-0">
                            <Check className="size-2.5" /> 已连线
                        </span>
                    )}
                </div>
                {item.text && (
                    <span className="block truncate text-[10px] opacity-50">{item.text}</span>
                )}
            </div>
        </button>
    );
}

function ItemThumbnail({ item }: { item: CanvasResourceReference }) {
    if (item.kind === "image" && item.previewUrl) {
        return <img src={item.previewUrl} alt="" className="size-8 rounded-lg object-cover shrink-0" />;
    }
    if (item.kind === "video" && item.previewUrl) {
        return <video src={item.previewUrl} className="size-8 rounded-lg bg-black object-cover shrink-0" muted preload="metadata" />;
    }
    const Icon = item.kind === "audio" ? Music2 : item.kind === "video" ? Video : item.kind === "image" ? ImageIcon : FileText;
    return (
        <span className="grid size-8 shrink-0 place-items-center">
            <Icon className="size-4.5 opacity-65" />
        </span>
    );
}
