import { App, Button, Card, Divider, Select, Space, Switch, Tag, Typography } from "antd";
import {
    Brush,
    Camera,
    CheckCircle2,
    Copy,
    Download,
    FileCode,
    FileText,
    FolderPlus,
    Grid2x2,
    Info,
    Lock,
    Maximize2,
    Scissors,
    Sparkles,
    Trash2,
    Upload,
    Wrench,
    ZoomIn,
} from "lucide-react";
import { useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { nanoid } from "nanoid";

import { validateComfyuiWorkflow } from "@/services/api/comfyui";
import {
    defaultToolbarConfig,
    findWorkflow,
    getChannelWorkflows,
    useConfigStore,
    type AiConfig,
    type ComfyWorkflowItem,
    type ModelChannel,
    type ToolbarConfig,
    type WorkflowCategory,
} from "@/stores/use-config-store";

type FrontendToolItem = {
    id: string;
    title: string;
    desc: string;
    icon: ReactNode;
    danger?: boolean;
};

type AiToolItem = {
    id: "maskEdit" | "reversePrompt" | "superResolve" | "angle" | "upscale";
    category: WorkflowCategory;
    title: string;
    desc: string;
    icon: ReactNode;
    isDualMode?: boolean;
};

const FRONTEND_TOOLS: FrontendToolItem[] = [
    { id: "info", title: "信息", desc: "查看节点 ID、尺寸、位置、提示词与底层 JSON 数据", icon: <Info className="size-4" /> },
    { id: "delete", title: "删除", desc: "从画布中永久移除当前节点及所有输入与衍生连线", icon: <Trash2 className="size-4" />, danger: true },
    { id: "saveAsset", title: "存资产", desc: "将节点图像及生成参数快速存入本地素材资产库", icon: <FolderPlus className="size-4" /> },
    { id: "download", title: "下载", desc: "将图片以原始格式及命名直接保存下载至本地", icon: <Download className="size-4" /> },
    { id: "copyPrompt", title: "复制提示词", desc: "快速复制生成该图片所使用的 Prompt 文本到剪贴板", icon: <Copy className="size-4" /> },
    { id: "replace", title: "替换图片", desc: "选择本地新图像，在原节点位置原位无损替换", icon: <Upload className="size-4" /> },
    { id: "resize", title: "锁比例 / 自由比例", desc: "切换节点自由拉伸缩放或强制锁定原图等比宽高缩放", icon: <Lock className="size-4" /> },
    { id: "crop", title: "裁剪", desc: "前端选区自由/等比裁剪图片，并在右侧生成衍生图片节点", icon: <Scissors className="size-4" /> },
    { id: "split", title: "切图", desc: "按行列网格切分图片，批量生成矩阵子图片节点", icon: <Grid2x2 className="size-4" /> },
    { id: "view", title: "查看大图", desc: "全屏居中放大浏览原图细节，自动暂停背景视频", icon: <Maximize2 className="size-4" /> },
];

const AI_TOOLS: AiToolItem[] = [
    {
        id: "maskEdit",
        category: "inpaint",
        title: "局部编辑 (Inpaint)",
        desc: "在原图上涂抹遮罩蒙版，结合输入提示词进行局部精准重绘与瑕疵修复",
        icon: <Brush className="size-4 text-emerald-500" />,
    },
    {
        id: "reversePrompt",
        category: "text",
        title: "反推提示词 (Text / VLM)",
        desc: "调用视觉大语言模型深度理解原图，自动生成反推提示词文本节点管线",
        icon: <FileText className="size-4 text-blue-500" />,
    },
    {
        id: "superResolve",
        category: "superResolve",
        title: "AI 超分 (Super Resolution)",
        desc: "通过 ComfyUI 超分辨率生成模型，大幅提升画面分辨率与微观纹理质量",
        icon: <Sparkles className="size-4 text-purple-500" />,
    },
    {
        id: "angle",
        category: "angle",
        title: "多角度生成 (Multi-Angle)",
        desc: "通过相机环绕方位角与俯仰视角参数，生成主体多视角衍生图片",
        icon: <Camera className="size-4 text-amber-500" />,
    },
    {
        id: "upscale",
        category: "upscale",
        title: "放大 (AI Upscale / Canvas)",
        desc: "双模式自适应：配置工作流后优先走 AI 潜空间/Tile 重绘放大，未配置则走前端 Canvas 快速无损放大",
        icon: <ZoomIn className="size-4 text-cyan-500" />,
        isDualMode: true,
    },
];

export function ConfigToolbar({ onOpenChannelEditor }: { onOpenChannelEditor?: (channelId: string) => void }) {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const config = useConfigStore((state) => state.config);
    const setConfig = useConfigStore((state) => state.setConfig);
    const updateToolbarConfig = useConfigStore((state) => state.updateToolbarConfig);

    const toolbar = config.toolbar || defaultToolbarConfig;
    const selectedIds = new Set(toolbar.ids);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const uploadingToolRef = useRef<AiToolItem | null>(null);

    const toggleTool = (toolId: string, enabled: boolean) => {
        const nextIds = enabled ? Array.from(new Set([...toolbar.ids, toolId])) : toolbar.ids.filter((id) => id !== toolId);
        updateToolbarConfig({ ids: nextIds });
    };

    const handleChannelChange = (toolId: AiToolItem["id"], channelId: string) => {
        const currentBindings = toolbar.bindings || {};
        updateToolbarConfig({
            bindings: {
                ...currentBindings,
                [toolId]: {
                    ...currentBindings[toolId],
                    channelId,
                    workflowId: undefined, // Reset workflow selection when channel changes
                },
            },
        });
    };

    const handleWorkflowChange = (toolId: AiToolItem["id"], workflowId: string) => {
        const currentBindings = toolbar.bindings || {};
        updateToolbarConfig({
            bindings: {
                ...currentBindings,
                [toolId]: {
                    ...currentBindings[toolId],
                    workflowId: workflowId || undefined,
                },
            },
        });
    };

    const triggerUpload = (tool: AiToolItem) => {
        uploadingToolRef.current = tool;
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
            fileInputRef.current.click();
        }
    };

    const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        const tool = uploadingToolRef.current;
        if (!file || !tool) return;

        try {
            const text = await file.text();
            const parsed = JSON.parse(text) as unknown;
            const validation = validateComfyuiWorkflow(parsed, tool.category);
            if (!validation.ok) {
                message.error(`工作流协议校验失败: ${validation.error}`);
                return;
            }

            const targetChannelId = toolbar.bindings?.[tool.id]?.channelId || config.channels[0]?.id;
            const targetChannel = config.channels.find((c) => c.id === targetChannelId) || config.channels[0];
            if (!targetChannel) {
                message.error("未找到可用渠道，请先创建渠道");
                return;
            }

            const existingWorkflows = Array.isArray(targetChannel.workflows) ? targetChannel.workflows : [];
            const rawName = file.name.replace(/\.[^/.]+$/, "");
            const newWorkflow: ComfyWorkflowItem = {
                id: nanoid(),
                name: rawName || `${tool.category}-workflow-${existingWorkflows.length + 1}`,
                category: tool.category,
                json: parsed as Record<string, unknown>,
                createdAt: Date.now(),
                isBuiltin: false,
                isDefault: existingWorkflows.filter((w) => w.category === tool.category).length === 0,
            };

            const updatedChannels = config.channels.map((channel) => {
                if (channel.id !== targetChannel.id) return channel;
                return {
                    ...channel,
                    workflows: [...existingWorkflows, newWorkflow],
                };
            });

            const currentBindings = toolbar.bindings || {};
            const nextConfig: AiConfig = {
                ...config,
                channels: updatedChannels,
                toolbar: {
                    ...toolbar,
                    bindings: {
                        ...currentBindings,
                        [tool.id]: {
                            channelId: targetChannel.id,
                            workflowId: newWorkflow.id,
                        },
                    },
                },
            };

            setConfig(nextConfig);
            message.success(`成功为「${tool.title}」上传并绑定工作流 "${newWorkflow.name}"！`);
        } catch {
            message.error("解析文件失败，请确保上传的是有效的 JSON 格式工作流");
        }
    };

    return (
        <div className="space-y-6">
            <input ref={fileInputRef} type="file" accept="application/json,.json" className="hidden" onChange={handleFileChange} />

            {/* 顶栏控制与说明 */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-stone-200 bg-stone-50/50 p-4 dark:border-stone-800 dark:bg-stone-900/50">
                <div>
                    <div className="flex items-center gap-2 text-sm font-semibold">
                        <Wrench className="size-4" />
                        <span>{t("config.toolbar.title", "画布节点快捷工具栏配置")}</span>
                    </div>
                    <div className="mt-1 text-xs text-stone-500">
                        {t("config.toolbar.description", "管理图片节点悬浮工具栏中显示的快捷工具，并为 AI 增强工具指定绑定的 ComfyUI 工作流。")}
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-xs text-stone-600 dark:text-stone-300">{t("canvas.imageTools.showLabels", "显示按钮文字")}</span>
                    <Switch checked={toolbar.showLabels} onChange={(showLabels) => updateToolbarConfig({ showLabels })} />
                </div>
            </div>

            {/* AI 增强工具组 */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Sparkles className="size-4 text-purple-500" />
                        <span className="text-sm font-semibold">{t("config.toolbar.aiToolsTitle", "AI 增强工具 (ComfyUI 工作流驱动)")}</span>
                        <Tag color="purple">{AI_TOOLS.length} 个工具</Tag>
                    </div>
                    <span className="text-xs text-stone-400">依赖本地/云端 ComfyUI 工作流支持</span>
                </div>

                <div className="grid gap-3 md:grid-cols-1">
                    {AI_TOOLS.map((tool) => {
                        const isEnabled = selectedIds.has(tool.id);
                        const binding = toolbar.bindings?.[tool.id];
                        const channelId = binding?.channelId || config.channels[0]?.id;
                        const channel = config.channels.find((c) => c.id === channelId) || config.channels[0];
                        const workflows = channel ? getChannelWorkflows(channel, tool.category) : [];
                        const defaultWorkflow = channel ? findWorkflow(config, channel.id, undefined, tool.category) : undefined;
                        const currentWorkflowId = binding?.workflowId || defaultWorkflow?.id;

                        const hasWorkflow = workflows.length > 0;

                        return (
                            <Card key={tool.id} size="small" className="rounded-lg border-stone-200 dark:border-stone-800">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                    <div className="flex items-start gap-3">
                                        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-stone-200 bg-stone-50 dark:border-stone-800 dark:bg-stone-900">
                                            {tool.icon}
                                        </div>
                                        <div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="text-sm font-semibold">{tool.title}</span>
                                                {tool.isDualMode && !hasWorkflow ? (
                                                    <Tag color="blue">{t("config.toolbar.canvasDualMode", "默认 Canvas 快速放大")}</Tag>
                                                ) : hasWorkflow ? (
                                                    <Tag color="green" icon={<CheckCircle2 className="mr-1 inline-block size-3" />}>
                                                        {t("config.toolbar.workflowReady", { count: workflows.length, defaultValue: `已就绪 (${workflows.length} 个工作流)` })}
                                                    </Tag>
                                                ) : (
                                                    <Tag color="warning">{t("config.toolbar.workflowMissing", "未配置工作流")}</Tag>
                                                )}
                                            </div>
                                            <div className="mt-1 text-xs text-stone-500">{tool.desc}</div>
                                        </div>
                                    </div>

                                    <div className="flex shrink-0 items-center gap-3 self-end sm:self-auto">
                                        <span className="text-xs text-stone-400">{isEnabled ? "已启用" : "已隐藏"}</span>
                                        <Switch checked={isEnabled} onChange={(checked) => toggleTool(tool.id, checked)} />
                                    </div>
                                </div>

                                <Divider className="my-3" />

                                {/* 渠道与工作流配置区 */}
                                <div className="flex flex-wrap items-center gap-3">
                                    <div className="flex items-center gap-2 text-xs text-stone-500">
                                        <span>渠道:</span>
                                        <Select
                                            size="small"
                                            className="w-36"
                                            value={channel?.id}
                                            onChange={(val) => handleChannelChange(tool.id, val)}
                                            options={config.channels.map((c) => ({ label: c.name || c.id, value: c.id }))}
                                        />
                                    </div>

                                    <div className="flex items-center gap-2 text-xs text-stone-500">
                                        <span>执行工作流:</span>
                                        <Select
                                            size="small"
                                            className="w-56"
                                            value={currentWorkflowId || ""}
                                            onChange={(val) => handleWorkflowChange(tool.id, val)}
                                            placeholder="选择工作流"
                                            options={[
                                                ...(workflows.length > 0
                                                    ? workflows.map((w) => ({
                                                          label: `${w.name}${w.isDefault ? " (默认)" : ""}`,
                                                          value: w.id,
                                                      }))
                                                    : [{ label: "暂无工作流，请上传", value: "", disabled: true }]),
                                            ]}
                                        />
                                    </div>

                                    <Button size="small" icon={<Upload className="size-3.5" />} onClick={() => triggerUpload(tool)}>
                                        {t("config.toolbar.uploadWorkflow", "上传新工作流")}
                                    </Button>

                                    {channel && onOpenChannelEditor && (
                                        <Button size="small" type="link" className="!p-0 text-xs" onClick={() => onOpenChannelEditor(channel.id)}>
                                            管理渠道工作流 &gt;
                                        </Button>
                                    )}
                                </div>
                            </Card>
                        );
                    })}
                </div>
            </div>

            {/* 基础与操作工具组 */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Wrench className="size-4 text-stone-500" />
                        <span className="text-sm font-semibold">{t("config.toolbar.frontendToolsTitle", "基础与操作工具 (纯前端处理)")}</span>
                        <Tag>{FRONTEND_TOOLS.length} 个工具</Tag>
                    </div>
                    <span className="text-xs text-stone-400">运行于浏览器端，无需工作流支持</span>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                    {FRONTEND_TOOLS.map((tool) => {
                        const isEnabled = selectedIds.has(tool.id);
                        return (
                            <div
                                key={tool.id}
                                className={`flex items-center justify-between rounded-lg border p-3 transition ${
                                    tool.danger ? "border-red-200/60 dark:border-red-950/60" : "border-stone-200 dark:border-stone-800"
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`flex size-8 items-center justify-center rounded-lg border ${tool.danger ? "border-red-200 text-red-500 dark:border-red-900" : "border-stone-200 bg-stone-50 dark:border-stone-800 dark:bg-stone-900"}`}>
                                        {tool.icon}
                                    </div>
                                    <div>
                                        <div className={`text-xs font-semibold ${tool.danger ? "text-red-500" : ""}`}>{tool.title}</div>
                                        <div className="mt-0.5 line-clamp-1 text-[11px] text-stone-400">{tool.desc}</div>
                                    </div>
                                </div>
                                <Switch size="small" checked={isEnabled} onChange={(checked) => toggleTool(tool.id, checked)} />
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
