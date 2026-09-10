import { useState } from "react";
import { Button, Card, Modal, Tag } from "antd";
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
    HelpCircle,
} from "lucide-react";

import { useCopyText } from "@/hooks/use-copy-text";

// 预留微信号配置，方便后续随时修改
export const WECHAT_CONTACT = {
    wechatId: "comfy-canvas-service", // 预留微信号，后续提供真实微信号直接替换
    title: "AI 部署专家专属咨询",
    qrPlaceholderNote: "微信扫一扫上方二维码添加客服",
    tip: "添加时请备注：【云端镜像】/【本地部署】/【1对1咨询】，极速优先通过！",
};

export default function PricingPage() {
    const copyText = useCopyText();
    const [qrModalOpen, setQrModalOpen] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState<string>("云端算力镜像包");

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
                                        主流卡（RTX 3090/4070 24G）仅 <span className="font-semibold text-emerald-600 dark:text-emerald-400">¥1~2 /小时</span>；旗舰卡（4090/A100）约 <span className="font-semibold text-emerald-600 dark:text-emerald-400">¥7~8 /小时</span>
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

                {/* 2. 三大主力方案卡片 (展现交付效果、优势与缺点) */}
                <div className="mt-14 grid grid-cols-1 gap-8 lg:grid-cols-3">
                    {/* 方案 A: 云端算力一键镜像 (主推 / 走量款) */}
                    <div className="relative flex flex-col justify-between rounded-3xl border-2 border-blue-500 bg-background p-6 shadow-xl ring-1 ring-blue-500/20 sm:p-8 dark:border-blue-400">
                        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-1 text-xs font-semibold text-white shadow-md">
                            🔥 主力热销 · 80% 创作者首选
                        </div>

                        <div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="flex size-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
                                        <Cloud className="size-5" />
                                    </div>
                                    <h3 className="text-xl font-bold">云端一键即用镜像</h3>
                                </div>
                                <Tag color="blue">零硬件门槛</Tag>
                            </div>

                            <p className="mt-3 text-sm text-stone-500 dark:text-stone-400">
                                摆脱电脑配置束缚。AutoDL / 算力云一键启动，内置全部插件与大模型，网页直连 5 分钟开跑。
                            </p>

                            <div className="mt-5 flex items-baseline gap-1">
                                <span className="text-4xl font-extrabold tracking-tight text-stone-950 dark:text-stone-100">¥49</span>
                                <span className="text-xs text-stone-500">/ 终身镜像与升级</span>
                            </div>
                            <div className="mt-1 text-xs text-stone-400">
                                算力租金实报实销（便宜卡仅 1~2 元/时，用多少花多少）
                            </div>

                            <div className="mt-6 border-t border-stone-100 pt-5 dark:border-stone-800">
                                <div className="text-xs font-semibold uppercase tracking-wider text-stone-400">📦 交付效果</div>
                                <ul className="mt-2 space-y-2 text-xs text-stone-600 dark:text-stone-300">
                                    <li className="flex items-start gap-1.5">
                                        <span className="font-semibold text-blue-600 dark:text-blue-400">•</span>
                                        <span>专属算力云镜像分享码 + 1分钟快速启动指南</span>
                                    </li>
                                    <li className="flex items-start gap-1.5">
                                        <span className="font-semibold text-blue-600 dark:text-blue-400">•</span>
                                        <span>预装好 5 大必备插件（kktools、KJNodes、Literals 等）</span>
                                    </li>
                                    <li className="flex items-start gap-1.5">
                                        <span className="font-semibold text-blue-600 dark:text-blue-400">•</span>
                                        <span>预下好 MiniMax H3、Flux2、Qwen3.5 全套模型与工作流</span>
                                    </li>
                                </ul>
                            </div>

                            <div className="mt-4 border-t border-stone-100 pt-4 dark:border-stone-800">
                                <div className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">✅ 核心优势</div>
                                <ul className="mt-2 space-y-1.5 text-xs text-stone-600 dark:text-stone-300">
                                    <li className="flex items-center gap-1.5">
                                        <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                                        <span>轻薄本、Mac、iPad 都能流畅出图出视频</span>
                                    </li>
                                    <li className="flex items-center gap-1.5">
                                        <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                                        <span>无需繁琐配置 Python/CUDA，彻底告别红字报错</span>
                                    </li>
                                    <li className="flex items-center gap-1.5">
                                        <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                                        <span>不占用本地硬盘（省下 100GB+ 存储空间）</span>
                                    </li>
                                </ul>
                            </div>

                            <div className="mt-4 border-t border-stone-100 pt-4 dark:border-stone-800">
                                <div className="text-xs font-semibold uppercase tracking-wider text-rose-500">⚠️ 缺点与注意</div>
                                <ul className="mt-2 space-y-1.5 text-xs text-stone-500 dark:text-stone-400">
                                    <li className="flex items-center gap-1.5">
                                        <XCircle className="size-3.5 text-stone-400 shrink-0" />
                                        <span>需联网使用，无法在无网断网环境下运行</span>
                                    </li>
                                    <li className="flex items-center gap-1.5">
                                        <XCircle className="size-3.5 text-stone-400 shrink-0" />
                                        <span>需自备算力平台账号（按使用分钟扣除 1~2元/时）</span>
                                    </li>
                                </ul>
                            </div>
                        </div>

                        <div className="mt-8">
                            <Button
                                type="primary"
                                size="large"
                                className="w-full !h-11 !font-medium"
                                onClick={() => openContactModal("云端一键即用镜像包")}
                            >
                                立即获取云端镜像
                            </Button>
                        </div>
                    </div>

                    {/* 方案 B: 本地免安装整合包 (进阶本地款) */}
                    <div className="relative flex flex-col justify-between rounded-3xl border border-stone-200 bg-background p-6 shadow-sm sm:p-8 dark:border-stone-800">
                        <div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="flex size-9 items-center justify-center rounded-lg bg-stone-500/10 text-stone-700 dark:bg-stone-500/20 dark:text-stone-300">
                                        <HardDrive className="size-5" />
                                    </div>
                                    <h3 className="text-xl font-bold">本地免配置整合包</h3>
                                </div>
                                <Tag>离线隐私</Tag>
                            </div>

                            <p className="mt-3 text-sm text-stone-500 dark:text-stone-400">
                                适合电脑硬件高配的玩家。解压即用免安装绿色版，数据 100% 留在本地，无租赁费用。
                            </p>

                            <div className="mt-5 flex items-baseline gap-1">
                                <span className="text-4xl font-extrabold tracking-tight text-stone-950 dark:text-stone-100">¥99</span>
                                <span className="text-xs text-stone-500">/ 完整整合包下载</span>
                            </div>
                            <div className="mt-1 text-xs text-stone-400">
                                后续零额外费用，一次解压永久离线使用
                            </div>

                            <div className="mt-6 border-t border-stone-100 pt-5 dark:border-stone-800">
                                <div className="text-xs font-semibold uppercase tracking-wider text-stone-400">📦 交付效果</div>
                                <ul className="mt-2 space-y-2 text-xs text-stone-600 dark:text-stone-300">
                                    <li className="flex items-start gap-1.5">
                                        <span className="font-semibold text-stone-600 dark:text-stone-400">•</span>
                                        <span>百度网盘 / 夸克网盘高速直链下载</span>
                                    </li>
                                    <li className="flex items-start gap-1.5">
                                        <span className="font-semibold text-stone-600 dark:text-stone-400">•</span>
                                        <span>内置独立 Python 3.11、Git 及专属依赖运行库</span>
                                    </li>
                                    <li className="flex items-start gap-1.5">
                                        <span className="font-semibold text-stone-600 dark:text-stone-400">•</span>
                                        <span>一键启动批处理脚本（内置跨域与外部监听参数）</span>
                                    </li>
                                </ul>
                            </div>

                            <div className="mt-4 border-t border-stone-100 pt-4 dark:border-stone-800">
                                <div className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">✅ 核心优势</div>
                                <ul className="mt-2 space-y-1.5 text-xs text-stone-600 dark:text-stone-300">
                                    <li className="flex items-center gap-1.5">
                                        <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                                        <span>100% 离线运行，原创商用素材与隐私绝对保密</span>
                                    </li>
                                    <li className="flex items-center gap-1.5">
                                        <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                                        <span>无每小时算力账单，高频大批量出图最划算</span>
                                    </li>
                                    <li className="flex items-center gap-1.5">
                                        <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                                        <span>与无限画布本地完全打通，即启即用</span>
                                    </li>
                                </ul>
                            </div>

                            <div className="mt-4 border-t border-stone-100 pt-4 dark:border-stone-800">
                                <div className="text-xs font-semibold uppercase tracking-wider text-rose-500">⚠️ 缺点与注意</div>
                                <ul className="mt-2 space-y-1.5 text-xs text-stone-500 dark:text-stone-400">
                                    <li className="flex items-center gap-1.5">
                                        <XCircle className="size-3.5 text-stone-400 shrink-0" />
                                        <span>强依赖本地硬件：需 Windows + Nvidia 独显（建议12G+）</span>
                                    </li>
                                    <li className="flex items-center gap-1.5">
                                        <XCircle className="size-3.5 text-stone-400 shrink-0" />
                                        <span>模型包体大（需 80GB~150GB 硬盘空间，下载耗时）</span>
                                    </li>
                                </ul>
                            </div>
                        </div>

                        <div className="mt-8">
                            <Button
                                size="large"
                                className="w-full !h-11 !font-medium"
                                onClick={() => openContactModal("本地免配置整合包")}
                            >
                                获取本地整合包
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
                                <Tag color="purple">省心全包</Tag>
                            </div>

                            <p className="mt-3 text-sm text-stone-500 dark:text-stone-400">
                                追求极致省心的团队与老板首选。资深工程师远程全程代劳，定制调优，包跑通包教会。
                            </p>

                            <div className="mt-5 flex items-baseline gap-1">
                                <span className="text-4xl font-extrabold tracking-tight text-stone-950 dark:text-stone-100">¥299</span>
                                <span className="text-xs text-stone-500">/ 次（含7天专属技术售后）</span>
                            </div>
                            <div className="mt-1 text-xs text-stone-400">
                                包本地/局域网调优，跑不通全额退款
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
                                        <span>支持定制多机器局域网共享部署</span>
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
                                onClick={() => openContactModal("1对1 专家全包部署")}
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
                                    <th className="px-3 py-3.5 text-blue-600 dark:text-blue-400">云端一键镜像 (推荐)</th>
                                    <th className="px-3 py-3.5">本地免配整合包</th>
                                    <th className="px-3 py-3.5 text-purple-600 dark:text-purple-400">1对1 专家全包</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100 text-stone-600 dark:divide-stone-800/60 dark:text-stone-300">
                                <tr>
                                    <td className="py-3.5 pl-6 pr-3 font-medium text-stone-900 dark:text-stone-100">电脑硬件要求</td>
                                    <td className="px-3 py-3.5 font-semibold text-emerald-600 dark:text-emerald-400">零要求（轻薄本/Mac均可）</td>
                                    <td className="px-3 py-3.5">高（需 N 卡 12G+ 显存）</td>
                                    <td className="px-3 py-3.5">视需求（工程师协助评估）</td>
                                </tr>
                                <tr>
                                    <td className="py-3.5 pl-6 pr-3 font-medium text-stone-900 dark:text-stone-100">上线速度</td>
                                    <td className="px-3 py-3.5 font-semibold text-emerald-600 dark:text-emerald-400">约 3~5 分钟</td>
                                    <td className="px-3 py-3.5">视网盘下载速度（约1~3小时）</td>
                                    <td className="px-3 py-3.5">预约时间远程（约1小时）</td>
                                </tr>
                                <tr>
                                    <td className="py-3.5 pl-6 pr-3 font-medium text-stone-900 dark:text-stone-100">后续算力开销</td>
                                    <td className="px-3 py-3.5">实报实销（1~2元/小时）</td>
                                    <td className="px-3 py-3.5 font-semibold text-emerald-600 dark:text-emerald-400">¥0（仅消耗电费）</td>
                                    <td className="px-3 py-3.5">无或实报实销</td>
                                </tr>
                                <tr>
                                    <td className="py-3.5 pl-6 pr-3 font-medium text-stone-900 dark:text-stone-100">内置模型与插件</td>
                                    <td className="px-3 py-3.5">全部预装已配齐</td>
                                    <td className="px-3 py-3.5">已预置打包好</td>
                                    <td className="px-3 py-3.5">按需定制下载与优化</td>
                                </tr>
                                <tr>
                                    <td className="py-3.5 pl-6 pr-3 font-medium text-stone-900 dark:text-stone-100">数据隐私性</td>
                                    <td className="px-3 py-3.5">专属云端实例隔离</td>
                                    <td className="px-3 py-3.5 font-semibold text-emerald-600 dark:text-emerald-400">100% 离线单机保密</td>
                                    <td className="px-3 py-3.5">完全留存用户本机</td>
                                </tr>
                                <tr>
                                    <td className="py-3.5 pl-6 pr-3 font-medium text-stone-900 dark:text-stone-100">技术售后保障</td>
                                    <td className="px-3 py-3.5">视频教程 + 常见 FAQ</td>
                                    <td className="px-3 py-3.5">解压文档 + 排错指南</td>
                                    <td className="px-3 py-3.5 font-semibold text-purple-600 dark:text-purple-400">7 天 1 对 1 专家答疑</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 4. 常见问题 FAQ */}
                <div className="mt-16">
                    <h2 className="text-center text-2xl font-bold">常见疑问解答 (FAQ)</h2>
                    <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
                        <Card className="!rounded-2xl dark:!border-stone-800 dark:!bg-stone-900/40">
                            <h3 className="flex items-center gap-2 text-base font-semibold">
                                <HelpCircle className="size-4 text-blue-500" />
                                为什么云端 GPU 只要 1~2 块钱一小时？
                            </h3>
                            <p className="mt-2 text-xs leading-relaxed text-stone-500 dark:text-stone-400">
                                我们对接的是国内主流的弹性 GPU 算力平台（如 AutoDL 等）。平台采用按使用分钟计费模式，不用时随时关机停止计费。跑几百张图通常只需几十分钟，折合下来成本极其低廉，相比自己花 1.5 万元买高端显卡更划算。
                            </p>
                        </Card>

                        <Card className="!rounded-2xl dark:!border-stone-800 dark:!bg-stone-900/40">
                            <h3 className="flex items-center gap-2 text-base font-semibold">
                                <HelpCircle className="size-4 text-blue-500" />
                                我是苹果 Mac 电脑（M1/M2/M3），能不能用？
                            </h3>
                            <p className="mt-2 text-xs leading-relaxed text-stone-500 dark:text-stone-400">
                                强烈推荐选<strong>【云端一键镜像】</strong>方案！Mac 电脑本地跑 ComfyUI 大模型速度较慢且不支持诸多 CUDA 加速节点；通过云端镜像，Mac 只需要打开浏览器即可远程享用满血 Nvidia 显卡算力，体验丝滑流畅。
                            </p>
                        </Card>

                        <Card className="!rounded-2xl dark:!border-stone-800 dark:!bg-stone-900/40">
                            <h3 className="flex items-center gap-2 text-base font-semibold">
                                <HelpCircle className="size-4 text-blue-500" />
                                购买了云端镜像后，如果不会操作怎么办？
                            </h3>
                            <p className="mt-2 text-xs leading-relaxed text-stone-500 dark:text-stone-400">
                                随镜像附带保姆级图文与视频指引，流程仅需 3 步：复制代码 ➔ 创建算力实例 ➔ 网页填入连接地址。若遇到任何网络或连接阻碍，微信客服均会提供排查支持。
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
                            onClick={() => openContactModal("专属微信咨询")}
                        >
                            扫码添加微信咨询
                        </Button>
                        <Button
                            size="large"
                            className="!h-10 !px-6 !text-white !border-stone-600 hover:!border-white"
                            onClick={() => copyText(WECHAT_CONTACT.wechatId, `已复制微信号: ${WECHAT_CONTACT.wechatId}`)}
                        >
                            一键复制微信号
                        </Button>
                    </div>
                </div>
            </div>

            {/* 微信咨询与购买二维码弹窗 */}
            <Modal
                title={
                    <div className="flex items-center gap-2 text-base font-bold">
                        <MessageSquare className="size-5 text-emerald-500" />
                        <span>{WECHAT_CONTACT.title}</span>
                    </div>
                }
                open={qrModalOpen}
                onCancel={() => setQrModalOpen(false)}
                footer={null}
                centered
                destroyOnClose
            >
                <div className="py-4 text-center">
                    <Tag color="blue" className="mb-3">
                        当前咨询意向：{selectedPlan}
                    </Tag>

                    {/* 微信二维码占位容器（待用户提供截图后直接替换图片路径） */}
                    <div className="mx-auto flex size-60 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-stone-300 bg-stone-50 p-4 dark:border-stone-700 dark:bg-stone-800">
                        <div className="flex size-44 flex-col items-center justify-center rounded-xl bg-white p-3 shadow-inner dark:bg-stone-900">
                            {/* 待用户提供微信截图后，将此处换成真实的二维码图片 */}
                            <div className="flex flex-col items-center justify-center text-center">
                                <div className="rounded-full bg-emerald-500/10 p-3 text-emerald-600 dark:text-emerald-400">
                                    <MessageSquare className="size-8" />
                                </div>
                                <span className="mt-2 text-xs font-semibold text-stone-800 dark:text-stone-200">
                                    【微信二维码待替换】
                                </span>
                                <span className="mt-1 text-[11px] text-stone-400">
                                    提供截图后自动呈现
                                </span>
                            </div>
                        </div>
                        <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
                            {WECHAT_CONTACT.qrPlaceholderNote}
                        </p>
                    </div>

                    {/* 微信号一键复制栏 */}
                    <div className="mx-auto mt-5 flex max-w-xs items-center justify-between rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs dark:border-stone-700 dark:bg-stone-800">
                        <span className="text-stone-500 dark:text-stone-400">微信号：</span>
                        <span className="font-mono font-bold text-stone-900 dark:text-stone-100">
                            {WECHAT_CONTACT.wechatId}
                        </span>
                        <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded bg-stone-200 px-2 py-1 text-[11px] font-medium text-stone-800 transition hover:bg-stone-300 dark:bg-stone-700 dark:text-stone-200 dark:hover:bg-stone-600"
                            onClick={() => copyText(WECHAT_CONTACT.wechatId, `已复制微信号: ${WECHAT_CONTACT.wechatId}`)}
                        >
                            <Copy className="size-3" />
                            <span>复制</span>
                        </button>
                    </div>

                    <p className="mt-4 text-xs leading-relaxed text-amber-600 dark:text-amber-400">
                        💡 {WECHAT_CONTACT.tip}
                    </p>
                </div>
            </Modal>
        </main>
    );
}
