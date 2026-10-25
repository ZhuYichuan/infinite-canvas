import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { App, Button, Empty, Input, Tag } from "antd";
import {
    ArrowRight,
    Check,
    Cpu,
    FolderPlus,
    Search,
    Users,
    Wrench,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { nanoid } from "nanoid";

import {
    DEFAULT_BUILTIN_COMFYUI_AUDIO_WORKFLOW,
    DEFAULT_BUILTIN_COMFYUI_DEPTH_VIDEO_WORKFLOW,
    DEFAULT_BUILTIN_COMFYUI_FACE_REFINE_WORKFLOW,
    DEFAULT_BUILTIN_COMFYUI_FRAME_VIDEO_WORKFLOW,
    DEFAULT_BUILTIN_COMFYUI_INPAINT_WORKFLOW,
    DEFAULT_BUILTIN_COMFYUI_QWEN_IMAGE_21_WORKFLOW,
    DEFAULT_BUILTIN_COMFYUI_T2I_WORKFLOW,
    DEFAULT_BUILTIN_COMFYUI_VIDEO_WORKFLOW,
} from "@/services/api/comfyui-default-workflows";
import {
    useConfigStore,
    type ComfyWorkflowItem,
    type WorkflowCategory,
} from "@/stores/use-config-store";

interface CommunityWorkflowItem {
    id: string;
    name: string;
    category: WorkflowCategory;
    author: string;
    description: string;
    tags: string[];
    minVram?: string;
    workflowJson: Record<string, unknown>;
}

// 社区初始精选推荐工作流集合（开箱即用，纯客户端无需中心后端）
const CURATED_COMMUNITY_WORKFLOWS: CommunityWorkflowItem[] = [
    {
        id: "wan2-1-speed-omni",
        name: "Wan2.1 极速文生视频 (720P)",
        category: "omniVideo",
        author: "ComfyOrg & Community",
        description: "基于 Wan2.1 蒸馏加速的超流畅 720P 电影感文生视频管线，带高动态运镜增强与自然物理惯性。",
        tags: ["Wan2.1", "720P", "Turbo", "Cinematic"],
        minVram: "12 GB",
        workflowJson: DEFAULT_BUILTIN_COMFYUI_VIDEO_WORKFLOW.json,
    },
    {
        id: "flux-turbo-t2i",
        name: "FLUX.1-Dev 电影感人像写真",
        category: "t2i",
        author: "BlackForest & ComfyLabs",
        description: "顶尖画质 FLUX.1 结构，带自然微距景深、皮肤毛孔写性质感与精细光影重构。",
        tags: ["FLUX.1", "Photorealism", "Portrait"],
        minVram: "16 GB",
        workflowJson: DEFAULT_BUILTIN_COMFYUI_T2I_WORKFLOW.json,
    },
    {
        id: "qwen-image-21-multiref",
        name: "Qwen-Image 2.1 多图参考图生图",
        category: "i2i",
        author: "Alibaba Tongyi Lab",
        description: "基于 Qwen-Image 2.1 的多参考图融合管线，支持保持主体一致性并融合指定艺术画风。",
        tags: ["Qwen-Image", "I2I", "Multi-Ref"],
        minVram: "8 GB",
        workflowJson: DEFAULT_BUILTIN_COMFYUI_QWEN_IMAGE_21_WORKFLOW.json,
    },
    {
        id: "minimax-h3-frame-video",
        name: "MiniMax H3 首尾帧运镜视频",
        category: "frameVideo",
        author: "MiniMax & KJNodes",
        description: "精准锁定第一帧与最后一帧，生成平滑过渡的电影机位航拍与推拉运镜。",
        tags: ["MiniMax", "FrameVideo", "FirstLastFrame"],
        minVram: "16 GB",
        workflowJson: DEFAULT_BUILTIN_COMFYUI_FRAME_VIDEO_WORKFLOW.json,
    },
    {
        id: "inpaint-brush-magic",
        name: "Qwen 智能涂抹重绘与局部消除",
        category: "inpaint",
        author: "ComfyUI LayerStyle Team",
        description: "支持任意形状画笔遮罩的高保真局部重绘，自动保持背景边界柔和自然羽化。",
        tags: ["Inpaint", "Mask", "Seamless"],
        minVram: "8 GB",
        workflowJson: DEFAULT_BUILTIN_COMFYUI_INPAINT_WORKFLOW.json,
    },
    {
        id: "minimax-music3-studio",
        name: "MiniMax Music3 电影配乐生成",
        category: "audio",
        author: "MiniMax Audio Group",
        description: "输入情感和场景文本，生成具备多乐器层次感与动态起伏的高品质立体声配乐。",
        tags: ["Audio", "Music", "Cinematic"],
        minVram: "8 GB",
        workflowJson: DEFAULT_BUILTIN_COMFYUI_AUDIO_WORKFLOW.json,
    },
    {
        id: "face-refine-highres",
        name: "人脸高清微距精修与五官增强",
        category: "faceRefine",
        author: "FaceDetailer Community",
        description: "自动识别画幅内所有人脸并进行 4K 细节重采样，彻底修复远景人脸崩坏缺陷。",
        tags: ["FaceDetailer", "HighRes", "Enhance"],
        minVram: "10 GB",
        workflowJson: DEFAULT_BUILTIN_COMFYUI_FACE_REFINE_WORKFLOW.json,
    },
    {
        id: "depth-anything-v2-video",
        name: "Depth Anything 空间深度视频",
        category: "depthVideo",
        author: "DepthLab Team",
        description: "实时提取视频序列的相对物理深度图，适用于裸眼 3D 与空间视频二次合成。",
        tags: ["Depth", "Spatial", "3D"],
        minVram: "8 GB",
        workflowJson: DEFAULT_BUILTIN_COMFYUI_DEPTH_VIDEO_WORKFLOW.json,
    },
];

const MODALITY_FILTERS: { key: string; label: string }[] = [
    { key: "all", label: "全部模态" },
    { key: "t2i", label: "文生图" },
    { key: "i2i", label: "图生图" },
    { key: "inpaint", label: "局部重绘" },
    { key: "omniVideo", label: "全能视频" },
    { key: "frameVideo", label: "首尾帧视频" },
    { key: "audio", label: "音乐音频" },
    { key: "faceRefine", label: "人脸精修" },
    { key: "depthVideo", label: "深度视频" },
];

export default function CommunityPage() {
    const { message } = App.useApp();
    const { t } = useTranslation();

    const [activeFilter, setActiveFilter] = useState("all");
    const [searchKeyword, setSearchKeyword] = useState("");
    const [installedIds, setInstalledIds] = useState<Set<string>>(new Set());

    // 过滤工作流列表
    const filteredWorkflows = useMemo(() => {
        return CURATED_COMMUNITY_WORKFLOWS.filter((item) => {
            if (activeFilter !== "all" && item.category !== activeFilter) {
                return false;
            }
            if (!searchKeyword.trim()) return true;
            const kw = searchKeyword.toLowerCase();
            return (
                item.name.toLowerCase().includes(kw) ||
                item.author.toLowerCase().includes(kw) ||
                item.description.toLowerCase().includes(kw) ||
                item.tags.some((tag) => tag.toLowerCase().includes(kw))
            );
        });
    }, [activeFilter, searchKeyword]);

    // 一键安装到画布
    const handleInstall = (item: CommunityWorkflowItem) => {
        const workflowItem: ComfyWorkflowItem = {
            id: nanoid(),
            name: item.name,
            category: item.category,
            json: item.workflowJson,
            createdAt: Date.now(),
            isBuiltin: false,
            description: item.description,
        };

        useConfigStore.getState().saveWorkflowGlobally(workflowItem);
        setInstalledIds((prev) => new Set([...prev, item.id]));
        message.success(`「${item.name}」已成功安装至本地画布与渠道配置！`);
    };

    return (
        <div className="flex h-full flex-col overflow-hidden bg-background text-stone-800 dark:text-stone-100">
            <main className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:py-8">
                <div className="mx-auto max-w-7xl">
                    {/* 页面标题区 */}
                    <div className="text-center">
                        <div className="inline-flex items-center gap-2 rounded-full border border-blue-200/80 bg-blue-50/60 px-3 py-1 text-xs font-medium text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-300">
                            <Users className="size-3.5" />
                            <span>去中心化开源工作流生态</span>
                        </div>
                        <h1 className="mt-3 text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100 sm:text-3xl">
                            {t("community.title")}
                        </h1>
                        <p className="mx-auto mt-2 max-w-2xl text-xs sm:text-sm text-stone-500 dark:text-stone-400">
                            {t("community.subtitle")}
                        </p>
                    </div>

                    {/* 首发核心功能：工作流适配工坊 引导横幅 */}
                    <div className="mt-8 overflow-hidden rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50/80 via-indigo-50/40 to-white p-6 shadow-sm dark:border-blue-900/60 dark:from-blue-950/30 dark:via-indigo-950/20 dark:to-stone-900">
                        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <Tag color="blue" className="px-2 py-0.5 text-xs font-semibold">
                                        首发旗舰工具
                                    </Tag>
                                    <h2 className="text-lg font-bold text-stone-900 dark:text-stone-100">
                                        工作流转换与适配工坊 (Workflow Studio)
                                    </h2>
                                </div>
                                <p className="max-w-2xl text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                                    把您在 ComfyUI 调试好的任意原生工作流 JSON 或生成原图（PNG/WebP）拖入工坊，自动分析 9 大模态、拓扑诊断、交互式分配连线插槽（Prompt、Seed、首尾帧、参考图），一键无缝接入无限画布中连线调度！
                                </p>
                            </div>

                            <Link to="/community/studio" className="shrink-0">
                                <Button
                                    type="primary"
                                    size="large"
                                    className="flex items-center gap-2 font-medium"
                                    icon={<Wrench className="size-4" />}
                                >
                                    <span>{t("community.enterStudio")}</span>
                                    <ArrowRight className="size-4" />
                                </Button>
                            </Link>
                        </div>
                    </div>

                    {/* 筛选与搜索工具条 */}
                    <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        {/* 模态分类胶囊 */}
                        <div className="hide-scrollbar flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                            {MODALITY_FILTERS.map((f) => (
                                <button
                                    key={f.key}
                                    type="button"
                                    onClick={() => setActiveFilter(f.key)}
                                    className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                                        activeFilter === f.key
                                            ? "bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900"
                                            : "bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
                                    }`}
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>

                        {/* 搜索框 */}
                        <div className="w-full sm:w-64">
                            <Input
                                prefix={<Search className="size-3.5 text-stone-400" />}
                                placeholder={t("community.searchPlaceholder")}
                                value={searchKeyword}
                                onChange={(e) => setSearchKeyword(e.target.value)}
                                allowClear
                                size="middle"
                            />
                        </div>
                    </div>

                    {/* 精选工作流卡片网格 */}
                    <div className="mt-6">
                        {filteredWorkflows.length === 0 ? (
                            <Empty description="未找到匹配的社区工作流" className="py-16" />
                        ) : (
                            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                {filteredWorkflows.map((item) => {
                                    const isInstalled = installedIds.has(item.id);
                                    return (
                                        <div
                                            key={item.id}
                                            className="group flex flex-col justify-between rounded-xl border border-stone-200/90 bg-white p-4.5 shadow-xs transition-all hover:border-stone-400 hover:shadow-md dark:border-stone-800 dark:bg-stone-900/90 dark:hover:border-stone-700"
                                        >
                                            <div>
                                                {/* 头部元信息 */}
                                                <div className="flex items-center justify-between gap-2">
                                                    <Tag color="geekblue" className="text-[11px] font-semibold">
                                                        {item.category}
                                                    </Tag>
                                                    {item.minVram && (
                                                        <span className="flex items-center gap-1 text-[11px] text-stone-400">
                                                            <Cpu className="size-3" />
                                                            {item.minVram}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* 标题与描述 */}
                                                <h3 className="mt-2.5 font-semibold text-sm text-stone-900 dark:text-stone-100 line-clamp-1">
                                                    {item.name}
                                                </h3>
                                                <p className="mt-1 text-xs text-stone-500 dark:text-stone-400 line-clamp-2 leading-relaxed">
                                                    {item.description}
                                                </p>

                                                {/* 标签 */}
                                                <div className="mt-3 flex flex-wrap gap-1">
                                                    {item.tags.map((t) => (
                                                        <span
                                                            key={t}
                                                            className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-600 dark:bg-stone-800 dark:text-stone-400"
                                                        >
                                                            #{t}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* 底部操作栏 */}
                                            <div className="mt-5 border-t border-stone-100 pt-3 dark:border-stone-800">
                                                <div className="flex items-center justify-between text-xs text-stone-400 mb-3">
                                                    <span>作者: {item.author}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        block
                                                        type={isInstalled ? "default" : "primary"}
                                                        icon={
                                                            isInstalled ? (
                                                                <Check className="size-3.5 text-green-600" />
                                                            ) : (
                                                                <FolderPlus className="size-3.5" />
                                                            )
                                                        }
                                                        onClick={() => handleInstall(item)}
                                                    >
                                                        {isInstalled ? t("community.installed") : t("community.installToCanvas")}
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
