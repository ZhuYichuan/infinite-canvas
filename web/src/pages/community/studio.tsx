import { useCallback, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { App, Button, Input, Select, Tag } from "antd";
import {
    ArrowLeft,
    CheckCircle2,
    FileJson,
    FolderDown,
    Info,
    RefreshCw,
    UploadCloud,
    Workflow as WorkflowIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { saveAs } from "file-saver";
import { nanoid } from "nanoid";

import { ComfyFlowGraph } from "@/components/workflow-graph/comfy-flow-graph";
import { createZip } from "@/lib/zip";
import {
    ingestWorkflow,
    type InferredWorkflowModality,
    type WorkflowIngestionResult,
} from "@/services/api/comfyui-adapter";
import { extractComfyMetadataFromImage } from "@/services/api/comfyui-image-parser";
import {
    DEFAULT_BUILTIN_COMFYUI_T2I_WORKFLOW,
    DEFAULT_BUILTIN_COMFYUI_VIDEO_WORKFLOW,
} from "@/services/api/comfyui-default-workflows";
import {
    useConfigStore,
    type ComfyWorkflowItem,
    type WorkflowCategory,
} from "@/stores/use-config-store";
import type { ComfyuiWorkflowJson } from "@/services/api/comfyui";

const MODALITY_OPTIONS: { value: WorkflowCategory; label: string }[] = [
    { value: "t2i", label: "文生图 (Text-to-Image)" },
    { value: "i2i", label: "图生图 (Image-to-Image)" },
    { value: "inpaint", label: "局部重绘 (Inpainting)" },
    { value: "omniVideo", label: "全能参考视频 (Omni Video)" },
    { value: "frameVideo", label: "首尾帧视频 (Frame Video)" },
    { value: "text", label: "文本生成与反推 (Text)" },
    { value: "audio", label: "音乐与音频生成 (Audio)" },
    { value: "faceRefine", label: "人脸精修 (Face Refine)" },
    { value: "depthVideo", label: "深度估计视频 (Depth Video)" },
];

export default function CommunityStudioPage() {
    const { message } = App.useApp();
    const { t } = useTranslation();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [rawInput, setRawInput] = useState<unknown | null>(null);
    const [ingestionResult, setIngestionResult] = useState<WorkflowIngestionResult | null>(null);
    const [activeWorkflowJson, setActiveWorkflowJson] = useState<ComfyuiWorkflowJson | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isParsing, setIsParsing] = useState(false);

    // 工作流元数据
    const [metaName, setMetaName] = useState("");
    const [metaCategory, setMetaCategory] = useState<WorkflowCategory>("t2i");
    const [metaAuthor, setMetaAuthor] = useState("");
    const [metaDescription, setMetaDescription] = useState("");
    const [metaTags, setMetaTags] = useState("");

    // 处理原始输入转译
    const processInput = useCallback(
        (data: unknown, fallbackName?: string) => {
            try {
                const res = ingestWorkflow(data);
                setRawInput(data);
                setIngestionResult(res);
                setActiveWorkflowJson(res.adaptedWorkflow);
                setMetaCategory(res.modality);
                if (fallbackName && !metaName) {
                    setMetaName(fallbackName);
                } else if (!metaName) {
                    setMetaName(`社区适配工作流-${res.modality}`);
                }
                message.success(`成功识别模态: ${res.modality} (置信度 ${Math.round(res.confidence * 100)}%)`);
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                message.error(`解析工作流失败: ${msg}`);
            }
        },
        [message, metaName],
    );

    // 处理文件导入 (JSON 或 PNG/WebP)
    const handleFile = useCallback(
        async (file: File) => {
            setIsParsing(true);
            try {
                const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
                const isImage = file.type.startsWith("image/") || /\.(png|webp)$/i.test(file.name);

                if (isImage) {
                    const extracted = await extractComfyMetadataFromImage(file);
                    if (!extracted || (!extracted.workflow && !extracted.prompt)) {
                        message.warning(t("community.imageMissingMetadata"));
                        return;
                    }
                    const payload = extracted.workflow || extracted.prompt;
                    processInput(payload, nameWithoutExt);
                } else {
                    const text = await file.text();
                    const parsed = JSON.parse(text);
                    processInput(parsed, nameWithoutExt);
                }
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                message.error(`读取文件失败: ${msg}`);
            } finally {
                setIsParsing(false);
            }
        },
        [message, processInput, t],
    );

    // 拖拽导入监听
    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            setIsDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) {
                void handleFile(file);
            }
        },
        [handleFile],
    );

    // 交互式槽位覆盖 (Slot Override)
    const handleSlotOverride = useCallback(
        (nodeId: string, slotTitle: string) => {
            if (!activeWorkflowJson) return;

            const cloned: ComfyuiWorkflowJson = JSON.parse(JSON.stringify(activeWorkflowJson));
            if (!cloned[nodeId]) return;

            if (!cloned[nodeId]._meta) {
                cloned[nodeId]._meta = {};
            }

            if (slotTitle) {
                cloned[nodeId]._meta.title = slotTitle;
            } else {
                delete cloned[nodeId]._meta.title;
            }

            // 重新运行适配器以更新槽位统计
            const nextResult = ingestWorkflow(cloned, { preferredModality: metaCategory });
            setActiveWorkflowJson(cloned);
            setIngestionResult(nextResult);
            message.success(`已更新节点 #${nodeId} 槽位标记为: ${slotTitle || "普通节点"}`);
        },
        [activeWorkflowJson, message, metaCategory],
    );

    // 一键保存到我的画布
    const handleSaveToCanvas = () => {
        if (!activeWorkflowJson) return;

        const workflowItem: ComfyWorkflowItem = {
            id: nanoid(),
            name: metaName.trim() || `社区适配-${metaCategory}-${Date.now().toString().slice(-4)}`,
            category: metaCategory,
            json: activeWorkflowJson,
            createdAt: Date.now(),
            isBuiltin: false,
            description: metaDescription.trim(),
        };

        useConfigStore.getState().saveWorkflowGlobally(workflowItem);
        message.success(t("community.saveSuccess"));
    };

    // 导出规范化 API JSON
    const handleExportJson = () => {
        if (!activeWorkflowJson) return;
        const blob = new Blob([JSON.stringify(activeWorkflowJson, null, 2)], {
            type: "application/json;charset=utf-8",
        });
        saveAs(blob, `${metaName || "workflow"}.json`);
    };

    // 导出标准社区包 (ZIP)
    const handleExportZip = async () => {
        if (!activeWorkflowJson || !ingestionResult) return;

        const manifest = {
            $schema: "https://canvas.imihoo.com/schemas/community-workflow-v1.json",
            id: (metaName || "community-workflow").toLowerCase().replace(/[^a-z0-9_-]/g, "-"),
            name: metaName || "Community Workflow",
            version: "1.0.0",
            category: metaCategory,
            author: {
                name: metaAuthor || "Community Creator",
            },
            description: metaDescription || "Exported from Infinite Canvas Workflow Studio",
            tags: metaTags
                .split(/[,，]/)
                .map((t) => t.trim())
                .filter(Boolean),
            slots: ingestionResult.slots,
        };

        const readme = `# ${metaName || "Community Workflow"}\n\n${metaDescription}\n\n## 适用模态\n\`${metaCategory}\`\n\n## 作者\n${metaAuthor || "Community Creator"}\n\n## 导入指引\n在 Infinite Canvas 中打开「开源社区」-「工作流适配工坊」，直接拖入 \`workflow.json\` 即可一键安装使用。\n`;

        const zipBlob = await createZip([
            { name: "manifest.json", data: JSON.stringify(manifest, null, 2) },
            { name: "workflow.json", data: JSON.stringify(activeWorkflowJson, null, 2) },
            { name: "README.md", data: readme },
        ]);

        saveAs(zipBlob, `${metaName || "community-workflow"}-package.zip`);
        message.success("已成功生成并下载社区标准分发包！");
    };

    return (
        <div className="flex h-full flex-col overflow-hidden bg-background text-stone-800 dark:text-stone-100">
            {/* 顶栏 Header */}
            <header className="flex h-14 shrink-0 items-center justify-between border-b border-stone-200/80 px-4 sm:px-6 dark:border-stone-800">
                <div className="flex items-center gap-3">
                    <Link
                        to="/community"
                        className="inline-flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
                    >
                        <ArrowLeft className="size-4" />
                        <span>{t("community.backToCommunity")}</span>
                    </Link>
                    <div className="h-4 w-px bg-stone-300 dark:bg-stone-700" />
                    <div className="flex items-center gap-2">
                        <WorkflowIcon className="size-4 text-blue-600 dark:text-blue-400" />
                        <h1 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
                            {t("community.studioTitle")}
                        </h1>
                    </div>
                </div>

                {activeWorkflowJson && (
                    <div className="flex items-center gap-2">
                        <Button
                            size="small"
                            icon={<FileJson className="size-3.5" />}
                            onClick={handleExportJson}
                        >
                            {t("community.downloadJson")}
                        </Button>
                        <Button
                            size="small"
                            icon={<FolderDown className="size-3.5" />}
                            onClick={handleExportZip}
                        >
                            {t("community.exportBundle")}
                        </Button>
                        <Button
                            size="small"
                            type="primary"
                            icon={<CheckCircle2 className="size-3.5" />}
                            onClick={handleSaveToCanvas}
                        >
                            {t("community.saveToCanvas")}
                        </Button>
                    </div>
                )}
            </header>

            {/* 主内容区域 */}
            <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                {!activeWorkflowJson ? (
                    /* 阶段一：工作流上传与导入区 */
                    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center p-6 sm:p-10">
                        <div
                            className={`flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 text-center transition-all ${
                                isDragging
                                    ? "border-blue-500 bg-blue-50/50 dark:border-blue-400 dark:bg-blue-950/20"
                                    : "border-stone-300 bg-stone-50/50 hover:border-stone-400 dark:border-stone-700 dark:bg-stone-900/30"
                            }`}
                            onDragOver={(e) => {
                                e.preventDefault();
                                setIsDragging(true);
                            }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={handleDrop}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".json,.png,.webp"
                                className="hidden"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) void handleFile(file);
                                }}
                            />

                            <div className="rounded-full bg-blue-100 p-4 text-blue-600 dark:bg-blue-950/80 dark:text-blue-400">
                                <UploadCloud className="size-8" />
                            </div>

                            <h2 className="mt-4 text-base font-semibold text-stone-900 dark:text-stone-100">
                                {t("community.uploadPrompt")}
                            </h2>
                            <p className="mt-1 max-w-md text-xs text-stone-500 dark:text-stone-400">
                                {t("community.uploadHelp")}
                            </p>

                            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                                <Button
                                    type="primary"
                                    loading={isParsing}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    浏览本地文件
                                </Button>
                            </div>

                            {/* 示例体验快捷方式 */}
                            <div className="mt-8 border-t border-stone-200/80 pt-6 dark:border-stone-800">
                                <div className="text-xs font-medium text-stone-400">
                                    {t("community.trySample")}：
                                </div>
                                <div className="mt-2.5 flex flex-wrap items-center justify-center gap-2">
                                    <Button
                                        size="small"
                                        onClick={() =>
                                            processInput(DEFAULT_BUILTIN_COMFYUI_T2I_WORKFLOW.json, "示例-文生图")
                                        }
                                    >
                                        {t("community.sampleT2i")}
                                    </Button>
                                    <Button
                                        size="small"
                                        onClick={() =>
                                            processInput(DEFAULT_BUILTIN_COMFYUI_VIDEO_WORKFLOW.json, "示例-全能视频")
                                        }
                                    >
                                        {t("community.sampleVideo")}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* 阶段二：可视化流图与插槽调整工坊工作台 */
                    <div className="flex min-h-0 flex-1 flex-col">
                        {/* 诊断与槽位分析状态条 */}
                        <div className="border-b border-stone-200 bg-white/70 px-4 py-3 backdrop-blur-xs dark:border-stone-800 dark:bg-stone-900/70 sm:px-6">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="flex flex-wrap items-center gap-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-semibold text-stone-500">
                                            {t("community.detectedModality")}:
                                        </span>
                                        <Select
                                            size="small"
                                            value={metaCategory}
                                            className="w-48"
                                            options={MODALITY_OPTIONS}
                                            onChange={(val) => {
                                                setMetaCategory(val);
                                                if (rawInput) {
                                                    const res = ingestWorkflow(rawInput, { preferredModality: val });
                                                    setIngestionResult(res);
                                                    setActiveWorkflowJson(res.adaptedWorkflow);
                                                }
                                            }}
                                        />
                                    </div>

                                    {ingestionResult && (
                                        <Tag color="cyan">
                                            置信度: {Math.round(ingestionResult.confidence * 100)}%
                                        </Tag>
                                    )}

                                    {/* 关键槽位指示 */}
                                    {ingestionResult && (
                                        <div className="flex items-center gap-1.5 text-xs">
                                            <Tag color={ingestionResult.slots.prompt ? "blue" : "default"}>
                                                提示词: #{ingestionResult.slots.prompt || "无"}
                                            </Tag>
                                            <Tag color={ingestionResult.slots.seed ? "purple" : "default"}>
                                                种子: #{ingestionResult.slots.seed || "无"}
                                            </Tag>
                                            <Tag color={ingestionResult.slots.outputs.length > 0 ? "green" : "default"}>
                                                输出端点: {ingestionResult.slots.outputs.length} 个
                                            </Tag>
                                            {ingestionResult.slots.models.length > 0 && (
                                                <Tag color="geekblue">
                                                    模型插槽: {ingestionResult.slots.models.length} 个
                                                </Tag>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center gap-2">
                                    <Button
                                        size="small"
                                        type="text"
                                        icon={<RefreshCw className="size-3.5" />}
                                        onClick={() => {
                                            setActiveWorkflowJson(null);
                                            setIngestionResult(null);
                                            setRawInput(null);
                                        }}
                                    >
                                        重新导入
                                    </Button>
                                </div>
                            </div>

                            {/* 警告与歧义提示 */}
                            {ingestionResult && ingestionResult.ambiguities.length > 0 && (
                                <div className="mt-2.5 flex items-start gap-1.5 rounded-lg bg-amber-50 p-2 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                                    <Info className="size-4 shrink-0 mt-0.5" />
                                    <span>
                                        检测到多候选插槽：{ingestionResult.ambiguities.join("；")}。可在下方流图中点击对应节点进行针对性覆盖分配。
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* 流图与右侧元数据编辑 */}
                        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1fr_320px]">
                            {/* 流图画布 */}
                            <div className="relative min-h-[460px] flex-1 bg-stone-100/60 dark:bg-stone-950/60">
                                <ComfyFlowGraph
                                    workflowJson={activeWorkflowJson}
                                    onSlotOverride={handleSlotOverride}
                                    className="size-full"
                                />
                            </div>

                            {/* 右侧：元数据编辑与发布面板 */}
                            <aside className="border-t border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900 lg:border-t-0 lg:border-l">
                                <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-400">
                                    {t("community.workflowMeta")}
                                </h3>

                                <div className="mt-4 space-y-4 text-xs">
                                    <div>
                                        <label className="mb-1 block font-medium text-stone-700 dark:text-stone-300">
                                            {t("community.workflowName")}
                                        </label>
                                        <Input
                                            value={metaName}
                                            onChange={(e) => setMetaName(e.target.value)}
                                            placeholder="如：Wan2.1 极速文生视频 720P"
                                        />
                                    </div>

                                    <div>
                                        <label className="mb-1 block font-medium text-stone-700 dark:text-stone-300">
                                            {t("community.workflowAuthor")}
                                        </label>
                                        <Input
                                            value={metaAuthor}
                                            onChange={(e) => setMetaAuthor(e.target.value)}
                                            placeholder="创作者昵称 / GitHub"
                                        />
                                    </div>

                                    <div>
                                        <label className="mb-1 block font-medium text-stone-700 dark:text-stone-300">
                                            {t("community.workflowDesc")}
                                        </label>
                                        <Input.TextArea
                                            rows={3}
                                            value={metaDescription}
                                            onChange={(e) => setMetaDescription(e.target.value)}
                                            placeholder="简要描述此工作流的用途、生成特色与所需模型..."
                                        />
                                    </div>

                                    <div>
                                        <label className="mb-1 block font-medium text-stone-700 dark:text-stone-300">
                                            {t("community.workflowTags")}
                                        </label>
                                        <Input
                                            value={metaTags}
                                            onChange={(e) => setMetaTags(e.target.value)}
                                            placeholder="如：Wan2.1, 720P, Turbo, Cinematic"
                                        />
                                    </div>

                                    <div className="pt-2">
                                        <Button
                                            type="primary"
                                            block
                                            icon={<CheckCircle2 className="size-4" />}
                                            onClick={handleSaveToCanvas}
                                        >
                                            {t("community.saveToCanvas")}
                                        </Button>
                                    </div>
                                </div>
                            </aside>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
