import { Button, Card, Divider, Space, Switch, Tag, Typography } from "antd";
import {
    Brush,
    Camera,
    CheckCircle2,
    Copy,
    Download,
    ExternalLink,
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
import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import {
    defaultToolbarConfig,
    getChannelWorkflows,
    useConfigStore,
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
        icon: <Wrench className="size-4 text-blue-500" />,
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
        title: "高清放大 (Upscale)",
        desc: "支持基于前端 Canvas 算法快速插值或调用 ComfyUI 模型进行高清放大",
        icon: <ZoomIn className="size-4 text-cyan-500" />,
    },
];

export function ConfigToolbar({ onNavigateToChannels }: { onNavigateToChannels?: () => void }) {
    const { t } = useTranslation();
    const config = useConfigStore((state) => state.config);
    const updateToolbarConfig = useConfigStore((state) => state.updateToolbarConfig);

    const toolbarConfig: ToolbarConfig = config.toolbar || defaultToolbarConfig;
    const enabledToolIds = new Set(toolbarConfig.ids);

    // 活跃渠道判断
    const activeChannel: ModelChannel | undefined =
        config.channels.find((c) => c.id === config.channelId) || config.channels[0];

    const handleToggleTool = (toolId: string, checked: boolean) => {
        let nextIds: string[];
        if (checked) {
            nextIds = Array.from(new Set([...toolbarConfig.ids, toolId]));
        } else {
            nextIds = toolbarConfig.ids.filter((id) => id !== toolId);
        }
        updateToolbarConfig({ ids: nextIds });
    };

    const handleToggleLabels = (checked: boolean) => {
        updateToolbarConfig({ showLabels: checked });
    };

    return (
        <div className="space-y-6">
            {/* 顶栏说明与全局操作 */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-stone-200/80 bg-stone-50/70 p-4 dark:border-stone-800 dark:bg-stone-900/40">
                <div>
                    <h3 className="text-base font-semibold text-stone-800 dark:text-stone-200">
                        {t("canvas.imageTools.customize", "自定义工具栏")}
                    </h3>
                    <p className="mt-0.5 text-xs text-stone-500">
                        统一管理画布图片节点悬浮工具栏中的工具开关。所有 AI 增强工具的工作流模板统一在「渠道」中维护。
                    </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center gap-2 text-xs text-stone-600 dark:text-stone-400">
                        <span>{t("canvas.imageTools.showLabels", "显示按钮文字")}</span>
                        <Switch
                            size="small"
                            checked={toolbarConfig.showLabels}
                            onChange={handleToggleLabels}
                        />
                    </div>
                    {onNavigateToChannels && (
                        <Button
                            size="small"
                            icon={<ExternalLink className="size-3.5" />}
                            onClick={onNavigateToChannels}
                        >
                            管理渠道与工作流
                        </Button>
                    )}
                </div>
            </div>

            {/* AI 增强工具组 */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-sm font-semibold text-stone-800 dark:text-stone-200">
                            AI 增强工具
                        </div>
                        <div className="text-xs text-stone-500">
                            基于 ComfyUI 模型能力，触发后自动调度当前活跃渠道的对应工作流
                        </div>
                    </div>
                    {activeChannel && (
                        <div className="text-xs text-stone-400">
                            当前生效渠道：<span className="font-medium text-stone-600 dark:text-stone-300">{activeChannel.name}</span>
                        </div>
                    )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                    {AI_TOOLS.map((tool) => {
                        const isEnabled = enabledToolIds.has(tool.id);
                        const channelWorkflows = activeChannel ? getChannelWorkflows(activeChannel, tool.category) : [];
                        const defaultWorkflow = channelWorkflows.find((w) => w.isDefault) || channelWorkflows[0];
                        const isReady = channelWorkflows.length > 0;

                        return (
                            <Card
                                key={tool.id}
                                size="small"
                                className={`transition-colors ${
                                    isEnabled
                                        ? "border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900/60"
                                        : "border-stone-200/50 bg-stone-50/40 opacity-70 dark:border-stone-800/40 dark:bg-stone-900/20"
                                }`}
                                styles={{ body: { padding: "12px 14px" } }}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                        <div className="grid size-7 shrink-0 place-items-center rounded-lg bg-stone-100 dark:bg-stone-800">
                                            {tool.icon}
                                        </div>
                                        <div className="font-medium text-xs text-stone-800 dark:text-stone-200">
                                            {tool.title}
                                        </div>
                                    </div>
                                    <Switch
                                        size="small"
                                        checked={isEnabled}
                                        onChange={(checked) => handleToggleTool(tool.id, checked)}
                                    />
                                </div>

                                <p className="mt-2 text-[11px] leading-relaxed text-stone-500 min-h-[32px]">
                                    {tool.desc}
                                </p>

                                <div className="mt-2.5 flex items-center justify-between border-t border-stone-100 pt-2 dark:border-stone-800/80">
                                    {isReady ? (
                                        <Tag color="success" className="!mr-0 !text-[10px] flex items-center gap-1">
                                            <CheckCircle2 className="size-2.5" />
                                            已就绪: {defaultWorkflow?.name}
                                        </Tag>
                                    ) : (
                                        <div className="flex items-center gap-1.5">
                                            <Tag color="warning" className="!mr-0 !text-[10px]">
                                                渠道未配置工作流
                                            </Tag>
                                            {onNavigateToChannels && (
                                                <Button
                                                    type="link"
                                                    size="small"
                                                    className="!h-auto !p-0 text-[11px] text-blue-500"
                                                    onClick={onNavigateToChannels}
                                                >
                                                    去配置 &gt;
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </Card>
                        );
                    })}
                </div>
            </div>

            <Divider className="!my-2" />

            {/* 基础操作工具组 */}
            <div className="space-y-3">
                <div>
                    <div className="text-sm font-semibold text-stone-800 dark:text-stone-200">
                        基础操作工具
                    </div>
                    <div className="text-xs text-stone-500">
                        运行在浏览器前端的纯视图交互、资产保存及图像处理工具
                    </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                    {FRONTEND_TOOLS.map((tool) => {
                        const isEnabled = enabledToolIds.has(tool.id);
                        return (
                            <Card
                                key={tool.id}
                                size="small"
                                className={`transition-colors ${
                                    isEnabled
                                        ? "border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900/60"
                                        : "border-stone-200/50 bg-stone-50/40 opacity-70 dark:border-stone-800/40 dark:bg-stone-900/20"
                                }`}
                                styles={{ body: { padding: "12px 14px" } }}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                        <div
                                            className={`grid size-7 shrink-0 place-items-center rounded-lg ${
                                                tool.danger
                                                    ? "bg-red-50 text-red-500 dark:bg-red-950/40"
                                                    : "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400"
                                            }`}
                                        >
                                            {tool.icon}
                                        </div>
                                        <div className="font-medium text-xs text-stone-800 dark:text-stone-200">
                                            {tool.title}
                                        </div>
                                    </div>
                                    <Switch
                                        size="small"
                                        checked={isEnabled}
                                        onChange={(checked) => handleToggleTool(tool.id, checked)}
                                    />
                                </div>

                                <p className="mt-2 text-[11px] leading-relaxed text-stone-500 min-h-[32px]">
                                    {tool.desc}
                                </p>
                            </Card>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
