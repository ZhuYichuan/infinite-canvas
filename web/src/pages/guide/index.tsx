import { useState } from "react";
import { App, Button, Card, Divider, Tag, Tooltip } from "antd";
import {
    AlertCircle,
    ArrowRight,
    Check,
    CheckCircle2,
    Copy,
    Download,
    ExternalLink,
    FileCode,
    FolderTree,
    HelpCircle,
    Info,
    Layers,
    Package,
    Puzzle,
    RefreshCw,
    Terminal,
    Wrench,
} from "lucide-react";
import { Link } from "react-router-dom";
import { saveAs } from "file-saver";

import { createZip } from "@/lib/zip";
import { useCopyText } from "@/hooks/use-copy-text";
import { useConfigStore } from "@/stores/use-config-store";

const CORS_FLAG = '--enable-cors-header "*"';
const LAUNCH_CMD_EXAMPLE = 'python.exe main.py --listen 0.0.0.0 --enable-manager --enable-cors-header "*"';

export const REQUIRED_PLUGINS = [
    {
        name: "Comfyui-kktools",
        repo: "zhiwendesign/Comfyui-kktools",
        url: "https://github.com/zhiwendesign/Comfyui-kktools",
        desc: "大语言模型多模态文本生成、提示词润色扩写与反推",
        usedBy: "文本生成 / 反推工作流",
    },
    {
        name: "ComfyUI-KJNodes",
        repo: "kijai/ComfyUI-KJNodes",
        url: "https://github.com/kijai/ComfyUI-KJNodes",
        desc: "高级逻辑控制与视频多模态组件解包提取 (GetVideoComponents 等)",
        usedBy: "全能参考视频工作流",
    },
    {
        name: "ComfyLiterals",
        repo: "M1kep/ComfyLiterals",
        url: "https://github.com/M1kep/ComfyLiterals",
        desc: "字面量、常数类型及动态参数输入端口节点",
        usedBy: "首尾帧视频 / 全能参考视频工作流",
    },
    {
        name: "ComfyUI-UniversalToolkit",
        repo: "whmc76/ComfyUI-UniversalToolkit",
        url: "https://github.com/whmc76/ComfyUI-UniversalToolkit",
        desc: "通用工具箱与多类型参数转接桥接",
        usedBy: "文本生成 / 反推工作流",
    },
    {
        name: "ComfyUI_LayerStyle",
        repo: "chflame163/ComfyUI_LayerStyle",
        url: "https://github.com/chflame163/ComfyUI_LayerStyle",
        desc: "图层样式合成与局部重绘遮罩 (Mask) 处理",
        usedBy: "局部编辑 (Inpaint) 工作流",
    },
];

export const CLONE_PLUGINS_CMD = [
    "cd custom_nodes",
    "git clone https://github.com/zhiwendesign/Comfyui-kktools.git",
    "git clone https://github.com/kijai/ComfyUI-KJNodes.git",
    "git clone https://github.com/M1kep/ComfyLiterals.git",
    "git clone https://github.com/whmc76/ComfyUI-UniversalToolkit.git",
    "git clone https://github.com/chflame163/ComfyUI_LayerStyle.git",
].join("\n");

type WorkflowModelSpec = {
    category: string;
    folder: string;
    files: string[];
};

type WorkflowItem = {
    id: string;
    name: string;
    badge: string;
    badgeColor?: string;
    baseModel: string;
    fileName: string;
    downloadUrl: string;
    description: string;
    plugins?: {
        name: string;
        url: string;
    }[];
    models: WorkflowModelSpec[];
    tips?: string;
};

