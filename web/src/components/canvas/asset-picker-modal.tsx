import { useEffect, useMemo, useState } from "react";
import { Empty, Input, Modal, Pagination, Segmented, Tabs, Tag, Tooltip } from "antd";
import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";
import { useAssetStore, type Asset } from "@/stores/use-asset-store";
import {
    ALL_POSES,
    POSE_ANGLE_LABELS,
    POSE_SERIES_LIST,
    getPoseImageUrl,
    type PoseAngleKey,
    type PoseItem,
} from "@/lib/canvas/pose-presets";

export type InsertAssetPayload =
    | { kind: "text"; content: string; title: string }
    | { kind: "image"; dataUrl: string; title: string; storageKey?: string }
    | { kind: "video"; url: string; title: string; storageKey?: string; width?: number; height?: number }
    | { kind: "audio"; url: string; title: string; storageKey?: string; durationMs?: number };

type Props = {
    open: boolean;
    defaultTab?: string;
    onInsert: (payload: InsertAssetPayload) => void;
    onClose: () => void;
};

export function AssetPickerModal({ open, defaultTab = "my-assets", onInsert, onClose }: Props) {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState(defaultTab);

    useEffect(() => {
        if (open) setActiveTab(defaultTab || "my-assets");
    }, [defaultTab, open]);

    return (
        <Modal
            title={t("canvas.assetPicker.title")}
            open={open}
            onCancel={onClose}
            footer={null}
            width={900}
            destroyOnHidden
            styles={{ body: { padding: "0 24px 24px", minHeight: 520 } }}
        >
            <Tabs
                activeKey={activeTab}
                onChange={setActiveTab}
                items={[
                    {
                        key: "my-assets",
                        label: t("canvas.assetPicker.tabMyAssets"),
                        children: <MyAssetsTab onInsert={onInsert} />,
                    },
                    {
                        key: "pose-presets",
                        label: t("canvas.assetPicker.tabPosePresets"),
                        children: <PosePresetsTab onInsert={onInsert} />,
                    },
                ]}
            />
        </Modal>
    );
}

const PAGE_SIZE = 8;
const kindOptions = ["all", "text", "image", "video", "audio"];

function PickerCard({ title, kind, cover, onClick }: { title: string; kind: string; cover: string; onClick: () => void }) {
    const { t } = useTranslation();
    return (
        <button
            type="button"
            className="group relative cursor-pointer overflow-hidden rounded-lg border border-stone-200 bg-white text-left transition hover:border-stone-400 hover:shadow-md dark:border-stone-700 dark:bg-stone-900 dark:hover:border-stone-500"
            onClick={onClick}
        >
            {cover ? (
                <img src={cover} alt={title} className="aspect-[4/3] w-full object-cover" />
            ) : (
                <div className="flex aspect-[4/3] items-center justify-center bg-stone-100 p-3 text-center text-xs leading-5 text-stone-500 dark:bg-stone-800 dark:text-stone-400">
                    {title}
                </div>
            )}
            <div className="p-2.5">
                <div className="flex items-center justify-between gap-2">
                    <span className="line-clamp-1 text-xs font-medium text-stone-800 dark:text-stone-200">{title}</span>
                    <Tag className="m-0 shrink-0 text-[10px]">{t(`assets.kinds.${kind}`)}</Tag>
                </div>
            </div>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-stone-950/0 text-sm font-medium text-white opacity-0 transition group-hover:bg-stone-950/55 group-hover:opacity-100">
                {t("canvas.assetPicker.insert")}
            </div>
        </button>
    );
}

