import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { Camera, Check, ChevronRight, FileText, Image as ImageIcon, Music2, UserRound, Video } from "lucide-react";

import { useDeferredOutsideClick } from "./use-deferred-outside-click";
import { canvasThemes } from "@/lib/canvas-theme";
import type { CanvasResourceReference, CategorizedCanvasResources } from "@/lib/canvas/canvas-resource-references";
import { MOTION_PRESETS, type CanvasMotionPreset } from "@/lib/canvas/canvas-motion-presets";

export type MentionMenuHandle = {
    handleKeyDown: (event: ReactKeyboardEvent<HTMLElement> | KeyboardEvent) => boolean;
};

type Props = {
    rect: DOMRect | null;
    query: string;
    categorized: CategorizedCanvasResources;
    theme: (typeof canvasThemes)[keyof typeof canvasThemes];
    activeIndex?: number;
    showMotionPresets?: boolean;
    onSelect: (reference: CanvasResourceReference) => void;
    onSelectMotion?: (motion: CanvasMotionPreset) => void;
    onClose: () => void;
};

type CategoryKey = "subjects" | "images" | "videos" | "audios" | "texts" | "motions";

export const CanvasResourceMentionMenu = forwardRef<MentionMenuHandle, Props>(function CanvasResourceMentionMenu({
    rect,
    query,
    categorized,
    theme,
    showMotionPresets = true,
    onSelect,
    onSelectMotion,
    onClose,
}, ref) {
    const [nav, setNav] = useState({
        searchIndex: 0,
        mainIndex: 0,
        inSubmenu: false,
        submenuIndex: 0,
        activeCategory: null as CategoryKey | null,
    });
    const navRef = useRef(nav);
    navRef.current = nav;

    const [hoveredMotion, setHoveredMotion] = useState<CanvasMotionPreset | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const activeItemRef = useRef<HTMLButtonElement | null>(null);

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

    const filteredMotions = useMemo(() => {
        if (!trimmedQuery || !showMotionPresets) return [];
        return MOTION_PRESETS.filter(
            (m) => m.name.toLowerCase().includes(trimmedQuery) || m.id.toLowerCase().includes(trimmedQuery) || m.prompt.toLowerCase().includes(trimmedQuery),
        );
    }, [trimmedQuery, showMotionPresets]);

    const categoriesConfig = useMemo(() => [
        ...(categorized.subjects.length > 0 ? [{ key: "subjects" as const, label: "主体", icon: UserRound, count: categorized.subjects.length }] : []),
        { key: "images" as const, label: "图片", icon: ImageIcon, count: categorized.images.length },
        { key: "videos" as const, label: "视频", icon: Video, count: categorized.videos.length },
        { key: "audios" as const, label: "音频", icon: Music2, count: categorized.audios.length },
        { key: "texts" as const, label: "文本", icon: FileText, count: categorized.texts.length },
        ...(showMotionPresets ? [{ key: "motions" as const, label: "运镜", icon: Camera, badge: "New", count: MOTION_PRESETS.length }] : []),
    ], [categorized, showMotionPresets]);

    const possibleItems = useMemo(() => categorized.possible.slice(0, 3), [categorized.possible]);

    const currentSubmenuItems = useMemo(() => {
        if (!nav.activeCategory || nav.activeCategory === "motions") return [];
        return categorized[nav.activeCategory] || [];
    }, [nav.activeCategory, categorized]);

    const updateNav = (updater: (prev: typeof nav) => typeof nav) => {
        const next = updater(navRef.current);
        navRef.current = next;
        setNav(next);
        return next;
    };

    // 重置状态
    useEffect(() => {
        updateNav((prev) => ({
            ...prev,
            searchIndex: 0,
            mainIndex: 0,
            inSubmenu: false,
            submenuIndex: 0,
            activeCategory: null,
        }));
        setHoveredMotion(null);
    }, [trimmedQuery]);

    // 自动滚动高亮项
    useEffect(() => {
        activeItemRef.current?.scrollIntoView({ block: "nearest" });
    }, [nav.searchIndex, nav.mainIndex, nav.submenuIndex, nav.inSubmenu]);

    // 暴露键盘导航处理给输入框
    useImperativeHandle(ref, () => ({
        handleKeyDown(event) {
            const key = event.key;
            const cur = navRef.current;

            // 搜索模式键盘处理
            if (trimmedQuery) {
                const resultsCount = filteredResults?.length || 0;
                const motionsCount = filteredMotions.length;
                const total = resultsCount + motionsCount;
                if (total === 0) return false;

                if (key === "ArrowDown") {
                    event.preventDefault();
                    updateNav((prev) => {
                        const nextIndex = (prev.searchIndex + 1) % total;
                        if (nextIndex >= resultsCount) setHoveredMotion(filteredMotions[nextIndex - resultsCount]);
                        else setHoveredMotion(null);
                        return { ...prev, searchIndex: nextIndex };
                    });
                    return true;
                }
                if (key === "ArrowUp") {
                    event.preventDefault();
                    updateNav((prev) => {
                        const nextIndex = (prev.searchIndex - 1 + total) % total;
                        if (nextIndex >= resultsCount) setHoveredMotion(filteredMotions[nextIndex - resultsCount]);
                        else setHoveredMotion(null);
                        return { ...prev, searchIndex: nextIndex };
                    });
                    return true;
                }
                if (key === "Enter") {
                    event.preventDefault();
                    if (cur.searchIndex < resultsCount && filteredResults) {
                        onSelect(filteredResults[cur.searchIndex]);
                        return true;
                    }
                    const motion = filteredMotions[cur.searchIndex - resultsCount];
                    if (motion) {
                        onSelectMotion?.(motion);
                        return true;
                    }
                    return false;
                }
                if (key === "Escape") {
                    event.preventDefault();
                    onClose();
                    return true;
                }
                return false;
            }

            // 浏览模式（按分类/可能的@内容）
            const totalMain = possibleItems.length + categoriesConfig.length;

            if (key === "ArrowDown") {
                event.preventDefault();
                if (cur.inSubmenu) {
                    const subCount = cur.activeCategory === "motions" ? MOTION_PRESETS.length : currentSubmenuItems.length;
                    if (subCount > 0) {
                        updateNav((prev) => {
                            const nextSub = (prev.submenuIndex + 1) % subCount;
                            if (prev.activeCategory === "motions") setHoveredMotion(MOTION_PRESETS[nextSub]);
                            return { ...prev, submenuIndex: nextSub };
                        });
                    }
                } else {
                    updateNav((prev) => {
                        const nextMain = (prev.mainIndex + 1) % totalMain;
                        let nextCategory: CategoryKey | null = null;
                        if (nextMain >= possibleItems.length) {
                            nextCategory = categoriesConfig[nextMain - possibleItems.length].key;
                            if (nextCategory === "motions") setHoveredMotion(MOTION_PRESETS[0]);
                            else setHoveredMotion(null);
                        } else {
                            setHoveredMotion(null);
                        }
                        return { ...prev, mainIndex: nextMain, activeCategory: nextCategory };
                    });
                }
                return true;
            }

            if (key === "ArrowUp") {
                event.preventDefault();
                if (cur.inSubmenu) {
                    const subCount = cur.activeCategory === "motions" ? MOTION_PRESETS.length : currentSubmenuItems.length;
                    if (subCount > 0) {
                        updateNav((prev) => {
                            const nextSub = (prev.submenuIndex - 1 + subCount) % subCount;
                            if (prev.activeCategory === "motions") setHoveredMotion(MOTION_PRESETS[nextSub]);
                            return { ...prev, submenuIndex: nextSub };
                        });
                    }
                } else {
                    updateNav((prev) => {
                        const nextMain = (prev.mainIndex - 1 + totalMain) % totalMain;
                        let nextCategory: CategoryKey | null = null;
                        if (nextMain >= possibleItems.length) {
                            nextCategory = categoriesConfig[nextMain - possibleItems.length].key;
                            if (nextCategory === "motions") setHoveredMotion(MOTION_PRESETS[0]);
                            else setHoveredMotion(null);
                        } else {
                            setHoveredMotion(null);
                        }
                        return { ...prev, mainIndex: nextMain, activeCategory: nextCategory };
                    });
                }
                return true;
            }

            if (key === "ArrowRight") {
                if (!cur.inSubmenu && cur.activeCategory) {
                    event.preventDefault();
                    updateNav((prev) => ({ ...prev, inSubmenu: true, submenuIndex: 0 }));
                    if (cur.activeCategory === "motions") setHoveredMotion(MOTION_PRESETS[0]);
                    return true;
                }
                return false;
            }

            if (key === "ArrowLeft") {
                if (cur.inSubmenu) {
                    event.preventDefault();
                    updateNav((prev) => ({ ...prev, inSubmenu: false }));
                    return true;
                }
                return false;
            }

            if (key === "Enter") {
                event.preventDefault();
                if (cur.inSubmenu) {
                    if (cur.activeCategory === "motions") {
                        const motion = MOTION_PRESETS[cur.submenuIndex];
                        if (motion) onSelectMotion?.(motion);
                        return true;
                    }
                    const item = currentSubmenuItems[cur.submenuIndex];
                    if (item) onSelect(item);
                    return true;
                }
                if (cur.mainIndex < possibleItems.length) {
                    const item = possibleItems[cur.mainIndex];
                    if (item) onSelect(item);
                    return true;
                }
                if (cur.activeCategory) {
                    updateNav((prev) => ({ ...prev, inSubmenu: true, submenuIndex: 0 }));
                    if (cur.activeCategory === "motions") setHoveredMotion(MOTION_PRESETS[0]);
                    return true;
                }
                return false;
            }

            if (key === "Escape") {
                event.preventDefault();
                if (cur.inSubmenu) {
                    updateNav((prev) => ({ ...prev, inSubmenu: false }));
                    return true;
                }
                onClose();
                return true;
            }

            return false;
        },
    }));

    useDeferredOutsideClick({
        open: true,
        onClose,
        ignoreRefs: [containerRef],
    });

    const stopPropagation = (event: ReactPointerEvent | ReactMouseEvent) => {
        event.stopPropagation();
    };

    const menuWidth = 260;
    const submenuWidth = 240;
    const maxMenuHeight = 380;
    const gap = 8;
    const anchor = rect || new DOMRect(16, 16, 0, 0);

    // 弹窗定位计算（防溢出）
    const showAbove = anchor.bottom + gap + maxMenuHeight > window.innerHeight && anchor.top - gap - maxMenuHeight >= 0;
    const top = showAbove ? Math.max(8, anchor.top - gap - maxMenuHeight) : Math.min(window.innerHeight - maxMenuHeight - 8, anchor.bottom + gap);
    const left = Math.max(8, Math.min(window.innerWidth - menuWidth - 8, anchor.left));

    // 二级菜单展示侧向判定（右侧空间不足则向左弹）
    const subLeft = left + menuWidth + gap + submenuWidth > window.innerWidth ? left - submenuWidth - gap : left + menuWidth + gap;

    return createPortal(
        <div
            ref={containerRef}
            data-canvas-no-zoom="true"
            data-canvas-resource-mention-menu="true"
            className="fixed z-[1200] flex text-xs select-none outline-none"
            style={{ left, top }}
            onPointerDown={stopPropagation}
            onMouseDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
            }}
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
                                        ref={idx === nav.searchIndex ? activeItemRef : undefined}
                                        item={item}
                                        isActive={idx === nav.searchIndex}
                                        theme={theme}
                                        onMouseEnter={() => {
                                            updateNav((prev) => ({ ...prev, searchIndex: idx }));
                                            setHoveredMotion(null);
                                        }}
                                        onSelect={() => onSelect(item)}
                                    />
                                ))}
                            </div>
                        ) : null}

                        {filteredMotions.length > 0 && (
                            <div className="mt-2">
                                <div className="px-2 py-1 text-[11px] font-medium opacity-60" style={{ color: theme.node.muted }}>
                                    运镜预设
                                </div>
                                <div className="space-y-0.5">
                                    {filteredMotions.map((motion, idx) => {
                                        const isMotionActive = idx + (filteredResults?.length || 0) === nav.searchIndex;
                                        return (
                                            <MotionItemRow
                                                key={motion.id}
                                                ref={isMotionActive ? activeItemRef : undefined}
                                                motion={motion}
                                                theme={theme}
                                                isHovered={isMotionActive || hoveredMotion?.id === motion.id}
                                                onMouseEnter={() => {
                                                    setHoveredMotion(motion);
                                                    updateNav((prev) => ({ ...prev, searchIndex: idx + (filteredResults?.length || 0) }));
                                                }}
                                                onSelect={() => onSelectMotion?.(motion)}
                                            />
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {(!filteredResults || filteredResults.length === 0) && filteredMotions.length === 0 && (
                            <div className="px-3 py-4 text-center text-xs opacity-50" style={{ color: theme.node.muted }}>
                                未在画布上找到匹配的资源
                            </div>
                        )}
                    </div>
                ) : (
                    <>
                        {/* 1. 可能的@内容 */}
                        {possibleItems.length > 0 && (
                            <div className="mb-2">
                                <div className="px-2 py-1 text-[11px] font-medium opacity-60" style={{ color: theme.node.muted }}>
                                    可能的@内容
                                </div>
                                <div className="space-y-0.5">
                                    {possibleItems.map((item, idx) => {
                                        const isItemActive = !nav.inSubmenu && idx === nav.mainIndex && nav.activeCategory === null;
                                        return (
                                            <ResourceItemRow
                                                key={item.id}
                                                ref={isItemActive ? activeItemRef : undefined}
                                                item={item}
                                                isActive={isItemActive}
                                                theme={theme}
                                                onMouseEnter={() => {
                                                    updateNav((prev) => ({
                                                        ...prev,
                                                        mainIndex: idx,
                                                        activeCategory: null,
                                                        inSubmenu: false,
                                                    }));
                                                    setHoveredMotion(null);
                                                }}
                                                onSelect={() => onSelect(item)}
                                            />
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* 2. 添加参考分类 */}
                        <div>
                            <div className="px-2 py-1 text-[11px] font-medium opacity-60" style={{ color: theme.node.muted }}>
                                添加参考
                            </div>
                            <div className="space-y-0.5">
                                {categoriesConfig.map((cat, catIdx) => {
                                    const Icon = cat.icon;
                                    const isFocused = !nav.inSubmenu && nav.mainIndex === possibleItems.length + catIdx;
                                    const isOpen = nav.activeCategory === cat.key;
                                    const isHighlighted = isFocused || isOpen;
                                    return (
                                        <button
                                            key={cat.key}
                                            ref={isFocused ? activeItemRef : undefined}
                                            type="button"
                                            className="flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left transition hover:bg-black/5 dark:hover:bg-white/10"
                                            style={{
                                                background: isHighlighted ? theme.toolbar.activeBg : "transparent",
                                                color: isHighlighted ? theme.toolbar.activeText : theme.node.text,
                                            }}
                                            onMouseEnter={() => {
                                                updateNav((prev) => ({
                                                    ...prev,
                                                    mainIndex: possibleItems.length + catIdx,
                                                    activeCategory: cat.key,
                                                    inSubmenu: false,
                                                }));
                                                if (cat.key === "motions") {
                                                    setHoveredMotion(MOTION_PRESETS[0]);
                                                } else {
                                                    setHoveredMotion(null);
                                                }
                                            }}
                                            onClick={() => {
                                                updateNav((prev) => ({
                                                    ...prev,
                                                    activeCategory: prev.activeCategory === cat.key ? null : cat.key,
                                                    inSubmenu: true,
                                                    submenuIndex: 0,
                                                }));
                                            }}
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <Icon className="size-4 opacity-70" />
                                                <span className="font-medium">{cat.label}</span>
                                                {cat.badge && (
                                                    <span className="rounded bg-sky-500/15 px-1 py-0.2 text-[9px] font-semibold text-sky-400">
                                                        {cat.badge}
                                                    </span>
                                                )}
                                                {typeof cat.count === "number" && cat.count > 0 && !cat.badge && (
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

            {/* 二级子菜单：展示普通分类资源 或 运镜预设 */}
            {nav.activeCategory && !trimmedQuery && (
                <div
                    className="fixed z-[1210] w-64 overflow-y-auto rounded-2xl border p-2 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-100"
                    style={{
                        left: subLeft,
                        top,
                        maxHeight: maxMenuHeight,
                        background: theme.toolbar.panel,
                        borderColor: theme.toolbar.border,
                        color: theme.node.text,
                    }}
                >
                    {nav.activeCategory === "motions" ? (
                        <>
                            <div className="mb-1 flex items-center justify-between border-b pb-1.5 px-2 text-[11px] font-semibold opacity-60" style={{ borderColor: theme.toolbar.border, color: theme.node.muted }}>
                                <span>运镜预设 ({MOTION_PRESETS.length})</span>
                            </div>
                            <div className="space-y-0.5">
                                {MOTION_PRESETS.map((motion, idx) => {
                                    const isSubActive = nav.inSubmenu && idx === nav.submenuIndex;
                                    return (
                                        <MotionItemRow
                                            key={motion.id}
                                            ref={isSubActive ? activeItemRef : undefined}
                                            motion={motion}
                                            theme={theme}
                                            isHovered={isSubActive || hoveredMotion?.id === motion.id}
                                            onMouseEnter={() => {
                                                updateNav((prev) => ({
                                                    ...prev,
                                                    inSubmenu: true,
                                                    submenuIndex: idx,
                                                }));
                                                setHoveredMotion(motion);
                                            }}
                                            onSelect={() => onSelectMotion?.(motion)}
                                        />
                                    );
                                })}
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="mb-1 flex items-center justify-between border-b pb-1.5 px-2 text-[11px] font-semibold opacity-60" style={{ borderColor: theme.toolbar.border, color: theme.node.muted }}>
                                <span>
                                    {categoriesConfig.find((c) => c.key === nav.activeCategory)?.label} ({currentSubmenuItems.length})
                                </span>
                            </div>

                            {currentSubmenuItems.length > 0 ? (
                                <div className="space-y-0.5">
                                    {currentSubmenuItems.map((item, idx) => {
                                        const isSubActive = nav.inSubmenu && idx === nav.submenuIndex;
                                        return (
                                            <ResourceItemRow
                                                key={item.id}
                                                ref={isSubActive ? activeItemRef : undefined}
                                                item={item}
                                                isActive={isSubActive}
                                                theme={theme}
                                                onMouseEnter={() => {
                                                    updateNav((prev) => ({
                                                        ...prev,
                                                        inSubmenu: true,
                                                        submenuIndex: idx,
                                                    }));
                                                }}
                                                onSelect={() => onSelect(item)}
                                            />
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="px-2 py-6 text-center text-xs opacity-50" style={{ color: theme.node.muted }}>
                                    画布中暂无此类资源
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* 三级浮层：悬浮运镜项时，展示微视频循环预览 */}
            {hoveredMotion && (nav.activeCategory === "motions" || (trimmedQuery && filteredMotions.length > 0)) && (
                <MotionPreviewCard
                    motion={hoveredMotion}
                    theme={theme}
                    anchorLeft={subLeft}
                    submenuWidth={submenuWidth}
                    anchorTop={top}
                />
            )}
        </div>,
        document.body,
    );
});

const MotionItemRow = forwardRef<
    HTMLButtonElement,
    {
        motion: CanvasMotionPreset;
        theme: (typeof canvasThemes)[keyof typeof canvasThemes];
        isHovered: boolean;
        onMouseEnter: () => void;
        onSelect: () => void;
    }
>(function MotionItemRow({ motion, theme, isHovered, onMouseEnter, onSelect }, ref) {
    return (
        <button
            ref={ref}
            type="button"
            className="flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition hover:bg-black/5 dark:hover:bg-white/10"
            style={{
                background: isHovered ? theme.toolbar.activeBg : "transparent",
                color: isHovered ? theme.toolbar.activeText : theme.node.text,
            }}
            onMouseEnter={onMouseEnter}
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onSelect();
            }}
        >
            <video
                src={motion.video}
                muted
                preload="metadata"
                className="size-8 rounded-lg bg-black object-cover shrink-0 pointer-events-none"
            />
            <span className="truncate font-medium flex-1">{motion.name}</span>
        </button>
    );
});

function MotionPreviewCard({
    motion,
    theme,
    anchorLeft,
    submenuWidth,
    anchorTop,
}: {
    motion: CanvasMotionPreset;
    theme: (typeof canvasThemes)[keyof typeof canvasThemes];
    anchorLeft: number;
    submenuWidth: number;
    anchorTop: number;
}) {
    const previewWidth = 220;
    const gap = 8;
    const previewLeft =
        anchorLeft + submenuWidth + gap + previewWidth > window.innerWidth
            ? Math.max(8, anchorLeft - previewWidth - gap)
            : anchorLeft + submenuWidth + gap;

    const [progress, setProgress] = useState(0);

    return (
        <div
            className="fixed z-[1220] w-[220px] overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150"
            style={{
                left: previewLeft,
                top: anchorTop,
                background: theme.toolbar.panel,
                borderColor: theme.toolbar.border,
                color: theme.node.text,
            }}
        >
            <div className="relative aspect-square w-full overflow-hidden bg-black">
                <video
                    key={motion.id}
                    src={motion.video}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="size-full object-cover"
                    onTimeUpdate={(e) => {
                        const v = e.currentTarget;
                        if (v.duration) {
                            setProgress((v.currentTime / v.duration) * 100);
                        }
                    }}
                />
                {/* 底部播放进度条 */}
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black/40">
                    <div
                        className="h-full bg-white transition-[width] duration-75"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>
            <div className="p-3">
                <div className="flex items-center gap-1.5 font-semibold text-xs mb-1">
                    <Camera className="size-3.5 text-sky-400" />
                    <span>{motion.name}</span>
                </div>
                <div className="text-[11px] leading-4 opacity-70 line-clamp-3">
                    {motion.prompt}
                </div>
            </div>
        </div>
    );
}

const ResourceItemRow = forwardRef<
    HTMLButtonElement,
    {
        item: CanvasResourceReference;
        isActive?: boolean;
        theme: (typeof canvasThemes)[keyof typeof canvasThemes];
        onMouseEnter?: () => void;
        onSelect: () => void;
    }
>(function ResourceItemRow({ item, isActive = false, theme, onMouseEnter, onSelect }, ref) {
    return (
        <button
            ref={ref}
            type="button"
            className="flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition hover:bg-black/5 dark:hover:bg-white/10"
            style={{
                background: isActive ? theme.toolbar.activeBg : "transparent",
                color: isActive ? theme.toolbar.activeText : theme.node.text,
            }}
            onMouseEnter={onMouseEnter}
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
});

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