const WORKFLOWS: WorkflowItem[] = [
    {
        id: "t2i",
        name: "文生图工作流 (T2I)",
        badge: "文生图",
        badgeColor: "blue",
        baseModel: "Z-Image-Turbo Int8",
        fileName: "image_z_image_turbo_workflow.json",
        downloadUrl: "/workflows/image_z_image_turbo_workflow.json",
        description: "基于 Z-Image-Turbo 极速出图架构，在保持极快采样速度的同时生成高画质图像，适合画布快速创意发散。",
        models: [
            { category: "VAE", folder: "models/vae/", files: ["ae.safetensors"] },
            { category: "扩散模型", folder: "models/diffusion_models/", files: ["z_image_turbo_bf16.safetensors"] },
            { category: "文本编码器", folder: "models/text_encoders/", files: ["qwen_3_4b.safetensors"] },
        ],
        tips: "标准原生节点即可运行，极速出图；ComfyUI 需确保支持新版 Qwen 文本编码器。",
    },
    {
        id: "i2i",
        name: "图生图工作流 (I2I)",
        badge: "图生图 / 多图编辑",
        badgeColor: "purple",
        baseModel: "Flux2.Dev",
        fileName: "image_flux2.dev_mult_image_edit_workflow.json",
        downloadUrl: "/workflows/image_flux2.dev_mult_image_edit_workflow.json",
        description: "基于 Flux2.Dev 多图编辑架构，支持在画布中连接多张参考图进行风格迁移、融合推演与高质量图生图。",
        models: [
            { category: "LoRA", folder: "models/loras/", files: ["Flux2TurboComfyv2.safetensors"] },
            { category: "VAE", folder: "models/vae/", files: ["flux2-vae.safetensors"] },
            { category: "扩散模型", folder: "models/diffusion_models/", files: ["flux2_dev_fp8mixed.safetensors"] },
            { category: "文本编码器", folder: "models/text_encoders/", files: ["mistral_3_small_flux2_fp8.safetensors"] },
        ],
        tips: "模型较大，推荐在具有 16GB 以上显存环境运行；显存较小可配置 ComfyUI 启动参数 --lowvram。",
    },
    {
        id: "inpaint",
        name: "局部编辑工作流 (Inpaint)",
        badge: "局部重绘",
        badgeColor: "cyan",
        baseModel: "Qwen千问图像局部重绘 ControlNet",
        fileName: "mask_edit_workflow.json",
        downloadUrl: "/workflows/mask_edit_workflow.json",
        description: "专为无限画布局部涂抹修图设计，支持接收前端遮罩图（ref_mask）对指定区域进行精准修改与内容补全。",
        plugins: [
            {
                name: "ComfyUI_LayerStyle",
                url: "https://github.com/chflame163/ComfyUI_LayerStyle",
            },
        ],
        models: [
            { category: "LoRA", folder: "models/loras/", files: ["Qwen-Image-Lightning-4steps-V1.0.safetensors"] },
            { category: "VAE", folder: "models/vae/", files: ["qwen_image_vae.safetensors"] },
            { category: "扩散模型", folder: "models/diffusion_models/", files: ["qwen_image_fp8_e4m3fn.safetensors"] },
            { category: "文本编码器", folder: "models/text_encoders/", files: ["qwen_2.5_vl_7b_fp8_scaled.safetensors"] },
        ],
        tips: "画布节点涂抹生成的白色 Mask 会自动送入 ref_mask 槽位；依赖 ComfyUI_LayerStyle 插件处理遮罩与图层。",
    },
    {
        id: "llm",
        name: "文本生成 / 反推工作流 (LLM)",
        badge: "大语言模型 / 反推",
        badgeColor: "green",
        baseModel: "Qwen3.5: 文本生成",
        fileName: "llm_qwen3_5_text_gen_workflow.json",
        downloadUrl: "/workflows/llm_qwen3_5_text_gen_workflow.json",
        description: "用于无限画布中的多模态文本生成、提示词润色扩写与画面反推，由本地端侧大语言模型直接驱动。",
        plugins: [
            {
                name: "Comfyui-kktools",
                url: "https://github.com/zhiwendesign/Comfyui-kktools",
            },
            {
                name: "ComfyUI-UniversalToolkit",
                url: "https://github.com/whmc76/ComfyUI-UniversalToolkit",
            },
        ],
        models: [
            { category: "扩散模型", folder: "models/diffusion_models/", files: ["qwen3.5_4b_bf16.safetensors"] },
        ],
        tips: "⚠️ 依赖第三方插件 Comfyui-kktools 和 ComfyUI-UniversalToolkit，请先安装到 custom_nodes/ 目录。",
    },
    {
        id: "frame_video",
        name: "首尾帧视频工作流 (FL2V)",
        badge: "首尾帧视频",
        badgeColor: "gold",
        baseModel: "MiniMax H3 fl2va",
        fileName: "minimax_H3_i2v&t2v_workflow.json",
        downloadUrl: "/workflows/minimax_H3_i2v&t2v_workflow.json",
        description: "支持指定视频的起始首帧与终止尾帧，在两张画面之间平滑插值演化，生成动感连贯的高清音画同步视频。",
        plugins: [
            {
                name: "ComfyLiterals",
                url: "https://github.com/M1kep/ComfyLiterals",
            },
        ],
        models: [
            { category: "VAE", folder: "models/vae/", files: ["minimax_h3_video_vae_fp16.safetensors", "minimax_h3_audio_vae_fp32.safetensors"] },
            { category: "扩散模型", folder: "models/diffusion_models/", files: ["minimax_h3_fl2va_pruned_fp8_scaled.safetensors"] },
            { category: "文本编码器", folder: "models/text_encoders/", files: ["qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors"] },
        ],
        tips: "包含视频与音频双 VAE；视频分辨率硬件对齐锁定，支持 16:9 与 9:16 画幅；依赖 ComfyLiterals 节点。",
    },
    {
        id: "ref_video",
        name: "全能参考视频工作流 (Video / Omni)",
        badge: "全能多模态参考视频",
        badgeColor: "orange",
        baseModel: "MiniMax H3 ref2va",
        fileName: "minimax_h3_ref2v_workflow.json",
        downloadUrl: "/workflows/minimax_h3_ref2v_workflow.json",
        description: "支持最多 9 张参考图 + 3 段参考视频 + 3 段参考音频多模态混音生成，未连满的插槽会被系统自动优雅裁剪。",
        plugins: [
            {
                name: "ComfyUI-KJNodes",
                url: "https://github.com/kijai/ComfyUI-KJNodes",
            },
            {
                name: "ComfyLiterals",
                url: "https://github.com/M1kep/ComfyLiterals",
            },
        ],
        models: [
            { category: "LoRA", folder: "models/loras/", files: ["minimax_h3_ref2v_lightx2v_turbo_4step_v0.1_resized_avg_rank_20_bf16.safetensors"] },
            { category: "VAE", folder: "models/vae/", files: ["minimax_h3_video_vae_fp16.safetensors", "minimax_h3_audio_vae_fp32.safetensors"] },
            { category: "扩散模型", folder: "models/diffusion_models/", files: ["minimax_h3_ref2va_pruned_fp8_scaled.safetensors"] },
            { category: "文本编码器", folder: "models/text_encoders/", files: ["qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors"] },
        ],
        tips: "MiniMax H3 旗舰参考视频架构，支持多模态输入，生成耗时与显存需求较高；依赖 ComfyUI-KJNodes 与 ComfyLiterals。",
    },
];

