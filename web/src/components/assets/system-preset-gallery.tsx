import { useEffect, useMemo, useState } from "react";
import { Empty, Input, Pagination, Spin, Switch, Tag, Tooltip, theme as antdTheme } from "antd";
import { Plus, Search } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { InsertAssetPayload } from "@/components/canvas/asset-picker-modal";
import {
    POSE_ANGLE_LABELS,
    POSE_ANGLE_SHORT_LABELS,
    POSE_RENDITIONS,
    SYSTEM_PRESET_CATEGORIES,
    defaultPoseAngle,
    filterPresetAssets,
    loadSystemPresets,
    presetImageUrl,
    presetInsertTitle,
    type PoseAngleKey,
    type PoseRendition,
    type SystemPresetAsset,
    type SystemPresetCategory,
    type SystemPresetDataset,
} from "@/lib/assets/system-presets";
import type { CanvasTheme } from "@/lib/canvas-theme";
import { cn } from "@/lib/utils";

type Props = {
    category: SystemPresetCategory;
    onCategoryChange?: (category: SystemPresetCategory) => void;
    onInsert: (payload: InsertAssetPayload) => void;
    /** 画布侧边栏为窄栏，采用双列卡片；弹窗为四列。 */
    variant?: "modal" | "panel";
    /** 画布面板调色板。传入后图库跟随画布主题取色，不再依赖 Tailwind 深色变体。 */
    canvasTheme?: CanvasTheme;
    className?: string;
};

type PresetPalette = {
    muted: string;
    chipBg: string;
    chipText: string;
    activeBg: string;
    activeText: string;
    cardBg: string;
    cardBorder: string;
    cardHoverBorder: string;
    cardText: string;
};

/** 画布侧栏用画布调色板（与面板底色同源），弹窗用 antd token（已随 ConfigProvider 切换明暗）。 */
function usePresetPalette(canvasTheme?: CanvasTheme): PresetPalette {
    const { token } = antdTheme.useToken();
    return useMemo(() => {
        if (canvasTheme) {
            return {
                muted: canvasTheme.node.muted,
                chipBg: canvasTheme.toolbar.itemHover,
                chipText: canvasTheme.node.muted,
                activeBg: canvasTheme.toolbar.activeBg,
                activeText: canvasTheme.toolbar.activeText,
                cardBg: canvasTheme.node.panel,
                cardBorder: canvasTheme.node.stroke,
                cardHoverBorder: canvasTheme.node.activeStroke,
                cardText: canvasTheme.node.text,
            };
        }
        return {
            muted: token.colorTextSecondary,
            chipBg: token.colorFillSecondary,
            chipText: token.colorTextSecondary,
            activeBg: token.colorBgSpotlight,
            activeText: token.colorTextLightSolid,
            cardBg: token.colorBgContainer,
            cardBorder: token.colorBorderSecondary,
            cardHoverBorder: token.colorBorder,
            cardText: token.colorText,
        };
    }, [canvasTheme, token]);
}

/**
 * 系统预设资产图库：姿态（线稿/深度）、服装、发型三类共用一套浏览与插入交互。
 * 被资产选择弹窗（生图/视频工作台、画布）与画布侧边栏复用。
 */