function MyAssetsTab({ onInsert }: { onInsert: (payload: InsertAssetPayload) => void }) {
    const { t } = useTranslation();
    const assets = useAssetStore((state) => state.assets);
    const [keyword, setKeyword] = useState("");
    const [kindFilter, setKindFilter] = useState("all");
    const [page, setPage] = useState(1);

    const filtered = useMemo(() => {
        const query = keyword.trim().toLowerCase();
        return assets
            .filter((a) => kindFilter === "all" || a.kind === kindFilter)
            .filter((a) => !query || [a.title, ...(a.tags || [])].join(" ").toLowerCase().includes(query));
    }, [assets, keyword, kindFilter]);

    const visible = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page]);

    useEffect(() => {
        const maxPage = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
        setPage((v) => Math.min(v, maxPage));
    }, [filtered.length]);

    const handleInsert = (asset: Asset) => {
        if (asset.kind === "text") {
            onInsert({ kind: "text", content: asset.data.content, title: asset.title });
        } else if (asset.kind === "video") {
            onInsert({ kind: "video", url: asset.data.url, storageKey: asset.data.storageKey, title: asset.title, width: asset.data.width, height: asset.data.height });
        } else if (asset.kind === "audio") {
            onInsert({ kind: "audio", url: asset.data.url, storageKey: asset.data.storageKey, title: asset.title, durationMs: asset.data.durationMs });
        } else {
            onInsert({ kind: "image", dataUrl: asset.data.dataUrl, storageKey: asset.data.storageKey, title: asset.title });
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
                <Input
                    className="w-56"
                    size="small"
                    prefix={<Search className="size-3.5 text-stone-400" />}
                    placeholder={t("canvas.assetPicker.search")}
                    value={keyword}
                    allowClear
                    onChange={(e) => {
                        setPage(1);
                        setKeyword(e.target.value);
                    }}
                />
                <div className="flex gap-1.5">
                    {kindOptions.map((option) => (
                        <Tag.CheckableTag
                            key={option}
                            checked={kindFilter === option}
                            className={cn("prompt-filter-tag", kindFilter === option && "is-active")}
                            onChange={() => {
                                setPage(1);
                                setKindFilter(option);
                            }}
                        >
                            {option === "all" ? t("common.all") : t(`assets.kinds.${option}`)}
                        </Tag.CheckableTag>
                    ))}
                </div>
            </div>

            {visible.length ? (
                <div className="grid grid-cols-4 gap-3">
                    {visible.map((asset) => (
                        <PickerCard
                            key={asset.id}
                            title={asset.title}
                            kind={asset.kind}
                            cover={asset.coverUrl || (asset.kind === "image" ? asset.data.dataUrl : "")}
                            onClick={() => handleInsert(asset)}
                        />
                    ))}
                </div>
            ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("canvas.assetPicker.empty")} className="py-12" />
            )}

            {filtered.length > PAGE_SIZE && (
                <div className="flex justify-center">
                    <Pagination size="small" current={page} pageSize={PAGE_SIZE} total={filtered.length} onChange={setPage} showSizeChanger={false} />
                </div>
            )}
        </div>
    );
}

