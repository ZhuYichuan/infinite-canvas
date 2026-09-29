import { useState } from "react";
import { Button, Card, Modal, Segmented, Tag, Tooltip } from "antd";
import {
    CheckCircle2,
    XCircle,
    Cloud,
    HardDrive,
    Wrench,
    Sparkles,
    Copy,
    MessageSquare,
    Cpu,
    Database,
    Heart,
    HelpCircle,
    RefreshCw,
    Server,
    Video,
    Zap,
    Terminal,
    Bot,
} from "lucide-react";

import { useCopyText } from "@/hooks/use-copy-text";

// 联系方式与渠道配置
export const CONTACT_INFO = {
    wechat: {
        wechatId: "openlts", // 真实微信号
        title: "微信扫码咨询与购买",
        qrPath: "/images/contact/wechat-qr.png",
        tip: "添加时请备注：【0元极速体验】/【119服务包】/【1对1作者部署】，极速优先通过！",
    },
    douyin: {
        name: "@同学你好",
        douyinId: "574832860",
        title: "抖音扫码关注官方教程",
        qrPath: "/images/contact/douyin-qr.png",
        tip: "关注抖音【同学你好】，获取第一手 ComfyUI 视频实操演示与最新大模型避坑技巧！",
    },
};

export default function PricingPage() {
    const copyText = useCopyText();
    const [qrModalOpen, setQrModalOpen] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState<string>("创作者服务包（¥119）");
    const [activeContactTab, setActiveContactTab] = useState<"wechat" | "douyin">("wechat");

    const openContactModal = (planName: string) => {
        setSelectedPlan(planName);
        setQrModalOpen(true);
    };

    return (
        <main className="relative h-full overflow-y-auto bg-background text-stone-950 dark:text-stone-100">
            {/* 背景修饰底纹 */}
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:20px_20px] opacity-60 dark:bg-[radial-gradient(rgba(245,245,244,.12)_1px,transparent_1px)]" />

            <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
                {/* 1. Hero 头部吸引区 */}
                <div className="text-center">
                    <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                        <Sparkles className="size-3.5" />
                        <span>无需万元显卡，几块钱跑通 ComfyUI 顶级工作流</span>
                    </div>

                    <h1 className="mt-4 text-balance text-3xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
                        选择最适合您的 <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 bg-clip-text text-transparent">AI 生产力部署方案</span>
                    </h1>

                    <div className="mx-auto mt-6 flex max-w-3xl flex-col items-center text-center">
                        <div className="inline-flex items-center justify-center rounded-2xl border border-indigo-200/90 bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10 px-6 py-2.5 text-center shadow-sm backdrop-blur dark:border-indigo-800/60 dark:bg-indigo-950/40 sm:px-8 sm:py-3">
                            <p className="!m-0 flex flex-wrap items-center justify-center text-center text-lg font-black leading-normal tracking-tight sm:text-2xl md:text-3xl">
                                <span className="inline-flex items-center">
                                    <span className="mr-1.5">💡</span>
                                    <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">把时间留给灵感与创作</span>
                                    <span className="text-stone-900 dark:text-stone-100">，</span>
                                </span>
                                <span className="text-stone-900 dark:text-stone-100">别把精力浪费在折腾工具上</span>
                            </p>
                        </div>

                        <div className="mt-4 space-y-1.5 text-center text-sm text-stone-600 sm:text-base dark:text-stone-400">
                            <p>告别环境报错红字与漫长配置</p>
                            <p>轻薄本 / Mac 亦可享受 24G 顶级显卡算力</p>
                            <p className="text-stone-500 dark:text-stone-400">为个人创作者、设计团队与工作室量身打造的开箱即用方案</p>
                        </div>
                    </div>

                    {/* GPU 算力透明成本条 */}
                    <div className="mx-auto mt-8 max-w-3xl rounded-2xl border border-stone-200 bg-stone-50/90 p-4 shadow-sm backdrop-blur dark:border-stone-800 dark:bg-stone-900/90">
                        <div className="flex flex-wrap items-center justify-between gap-4 text-left sm:flex-nowrap">
                            <div className="flex items-center gap-3">
                                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
                                    <Cpu className="size-5" />
                                </div>
                                <div>
                                    <div className="text-sm font-semibold text-stone-900 dark:text-stone-100">真实 GPU 算力实报实销：极其实惠</div>
                                    <div className="text-xs text-stone-500 dark:text-stone-400">
                                        主流卡（RTX 3090/4070 24G）仅仅 <span className="font-semibold text-emerald-600 dark:text-emerald-400">¥1~2 /小时</span>；旗舰卡（4090/5090）约 <span className="font-semibold text-emerald-600 dark:text-emerald-400">¥3~5 /小时</span>；服务器级显卡（RTX PRO 6000）约 <span className="font-semibold text-emerald-600 dark:text-emerald-400">¥6~8 /小时</span>
                                    </div>
                                </div>
                            </div>
                            <div className="shrink-0 text-xs text-stone-500 dark:text-stone-400">
                                跑 100 张图/生成 5 个视频 <br />
                                算力成本仅需 <span className="text-sm font-bold text-amber-600 dark:text-amber-400">¥1.5 ~ ¥4</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. 三大主力方案卡片 (展现交付效果、优势与明确服务边界) */}
                <div className="mt-14 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
                    {/* 方案 A: 极速自助体验包 (限时 ¥0.00 / 纯文档自助) */}
                    <div className="relative flex flex-col justify-between rounded-3xl border border-stone-200 bg-background p-6 shadow-sm sm:p-7 dark:border-stone-800">
                        <div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                                        <Terminal className="size-5" />
                                    </div>
                                    <h3 className="text-xl font-bold leading-tight">
                                        极速自助<br />体验包
                                    </h3>
                                </div>
                                <Tag color="green" className="!mr-0 shrink-0 font-medium">限时0.00元</Tag>
                            </div>

                            <p className="mt-3 text-sm text-stone-500 dark:text-stone-400">
                                作者已部署 LightCC & AutoDL 官方预装镜像，告别本地显卡限制与繁琐配置。提供 3 步开箱即用接入文档，纯文档自查。
                            </p>

                            <div className="mt-5 flex items-baseline gap-1.5 flex-wrap">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-4xl font-extrabold tracking-tight text-emerald-600 dark:text-emerald-400">¥0.00</span>
                                    <span className="text-xs text-stone-400 line-through">原价 ¥19.9</span>
                                    <Tooltip
                                        title={
                                            <div className="p-1 text-xs leading-relaxed">
                                                <div className="font-semibold text-emerald-400">💡 限时 0.00 元福利说明</div>
                                                <div className="mt-1 text-stone-200">
                                                    作者已在 LightCC 与 AutoDL 平台部署官方预装云镜像供社区免费使用，免镜像费！注册 LightCC 新用户还送 3 元算力券（可免费体验 RTX 5090 1 小时）。您只需按需支付云平台的 GPU 算力租金。
                                                </div>
                                            </div>
                                        }
                                        trigger={["hover", "click"]}
                                        overlayClassName="max-w-xs"
                                    >
                                        <button
                                            type="button"
                                            className="inline-flex cursor-pointer items-center text-stone-400 hover:text-emerald-500 transition-colors focus:outline-none"
                                            aria-label="限时 0.00 元说明"
                                        >
                                            <HelpCircle className="size-4" />
                                        </button>
                                    </Tooltip>
                                </div>
                                <span className="text-xs text-stone-500">/ 限时免费体验（仅付算力租金）</span>
                            </div>
                            <div className="mt-1 text-xs text-stone-400">
                                作者官方镜像免费开放，提供教程文档，不含人工答疑
                            </div>

                            <div className="mt-6 border-t border-stone-100 pt-5 dark:border-stone-800">
                                <div className="text-xs font-semibold uppercase tracking-wider text-stone-400">📦 交付效果</div>
                                <ul className="mt-2 space-y-2 text-xs text-stone-600 dark:text-stone-300">
                                    <li className="flex items-start gap-1.5">
                                        <span className="font-semibold text-stone-600 dark:text-stone-400">•</span>
                                        <span>LightCC（推荐首选）+ AutoDL 官方预装镜像与开机指引</span>
                                    </li>
                                    <li className="flex items-start gap-1.5">
                                        <span className="font-semibold text-stone-600 dark:text-stone-400">•</span>
                                        <span>LightCC 注册赠 3 元券福利（免费跑 5090 算力 1 小时）</span>
                                    </li>
                                    <li className="flex items-start gap-1.5">
                                        <span className="font-semibold text-stone-600 dark:text-stone-400">•</span>
                                        <span>3 步极速接入指引（开机 -&gt; 复制地址 -&gt; 粘贴到画布）</span>
                                    </li>
                                    <li className="flex items-start gap-1.5">
                                        <span className="font-semibold text-stone-600 dark:text-stone-400">•</span>
                                        <span>预装 5 大核心插件与主流精选模型工作流</span>
                                    </li>
                                    <li className="flex items-start gap-1.5">
                                        <span className="font-semibold text-stone-600 dark:text-stone-400">•</span>
                                        <span>常见报错排查自救指南（网络/端口/显存自查）</span>
                                    </li>
                                </ul>
                            </div>

                            <div className="mt-4 border-t border-stone-100 pt-4 dark:border-stone-800">
                                <div className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">✅ 核心优势</div>
                                <ul className="mt-2 space-y-1.5 text-xs text-stone-600 dark:text-stone-300">
                                    <li className="flex items-center gap-1.5">
                                        <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                                        <span>限时 0 元极低门槛，轻薄本/Mac 秒级上手</span>
                                    </li>
                                    <li className="flex items-center gap-1.5">
                                        <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                                        <span>纯云端开箱即用，免本地配环境与装显卡，随用随停</span>
                                    </li>
                                    <li className="flex items-center gap-1.5">
                                        <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                                        <span>内置国内高速源，速度视网络情况而定</span>
                                    </li>
                                </ul>
                            </div>

                            <div className="mt-4 border-t border-stone-100 pt-4 dark:border-stone-800">
                                <div className="text-xs font-semibold uppercase tracking-wider text-rose-500">⚠️ 服务边界与注意</div>
                                <ul className="mt-2 space-y-1.5 text-xs text-stone-500 dark:text-stone-400">
                                    <li className="flex items-center gap-1.5">
                                        <XCircle className="size-3.5 text-stone-400 shrink-0" />
                                        <span>仅限云端预装镜像：本方案不包含本地便携包部署</span>
                                    </li>
                                    <li className="flex items-center gap-1.5">
                                        <XCircle className="size-3.5 text-stone-400 shrink-0" />
                                        <span>纯文档自查模式：不提供任何 1 对 1 人工技术支持与答疑</span>
                                    </li>
                                    <li className="flex items-center gap-1.5">
                                        <XCircle className="size-3.5 text-stone-400 shrink-0" />
                                        <span>遇脚本或网络报错请完全自行对照文档排查</span>
                                    </li>
                                    <li className="flex items-center gap-1.5">
                                        <XCircle className="size-3.5 text-stone-400 shrink-0" />
                                        <span>云端算力平台租金自行支付（按时计费，新用户可领券）</span>
                                    </li>
                                </ul>
                            </div>
                        </div>

                        <div className="mt-8">
                            <Button
                                size="large"
                                className="w-full !h-11 !font-medium"
                                onClick={() => window.open("https://www.lightcc.cloud/imageDetail?id=75064&invitationCode=yKBHXCJF108947", "_blank")}
                            >
                                查看云端镜像使用教程（限时0元）
                            </Button>
                            <div className="mt-2 text-center">
                                <a
                                    href="https://github.com/ZhuYichuan/infinite-canvas/blob/main/docs/CLOUD_MIRROR_GUIDE.md"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-stone-400 hover:text-emerald-600 dark:hover:text-emerald-400 underline transition-colors"
                                >
                                    查看免配置接入图文文档 →
                                </a>
                            </div>
                        </div>
                    </div>

                    {/* 方案 B: 创作者服务包 (¥119 / 官方重点推荐款) */}
                    <div className="relative flex flex-col justify-between rounded-3xl border-2 border-indigo-600 bg-background p-6 shadow-2xl ring-2 ring-indigo-500/30 sm:p-7 dark:border-indigo-400 dark:ring-indigo-400/30 lg:-translate-y-2">
                        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 px-4 py-1 text-xs font-bold text-white shadow-lg whitespace-nowrap">
                            🔥 官方重点推荐 · 80% 创作者首选
                        </div>

                        <div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400">
                                        <Bot className="size-5" />
                                    </div>
                                    <h3 className="text-xl font-bold leading-tight">
                                        创作者<br />服务包
                                    </h3>
                                </div>
                                <Tag color="magenta" className="!mr-0 shrink-0 font-semibold">🔥 重点推荐</Tag>
                            </div>

                            <p className="mt-3 text-sm text-stone-500 dark:text-stone-400">
                                专为高频创作与追求稳定的创作者打造。配通 Workbuddy 桌面智能体接管画布，赠送 3 次远程排障兜底与优先微信答疑。
                            </p>

                            <div className="mt-5 flex items-baseline gap-1">
                                <span className="text-4xl font-extrabold tracking-tight text-stone-950 dark:text-stone-100">¥119</span>
                                <span className="text-xs text-stone-500">/ 年（含 3 次远程排障）</span>
                            </div>
                            <div className="mt-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                                官方重点推荐 · 智能体协同与远程排障双重保障
                            </div>

                            <div className="mt-6 border-t border-stone-100 pt-5 dark:border-stone-800">
                                <div className="text-xs font-semibold uppercase tracking-wider text-stone-400">📦 交付效果</div>
                                <ul className="mt-2 space-y-2 text-xs text-stone-600 dark:text-stone-300">
                                    <li className="flex items-start gap-1.5">
                                        <span className="font-semibold text-indigo-600 dark:text-indigo-400">•</span>
                                        <div>
                                            <span><strong>AutoDL 云端 + 本地环境部署支持</strong>（要求 最低 Win10 / 显存 &gt; 12G 最佳）</span>
                                            <div className="mt-1.5 rounded-lg border border-stone-200 bg-stone-50/90 p-2 text-[11px] leading-relaxed text-stone-600 dark:border-stone-800 dark:bg-stone-900/80 dark:text-stone-400">
                                                💡 <strong>本地环境说明：</strong>本地能否跑通大模型由个人显卡配置决定。若电脑显卡显存低于 12G 或系统低于 Win10，可直接无缝切换使用附赠的 AutoDL 云端镜像，兼顾体验。
                                            </div>
                                        </div>
                                    </li>
                                    <li className="flex items-start gap-1.5">
                                        <span className="font-semibold text-indigo-600 dark:text-indigo-400">•</span>
                                        <span><strong>持续升级服务与作者微信优先答疑</strong>（脚本执行与报错协助定位）</span>
                                    </li>
                                    <li className="flex items-start gap-1.5">
                                        <span className="font-semibold text-indigo-600 dark:text-indigo-400">•</span>
                                        <span><strong>增加 Workbuddy 的智能体接入配置</strong>（端到端配通桌面 Agent 与无限画布协同调度）</span>
                                    </li>
                                    <li className="flex items-start gap-1.5">
                                        <span className="font-semibold text-indigo-600 dark:text-indigo-400">•</span>
                                        <span><strong>增加远程解决问题 3 次</strong>（遇到脚本断连/环境冲突/网络顽疾，远程连线排查至解决）</span>
                                    </li>
                                </ul>
                            </div>

                            <div className="mt-4 border-t border-stone-100 pt-4 dark:border-stone-800">
                                <div className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">✅ 核心优势</div>
                                <ul className="mt-2 space-y-1.5 text-xs text-stone-600 dark:text-stone-300">
                                    <li className="flex items-center gap-1.5">
                                        <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                                        <span>享受 Workbuddy 智能体接管画布的高效创作体验</span>
                                    </li>
                                    <li className="flex items-center gap-1.5">
                                        <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                                        <span>关键时刻专家远程代连排查，3 次额度告别自查折磨</span>
                                    </li>
                                    <li className="flex items-center gap-1.5">
                                        <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                                        <span>持续升级服务与作者微信优先答疑双重兜底</span>
                                    </li>
                                </ul>
                            </div>

                            <div className="mt-4 border-t border-stone-100 pt-4 dark:border-stone-800">
                                <div className="text-xs font-semibold uppercase tracking-wider text-rose-500">⚠️ 服务边界与注意</div>
                                <ul className="mt-2 space-y-1.5 text-xs text-stone-500 dark:text-stone-400">
                                    <li className="flex items-center gap-1.5">
                                        <XCircle className="size-3.5 text-stone-400 shrink-0" />
                                        <span>云端算力平台租金自行支付（1~N元/时）</span>
                                    </li>
                                    <li className="flex items-center gap-1.5">
                                        <XCircle className="size-3.5 text-stone-400 shrink-0" />
                                        <span>远程解决问题共 3 次额度，有效期 1 年</span>
                                    </li>
                                    <li className="flex items-center gap-1.5">
                                        <XCircle className="size-3.5 text-stone-400 shrink-0" />
                                        <span>本地部署同样要求 最低 Win10 / 显存 &gt; 12G 最佳</span>
                                    </li>
                                </ul>
                            </div>
                        </div>

                        <div className="mt-8">
                            <Button
                                type="primary"
                                size="large"
                                className="w-full !h-11 !font-semibold !bg-gradient-to-r !from-indigo-600 !via-purple-600 !to-indigo-600 hover:!from-indigo-500 hover:!to-purple-500 shadow-md shadow-indigo-500/25"
                                onClick={() => openContactModal("创作者服务包（¥119）")}
                            >
                                立即获取创作者服务包（¥119）
                            </Button>
                        </div>
                    </div>

                    {/* 方案 C: 1 对 1 专家远程部署 (VIP 尊享款) */}
                    <div className="relative flex flex-col justify-between rounded-3xl border border-purple-200 bg-background p-6 shadow-sm sm:p-7 dark:border-purple-900/60">
                        <div>
                            <div className="flex items-center gap-2.5">
                                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400">
                                    <Wrench className="size-5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-1.5">
                                        <span className="text-xl font-bold leading-tight text-stone-950 dark:text-stone-100">
                                            1对1
                                        </span>
                                        <Tag color="purple" className="!mr-0 shrink-0">
                                            包跑通退款
                                        </Tag>
                                    </div>
                                    <h3 className="text-xl font-bold leading-tight text-stone-950 dark:text-stone-100">
                                        作者全包部署
                                    </h3>
                                </div>
                            </div>

                            <p className="mt-3 text-sm text-stone-500 dark:text-stone-400">
                                追求极致省心的团队与老板首选。作者远程全程代劳，定制调优，包跑通包教会。<strong className="font-semibold text-purple-600 dark:text-purple-400">支持本地部署数据更安全。</strong>
                            </p>

                            <div className="mt-5 flex items-baseline gap-1">
                                <span className="text-4xl font-extrabold tracking-tight text-stone-950 dark:text-stone-100">¥299</span>
                                <span className="text-xs text-stone-500">/ 次（含7天专属技术售后）</span>
                            </div>
                            <div className="mt-1 text-xs text-stone-400">
                                承诺包跑通、包测试出图，跑不通 100% 全额退款
                            </div>

                            <div className="mt-6 border-t border-stone-100 pt-5 dark:border-stone-800">
                                <div className="text-xs font-semibold uppercase tracking-wider text-stone-400">📦 交付效果</div>
                                <ul className="mt-2 space-y-2 text-xs text-stone-600 dark:text-stone-300">
                                    <li className="flex items-start gap-1.5">
                                        <span className="font-semibold text-purple-600 dark:text-purple-400">•</span>
                                        <span>ToDesk / 向日葵一对一远程全套环境代部署</span>
                                    </li>
                                    <li className="flex items-start gap-1.5">
                                        <span className="font-semibold text-purple-600 dark:text-purple-400">•</span>
                                        <span>显卡驱动、CUDA、ComfyUI 与无限画布端到端联调</span>
                                    </li>
                                    <li className="flex items-start gap-1.5">
                                        <span className="font-semibold text-purple-600 dark:text-purple-400">•</span>
                                        <span>根据您的实际显存针对性优化参数（防止爆显存 OOM）</span>
                                    </li>
                                    <li className="flex items-start gap-1.5">
                                        <span className="font-semibold text-purple-600 dark:text-purple-400">•</span>
                                        <span><strong>赠送全年环境持续升级与作者微信答疑权益</strong></span>
                                    </li>
                                </ul>
                            </div>

                            <div className="mt-4 border-t border-stone-100 pt-4 dark:border-stone-800">
                                <div className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">✅ 核心优势</div>
                                <ul className="mt-2 space-y-1.5 text-xs text-stone-600 dark:text-stone-300">
                                    <li className="flex items-center gap-1.5">
                                        <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                                        <span>完全零脑力负担，任何环境冲突与疑难报错专家搞定</span>
                                    </li>
                                    <li className="flex items-center gap-1.5">
                                        <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                                        <span>包含 7 天技术指导与答疑群，不走弯路</span>
                                    </li>
                                    <li className="flex items-center gap-1.5">
                                        <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                                        <span>支持定制多机器局域网共享部署与私有化咨询</span>
                                    </li>
                                </ul>
                            </div>

                            <div className="mt-4 border-t border-stone-100 pt-4 dark:border-stone-800">
                                <div className="text-xs font-semibold uppercase tracking-wider text-rose-500">⚠️ 服务边界与注意</div>
                                <ul className="mt-2 space-y-1.5 text-xs text-stone-500 dark:text-stone-400">
                                    <li className="flex items-center gap-1.5">
                                        <XCircle className="size-3.5 text-stone-400 shrink-0" />
                                        <span>需提前预约时间，远程约需 40~90 分钟</span>
                                    </li>
                                    <li className="flex items-center gap-1.5">
                                        <XCircle className="size-3.5 text-stone-400 shrink-0" />
                                        <span>单价相对较高，适合更重视时间成本的客户</span>
                                    </li>
                                </ul>
                            </div>
                        </div>

                        <div className="mt-8">
                            <Button
                                size="large"
                                className="w-full !h-11 !font-medium"
                                onClick={() => openContactModal("1对1 作者全包部署（¥299）")}
                            >
                                预约作者远程服务
                            </Button>
                        </div>
                    </div>
                </div>

                {/* 3. 产品交付全景横向对比矩阵 (透明对比，增强信任) */}
                <div className="mt-16 overflow-hidden rounded-3xl border border-stone-200 bg-background shadow-sm dark:border-stone-800">
                    <div className="border-b border-stone-200 bg-stone-50/70 px-6 py-4 dark:border-stone-800 dark:bg-stone-900/50">
                        <h2 className="text-lg font-bold">三款方案详细横向对比</h2>
                        <p className="text-xs text-stone-500 dark:text-stone-400">按需选择，丰俭由人</p>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[760px] text-left text-sm">
                            <thead className="border-b border-stone-100 bg-stone-50/40 text-xs font-semibold text-stone-500 dark:border-stone-800 dark:bg-stone-900/20 dark:text-stone-400">
                                <tr>
                                    <th className="py-3.5 pl-6 pr-3">对比维度</th>
                                    <th className="px-3 py-3.5">极速体验包</th>
                                    <th className="px-3 py-3.5 font-bold text-indigo-700 bg-indigo-500/10 dark:text-indigo-300 dark:bg-indigo-500/20">创作者服务包 (重点推荐) 🔥</th>
                                    <th className="px-3 py-3.5 text-purple-600 dark:text-purple-400">1对1 作者全包</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100 text-stone-600 dark:divide-stone-800/60 dark:text-stone-300">
                                <tr>
                                    <td className="py-3.5 pl-6 pr-3 font-medium text-stone-900 dark:text-stone-100">方案费用</td>
                                    <td className="px-3 py-3.5 font-semibold text-emerald-600 dark:text-emerald-400">限时 ¥0.00 免费体验</td>
                                    <td className="px-3 py-3.5 font-semibold text-indigo-600 dark:text-indigo-400">¥119 / 年（含3次远程）</td>
                                    <td className="px-3 py-3.5 font-semibold text-purple-600 dark:text-purple-400">¥299 / 次（包跑通）</td>
                                </tr>
                                <tr>
                                    <td className="py-3.5 pl-6 pr-3 font-medium text-stone-900 dark:text-stone-100">运行环境支持</td>
                                    <td className="px-3 py-3.5 text-stone-600 dark:text-stone-400">仅限云端镜像（LightCC / AutoDL，不含本地）</td>
                                    <td className="px-3 py-3.5 font-semibold text-indigo-600 dark:text-indigo-400">AutoDL 云端 + 本地部署（含 Workbuddy 接入）</td>
                                    <td className="px-3 py-3.5">工程师按需调优（云端或本地）</td>
                                </tr>
                                <tr>
                                    <td className="py-3.5 pl-6 pr-3 font-medium text-stone-900 dark:text-stone-100">核心交付内容</td>
                                    <td className="px-3 py-3.5">官方云端镜像 + 免本地配置 + 3步接入指引</td>
                                    <td className="px-3 py-3.5 font-semibold text-indigo-700 dark:text-indigo-300">云端+本地全套 + Workbuddy 智能体配置 + 3 次远程解决问题</td>
                                    <td className="px-3 py-3.5">远程端到端调通 + 显存调优 + 赠持续升级与答疑</td>
                                </tr>
                                <tr>
                                    <td className="py-3.5 pl-6 pr-3 font-medium text-stone-900 dark:text-stone-100">技术支持服务</td>
                                    <td className="px-3 py-3.5 text-stone-400">仅限文档自查（不提供人工技术支持）</td>
                                    <td className="px-3 py-3.5 font-semibold text-indigo-600 dark:text-indigo-400">作者微信优先答疑 + 3 次专家远程连线解决问题</td>
                                    <td className="px-3 py-3.5 font-semibold text-purple-600 dark:text-purple-400">1对1 远程代劳协助 + 7天专属技术售后</td>
                                </tr>
                                <tr>
                                    <td className="py-3.5 pl-6 pr-3 font-medium text-stone-900 dark:text-stone-100">智能体协同接入</td>
                                    <td className="px-3 py-3.5 text-stone-400">—</td>
                                    <td className="px-3 py-3.5 font-semibold text-indigo-600 dark:text-indigo-400">提供 Workbuddy 桌面智能体接入配置与直连调试</td>
                                    <td className="px-3 py-3.5">按需配置全套智能体协同</td>
                                </tr>
                                <tr>
                                    <td className="py-3.5 pl-6 pr-3 font-medium text-stone-900 dark:text-stone-100">版本更新跟进</td>
                                    <td className="px-3 py-3.5">自行对照文档手动升级</td>
                                    <td className="px-3 py-3.5 font-semibold text-emerald-600 dark:text-emerald-400">持续升级服务，提供环境版本维护更新</td>
                                    <td className="px-3 py-3.5">同步享有持续升级服务与环境维护</td>
                                </tr>
                                <tr>
                                    <td className="py-3.5 pl-6 pr-3 font-medium text-stone-900 dark:text-stone-100">售后与保障</td>
                                    <td className="px-3 py-3.5">公开免费文档，云端按需开机体验</td>
                                    <td className="px-3 py-3.5 font-semibold text-indigo-600 dark:text-indigo-400">3 次远程问题解决，额度有效期 1 年</td>
                                    <td className="px-3 py-3.5 font-semibold text-purple-600 dark:text-purple-400">承诺包跑通包出图，跑不通全额退款</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 4. 为什么极速体验包限时 0.00 元且不提供人工支持？（坦诚告知：关于人力成本与持续维护） */}
                <div className="mt-16 rounded-3xl border border-stone-200 bg-stone-50/70 p-6 sm:p-10 dark:border-stone-800 dark:bg-stone-900/50">
                    <div className="mx-auto max-w-3xl text-center">
                        <div className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-background px-3 py-1 text-xs font-medium text-stone-600 dark:border-stone-700 dark:text-stone-300">
                            <Heart className="size-3.5 text-rose-500 fill-rose-500" />
                            <span>坦诚告知 · 关于极低体验价与服务边界的真心话</span>
                        </div>
                        <h2 className="mt-3 text-2xl font-bold tracking-tight text-stone-950 dark:text-stone-100 sm:text-3xl">
                            为什么极速体验包限时 0.00 元？为什么不提供人工支持？
                        </h2>
                        <p className="mt-3 text-sm leading-relaxed text-stone-600 dark:text-stone-400">
                            《无限画布》前端代码与文档 100% 保持开源免费。为了让每一位没有高端显卡的创作者都能以零门槛体验 ComfyUI 大模型，<strong>作者已在 LightCC 与 AutoDL 平台部署官方预装镜像，并实行限时 0.00 元免费开放使用</strong>（您只需按需支付云算力平台每小时几毛到 1~2 元的 GPU 机器租金，LightCC 注册还送 3 元体验券可免费体验 1 小时 5090）。同时，由于该方案属于完全免费的社区自助福利、无法覆盖工程师一对一排障的人力时间成本，因此该方案严格仅限文档自查、不提供人工答疑支持；若您需要作者微信优先答疑、Workbuddy 智能体接入与 3 次远程排障请选 ¥119 服务包，需要专家全程代劳请选 ¥299 远程服务。
                        </p>
                    </div>

                    <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
                        <div className="rounded-2xl border border-stone-200/80 bg-background p-5 dark:border-stone-800">
                            <div className="flex size-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
                                <Database className="size-5" />
                            </div>
                            <h3 className="mt-3 text-sm font-bold text-stone-900 dark:text-stone-100">1. 作者自费部署云镜像，限时 0 元回馈社区</h3>
                            <p className="mt-2 text-xs leading-relaxed text-stone-500 dark:text-stone-400">
                                一个包含 5 大核心插件、MiniMax H3、Flux 等全模态权重的完整 ComfyUI 镜像体积高达 <strong>80GB ~ 120GB</strong>。作者已将其预装并发布至平台镜像市场，免去大家本地配置之苦，开机即可直连画布体验。
                            </p>
                        </div>

                        <div className="rounded-2xl border border-stone-200/80 bg-background p-5 dark:border-stone-800">
                            <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
                                <RefreshCw className="size-5" />
                            </div>
                            <h3 className="mt-3 text-sm font-bold text-stone-900 dark:text-stone-100">2. ComfyUI 频繁破坏性更新</h3>
                            <p className="mt-2 text-xs leading-relaxed text-stone-500 dark:text-stone-400">
                                开源 AI 社区日新月异，ComfyUI 官方、底层 PyTorch 与第三方插件每周都在升级，极易造成旧工作流红字报错。我们需要持续投入真机环境进行回归测试、修补兼容性，并重制稳定镜像。
                            </p>
                        </div>

                        <div className="rounded-2xl border border-stone-200/80 bg-background p-5 dark:border-stone-800">
                            <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                                <Server className="size-5" />
                            </div>
                            <h3 className="mt-3 text-sm font-bold text-stone-900 dark:text-stone-100">3. 以服务养开源，拒绝牛皮癣广告</h3>
                            <p className="mt-2 text-xs leading-relaxed text-stone-500 dark:text-stone-400">
                                我们坚持前端界面零弹窗、零广告植入，纯粹为创作者提供极致生产力体验。通过为需要节省时间的同学提供经过严格测试的标准化镜像与专业部署服务，收取的适量费用全部用于支撑算力与项目长久发展。
                            </p>
                        </div>
                    </div>
                </div>

                {/* 5. 常见问题 FAQ */}
                <div className="mt-16">
                    <h2 className="text-center text-2xl font-bold">常见疑问解答 (FAQ)</h2>
                    <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
                        <Card className="!rounded-2xl dark:!border-stone-800 dark:!bg-stone-900/40">
                            <h3 className="flex items-center gap-2 text-base font-semibold">
                                <HelpCircle className="size-4 text-emerald-500" />
                                极速体验包真的限时 0.00 元吗？还需要支付其他费用吗？
                            </h3>
                            <p className="mt-2 text-xs leading-relaxed text-stone-500 dark:text-stone-400">
                                <strong>镜像本身限时 0.00 元免费开放使用，无需向我们支付任何费用，仅需按需自付云平台的 GPU 算力租金。</strong>作者已在 LightCC 和 AutoDL 平台部署好预装环境，开机后直接将地址填入画布即可使用。通过推荐链接注册 LightCC 还赠送 3 元算力券，可免费体验 RTX 5090 一小时。使用完毕请及时关机避免产生额外费用。极速体验包不包含人工答疑支持，遇到问题请严格对照文档自查；若需本地环境部署、微信答疑与远程排障请选 ¥119 服务包，需专家全程代劳请选 ¥299 专家部署。
                            </p>
                        </Card>

                        <Card className="!rounded-2xl dark:!border-stone-800 dark:!bg-stone-900/40">
                            <h3 className="flex items-center gap-2 text-base font-semibold">
                                <HelpCircle className="size-4 text-indigo-500" />
                                方案众多，为什么官方重点推荐「创作者服务包（¥119）」？
                            </h3>
                            <p className="mt-2 text-xs leading-relaxed text-stone-500 dark:text-stone-400">
                                0 元体验包仅限文档自查，遇到深层系统与网络报错缺乏专家支持。<strong>¥119 创作者服务包</strong>全面支持云端+本地环境部署，独家配通 <strong>Workbuddy 桌面智能体接管画布</strong>，更赠送 <strong>3 次专家远程代连排障兜底</strong>与作者微信优先答疑，兼具生产力与疑难排错双重兜底，是 80% 创作者与工作室的重点推荐款。
                            </p>
                        </Card>

                        <Card className="!rounded-2xl dark:!border-stone-800 dark:!bg-stone-900/40">
                            <h3 className="flex items-center gap-2 text-base font-semibold">
                                <HelpCircle className="size-4 text-blue-500" />
                                创作者服务包（¥119）与 1 对 1 专家全包部署（¥299）有什么区别？该如何选？
                            </h3>
                            <p className="mt-2 text-xs leading-relaxed text-stone-500 dark:text-stone-400">
                                <strong>¥119 服务包</strong>适合希望自己掌握部署与更新，同时享有<strong>作者微信答疑指导与 3 次远程解决问题兜底</strong>的创作者，还独家包含 Workbuddy 智能体接入；<strong>¥299 专家全包部署</strong>则适合追求极致省心、时间宝贵的用户，由工程师直接远程一对一全流程代劳调通并做显存深度调优，包跑通包出图。
                            </p>
                        </Card>

                        <Card className="!rounded-2xl dark:!border-stone-800 dark:!bg-stone-900/40">
                            <h3 className="flex items-center gap-2 text-base font-semibold">
                                <HelpCircle className="size-4 text-blue-500" />
                                如果我使用 0 元极速体验包，遇到部署报错怎么处理？
                            </h3>
                            <p className="mt-2 text-xs leading-relaxed text-stone-500 dark:text-stone-400">
                                随包附带了保姆级 3 步接入指南与《常见报错排查自救指南》（涵盖 90% 的网络超时、端口复制、连接测试等问题）。请先严格对照文档自查排错；若尝试后希望彻底省心，可随时升级为 ¥119 创作者服务包（含微信答疑与 3 次远程排障）或 ¥299 专家 1 对 1 远程代劳服务。
                            </p>
                        </Card>

                        <Card className="!rounded-2xl dark:!border-stone-800 dark:!bg-stone-900/40">
                            <h3 className="flex items-center gap-2 text-base font-semibold">
                                <HelpCircle className="size-4 text-blue-500" />
                                我是苹果 Mac 电脑（M1/M2/M3），能不能用？
                            </h3>
                            <p className="mt-2 text-xs leading-relaxed text-stone-500 dark:text-stone-400">
                                强烈推荐！Mac 电脑本地跑 ComfyUI 大模型速度较慢且不支持诸多 CUDA 加速节点；通过我们的 LightCC / AutoDL 云端镜像，Mac 只需要打开浏览器即可远程享用 24G 顶级 Nvidia 显卡算力，体验丝滑流畅。
                            </p>
                        </Card>

                        <Card className="!rounded-2xl dark:!border-stone-800 dark:!bg-stone-900/40">
                            <h3 className="flex items-center gap-2 text-base font-semibold">
                                <HelpCircle className="size-4 text-blue-500" />
                                1 对 1 专家部署如果不成功会退款吗？
                            </h3>
                            <p className="mt-2 text-xs leading-relaxed text-stone-500 dark:text-stone-400">
                                承诺<strong>包跑通、包测试出图</strong>。若因您的电脑硬件严重损坏或不可抗力导致确实无法跑通，承诺 100% 全额退款，无任何后顾之忧。
                            </p>
                        </Card>

                        <Card className="!rounded-2xl dark:!border-stone-800 dark:!bg-stone-900/40">
                            <h3 className="flex items-center gap-2 text-base font-semibold">
                                <HelpCircle className="size-4 text-blue-500" />
                                为什么云端 GPU 只要 1~2 块钱一小时？
                            </h3>
                            <p className="mt-2 text-xs leading-relaxed text-stone-500 dark:text-stone-400">
                                我们对接的是国内主流的弹性 GPU 算力平台（如 AutoDL 等）。平台采用按使用分钟计费模式，不用时随时关机停止计费。跑几百张图通常只需几十分钟，折合下来成本极其低廉，相比自己花 1.5 万元买高端显卡更划算。
                            </p>
                        </Card>
                    </div>
                </div>

                {/* 5. 底部咨询引导 Banner */}
                <div className="mt-16 rounded-3xl bg-gradient-to-br from-stone-900 to-stone-800 p-8 text-center text-white shadow-xl dark:from-stone-800 dark:to-stone-900">
                    <h3 className="text-2xl font-bold">还有其他定制需求或企业级私有化疑问？</h3>
                    <p className="mx-auto mt-2 max-w-xl text-sm text-stone-300">
                        无论是局域网多机共享、公司设计工作流接入，还是指定私有模型定制，欢迎添加微信直接交流。
                    </p>
                    <div className="mt-6 flex flex-wrap justify-center gap-3">
                        <Button
                            type="primary"
                            size="large"
                            className="!h-10 !px-6"
                            onClick={() => {
                                setActiveContactTab("wechat");
                                openContactModal("专属微信咨询");
                            }}
                        >
                            扫码添加微信咨询
                        </Button>
                        <Button
                            size="large"
                            className="!h-10 !px-6 !text-white !border-stone-600 hover:!border-white"
                            onClick={() => {
                                setActiveContactTab("douyin");
                                openContactModal("抖音官方教程关注");
                            }}
                        >
                            关注抖音官方账号
                        </Button>
                        <Button
                            size="large"
                            className="!h-10 !px-6 !text-white !border-stone-600 hover:!border-white"
                            onClick={() => copyText(CONTACT_INFO.wechat.wechatId, `已复制微信号: ${CONTACT_INFO.wechat.wechatId}`)}
                        >
                            一键复制微信号
                        </Button>
                    </div>
                </div>
            </div>

            {/* 咨询与扫码弹窗（微信 + 抖音双通道） */}
            <Modal
                title={
                    <div className="flex items-center gap-2 text-base font-bold">
                        {activeContactTab === "wechat" ? (
                            <>
                                <MessageSquare className="size-5 text-emerald-500" />
                                <span>微信扫码咨询与专属服务</span>
                            </>
                        ) : (
                            <>
                                <Video className="size-5 text-rose-500" />
                                <span>抖音扫码关注官方教程 (@同学你好)</span>
                            </>
                        )}
                    </div>
                }
                open={qrModalOpen}
                onCancel={() => setQrModalOpen(false)}
                footer={null}
                centered
                destroyOnClose
            >
                <div className="py-2 text-center">
                    <div className="mb-4 flex justify-center">
                        <Segmented
                            value={activeContactTab}
                            onChange={(val) => setActiveContactTab(val as "wechat" | "douyin")}
                            options={[
                                {
                                    label: "微信咨询与购买",
                                    value: "wechat",
                                    icon: <MessageSquare className="size-3.5 inline mr-1 text-emerald-500" />,
                                },
                                {
                                    label: "抖音关注官方号",
                                    value: "douyin",
                                    icon: <Video className="size-3.5 inline mr-1 text-rose-500" />,
                                },
                            ]}
                        />
                    </div>

                    <Tag color={activeContactTab === "wechat" ? "blue" : "magenta"} className="mb-3">
                        {activeContactTab === "wechat" ? `当前咨询意向：${selectedPlan}` : "关注抖音获取第一手 ComfyUI 视频实操"}
                    </Tag>

                    {activeContactTab === "wechat" ? (
                        <div>
                            {/* 微信二维码容器 */}
                            <div className="mx-auto flex size-60 flex-col items-center justify-center rounded-2xl border border-stone-200 bg-stone-50 p-4 dark:border-stone-700 dark:bg-stone-800">
                                <div className="relative flex size-44 flex-col items-center justify-center overflow-hidden rounded-xl bg-white p-2 shadow-inner dark:bg-stone-900">
                                    <img
                                        src={CONTACT_INFO.wechat.qrPath}
                                        alt="微信二维码"
                                        className="size-full object-contain"
                                        onError={(e) => {
                                            // 图片尚未存在时显示占位
                                            e.currentTarget.style.display = "none";
                                            const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                                            if (fallback) fallback.style.display = "flex";
                                        }}
                                    />
                                    <div className="hidden flex-col items-center justify-center text-center">
                                        <div className="rounded-full bg-emerald-500/10 p-3 text-emerald-600 dark:text-emerald-400">
                                            <MessageSquare className="size-8" />
                                        </div>
                                        <span className="mt-2 text-xs font-semibold text-stone-800 dark:text-stone-200">
                                            微信二维码待放入
                                        </span>
                                        <span className="mt-1 text-[11px] text-stone-400">
                                            可直接复制微信号添加
                                        </span>
                                    </div>
                                </div>
                                <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
                                    微信扫一扫上方二维码添加好友
                                </p>
                            </div>

                            {/* 微信号一键复制 */}
                            <div className="mx-auto mt-4 flex max-w-xs items-center justify-between rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs dark:border-stone-700 dark:bg-stone-800">
                                <span className="text-stone-500 dark:text-stone-400">微信号：</span>
                                <span className="font-mono font-bold text-stone-900 dark:text-stone-100">
                                    {CONTACT_INFO.wechat.wechatId}
                                </span>
                                <button
                                    type="button"
                                    className="inline-flex items-center gap-1 rounded bg-stone-200 px-2 py-1 text-[11px] font-medium text-stone-800 transition hover:bg-stone-300 dark:bg-stone-700 dark:text-stone-200 dark:hover:bg-stone-600"
                                    onClick={() => copyText(CONTACT_INFO.wechat.wechatId, `已复制微信号: ${CONTACT_INFO.wechat.wechatId}`)}
                                >
                                    <Copy className="size-3" />
                                    <span>复制</span>
                                </button>
                            </div>

                            <p className="mt-3 text-xs leading-relaxed text-amber-600 dark:text-amber-400">
                                💡 {CONTACT_INFO.wechat.tip}
                            </p>
                        </div>
                    ) : (
                        <div>
                            {/* 抖音二维码展示 */}
                            <div className="mx-auto flex size-60 flex-col items-center justify-center rounded-2xl border border-stone-200 bg-stone-50 p-4 dark:border-stone-700 dark:bg-stone-800">
                                <div className="flex size-44 items-center justify-center overflow-hidden rounded-xl bg-white p-1 shadow-inner dark:bg-stone-900">
                                    <img
                                        src={CONTACT_INFO.douyin.qrPath}
                                        alt="抖音二维码"
                                        className="size-full object-contain"
                                    />
                                </div>
                                <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
                                    打开抖音 App 搜索页扫一扫
                                </p>
                            </div>

                            {/* 抖音号一键复制 */}
                            <div className="mx-auto mt-4 flex max-w-xs items-center justify-between rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs dark:border-stone-700 dark:bg-stone-800">
                                <span className="text-stone-500 dark:text-stone-400">抖音号 ({CONTACT_INFO.douyin.name})：</span>
                                <span className="font-mono font-bold text-stone-900 dark:text-stone-100">
                                    {CONTACT_INFO.douyin.douyinId}
                                </span>
                                <button
                                    type="button"
                                    className="inline-flex items-center gap-1 rounded bg-stone-200 px-2 py-1 text-[11px] font-medium text-stone-800 transition hover:bg-stone-300 dark:bg-stone-700 dark:text-stone-200 dark:hover:bg-stone-600"
                                    onClick={() => copyText(CONTACT_INFO.douyin.douyinId, `已复制抖音号: ${CONTACT_INFO.douyin.douyinId}`)}
                                >
                                    <Copy className="size-3" />
                                    <span>复制</span>
                                </button>
                            </div>

                            <p className="mt-3 text-xs leading-relaxed text-stone-500 dark:text-stone-400">
                                🎬 {CONTACT_INFO.douyin.tip}
                            </p>
                        </div>
                    )}
                </div>
            </Modal>
        </main>
    );
}