export function SystemPresetGallery({ category, onCategoryChange, onInsert, variant = "modal", canvasTheme, className }: Props) {
    const { t } = useTranslation();
    const palette = usePresetPalette(canvasTheme);
    const [dataset, setDataset] = useState<SystemPresetDataset | null>(null);
    const [loadError, setLoadError] = useState(false);
    const [reloadToken, setReloadToken] = useState(0);
    const [series, setSeries] = useState("");
    const [group, setGroup] = useState("");
    const [keyword, setKeyword] = useState("");
    const [includeSensitive, setIncludeSensitive] = useState(false);
    const [rendition, setRendition] = useState<PoseRendition>("line");
    const [page, setPage] = useState(1);

    useEffect(() => {
        let cancelled = false;
        setDataset(null);
        setLoadError(false);
        loadSystemPresets(category)
            .then((data) => {
                if (!cancelled) setDataset(data);
            })
            .catch(() => {
                if (!cancelled) setLoadError(true);
            });
        return () => {
            cancelled = true;
        };
    }, [category, reloadToken]);

    // 切换类目时重置筛选，并落在第一个可见系列上
    useEffect(() => {
        setSeries("");
        setGroup("");
        setKeyword("");
        setPage(1);
    }, [category]);

    useEffect(() => {
        setPage(1);
    }, [series, group, keyword, includeSensitive, rendition]);

    const visibleSeries = useMemo(() => (dataset ? dataset.series.filter((item) => includeSensitive || !item.nsfw) : []), [dataset, includeSensitive]);

    const activeSeries = useMemo(() => visibleSeries.find((item) => item.id === series) ?? visibleSeries[0], [series, visibleSeries]);

    const groups = activeSeries?.groups ?? [];

    const assets = useMemo(() => {
        if (!dataset) return [];
        return filterPresetAssets(dataset.assets, {
            series: activeSeries?.id,
            group: group || undefined,
            keyword,
            includeSensitive,
        });
    }, [activeSeries?.id, dataset, group, includeSensitive, keyword]);

    const isPose = category === "pose";
    const columns = variant === "panel" ? 2 : 4;
    const rows = variant === "panel" ? 9 : 6;
    const pageSize = columns * rows;
    const maxPage = Math.max(1, Math.ceil(assets.length / pageSize));
    const currentPage = Math.min(page, maxPage);
    const visibleAssets = assets.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    const gridColumns = variant === "panel" ? "grid-cols-2" : "grid-cols-4";
    const totalCount = dataset ? dataset.assets.filter((asset) => includeSensitive || !asset.nsfw).length : 0;

    if (loadError) {
        return (
            <div className="flex flex-col items-center gap-2 py-16 text-xs text-stone-500">
                <span>{t("systemPresets.loadFailed")}</span>
                <button type="button" className="underline" style={{ color: palette.cardText }} onClick={() => setReloadToken((value) => value + 1)}>
                    {t("systemPresets.retry")}
                </button>
            </div>
        );
    }

    if (!dataset) {
        return (
            <div className="grid place-items-center py-16">
                <Spin size="small" />
            </div>
        );
    }

    return (
        <div className={cn("flex h-full min-h-0 flex-col gap-2.5", className)}>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="thin-scrollbar flex items-center gap-1 overflow-x-auto">
                    {SYSTEM_PRESET_CATEGORIES.map((item) => (
                        <ChipButton key={item} palette={palette} active={item === category} onClick={() => onCategoryChange?.(item)}>
                            {t(`systemPresets.categories.${item}`)}
                        </ChipButton>
                    ))}
                    {isPose ? <span className="mx-1 h-4 w-px shrink-0" style={{ background: palette.cardBorder }} aria-hidden /> : null}
                    {isPose
                        ? POSE_RENDITIONS.map((item) => (
                              <ChipButton key={item} palette={palette} active={item === rendition} onClick={() => setRendition(item)}>
                                  {t(`systemPresets.renditions.${item}`)}
                              </ChipButton>
                          ))
                        : null}
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[11px]" style={{ color: palette.muted }}>
                        {totalCount}
                    </span>
                    <Tooltip title={t("systemPresets.sensitiveHint")}>
                        <label className="flex cursor-pointer items-center gap-1.5 text-[11px]" style={{ color: palette.muted }}>
                            {t("systemPresets.sensitive")}
                            <Switch size="small" checked={includeSensitive} onChange={setIncludeSensitive} />
                        </label>
                    </Tooltip>
                </div>
            </div>

            <Input size="small" allowClear prefix={<Search className="size-3.5 text-stone-400" />} placeholder={t("systemPresets.search")} value={keyword} onChange={(event) => setKeyword(event.target.value)} />

            <div className="thin-scrollbar flex items-center gap-1.5 overflow-x-auto pb-0.5">
                {visibleSeries.map((item) => (
                    <Tag.CheckableTag
                        key={item.id}
                        checked={activeSeries?.id === item.id}
                        className={cn("prompt-filter-tag shrink-0", activeSeries?.id === item.id && "is-active")}
                        onChange={() => {
                            setSeries(item.id);
                            setGroup("");
                        }}
                    >
                        {item.name} ({item.count})
                    </Tag.CheckableTag>
                ))}
            </div>

            {groups.length ? (
                <div className="thin-scrollbar flex items-center gap-1.5 overflow-x-auto pb-0.5">
                    <Tag.CheckableTag checked={!group} className={cn("prompt-filter-tag shrink-0", !group && "is-active")} onChange={() => setGroup("")}>
                        {t("systemPresets.allGroups")}
                    </Tag.CheckableTag>
                    {groups.map((item) => (
                        <Tag.CheckableTag key={item} checked={group === item} className={cn("prompt-filter-tag shrink-0", group === item && "is-active")} onChange={() => setGroup(item)}>
                            {item}
                        </Tag.CheckableTag>
                    ))}
                </div>
            ) : null}

            <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto">
                {visibleAssets.length ? (
                    <div className={cn("grid gap-2 pb-1 pr-0.5", gridColumns)}>
                        {visibleAssets.map((asset) => (
                            <PresetCard key={asset.id} asset={asset} category={category} rendition={rendition} palette={palette} onInsert={onInsert} />
                        ))}
                    </div>
                ) : (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("systemPresets.empty")} className="py-12" />
                )}
            </div>

            {assets.length > pageSize ? (
                <div className="flex shrink-0 items-center justify-center pt-1">
                    <Pagination size="small" simple current={currentPage} pageSize={pageSize} total={assets.length} onChange={setPage} />
                </div>
            ) : null}
        </div>
    );
}