function PosePresetsTab({ onInsert }: { onInsert: (payload: InsertAssetPayload) => void }) {
    const { t } = useTranslation();
    const [selectedSeries, setSelectedSeries] = useState<string>("full_single");
    const [selectedCategory, setSelectedCategory] = useState<string>("全部");
    const [keyword, setKeyword] = useState<string>("");
    const [page, setPage] = useState<number>(1);

    const activeSeriesMeta = useMemo(
        () => POSE_SERIES_LIST.find((s) => s.id === selectedSeries) || POSE_SERIES_LIST[0],
        [selectedSeries],
    );

    const filteredPoses = useMemo(() => {
        const query = keyword.trim().toLowerCase();
        return ALL_POSES.filter((item) => {
            if (item.series !== selectedSeries) return false;
            if (selectedCategory !== "全部" && item.category !== selectedCategory) return false;
            if (!query) return true;
            return [item.name, item.id, item.category].some((text) => text.toLowerCase().includes(query));
        });
    }, [keyword, selectedCategory, selectedSeries]);

    const visiblePoses = useMemo(() => {
        return filteredPoses.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    }, [filteredPoses, page]);

    useEffect(() => {
        const maxPage = Math.max(1, Math.ceil(filteredPoses.length / PAGE_SIZE));
        setPage((v) => Math.min(v, maxPage));
    }, [filteredPoses.length]);

    const handleSeriesChange = (value: string | number) => {
        setSelectedSeries(String(value));
        setSelectedCategory("全部");
        setPage(1);
    };

    return (
        <div className="space-y-3">
            {/* 顶栏：系列切换与搜索框 */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-3 dark:border-stone-800">
                <Segmented
                    size="small"
                    options={POSE_SERIES_LIST.map((series) => ({
                        label: `${series.name} (${series.count})`,
                        value: series.id,
                    }))}
                    value={selectedSeries}
                    onChange={handleSeriesChange}
                />
                <Input
                    className="w-52"
                    size="small"
                    prefix={<Search className="size-3.5 text-stone-400" />}
                    placeholder={t("canvas.assetPicker.searchPoses")}
                    value={keyword}
                    allowClear
                    onChange={(e) => {
                        setPage(1);
                        setKeyword(e.target.value);
                    }}
                />
            </div>

            {/* 分类过滤器 */}
            {activeSeriesMeta?.categories?.length ? (
                <div className="flex flex-wrap gap-1.5 py-0.5">
                    {activeSeriesMeta.categories.map((cat) => (
                        <Tag.CheckableTag
                            key={cat}
                            checked={selectedCategory === cat}
                            className={cn("prompt-filter-tag", selectedCategory === cat && "is-active")}
                            onChange={() => {
                                setSelectedCategory(cat);
                                setPage(1);
                            }}
                        >
                            {cat}
                        </Tag.CheckableTag>
                    ))}
                </div>
            ) : null}

            {/* 姿态卡片网格 */}
            {visiblePoses.length ? (
                <div className="grid grid-cols-4 gap-3 pt-1">
                    {visiblePoses.map((pose) => (
                        <PoseCard key={pose.id} pose={pose} onInsert={onInsert} />
                    ))}
                </div>
            ) : (
                <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description={t("canvas.assetPicker.emptyPoses")}
                    className="py-12"
                />
            )}

            {/* 分页器 */}
            {filteredPoses.length > PAGE_SIZE && (
                <div className="flex justify-center pt-2">
                    <Pagination
                        size="small"
                        current={page}
                        pageSize={PAGE_SIZE}
                        total={filteredPoses.length}
                        onChange={setPage}
                        showSizeChanger={false}
                    />
                </div>
            )}
        </div>
    );
}

function PoseCard({ pose, onInsert }: { pose: PoseItem; onInsert: (payload: InsertAssetPayload) => void }) {
    const { t } = useTranslation();
    const defaultAngle: PoseAngleKey = pose.angles.includes("front") ? "front" : pose.angles[0] || "front";
    const [activeAngle, setActiveAngle] = useState<PoseAngleKey>(defaultAngle);

    useEffect(() => {
        if (!pose.angles.includes(activeAngle)) {
            setActiveAngle(defaultAngle);
        }
    }, [activeAngle, defaultAngle, pose.angles]);

    const activeImageUrl = getPoseImageUrl(pose.id, activeAngle);

    const handleCardInsert = () => {
        onInsert({
            kind: "image",
            dataUrl: activeImageUrl,
            title: `${pose.name} (${POSE_ANGLE_LABELS[activeAngle] || activeAngle})`,
        });
    };

    return (
        <div
            className="group relative flex flex-col overflow-hidden rounded-lg border border-stone-200 bg-white transition hover:border-stone-400 hover:shadow-md dark:border-stone-700 dark:bg-stone-900 dark:hover:border-stone-500"
            role="button"
            tabIndex={0}
            onClick={handleCardInsert}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") handleCardInsert();
            }}
        >
            {/* 视角图片预览区域 */}
            <div className="relative aspect-[3/4] w-full overflow-hidden bg-stone-100 dark:bg-stone-800">
                <img
                    src={activeImageUrl}
                    alt={`${pose.name} - ${POSE_ANGLE_LABELS[activeAngle]}`}
                    loading="lazy"
                    className="h-full w-full object-contain p-1 transition duration-200 group-hover:scale-105"
                />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-stone-950/0 text-xs font-medium text-white opacity-0 transition group-hover:bg-stone-950/50 group-hover:opacity-100">
                    <span className="rounded bg-black/60 px-2 py-1 backdrop-blur-sm">
                        {t("canvas.assetPicker.insertAngle")}
                    </span>
                </div>
            </div>

            {/* 卡片信息与视角选择按钮 */}
            <div className="flex flex-1 flex-col justify-between p-2">
                <div>
                    <Tooltip title={pose.name}>
                        <div className="line-clamp-1 text-xs font-medium text-stone-800 dark:text-stone-200">
                            {pose.name}
                        </div>
                    </Tooltip>
                    {pose.category ? (
                        <div className="mt-0.5 text-[10px] text-stone-400 dark:text-stone-500">
                            {pose.category}
                        </div>
                    ) : null}
                </div>

                {/* 机位切换标签 */}
                <div
                    className="mt-1.5 flex flex-wrap items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                >
                    {pose.angles.map((angle) => {
                        const isSelected = activeAngle === angle;
                        return (
                            <button
                                key={angle}
                                type="button"
                                className={cn(
                                    "rounded px-1.5 py-0.5 text-[10px] font-medium transition",
                                    isSelected
                                        ? "bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900"
                                        : "bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700",
                                )}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveAngle(angle);
                                }}
                            >
                                {POSE_ANGLE_LABELS[angle]}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
