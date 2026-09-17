import { useState } from "react";
import { Button, Card, Modal, Segmented, Tag } from "antd";
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
} from "lucide-react";

import { useCopyText } from "@/hooks/use-copy-text";

// 联系方式与渠道配置
export const CONTACT_INFO = {
    wechat: {
        wechatId: "openlts", // 真实微信号
        title: "微信扫码咨询与购买",
        qrPath: "/images/contact/wechat-qr.png",
        tip: "添加时请备注：【19.9体验包】/【伴学更新】/【1对1专家部署】，极速优先通过！",
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
    const [selectedPlan, setSelectedPlan] = useState<string>("创作者伴学与年度更新包（¥79）");
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

                    <p className="mx-auto mt-4 max-w-2xl text-balance text-base leading-7 text-stone-600 dark:text-stone-400 sm:text-lg">
                        告别环境报错红字与漫长下载。轻薄本/Mac 亦可享受 24G 顶级显卡算力，
                        为个人创作者、设计团队与工作室量身打造的开箱即用方案。
                    </p>

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
                <div className="mt-14 grid grid-cols-1 gap-8 lg:grid-cols-3">
                    {/* 方案 A: 极速自助体验包 (¥19.9 一次性 / 纯文档自助) */}
                    <div className="relative flex flex-col justify-between rounded-3xl border border-stone-200 bg-background p-6 shadow-sm sm:p-8 dark:border-stone-800">
                        <div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="flex size-9 items-center justify-center rounded-lg bg-stone-500/10 text-stone-700 dark:bg-stone-500/20 dark:text-stone-300">
                                        <Terminal className="size-5" />
                                    </div>
                                    <h3 className="text-xl font-bold">极速自助体验包</h3>
                                </div>
                                <Tag>纯文档自助</Tag>
                            </div>

                            <p className="mt-3 text-sm text-stone-500 dark:text-stone-400">
                                AutoDL 云端镜像与本地便携包双模式，告别从零繁琐配置。提供保姆级图文与视频部署排错文档，纯文档自查。
                            </p>

                            <div className="mt-5 flex items-baseline gap-1">
                                <span className="text-4xl font-extrabold tracking-tight text-stone-950 dark:text-stone-100">¥19.9</span>
                                <span className="text-xs text-stone-500">/ 象征性分摊镜像存储费</span>
                            </div>
                            <div className="mt-1 text-xs text-stone-400">
                                仅提供部署与排错文档，不提供任何人工技术支持
                            </div>

                            <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-2.5 text-xs leading-relaxed text-amber-800 dark:text-amber-300">
                                💡 <strong>为什么收 19.9 元？</strong> 包含百 G 大模型的云镜像每天都在产生存储租金。若不收费用，镜像会因欠费被平台直接清理删除，因此必须象征性收取一点费用分摊存储成本，保障镜像长期存活。
                            </div>

                            <div className="mt-6 border-t border-stone-100 pt-5 dark:border-stone-800">
                                <div className="text-xs font-semibold uppercase tracking-wider text-stone-400">📦 交付效果</div>
                                <ul className="mt-2 space-y-2 text-xs text-stone-600 dark:text-stone-300">
                                    <li className="flex items-start gap-1.5">
                                        <span className="font-semibold text-stone-600 dark:text-stone-400">•</span>
                                        <span>专属 AutoDL 镜像分享码 + 本地免配包拉取脚本</span>
                                    </li>
                                    <li className="flex items-start gap-1.5">
                                        <span className="font-semibold text-stone-600 dark:text-stone-400">•</span>
                                        <span>保姆级图文与视频部署演示（从开机到出图实录）</span>
                                    </li>
                                    <li className="flex items-start gap-1.5">
                                        <span className="font-semibold text-stone-600 dark:text-stone-400">•</span>
                                        <span>常见报错排查自救指南（网络/端口/显存自查）</span>
                                    </li>
                                    <li className="flex items-start gap-1.5">
                                        <span className="font-semibold text-stone-600 dark:text-stone-400">•</span>
                                        <span>预装 5 大核心插件与主流精选模型工作流</span>
                                    </li>
                                </ul>
                            </div>

                            <div className="mt-4 border-t border-stone-100 pt-4 dark:border-stone-800">
                                <div className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">✅ 核心优势</div>
                                <ul className="mt-2 space-y-1.5 text-xs text-stone-600 dark:text-stone-300">
                                    <li className="flex items-center gap-1.5">
                                        <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                                        <span>一杯咖啡钱极低门槛，轻薄本/Mac 秒级上手</span>
                                    </li>
                                    <li className="flex items-center gap-1.5">
                                        <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                                        <span>一套代码打通云端与本地，按需随时切换</span>
                                    </li>
                                    <li className="flex items-center gap-1.5">
                                        <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                                        <span>内置国内高速源，省去数十小时手动下载折磨</span>
                                    </li>
                                </ul>
                            </div>

                            <div className="mt-4 border-t border-stone-100 pt-4 dark:border-stone-800">
                                <div className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-500">⚠️ 服务边界与注意</div>
                                <ul className="mt-2 space-y-1.5 text-xs text-stone-500 dark:text-stone-400">
                                    <li className="flex items-center gap-1.5">
                                        <XCircle className="size-3.5 text-stone-400 shrink-0" />
                                        <span className="font-medium text-amber-700 dark:text-amber-400">纯文档自查模式：不提供任何 1 对 1 人工技术支持与答疑</span>
                                    </li>
                                    <li className="flex items-center gap-1.5">
                                        <XCircle className="size-3.5 text-stone-400 shrink-0" />
                                        <span>遇脚本或网络报错请完全自行排查</span>
                                    </li>
                                </ul>
                            </div>
                        </div>

                        <div className="mt-8">
                            <Button
                                size="large"
                                className="w-full !h-11 !font-medium"
                                onClick={() => openContactModal("极速自助体验包（¥19.9）")}
                            >
                                获取极速体验包（¥19.9）
                            </Button>
                        </div>
                    </div>

                    {/* 方案 B: 创作者伴学与年度更新包 (主推 / 最具性价比款) */}
                    <div className="relative flex flex-col justify-between rounded-3xl border-2 border-blue-500 bg-background p-6 shadow-xl ring-1 ring-blue-500/20 sm:p-8 dark:border-blue-400">
                        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-1 text-xs font-semibold text-white shadow-md">
                            🔥 最具性价比 · 80% 创作者首选
                        </div>

                        <div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="flex size-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
                                        <Sparkles className="size-5" />
                                    </div>
                                    <h3 className="text-xl font-bold">创作者年度伴学包</h3>
                                </div>
                                <Tag color="blue">省心持续更新</Tag>
                            </div>

                            <p className="mt-3 text-sm text-stone-500 dark:text-stone-400">
                                专为高频创作与设计师打造。彻底告别 ComfyUI 每周升级导致的红字断连，享一整年环境稳定与新工作流。
                            </p>

                            <div className="mt-5 flex items-baseline gap-1">
                                <span className="text-4xl font-extrabold tracking-tight text-stone-950 dark:text-stone-100">¥79</span>
                                <span className="text-xs text-stone-500">/ 全年持续更新与答疑</span>
                            </div>
                            <div className="mt-1 text-xs text-stone-400">
                                不到一顿火锅钱，买下一整年稳定省心的创作环境
                            </div>

                            <div className="mt-6 border-t border-stone-100 pt-5 dark:border-stone-800">
                                <div className="text-xs font-semibold uppercase tracking-wider text-stone-400">📦 交付效果</div>
                                <ul className="mt-2 space-y-2 text-xs text-stone-600 dark:text-stone-300">
                                    <li className="flex items-start gap-1.5">
                                        <span className="font-semibold text-blue-600 dark:text-blue-400">•</span>
                                        <span>包含【极速自助体验包】全部云端镜像与本地包脚本</span>
                                    </li>
                                    <li className="flex items-start gap-1.5">
                                        <span className="font-semibold text-blue-600 dark:text-blue-400">•</span>
                                        <span><strong>未来 1 年 ComfyUI 核心插件及镜像版本持续维护更新</strong></span>
                                    </li>
                                    <li className="flex items-start gap-1.5">
                                        <span className="font-semibold text-blue-600 dark:text-blue-400">•</span>
                                        <span><strong>无限画布独家预设工作流与高品质 Prompt 模板库</strong></span>
                                    </li>
                                    <li className="flex items-start gap-1.5">
                                        <span className="font-semibold text-blue-600 dark:text-blue-400">•</span>
                                        <span><strong>官方优先微信群答疑（脚本执行与报错协助定位）</strong></span>
                                    </li>
                                </ul>
                            </div>

                            <div className="mt-4 border-t border-stone-100 pt-4 dark:border-stone-800">
                                <div className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">✅ 核心优势</div>
                                <ul className="mt-2 space-y-1.5 text-xs text-stone-600 dark:text-stone-300">
                                    <li className="flex items-center gap-1.5">
                                        <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                                        <span>彻底免除“开源节点每周升级就红字报错”的折磨</span>
                                    </li>
                                    <li className="flex items-center gap-1.5">
                                        <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                                        <span>第一时间体验无限画布最新功能与前沿模型</span>
                                    </li>
                                    <li className="flex items-center gap-1.5">
                                        <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                                        <span>社群内工程师优先指导，解决脚本与网络异常</span>
                                    </li>
                                </ul>
                            </div>

                            <div className="mt-4 border-t border-stone-100 pt-4 dark:border-stone-800">
                                <div className="text-xs font-semibold uppercase tracking-wider text-rose-500">⚠️ 服务边界与注意</div>
                                <ul className="mt-2 space-y-1.5 text-xs text-stone-500 dark:text-stone-400">
                                    <li className="flex items-center gap-1.5">
                                        <XCircle className="size-3.5 text-stone-400 shrink-0" />
                                        <span>仅限群内文字与截图协助诊断，不含远程代连操作</span>
                                    </li>
                                    <li className="flex items-center gap-1.5">
                                        <XCircle className="size-3.5 text-stone-400 shrink-0" />
                                        <span>云端算力平台租金仍按使用实报实销（1~2元/时）</span>
                                    </li>
                                </ul>
                            </div>
                        </div>

                        <div className="mt-8">
                            <Button
                                type="primary"
                                size="large"
                                className="w-full !h-11 !font-medium"
                                onClick={() => openContactModal("创作者伴学与年度更新包（¥79）")}
                            >
                                加入创作者伴学计划
                            </Button>
                        </div>
                    </div>

                    {/* 方案 C: 1 对 1 专家远程部署 (VIP 尊享款) */}
                    <div className="relative flex flex-col justify-between rounded-3xl border border-purple-200 bg-background p-6 shadow-sm sm:p-8 dark:border-purple-900/60">
                        <div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="flex size-9 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400">
                                        <Wrench className="size-5" />
                                    </div>
                                    <h3 className="text-xl font-bold">1对1 专家全包部署</h3>
                                </div>
                                <Tag color="purple">省心全包 · 跑不通退款</Tag>
                            </div>

                            <p className="mt-3 text-sm text-stone-500 dark:text-stone-400">
                                追求极致省心的团队与老板首选。资深工程师远程全程代劳，定制调优，包跑通包教会。
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
                                        <span><strong>免费赠送方案 2 全套价值 ¥79 的全年更新与独家预设</strong></span>
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
                                <div className="text-xs font-semibold uppercase tracking-wider text-rose-500">⚠️ 缺点与注意</div>
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
                                onClick={() => openContactModal("1对1 专家全包部署（¥299）")}
                            >
                                预约专家远程服务
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
                        <table className="w-full min-w-[640px] text-left text-sm">
                            <thead className="border-b border-stone-100 bg-stone-50/40 text-xs font-semibold text-stone-500 dark:border-stone-800 dark:bg-stone-900/20 dark:text-stone-400">
                                <tr>
                                    <th className="py-3.5 pl-6 pr-3">对比维度</th>
                                    <th className="px-3 py-3.5">极速体验包</th>
                                    <th className="px-3 py-3.5 text-blue-600 dark:text-blue-400">创作者年度伴学 (推荐)</th>
                                    <th className="px-3 py-3.5 text-purple-600 dark:text-purple-400">1对1 专家全包</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100 text-stone-600 dark:divide-stone-800/60 dark:text-stone-300">
                                <tr>
                                    <td className="py-3.5 pl-6 pr-3 font-medium text-stone-900 dark:text-stone-100">方案费用</td>
                                    <td className="px-3 py-3.5 font-semibold text-emerald-600 dark:text-emerald-400">¥19.9 一次性买断</td>
                                    <td className="px-3 py-3.5 font-semibold text-blue-600 dark:text-blue-400">¥79 / 全年更新</td>
                                    <td className="px-3 py-3.5 font-semibold text-purple-600 dark:text-purple-400">¥299 / 次（赠全年伴学）</td>
                                </tr>
                                <tr>
                                    <td className="py-3.5 pl-6 pr-3 font-medium text-stone-900 dark:text-stone-100">运行环境支持</td>
                                    <td className="px-3 py-3.5">AutoDL 云端 + 本地便携双模式</td>
                                    <td className="px-3 py-3.5">AutoDL 云端 + 本地便携双模式</td>
                                    <td className="px-3 py-3.5">工程师按需调优（云端或本地）</td>
                                </tr>
                                <tr>
                                    <td className="py-3.5 pl-6 pr-3 font-medium text-stone-900 dark:text-stone-100">核心交付内容</td>
                                    <td className="px-3 py-3.5">镜像码 + 拉取脚本 + 部署排错文档</td>
                                    <td className="px-3 py-3.5 font-semibold text-stone-900 dark:text-stone-100">镜像/脚本 + 1年版本持续更新 + 独家预设库</td>
                                    <td className="px-3 py-3.5">远程端到端调通 + 显存调优 + 赠全年权益</td>
                                </tr>
                                <tr>
                                    <td className="py-3.5 pl-6 pr-3 font-medium text-stone-900 dark:text-stone-100">技术支持服务</td>
                                    <td className="px-3 py-3.5 text-stone-400">仅限文档自查（不提供人工技术支持）</td>
                                    <td className="px-3 py-3.5 text-blue-600 dark:text-blue-400">官方群优先答疑，截图协助定位排错</td>
                                    <td className="px-3 py-3.5 font-semibold text-purple-600 dark:text-purple-400">1对1 远程代劳协助 + 7天专属技术售后</td>
                                </tr>
                                <tr>
                                    <td className="py-3.5 pl-6 pr-3 font-medium text-stone-900 dark:text-stone-100">版本更新跟进</td>
                                    <td className="px-3 py-3.5">自行对照文档手动升级</td>
                                    <td className="px-3 py-3.5 font-semibold text-emerald-600 dark:text-emerald-400">团队持续回归测试，推送最新稳定版本</td>
                                    <td className="px-3 py-3.5">同步享有方案 2 全套全年更新权益</td>
                                </tr>
                                <tr>
                                    <td className="py-3.5 pl-6 pr-3 font-medium text-stone-900 dark:text-stone-100">售后与保障</td>
                                    <td className="px-3 py-3.5">虚拟数字资源，附带完整文档</td>
                                    <td className="px-3 py-3.5">社群持续维护，问题优先响应</td>
                                    <td className="px-3 py-3.5 font-semibold text-purple-600 dark:text-purple-400">承诺包跑通包出图，跑不通全额退款</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 4. 为什么极速体验包仅需 19.9 元且不提供人工支持？（坦诚告知：关于人力成本与持续维护） */}
                <div className="mt-16 rounded-3xl border border-stone-200 bg-stone-50/70 p-6 sm:p-10 dark:border-stone-800 dark:bg-stone-900/50">
                    <div className="mx-auto max-w-3xl text-center">
                        <div className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-background px-3 py-1 text-xs font-medium text-stone-600 dark:border-stone-700 dark:text-stone-300">
                            <Heart className="size-3.5 text-rose-500 fill-rose-500" />
                            <span>坦诚告知 · 关于极低体验价与服务边界的真心话</span>
                        </div>
                        <h2 className="mt-3 text-2xl font-bold tracking-tight text-stone-950 dark:text-stone-100 sm:text-3xl">
                            为什么极速体验包要收 19.9 元？为什么不提供人工支持？
                        </h2>
                        <p className="mt-3 text-sm leading-relaxed text-stone-600 dark:text-stone-400">
                            《无限画布》前端代码与文档 100% 保持开源免费。极速体验包之所以收取 19.9 元，是因为<strong>云端一个包含 MiniMax、Flux 等百 G 模型的预装镜像，平台每天都在扣除高昂的存储租金；如果不收费用，镜像就会因欠费被平台直接清理销毁，大家也将无法使用。因此必须象征性收取一点费用分摊存储成本，以维持镜像长期存活。</strong>同时，由于 19.9 元纯属象征性成本分摊、完全无法覆盖工程师一对一排障的人力时间成本，因此该方案严格仅限文档自查、不提供人工答疑支持；若您需要社群优先答疑请选 ¥79 伴学包，需要专家全程代劳请选 ¥299 远程服务。
                        </p>
                    </div>

                    <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
                        <div className="rounded-2xl border border-stone-200/80 bg-background p-5 dark:border-stone-800">
                            <div className="flex size-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
                                <Database className="size-5" />
                            </div>
                            <h3 className="mt-3 text-sm font-bold text-stone-900 dark:text-stone-100">1. 云端镜像高昂的长期存储租金</h3>
                            <p className="mt-2 text-xs leading-relaxed text-stone-500 dark:text-stone-400">
                                一个包含 5 大核心插件、MiniMax H3、Flux2、Qwen3.5 等全模态高精度权重的完整 ComfyUI 镜像，体积高达 <strong>80GB ~ 120GB</strong>。算力云平台按天收取持续的镜像存储费与公网分发流量费，每月均有固定的云账单支出。
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
                                <HelpCircle className="size-4 text-blue-500" />
                                为什么极速体验包要收取 19.9 元？提供人工支持吗？
                            </h3>
                            <p className="mt-2 text-xs leading-relaxed text-stone-500 dark:text-stone-400">
                                <strong>核心是为了维持镜像存活，不提供人工技术支持</strong>。云端存储一个包含全套百 G 模型与插件的预装镜像，平台每天都在扣除固定的存储费用；如果不收费用，镜像会因欠费被平台直接清理删除。19.9 元纯属象征性分摊长期存储租金，让大家随时有一键可用的镜像。同时因价格极低无法覆盖人工排查时间成本，仅附带全套详尽文档供自查，不提供 1 对 1 人工排障。若需人工指导请选 ¥79 伴学包，需远程代劳请选 ¥299 专家部署。
                            </p>
                        </Card>

                        <Card className="!rounded-2xl dark:!border-stone-800 dark:!bg-stone-900/40">
                            <h3 className="flex items-center gap-2 text-base font-semibold">
                                <HelpCircle className="size-4 text-blue-500" />
                                既然有 19.9 元体验包，为什么强烈推荐选 ¥79 伴学包？
                            </h3>
                            <p className="mt-2 text-xs leading-relaxed text-stone-500 dark:text-stone-400">
                                开源 AI 社区迭代极快，底层 PyTorch、ComfyUI 和第三方插件几乎每周都在更新，极易导致旧工作流爆红断连。19.9 元版本仅包含当前静态镜像与文档，不含后续持续维护；而 ¥79 伴学包由工程师团队持续整年回归测试并推送稳定镜像，同时享有独家预设库与官方群优先答疑指导，更加省心长久。
                            </p>
                        </Card>

                        <Card className="!rounded-2xl dark:!border-stone-800 dark:!bg-stone-900/40">
                            <h3 className="flex items-center gap-2 text-base font-semibold">
                                <HelpCircle className="size-4 text-blue-500" />
                                如果我买了 19.9 元体验包，遇到部署报错怎么处理？
                            </h3>
                            <p className="mt-2 text-xs leading-relaxed text-stone-500 dark:text-stone-400">
                                随包附带了保姆级视频与《常见报错排查手册》（涵盖 90% 的网络超时、端口占用、显存爆满等问题）。请先严格对照文档自查排错；若尝试后希望彻底省心，可随时升级为 ¥79 伴学群优先答疑 或 ¥299 专家远程服务。
                            </p>
                        </Card>

                        <Card className="!rounded-2xl dark:!border-stone-800 dark:!bg-stone-900/40">
                            <h3 className="flex items-center gap-2 text-base font-semibold">
                                <HelpCircle className="size-4 text-blue-500" />
                                我是苹果 Mac 电脑（M1/M2/M3），能不能用？
                            </h3>
                            <p className="mt-2 text-xs leading-relaxed text-stone-500 dark:text-stone-400">
                                强烈推荐！Mac 电脑本地跑 ComfyUI 大模型速度较慢且不支持诸多 CUDA 加速节点；通过我们的 AutoDL 云端镜像，Mac 只需要打开浏览器即可远程享用 24G 顶级 Nvidia 显卡算力，体验丝滑流畅。
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