function ChipButton({ active, palette, children, onClick }: { active: boolean; palette: PresetPalette; children: React.ReactNode; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition"
            style={active ? { background: palette.activeBg, color: palette.activeText } : { background: palette.chipBg, color: palette.chipText }}
        >
            {children}
        </button>
    );
}

function PresetCard({ asset, category, rendition, palette, onInsert }: { asset: SystemPresetAsset; category: SystemPresetCategory; rendition: PoseRendition; palette: PresetPalette; onInsert: (payload: InsertAssetPayload) => void }) {
    const { t } = useTranslation();
    const defaultAngle = defaultPoseAngle(asset.angles);
    const [angle, setAngle] = useState<PoseAngleKey>(defaultAngle);

    useEffect(() => {
        setAngle(defaultAngle);
    }, [defaultAngle]);

    const thumbUrl = presetImageUrl(category, asset.id, { tier: "thumb", angle: asset.angles ? angle : undefined, rendition });
    const angleLabel = asset.angles ? POSE_ANGLE_LABELS[angle] : undefined;

    const payload = useMemo<InsertAssetPayload>(
        () => ({
            kind: "image",
            dataUrl: presetImageUrl(category, asset.id, { tier: "full", angle: asset.angles ? angle : undefined, rendition }),
            title: presetInsertTitle(asset, angleLabel),
            promptText: asset.promptText,
        }),
        [angle, angleLabel, asset, category, rendition],
    );

    const handleDragStart = (event: React.DragEvent) => {
        event.dataTransfer.setData("application/infinite-canvas-asset", JSON.stringify(payload));
        event.dataTransfer.effectAllowed = "copy";
    };

    return (
        <div
            draggable
            onDragStart={handleDragStart}
            className="group relative flex cursor-grab flex-col overflow-hidden rounded-lg border transition hover:-translate-y-0.5 hover:border-(--preset-hover-border) hover:shadow-md active:cursor-grabbing"
            style={
                {
                    background: palette.cardBg,
                    borderColor: palette.cardBorder,
                    "--preset-hover-border": palette.cardHoverBorder,
                } as React.CSSProperties
            }
            title={t("systemPresets.dragOrClick")}
        >
            <div className="relative aspect-[3/4] w-full overflow-hidden" style={{ background: palette.chipBg }}>
                <img src={thumbUrl} alt={asset.name} loading="lazy" decoding="async" className="size-full object-contain transition duration-200 group-hover:scale-105" />
                <button
                    type="button"
                    onClick={() => onInsert(payload)}
                    className="absolute inset-0 grid place-items-center bg-stone-950/0 text-white opacity-0 transition group-hover:bg-stone-950/45 group-hover:opacity-100"
                    aria-label={t("systemPresets.insert")}
                    title={t("systemPresets.insert")}
                >
                    <span className="grid size-7 place-items-center rounded-full bg-white/90 text-stone-700 shadow-sm">
                        <Plus className="size-4" />
                    </span>
                </button>
            </div>

            <div className="flex flex-1 flex-col justify-between gap-1 p-1.5">
                <Tooltip title={asset.promptText || asset.name}>
                    <div className="line-clamp-1 text-[11px] font-medium" style={{ color: palette.cardText }}>
                        {asset.name}
                    </div>
                </Tooltip>
                {asset.angles?.length ? (
                    <div className="flex items-center gap-0.5">
                        {asset.angles.map((item) => (
                            <Tooltip key={item} title={POSE_ANGLE_LABELS[item]}>
                                <button
                                    type="button"
                                    className="flex-1 rounded py-0.5 text-center text-[10px] font-medium transition"
                                    style={item === angle ? { background: palette.activeBg, color: palette.activeText } : { background: palette.chipBg, color: palette.chipText }}
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        setAngle(item);
                                    }}
                                >
                                    {POSE_ANGLE_SHORT_LABELS[item]}
                                </button>
                            </Tooltip>
                        ))}
                    </div>
                ) : asset.promptText ? (
                    <div className="line-clamp-2 text-[10px] leading-4" style={{ color: palette.muted }}>
                        {asset.promptText}
                    </div>
                ) : null}
            </div>
        </div>
    );
}