export default function GuidePage() {
    const { message } = App.useApp();
    const copyText = useCopyText();
    const [downloadingZip, setDownloadingZip] = useState(false);
    const [detecting, setDetecting] = useState(false);
    const [comfyStatus, setComfyStatus] = useState<"unknown" | "online" | "offline">("unknown");

    const config = useConfigStore((state) => state.config);
    const comfyChannel = config.channels.find((c) => c.apiFormat === "comfyui" && c.comfyuiProxyUrl?.trim()) || config.channels[0];
    const configuredUrl = (comfyChannel?.comfyuiProxyUrl || "").trim() || "http://127.0.0.1:8188";
    const channelName = comfyChannel?.name || "默认渠道";

    const handleCheckComfy = async () => {
        setDetecting(true);
        const baseEndpoint = configuredUrl.replace(/\/+$/, "");
        const probeUrl = `${baseEndpoint}/system_stats`;
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            const headers: Record<string, string> = {};
            if (comfyChannel?.comfyuiProxyToken?.trim()) {
                headers.Authorization = `Bearer ${comfyChannel.comfyuiProxyToken.trim()}`;
            }
            const res = await fetch(probeUrl, {
                method: "GET",
                headers,
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            if (res.ok) {
                setComfyStatus("online");
                message.success(`ComfyUI 服务 (${configuredUrl}) 连接正常！`);
            } else {
                setComfyStatus("offline");
                message.warning(`ComfyUI 响应状态码: ${res.status}`);
            }
        } catch {
            setComfyStatus("offline");
            message.error(`未能连接到 ${configuredUrl}。请确认 ComfyUI 已启动且配置了 --enable-cors-header "*"`);
        } finally {
            setDetecting(false);
        }
    };

    const handleDownloadSingle = (wf: WorkflowItem) => {
        const link = document.createElement("a");
        link.href = wf.downloadUrl;
        link.download = wf.fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        message.success(`开始下载 ${wf.fileName}`);
    };

    const handleDownloadAllZip = async () => {
        setDownloadingZip(true);
        try {
            const zipFiles: Array<{ name: string; data: BlobPart }> = [];
            for (const item of WORKFLOWS) {
                const response = await fetch(item.downloadUrl);
                if (!response.ok) {
                    throw new Error(`下载工作流文件 ${item.fileName} 失败`);
                }
                const text = await response.text();
                zipFiles.push({ name: item.fileName, data: text });
            }

            const readmeContent = [
                "# Infinite Canvas · ComfyUI 官方核心工作流包",
                "",
                "本压缩包包含了本系统全部 6 个开箱即用的工作流文件（.json）：",
                ...WORKFLOWS.map((wf) => `\n## ${wf.name} (${wf.fileName})\n- 基础模型：${wf.baseModel}\n- 模型放置要求：\n${wf.models.map((m) => `  * [${m.category}] ${m.folder}: ${m.files.join(", ")}`).join("\n")}${wf.plugins?.length ? `\n- 依赖插件：${wf.plugins.map((p) => `${p.name} (${p.url})`).join(", ")}` : ""}`),
                "",
                "----------------------------------------",
                "必须安装的 5 大 ComfyUI 核心插件（克隆至 custom_nodes/ 目录）：",
                ...REQUIRED_PLUGINS.map((p, idx) => `${idx + 1}. ${p.name} - ${p.desc}\n   仓库地址: ${p.url}\n   适用模块: ${p.usedBy}`),
                "",
                "一键克隆全部插件安装脚本（在 ComfyUI 的 custom_nodes/ 目录下运行）：",
                CLONE_PLUGINS_CMD,
                "",
                "----------------------------------------",
                "部署调试说明：",
                `1. 启动本地 ComfyUI 必须开启跨域：例如 \`${LAUNCH_CMD_EXAMPLE}\`；`,
                "2. 将对应的模型 safetensors 放入 ComfyUI 的 `models/` 对应子目录；",
                "3. 将上述 5 大必备插件克隆到 `custom_nodes/` 目录并重启 ComfyUI；",
                "4. 缺少节点时在 ComfyUI-Manager 中点击「Install Missing Custom Nodes」；",
                "5. 将工作流拖入 ComfyUI Web 界面点击 Queue Prompt 测试；",
                "6. 在本系统中「设置 → 模型渠道」确认服务地址与端口并保存即可！",
            ].join("\n");

            zipFiles.push({ name: "README_模型与存放目录清单.txt", data: readmeContent });

            const zipBlob = await createZip(zipFiles);
            saveAs(zipBlob, "infinite-canvas-comfyui-workflows.zip");
            message.success("工作流合集打包下载成功！");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "打包下载失败");
        } finally {
            setDownloadingZip(false);
        }
    };

    return (
        <main className="h-full overflow-y-auto bg-background text-stone-950 dark:text-stone-100">
            <div className="mx-auto max-w-6xl px-6 py-8 pb-20">
                {/* 顶部标题区 */}
                <div className="mb-8 flex flex-col justify-between gap-4 border-b border-stone-200 pb-6 md:flex-row md:items-end dark:border-stone-800">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-stone-100/70 px-3 py-1 text-xs text-stone-600 dark:border-stone-800 dark:bg-stone-900/70 dark:text-stone-400">
                            <Layers className="size-3.5" />
                            <span>本地自建 ComfyUI 原生 API 直连</span>
                        </div>
                        <h1 className="mt-3 text-2xl font-bold tracking-tight text-stone-950 sm:text-3xl dark:text-stone-100">
                            用户使用手册与工作流下载
                        </h1>
                        <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500 dark:text-stone-400">
                            Infinite Canvas 采用纯前端无服务器架构，直连您本机的 ComfyUI（默认端口 8188）。下载并导入下方官方预设工作流，配齐模型并在本地 ComfyUI 调试通过后，即可在无限画布中开展流畅的全流程 AI 创作。
                        </p>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2.5">
                        <Button
                            type="primary"
                            icon={<Package className="size-4" />}
                            loading={downloadingZip}
                            onClick={handleDownloadAllZip}
                        >
                            打包下载全部工作流 (.zip)
                        </Button>
                        <Link to="/config">
                            <Button icon={<ArrowRight className="size-4" />} iconPlacement="end">
                                前往配置渠道
                            </Button>
                        </Link>
                    </div>
                </div>

                {/* ComfyUI 本地连通性轻量诊断条 */}
                <div className="mb-8 rounded-lg border border-stone-200 bg-stone-50 p-4 dark:border-stone-800 dark:bg-stone-900/40">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-stone-200 dark:bg-stone-800">
                                <Terminal className="size-4 text-stone-700 dark:text-stone-300" />
                            </div>
                            <div>
                                <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                                    <span>本地服务探测</span>
                                    <span className="text-xs text-stone-500">({channelName})：</span>
                                    <code className="rounded bg-stone-200/60 px-1.5 py-0.5 text-xs text-stone-700 dark:bg-stone-800 dark:text-stone-300">
                                        {configuredUrl}
                                    </code>
                                    {comfyStatus === "online" && (
                                        <Tag color="success" className="m-0 inline-flex items-center gap-1">
                                            <CheckCircle2 className="size-3" /> 在线就绪
                                        </Tag>
                                    )}
                                    {comfyStatus === "offline" && (
                                        <Tag color="error" className="m-0 inline-flex items-center gap-1">
                                            <AlertCircle className="size-3" /> 未连通 (请加跨域参数)
                                        </Tag>
                                    )}
                                </div>
                                <p className="mt-0.5 text-xs text-stone-500">
                                    探测目标为您在「配置」中设定的 ComfyUI 地址。启动时请务必开启跨域参数{" "}
                                    <code className="font-semibold text-stone-800 dark:text-stone-200">{CORS_FLAG}</code>
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Link to="/config">
                                <Button size="small">修改配置</Button>
                            </Link>
                            <Button
                                size="small"
                                type="primary"
                                icon={<RefreshCw className={`size-3.5 ${detecting ? "animate-spin" : ""}`} />}
                                loading={detecting}
                                onClick={handleCheckComfy}
                            >
                                测试连接
                            </Button>
                        </div>
                    </div>

                    {/* 完整启动命令举例与一键复制 */}
                    <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 rounded-md border border-stone-200/70 bg-stone-100/80 px-3 py-2 text-xs dark:border-stone-800 dark:bg-stone-800/60">
                        <div className="flex min-w-0 items-center gap-2 font-mono text-[11px] text-stone-700 dark:text-stone-300">
                            <span className="shrink-0 font-sans font-medium text-stone-500">推荐启动命令：</span>
                            <span className="truncate">{LAUNCH_CMD_EXAMPLE}</span>
                        </div>
                        <Tooltip title="一键复制完整启动命令">
                            <button
                                type="button"
                                onClick={() => copyText(LAUNCH_CMD_EXAMPLE, "已复制完整启动命令")}
                                className="inline-flex shrink-0 items-center gap-1 rounded bg-stone-200/70 px-2 py-1 text-[11px] font-medium text-stone-700 transition hover:bg-stone-300 dark:bg-stone-700/80 dark:text-stone-200 dark:hover:bg-stone-600"
                            >
                                <Copy className="size-3" /> 复制命令
                            </button>
                        </Tooltip>
                    </div>
                </div>

                {/* 极简快速起步四步法 */}
                <div className="mb-10">
                    <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-stone-900 dark:text-stone-100">
                        <Check className="size-4 text-emerald-600 dark:text-emerald-400" />
                        快速起步：4 步完成本地 ComfyUI 对接
                    </h2>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded-lg border border-stone-200 bg-card p-4 dark:border-stone-800">
                            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-stone-500">
                                <span className="flex size-5 items-center justify-center rounded-full bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900">
                                    1
                                </span>
                                启动本地 ComfyUI
                            </div>
                            <p className="text-xs leading-5 text-stone-600 dark:text-stone-400">
                                启动命令务必包含跨域参数：
                            </p>
                            <div className="mt-2 flex items-center justify-between rounded bg-stone-100 px-2 py-1.5 font-mono text-[11px] text-stone-800 dark:bg-stone-800/80 dark:text-stone-200">
                                <span className="truncate">{CORS_FLAG}</span>
                                <button
                                    type="button"
                                    onClick={() => copyText(CORS_FLAG, "已复制跨域参数")}
                                    className="ml-1 text-stone-500 hover:text-stone-900 dark:hover:text-stone-100"
                                    title="复制跨域参数"
                                >
                                    <Copy className="size-3" />
                                </button>
                            </div>
                            <button
                                type="button"
                                onClick={() => copyText(LAUNCH_CMD_EXAMPLE, "已复制完整启动命令")}
                                className="mt-2 block text-[11px] text-stone-500 underline decoration-dotted hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
                            >
                                复制完整启动命令
                            </button>
                        </div>

                        <div className="rounded-lg border border-stone-200 bg-card p-4 dark:border-stone-800">
                            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-stone-500">
                                <span className="flex size-5 items-center justify-center rounded-full bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900">
                                    2
                                </span>
                                下载工作流文件
                            </div>
                            <p className="text-xs leading-5 text-stone-600 dark:text-stone-400">
                                点击右上角打包下载全部工作流，或在下方按需下载所需模块的工作流 JSON 文件。
                            </p>
                        </div>

                        <div className="rounded-lg border border-stone-200 bg-card p-4 dark:border-stone-800">
                            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-stone-500">
                                <span className="flex size-5 items-center justify-center rounded-full bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900">
                                    3
                                </span>
                                安装插件与模型
                            </div>
                            <p className="text-xs leading-5 text-stone-600 dark:text-stone-400">
                                将下方 5 大核心插件克隆至 <code className="font-mono">custom_nodes/</code>，并将权重放入 <code className="font-mono">models/</code> 对应目录。
                            </p>
                        </div>

                        <div className="rounded-lg border border-stone-200 bg-card p-4 dark:border-stone-800">
                            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-stone-500">
                                <span className="flex size-5 items-center justify-center rounded-full bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900">
                                    4
                                </span>
                                调试成功后即可使用
                            </div>
                            <p className="text-xs leading-5 text-stone-600 dark:text-stone-400">
                                将工作流拖入 ComfyUI 页面点击 Queue 生成测试无报错后，回到本项目配置渠道，即可畅享画布生成！
                            </p>
                        </div>
                    </div>
                </div>

                {/* 运行必备 5 大 ComfyUI 核心插件专区 */}
                <div className="mb-12">
                    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg font-bold text-stone-950 dark:text-stone-100">
                                    运行必备 5 大 ComfyUI 核心扩展插件
                                </h2>
                                <Tag color="blue" className="m-0 text-xs">
                                    必须安装
                                </Tag>
                            </div>
                            <p className="mt-0.5 text-xs text-stone-500">
                                本项目所有官方工作流均基于这 5 个插件构建。在 ComfyUI 的 <code className="rounded bg-stone-100 px-1 py-0.5 font-mono text-[11px] text-stone-700 dark:bg-stone-800 dark:text-stone-300">custom_nodes/</code> 目录下完成克隆并重启 ComfyUI。
                            </p>
                        </div>
                        <Button
                            size="small"
                            icon={<Copy className="size-3.5" />}
                            onClick={() => copyText(CLONE_PLUGINS_CMD, "已复制全部插件克隆命令")}
                        >
                            一键复制全部克隆命令
                        </Button>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {REQUIRED_PLUGINS.map((plugin, idx) => (
                            <div
                                key={plugin.name}
                                className="flex flex-col justify-between rounded-lg border border-stone-200 bg-card p-4 shadow-sm dark:border-stone-800"
                            >
                                <div>
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-stone-100 font-mono text-[11px] font-semibold text-stone-600 dark:bg-stone-800 dark:text-stone-300">
                                                {idx + 1}
                                            </span>
                                            <a
                                                href={plugin.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 font-semibold text-stone-900 underline underline-offset-2 hover:text-blue-600 dark:text-stone-100 dark:hover:text-blue-400"
                                            >
                                                {plugin.name}
                                                <ExternalLink className="size-3" />
                                            </a>
                                        </div>
                                    </div>
                                    <p className="mt-2 text-xs leading-relaxed text-stone-600 dark:text-stone-400">
                                        {plugin.desc}
                                    </p>
                                    <div className="mt-2.5">
                                        <Tag className="text-[10px] text-stone-500 dark:text-stone-400">
                                            {plugin.usedBy}
                                        </Tag>
                                    </div>
                                </div>
                                <div className="mt-3 flex items-center justify-between rounded bg-stone-100 px-2 py-1.5 font-mono text-[11px] text-stone-700 dark:bg-stone-900/60 dark:text-stone-300">
                                    <span className="truncate" title={`git clone ${plugin.url}.git`}>
                                        git clone .../{plugin.name}.git
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => copyText(`git clone ${plugin.url}.git`, `已复制 ${plugin.name} 克隆命令`)}
                                        className="ml-1 shrink-0 text-stone-500 hover:text-stone-900 dark:hover:text-stone-100"
                                        title="复制克隆命令"
                                    >
                                        <Copy className="size-3" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 6 大核心工作流卡片专区 */}
                <div className="mb-12">
                    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-bold text-stone-950 dark:text-stone-100">
                                官方预置 6 大核心工作流清单
                            </h2>
                            <p className="mt-0.5 text-xs text-stone-500">
                                拖入本地 ComfyUI Web 界面即可加载调试；点击右侧按钮下载对应 JSON 文件。
                            </p>
                        </div>
                        <Button
                            size="small"
                            icon={<Download className="size-3.5" />}
                            loading={downloadingZip}
                            onClick={handleDownloadAllZip}
                        >
                            一键打包全部 (.zip)
                        </Button>
                    </div>

                    <div className="grid gap-5 md:grid-cols-2">
                        {WORKFLOWS.map((wf) => (
                            <Card
                                key={wf.id}
                                className="flex flex-col justify-between border-stone-200 bg-card shadow-sm dark:border-stone-800"
                                styles={{ body: { padding: "18px", display: "flex", flexDirection: "column", height: "100%" } }}
                            >
                                <div>
                                    {/* 卡片头部 */}
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="font-semibold text-stone-950 dark:text-stone-100">
                                                    {wf.name}
                                                </span>
                                                <Tag color={wf.badgeColor} className="m-0 text-[11px]">
                                                    {wf.badge}
                                                </Tag>
                                            </div>
                                            <div className="mt-1 text-xs text-stone-500">
                                                核心算法：<span className="font-medium text-stone-700 dark:text-stone-300">{wf.baseModel}</span>
                                            </div>
                                        </div>
                                        <Button
                                            type="primary"
                                            size="small"
                                            icon={<Download className="size-3.5" />}
                                            onClick={() => handleDownloadSingle(wf)}
                                            className="shrink-0"
                                        >
                                            下载工作流
                                        </Button>
                                    </div>

                                    {/* 描述 */}
                                    <p className="mt-3 text-xs leading-5 text-stone-600 dark:text-stone-400">
                                        {wf.description}
                                    </p>

                                    {/* 依赖插件 */}
                                    {wf.plugins && wf.plugins.length > 0 && (
                                        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50/60 px-2.5 py-1.5 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                                            <Puzzle className="size-3.5 shrink-0" />
                                            <span>依赖插件：</span>
                                            <div className="inline-flex flex-wrap items-center gap-2">
                                                {wf.plugins.map((plugin) => (
                                                    <a
                                                        key={plugin.name}
                                                        href={plugin.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1 font-medium underline underline-offset-2 hover:text-amber-950 dark:hover:text-amber-100"
                                                    >
                                                        {plugin.name}
                                                        <ExternalLink className="size-3" />
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* 模型目录要求 */}
                                    <div className="mt-3.5 rounded-lg border border-stone-200/80 bg-stone-50/80 p-3 dark:border-stone-800/80 dark:bg-stone-900/40">
                                        <div className="mb-2 flex items-center justify-between text-[11px] font-semibold text-stone-600 dark:text-stone-400">
                                            <div className="flex items-center gap-1.5">
                                                <FolderTree className="size-3.5" />
                                                <span>本地模型存放路径要求 (ComfyUI models/)</span>
                                            </div>
                                            <Tooltip title="一键复制本工作流所需全部模型文件名">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        copyText(
                                                            wf.models
                                                                .flatMap((m) => m.files.map((f) => `${m.folder}${f}`))
                                                                .join("\n"),
                                                            "已复制模型路径清单",
                                                        )
                                                    }
                                                    className="inline-flex items-center gap-1 text-[11px] text-stone-500 transition hover:text-stone-950 dark:hover:text-stone-200"
                                                >
                                                    <Copy className="size-3" /> 复制清单
                                                </button>
                                            </Tooltip>
                                        </div>

                                        <div className="space-y-2">
                                            {wf.models.map((m) => (
                                                <div key={m.folder} className="text-xs">
                                                    <div className="font-mono text-[11px] text-stone-400">
                                                        {m.folder}
                                                    </div>
                                                    <div className="mt-0.5 space-y-1">
                                                        {m.files.map((file) => (
                                                            <div
                                                                key={file}
                                                                className="flex items-center justify-between rounded bg-white px-2 py-1 text-xs text-stone-800 shadow-xs dark:bg-stone-800/70 dark:text-stone-200"
                                                            >
                                                                <span className="truncate font-mono font-medium">{file}</span>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => copyText(file, `已复制模型名：${file}`)}
                                                                    className="ml-2 text-stone-400 hover:text-stone-700 dark:hover:text-stone-100"
                                                                    title="复制文件名"
                                                                >
                                                                    <Copy className="size-3" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* 底部提示 */}
                                {wf.tips && (
                                    <div className="mt-3 flex items-start gap-1.5 text-[11px] leading-4 text-stone-500 dark:text-stone-400">
                                        <Info className="mt-0.5 size-3 shrink-0 text-stone-400" />
                                        <span>{wf.tips}</span>
                                    </div>
                                )}
                            </Card>
                        ))}
                    </div>
                </div>

                <Divider className="my-10" />

                {/* 常见问题与排错指引 */}
                <div>
                    <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-stone-950 dark:text-stone-100">
                        <HelpCircle className="size-5 text-stone-600 dark:text-stone-400" />
                        常见排错与调试 FAQ
                    </h2>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-lg border border-stone-200 p-4 dark:border-stone-800">
                            <h3 className="flex items-center gap-2 text-sm font-semibold text-stone-900 dark:text-stone-100">
                                <AlertCircle className="size-4 text-amber-500" />
                                1. 提示 Failed to fetch 或跨域 CORS 错误？
                            </h3>
                            <p className="mt-2 text-xs leading-5 text-stone-600 dark:text-stone-400">
                                浏览器基于安全策略禁止跨域访问。请在启动 ComfyUI 的脚本或命令行中追加跨域参数{" "}
                                <code className="rounded bg-stone-100 px-1 py-0.5 font-mono text-stone-800 dark:bg-stone-800 dark:text-stone-200">
                                    {CORS_FLAG}
                                </code>
                                。
                            </p>
                            <div className="mt-2.5 rounded bg-stone-100 p-2 font-mono text-[11px] text-stone-700 dark:bg-stone-800 dark:text-stone-300">
                                <div className="mb-1 text-[10px] text-stone-400">典型启动命令示例（Windows bat 或终端）：</div>
                                <div className="flex items-center justify-between gap-2">
                                    <span className="truncate">{LAUNCH_CMD_EXAMPLE}</span>
                                    <button
                                        type="button"
                                        onClick={() => copyText(LAUNCH_CMD_EXAMPLE, "已复制启动命令")}
                                        className="text-stone-500 hover:text-stone-900 dark:hover:text-stone-100"
                                        title="复制命令"
                                    >
                                        <Copy className="size-3" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-lg border border-stone-200 p-4 dark:border-stone-800">
                            <h3 className="flex items-center gap-2 text-sm font-semibold text-stone-900 dark:text-stone-100">
                                <Wrench className="size-4 text-blue-500" />
                                2. 工作流导入后显示红色缺失节点 (Missing Nodes)？
                            </h3>
                            <p className="mt-2 text-xs leading-5 text-stone-600 dark:text-stone-400">
                                请在 ComfyUI 网页界面中打开 <span className="font-semibold text-stone-800 dark:text-stone-200">ComfyUI-Manager</span>，点击 <span className="font-semibold text-stone-800 dark:text-stone-200">Install Missing Custom Nodes</span> 自动查找并安装缺失的扩展节点，安装完毕后重启 ComfyUI。
                            </p>
                        </div>

                        <div className="rounded-lg border border-stone-200 p-4 dark:border-stone-800">
                            <h3 className="flex items-center gap-2 text-sm font-semibold text-stone-900 dark:text-stone-100">
                                <Layers className="size-4 text-purple-500" />
                                3. 显存不足 (CUDA Out of Memory) 报错？
                            </h3>
                            <p className="mt-2 text-xs leading-5 text-stone-600 dark:text-stone-400">
                                MiniMax H3 视频与 Flux 模型显存需求较高。启动时添加{" "}
                                <code className="rounded bg-stone-100 px-1 py-0.5 font-mono text-stone-800 dark:bg-stone-800 dark:text-stone-200">
                                    --lowvram
                                </code>{" "}
                                或选用 FP8 压缩精度的扩散模型，可以显著降低峰值显存占用。
                            </p>
                        </div>

                        <div className="rounded-lg border border-stone-200 p-4 dark:border-stone-800">
                            <h3 className="flex items-center gap-2 text-sm font-semibold text-stone-900 dark:text-stone-100">
                                <FileCode className="size-4 text-emerald-500" />
                                4. 如何使用自己调整过的自定义工作流？
                            </h3>
                            <p className="mt-2 text-xs leading-5 text-stone-600 dark:text-stone-400">
                                在 ComfyUI 设置中勾选 <span className="font-semibold text-stone-800 dark:text-stone-200">Enable Dev mode Options</span>，通过 <span className="font-semibold text-stone-800 dark:text-stone-200">Save (API Format)</span> 导出 API 格式 JSON；然后在本项目「配置 → 模型渠道 → 编辑」中上传绑定即可。
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
