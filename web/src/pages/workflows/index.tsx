import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
    AlertCircle,
    Check,
    Code2,
    Copy,
    Cpu,
    Download,
    Layers,
    Network,
    RefreshCw,
    RotateCcw,
    Save,
    Sparkles,
    Star,
    Workflow as WorkflowIcon,
} from "lucide-react";
import { App, Button, Empty, Input, Segmented, Select, Tag, Tooltip } from "antd";

import { ComfyFlowGraph } from "@/components/workflow-graph/comfy-flow-graph";

import {
    getChannelWorkflows,
    getDefaultComfyWorkflowItems,
    useConfigStore,
    useEffectiveConfig,
    type ComfyWorkflowItem,
    type WorkflowCategory,
} from "@/stores/use-config-store";
import { useThemeStore } from "@/stores/use-theme-store";
import {
    fetchComfyuiModels,
    findWorkflowSelectNodes,
    updateWorkflowNodeInput,
    type ComfyuiModelItem,
    type ComfyuiWorkflowJson,
} from "@/services/api/comfyui";
import { useCopyText } from "@/hooks/use-copy-text";

function formatFileSize(bytes?: number): string {
    if (!bytes || bytes <= 0) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const CATEGORY_KEYS = [
    "all",
    "t2i",
    "i2i",
    "inpaint",
    "text",
    "omniVideo",
    "frameVideo",
    "audio",
    "faceRefine",
    "depthVideo",
] as const;

export default function WorkflowsPage() {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const copyText = useCopyText();
    const [searchParams] = useSearchParams();

    const categoryTabs = useMemo(
        () =>
            CATEGORY_KEYS.map((key) => ({
                key,
                label: t(`workflowsPage.categories.${key}`),
            })),
        [t],
    );

    const queryChannelId = searchParams.get("channelId");
    const queryWorkflowId = searchParams.get("id");
    const queryCategory = searchParams.get("category");

    const config = useEffectiveConfig();
    const saveWorkflowGlobally = useConfigStore((state) => state.saveWorkflowGlobally);
    const setChannelDefaultWorkflow = useConfigStore((state) => state.setChannelDefaultWorkflow);
    const resetChannelWorkflowToBuiltin = useConfigStore((state) => state.resetChannelWorkflowToBuiltin);

    // 当前渠道及基准端点（若 URL 传了 channelId 则锁定对应渠道，否则使用当前默认 ComfyUI 渠道）
    const primaryChannel = useMemo(() => {
        if (queryChannelId) {
            const found = config.channels?.find((c) => c.id === queryChannelId);
            if (found) return found;
        }
        return config.channels?.find((c) => c.apiFormat === "comfyui") || config.channels?.[0];
    }, [config.channels, queryChannelId]);

    const comfyEndpoint = useMemo(() => {
        return primaryChannel?.comfyuiProxyUrl || (primaryChannel?.id === "local" ? "http://127.0.0.1:8188" : "http://127.0.0.1:8188");
    }, [primaryChannel]);

    // 当前所有工作流列表
    const allWorkflows = useMemo(() => {
        return getChannelWorkflows(primaryChannel);
    }, [primaryChannel]);

    const theme = useThemeStore((state) => state.theme);
    const isDark = theme === "dark";

    // 分类筛选与搜索
    const [selectedCategory, setSelectedCategory] = useState(queryCategory || "all");
    const [searchKeyword, setSearchKeyword] = useState("");

    // 当前选中的正在编辑的工作流
    const [activeWorkflowId, setActiveWorkflowId] = useState<string>(queryWorkflowId || "");

    // 响应 URL 参数变化定位目标工作流与分类
    useEffect(() => {
        if (queryCategory) {
            setSelectedCategory(queryCategory);
        }
        if (queryWorkflowId) {
            const found = allWorkflows.find((w) => w.id === queryWorkflowId || w.name === queryWorkflowId);
            if (found) {
                setActiveWorkflowId(found.id);
            }
        }
    }, [queryCategory, queryWorkflowId, allWorkflows]);

    const filteredWorkflows = useMemo(() => {
        return allWorkflows.filter((wf) => {
            const matchesCat = selectedCategory === "all" || wf.category === selectedCategory;
            const matchesKw = !searchKeyword.trim() || wf.name.toLowerCase().includes(searchKeyword.toLowerCase().trim());
            return matchesCat && matchesKw;
        });
    }, [allWorkflows, selectedCategory, searchKeyword]);

    useEffect(() => {
        if (!filteredWorkflows.length) {
            setActiveWorkflowId("");
            return;
        }
        if (!activeWorkflowId || !filteredWorkflows.some((w) => w.id === activeWorkflowId)) {
            setActiveWorkflowId(filteredWorkflows[0].id);
        }
    }, [filteredWorkflows, activeWorkflowId]);

    const activeWorkflow = useMemo(() => {
        return allWorkflows.find((w) => w.id === activeWorkflowId) || filteredWorkflows[0] || null;
    }, [allWorkflows, activeWorkflowId, filteredWorkflows]);

    // 检查是否有系统出厂内置对应项
    const builtinCounterpart = useMemo(() => {
        if (!primaryChannel || !activeWorkflow) return null;
        const defaults = getDefaultComfyWorkflowItems(primaryChannel);
        return defaults.find((w) => w.id === activeWorkflow.id || w.name === activeWorkflow.name) || null;
    }, [primaryChannel, activeWorkflow]);

    // 编辑状态
    const [currentJson, setCurrentJson] = useState<ComfyuiWorkflowJson>({});
    const [currentName, setCurrentName] = useState("");
    const [currentDesc, setCurrentDesc] = useState("");
    const [isDirty, setIsDirty] = useState(false);
    const [copied, setCopied] = useState(false);
    const [viewMode, setViewMode] = useState<"graph" | "json">("graph");

    // 切换工作流时重置本地状态
    useEffect(() => {
        if (!activeWorkflow) return;
        setCurrentName(activeWorkflow.name || "");
        setCurrentDesc(activeWorkflow.description || "");
        setCurrentJson(activeWorkflow.json ? JSON.parse(JSON.stringify(activeWorkflow.json)) : {});
        setIsDirty(false);
    }, [activeWorkflow]);

    // 提取当前正在编辑工作流中的选择节点
    const selectNodes = useMemo(() => {
        return findWorkflowSelectNodes(currentJson);
    }, [currentJson]);

    // 独立缓存各分类模型（例如 diffusion_models, clip / text_encoders）
    const [modelsMap, setModelsMap] = useState<
        Record<string, { loading: boolean; error?: string; items: ComfyuiModelItem[] }>
    >({});

    const loadModelsForCategory = async (category: string, force = false) => {
        const catKey = category.trim().toLowerCase();
        if (!force && modelsMap[catKey]?.items?.length) return;

        setModelsMap((prev) => ({
            ...prev,
            [catKey]: { loading: true, error: undefined, items: prev[catKey]?.items || [] },
        }));

        try {
            const list = await fetchComfyuiModels(catKey, comfyEndpoint, primaryChannel?.comfyuiProxyToken);
            setModelsMap((prev) => ({
                ...prev,
                [catKey]: { loading: false, error: undefined, items: list },
            }));
        } catch (err) {
            const msg = err instanceof Error ? err.message : t("workflowsPage.fetchModelFailed");
            setModelsMap((prev) => ({
                ...prev,
                [catKey]: { loading: false, error: msg, items: prev[catKey]?.items || [] },
            }));
        }
    };

    // 自动触发当前工作流所需模型的加载
    useEffect(() => {
        for (const node of selectNodes) {
            if (node.modelType) {
                void loadModelsForCategory(node.modelType);
            }
        }
    }, [selectNodes, comfyEndpoint]);

    // 下拉框修改模型
    const handleModelChange = (nodeId: string, inputKey: string, nextValue: string) => {
        const nextJson = updateWorkflowNodeInput(currentJson, nodeId, inputKey, nextValue);
        setCurrentJson(nextJson);
        setIsDirty(true);
    };

    // 全局保存（全渠道即时生效）
    const handleSaveGlobal = () => {
        if (!activeWorkflow) return;
        const updatedWorkflow: ComfyWorkflowItem = {
            ...activeWorkflow,
            name: currentName.trim() || activeWorkflow.name,
            description: currentDesc.trim(),
            json: currentJson,
            isBuiltin: false,
            createdAt: Date.now(),
        };

        saveWorkflowGlobally(updatedWorkflow);
        setIsDirty(false);
        message.success(t("workflowsPage.saveSuccess", { name: updatedWorkflow.name }));
    };

    // 恢复系统内置出厂版本
    const handleReset = () => {
        if (!primaryChannel || !activeWorkflow || !builtinCounterpart) return;
        resetChannelWorkflowToBuiltin(primaryChannel.id, activeWorkflow.id);
        setCurrentName(builtinCounterpart.name);
        setCurrentDesc(builtinCounterpart.description || "");
        setCurrentJson(JSON.parse(JSON.stringify(builtinCounterpart.json)));
        setIsDirty(false);
        message.success(t("workflowsPage.resetDefaultSuccess", { name: builtinCounterpart.name }));
    };

    // 导出文件
    const handleExportJson = () => {
        const jsonStr = JSON.stringify(currentJson, null, 2);
        const blob = new Blob([jsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${currentName || "workflow"}_api.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // 复制代码
    const handleCopyJson = async () => {
        const jsonStr = JSON.stringify(currentJson, null, 2);
        await copyText(jsonStr);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        message.success(t("workflowsPage.copySuccess"));
    };

    const isCustom = activeWorkflow && !activeWorkflow.isBuiltin;
    const jsonString = JSON.stringify(currentJson, null, 2);

    return (
        <main className="flex h-full flex-col overflow-hidden bg-background text-foreground">
            {/* 顶栏信息与分类导航条 */}
            <div className="shrink-0 border-b border-stone-200 bg-background/95 px-6 pt-4 pb-3 backdrop-blur-md dark:border-stone-800">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <WorkflowIcon className="size-5 text-blue-500" />
                            <h1 className="text-lg font-semibold text-stone-950 dark:text-stone-100">
                                {t("workflowsPage.title")}
                            </h1>
                        </div>
                        <p className="mt-0.5 text-xs text-stone-500">
                            {t("workflowsPage.description")}
                        </p>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                        <span className="text-stone-400">{t("workflowsPage.instance")}</span>
                        <code className="rounded bg-stone-100 px-2 py-0.5 font-mono text-[11px] text-stone-700 dark:bg-stone-800 dark:text-stone-300">
                            {comfyEndpoint}
                        </code>
                    </div>
                </div>

                {/* 分类标签栏与搜索 */}
                <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                        {categoryTabs.map((tab) => {
                            const active = selectedCategory === tab.key;
                            return (
                                <button
                                    key={tab.key}
                                    type="button"
                                    onClick={() => setSelectedCategory(tab.key)}
                                    className={`rounded-full px-3.5 py-1 text-xs font-medium transition cursor-pointer select-none ${
                                        active
                                            ? isDark
                                                ? "bg-white text-stone-950 font-semibold shadow-xs"
                                                : "bg-stone-900 text-white font-semibold shadow-xs"
                                            : isDark
                                                ? "bg-stone-800/80 text-stone-400 hover:bg-stone-700 hover:text-stone-200"
                                                : "bg-stone-100 text-stone-600 hover:bg-stone-200/80 hover:text-stone-900"
                                    }`}
                                    style={
                                        active
                                            ? isDark
                                                ? { backgroundColor: "#ffffff", color: "#0c0a09" }
                                                : { backgroundColor: "#1c1917", color: "#ffffff" }
                                            : undefined
                                    }
                                >
                                    <span
                                        style={
                                            active
                                                ? isDark
                                                    ? { color: "#0c0a09" }
                                                    : { color: "#ffffff" }
                                                : undefined
                                        }
                                    >
                                        {tab.label}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    <div className="w-48">
                        <Input
                            size="small"
                            allowClear
                            placeholder={t("workflowsPage.searchPlaceholder")}
                            value={searchKeyword}
                            onChange={(e) => setSearchKeyword(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* 工作台主体：左侧列表 + 右侧可视化参数编辑器 */}
            <div className="flex min-h-0 flex-1 overflow-hidden">
                {/* 左栏：工作流条目列表 */}
                <div className="thin-scrollbar flex w-72 shrink-0 flex-col overflow-y-auto border-r border-stone-200 bg-stone-50/50 p-3 sm:w-80 dark:border-stone-800 dark:bg-stone-900/30">
                    <div className="mb-2 px-1 text-[11px] font-semibold tracking-wider text-stone-500 uppercase dark:text-stone-400">
                        {t("workflowsPage.workflowList", { count: filteredWorkflows.length })}
                    </div>
                    <div className="space-y-1.5">
                        {filteredWorkflows.map((wf) => {
                            const isSelected = wf.id === activeWorkflowId;
                            const custom = !wf.isBuiltin;
                            return (
                                <button
                                    key={wf.id}
                                    type="button"
                                    onClick={() => setActiveWorkflowId(wf.id)}
                                    className={`w-full rounded-xl border p-3 text-left transition cursor-pointer ${
                                        isSelected
                                            ? isDark
                                                ? "border-blue-500 bg-stone-800 shadow-sm"
                                                : "border-blue-500 bg-stone-900 shadow-sm"
                                            : isDark
                                                ? "border-stone-800/80 bg-stone-900/40 hover:border-stone-700 hover:bg-stone-800/50"
                                                : "border-stone-200/70 bg-white/70 hover:border-stone-300 hover:bg-white"
                                    }`}
                                    style={
                                        isSelected
                                            ? isDark
                                                ? { backgroundColor: "#292524", borderColor: "#3b82f6", color: "#ffffff" }
                                                : { backgroundColor: "#1c1917", borderColor: "#3b82f6", color: "#ffffff" }
                                            : undefined
                                    }
                                >
                                    <div className="flex items-center justify-between gap-1.5 mb-1">
                                        <span
                                            className="truncate text-xs font-semibold"
                                            style={{ color: isSelected ? "#ffffff" : undefined }}
                                        >
                                            {wf.name}
                                        </span>
                                        <div className="flex shrink-0 items-center gap-1">
                                            {wf.isDefault && (
                                                <span
                                                    className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium"
                                                    style={
                                                        isSelected
                                                            ? { backgroundColor: "rgba(16, 185, 129, 0.2)", color: "#6ee7b7", border: "1px solid rgba(16, 185, 129, 0.3)" }
                                                            : undefined
                                                    }
                                                >
                                                    {t("workflowsPage.default")}
                                                </span>
                                            )}
                                            <span
                                                className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium"
                                                style={
                                                    isSelected
                                                        ? custom
                                                            ? { backgroundColor: "rgba(245, 158, 11, 0.2)", color: "#fcd34d", border: "1px solid rgba(245, 158, 11, 0.3)" }
                                                            : { backgroundColor: "rgba(59, 130, 246, 0.2)", color: "#93c5fd", border: "1px solid rgba(59, 130, 246, 0.3)" }
                                                        : undefined
                                                }
                                            >
                                                {custom ? t("workflowsPage.custom") : t("workflowsPage.builtin")}
                                            </span>
                                        </div>
                                    </div>
                                    <div
                                        className="truncate text-[11px]"
                                        style={{ color: isSelected ? "#d6d3d1" : undefined }}
                                    >
                                        {wf.description || t("workflowsPage.noDescription")}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* 右栏：当前工作流的可视化模型与参数配置面板 */}
                {activeWorkflow ? (
                    <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
                        {/* 详情与操作工具栏 */}
                        <div className="flex shrink-0 items-center justify-between border-b border-stone-200 bg-white/70 px-6 py-3 backdrop-blur-md dark:border-stone-800 dark:bg-stone-900/60">
                            <div className="flex items-center gap-2.5">
                                <h2 className="text-sm font-semibold text-stone-950 dark:text-stone-100">
                                    {currentName}
                                </h2>
                                <span
                                    className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
                                        isCustom
                                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                                            : "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300"
                                    }`}
                                >
                                    {isCustom ? t("workflowsPage.customized") : t("workflowsPage.factoryBuiltin")}
                                </span>
                                <Tag className="m-0 text-xs">{activeWorkflow.category}</Tag>
                            </div>

                            <div className="flex items-center gap-2">
                                {activeWorkflow.isDefault ? (
                                    <Tag color="green" className="m-0 text-xs py-0.5">
                                        {t("workflowsPage.channelDefault")}
                                    </Tag>
                                ) : (
                                    <Button
                                        size="small"
                                        icon={<Star className="size-3.5 text-amber-500" />}
                                        onClick={() => {
                                            if (!primaryChannel || !activeWorkflow) return;
                                            setChannelDefaultWorkflow(primaryChannel.id, activeWorkflow.category, activeWorkflow.id);
                                            message.success(t("workflowsPage.setAsDefaultSuccess", { name: activeWorkflow.name, channel: primaryChannel.name }));
                                        }}
                                        title={t("workflowsPage.setAsDefaultTip", { channel: primaryChannel?.name })}
                                    >
                                        {t("workflowsPage.setAsDefault")}
                                    </Button>
                                )}
                                {builtinCounterpart && (
                                    <Button
                                        size="small"
                                        icon={<RotateCcw className="size-3.5" />}
                                        onClick={handleReset}
                                        title={t("workflowsPage.resetDefaultTip")}
                                    >
                                        {t("workflowsPage.resetDefault")}
                                    </Button>
                                )}
                                <Button
                                    size="small"
                                    type="primary"
                                    icon={<Save className="size-3.5" />}
                                    disabled={!isDirty}
                                    onClick={handleSaveGlobal}
                                >
                                    {t("workflowsPage.saveChanges")}
                                </Button>
                            </div>
                        </div>

                        {/* 主内容区域 */}
                        <div className="thin-scrollbar flex-1 overflow-y-auto p-6 space-y-6">
                            {/* 大模型可视化选择核心卡片（严格分别调用独立接口） */}
                            <div className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-xs dark:border-stone-800 dark:bg-stone-900/50">
                                <div className="mb-4 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Layers className="size-4 text-blue-500" />
                                        <span className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                                            {t("workflowsPage.modelConfigTitle")}
                                        </span>
                                    </div>
                                    <span className="text-xs text-stone-400">
                                        {t("workflowsPage.detectedSlots", { count: selectNodes.length })}
                                    </span>
                                </div>

                                {selectNodes.length === 0 ? (
                                    <div className="rounded-xl border border-dashed border-stone-200 p-6 text-center dark:border-stone-800">
                                        <AlertCircle className="mx-auto size-6 text-stone-400 mb-2" />
                                        <div className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                                            {t("workflowsPage.noSlots")}
                                        </div>
                                        <p className="mt-1 text-xs text-stone-400">
                                            {t("workflowsPage.noSlotsTipPrefix")}
                                            <code>select_models_diffusion_models</code> {t("workflowsPage.noSlotsTipOr", "或")}{" "}
                                            <code>select_models_clip</code>
                                            {t("workflowsPage.noSlotsTipSuffix")}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="grid gap-4 md:grid-cols-2">
                                        {selectNodes.map((node) => {
                                            const isDiffusion = node.modelType === "diffusion_models" || node.modelType === "unet";
                                            const isClip = node.modelType === "clip" || node.modelType === "text_encoders";
                                            const catKey = node.modelType;
                                            const modelState = modelsMap[catKey] || { loading: false, items: [] };
                                            const isLoading = modelState.loading;
                                            const items = modelState.items;

                                            // 端点提示
                                            const endpointName = isClip
                                                ? "GET /api/experiment/models/text_encoders"
                                                : isDiffusion
                                                ? "GET /api/experiment/models/diffusion_models"
                                                : `GET /api/experiment/models/${catKey}`;

                                            const options = items.map((m) => ({
                                                value: m.name,
                                                label: (
                                                    <div className="flex items-center justify-between gap-2 py-0.5">
                                                        <span className="truncate font-medium text-xs">{m.name}</span>
                                                        <span className="shrink-0 text-[10px] text-stone-400">
                                                            {formatFileSize(m.size)}
                                                        </span>
                                                    </div>
                                                ),
                                            }));

                                            return (
                                                <div
                                                    key={`${node.nodeId}:${node.inputKey}`}
                                                    className="rounded-xl border border-stone-200/80 bg-stone-50/50 p-4 transition hover:border-stone-300 dark:border-stone-800 dark:bg-stone-800/40 dark:hover:border-stone-700"
                                                >
                                                    <div className="mb-2 flex items-center justify-between">
                                                        <div className="flex items-center gap-1.5">
                                                            {isDiffusion ? (
                                                                <Cpu className="size-4 text-purple-500" />
                                                            ) : isClip ? (
                                                                <Sparkles className="size-4 text-amber-500" />
                                                            ) : (
                                                                <Layers className="size-4 text-blue-500" />
                                                            )}
                                                            <span className="text-xs font-semibold text-stone-900 dark:text-stone-100">
                                                                {isDiffusion
                                                                    ? t("workflowsPage.diffusionModel")
                                                                    : isClip
                                                                    ? t("workflowsPage.clipModel")
                                                                    : node.title}
                                                            </span>
                                                        </div>
                                                        <Tooltip title={t("workflowsPage.refreshTooltip")}>
                                                            <Button
                                                                size="small"
                                                                type="text"
                                                                icon={<RefreshCw className={`size-3 text-stone-500 ${isLoading ? "animate-spin" : ""}`} />}
                                                                onClick={() => void loadModelsForCategory(catKey, true)}
                                                            />
                                                        </Tooltip>
                                                    </div>

                                                    <div className="mb-2 text-[11px] text-stone-400">
                                                        {t("workflowsPage.endpoint")}<code className="text-blue-600 dark:text-blue-400">{endpointName}</code>
                                                    </div>

                                                    <div className="space-y-1.5">
                                                        <Select
                                                            className="w-full"
                                                            showSearch
                                                            value={node.currentValue || undefined}
                                                            placeholder={isLoading ? t("workflowsPage.loadingModels") : t("workflowsPage.selectModelPlaceholder", { type: catKey })}
                                                            loading={isLoading}
                                                            options={options}
                                                            onChange={(val) => handleModelChange(node.nodeId, node.inputKey, val)}
                                                            filterOption={(input, option) =>
                                                                (String(option?.value ?? "")).toLowerCase().includes(input.toLowerCase())
                                                            }
                                                            notFoundContent={
                                                                modelState.error ? (
                                                                    <div className="p-2 text-center text-xs text-rose-500">
                                                                        {modelState.error}
                                                                        <Button
                                                                            size="small"
                                                                            type="link"
                                                                            className="block mx-auto mt-1"
                                                                            onClick={() => void loadModelsForCategory(catKey, true)}
                                                                        >
                                                                            {t("workflowsPage.retry")}
                                                                        </Button>
                                                                    </div>
                                                                ) : (
                                                                    <div className="p-2 text-center text-xs text-stone-400">
                                                                        {t("workflowsPage.noModelsFound")}
                                                                    </div>
                                                                )
                                                            }
                                                        />

                                                        {node.currentValue && (
                                                            <div className="truncate text-[11px] text-stone-500">
                                                                {t("workflowsPage.currentSelected")}
                                                                <span className="font-mono text-stone-700 dark:text-stone-300">
                                                                    {node.currentValue}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* 基础元数据与 JSON 代码抽屉 */}
                            <div className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-xs dark:border-stone-800 dark:bg-stone-900/50">
                                <div className="mb-3 text-xs font-semibold text-stone-700 dark:text-stone-300">
                                    {t("workflowsPage.metaInfo")}
                                </div>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div>
                                        <label className="mb-1 block text-xs text-stone-500">{t("workflowsPage.nameLabel")}</label>
                                        <Input
                                            value={currentName}
                                            onChange={(e) => {
                                                setCurrentName(e.target.value);
                                                setIsDirty(true);
                                            }}
                                            placeholder={t("workflowsPage.namePlaceholder")}
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-xs text-stone-500">{t("workflowsPage.descLabel")}</label>
                                        <Input
                                            value={currentDesc}
                                            onChange={(e) => {
                                                setCurrentDesc(e.target.value);
                                                setIsDirty(true);
                                            }}
                                            placeholder={t("workflowsPage.descPlaceholder")}
                                        />
                                    </div>
                                </div>

                                <div className="mt-5 border-t border-stone-100 pt-4 dark:border-stone-800">
                                    <div className="mb-3 flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <Segmented
                                                size="small"
                                                value={viewMode}
                                                onChange={(val) => setViewMode(val as "graph" | "json")}
                                                options={[
                                                    {
                                                        value: "graph",
                                                        label: (
                                                            <div className="flex items-center gap-1.5 px-1 py-0.5">
                                                                <Network className="size-3.5 text-blue-500" />
                                                                <span className="font-medium text-xs">节点流图</span>
                                                            </div>
                                                        ),
                                                    },
                                                    {
                                                        value: "json",
                                                        label: (
                                                            <div className="flex items-center gap-1.5 px-1 py-0.5">
                                                                <Code2 className="size-3.5 text-stone-500" />
                                                                <span className="font-medium text-xs">JSON 代码</span>
                                                            </div>
                                                        ),
                                                    },
                                                ]}
                                            />
                                        </div>

                                        <div className="flex items-center gap-1.5">
                                            <Button
                                                size="small"
                                                icon={<Download className="size-3.5" />}
                                                onClick={handleExportJson}
                                            >
                                                {t("workflowsPage.exportFile")}
                                            </Button>
                                            <Button
                                                size="small"
                                                icon={copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                                                onClick={handleCopyJson}
                                            >
                                                {copied ? t("workflowsPage.copied") : t("workflowsPage.copyCode")}
                                            </Button>
                                        </div>
                                    </div>

                                    {viewMode === "graph" ? (
                                        <div className="h-[520px] w-full rounded-xl border border-stone-200 overflow-hidden shadow-2xs dark:border-stone-800">
                                            <ComfyFlowGraph
                                                workflowJson={currentJson}
                                                modelsMap={modelsMap}
                                                onModelChange={handleModelChange}
                                                onReloadModels={loadModelsForCategory}
                                            />
                                        </div>
                                    ) : (
                                        <div className="thin-scrollbar max-h-80 overflow-y-auto rounded-lg border border-stone-200 bg-stone-50 p-3 font-mono text-[11px] text-stone-700 select-text dark:border-stone-800 dark:bg-stone-950 dark:text-stone-300">
                                            <pre className="whitespace-pre-wrap break-all">{jsonString}</pre>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-1 items-center justify-center p-6">
                        <Empty description={t("workflowsPage.emptySelect")} />
                    </div>
                )}
            </div>
        </main>
    );
}
