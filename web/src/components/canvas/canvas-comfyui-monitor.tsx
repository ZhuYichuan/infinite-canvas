import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Popover, Progress, Select, Tooltip, message } from "antd";
import { Activity, Cpu, Eraser, ExternalLink, HardDrive, Loader2, RefreshCw, Server, Sparkles } from "lucide-react";
import { useConfigStore, type ModelChannel } from "@/stores/use-config-store";
import { useThemeStore } from "@/stores/use-theme-store";
import { canvasThemes } from "@/lib/canvas-theme";
import { formatBytes } from "@/lib/image-utils";
import {
    freeComfyuiMemory,
    getComfyuiRuntimeStats,
    getComfyuiSystemStats,
    type ComfyuiRuntimeStats,
    type ComfyuiSystemStats,
} from "@/services/api/comfyui";

function cleanGpuName(rawName?: string) {
    if (!rawName) return "GPU 加速卡";
    return rawName
        .replace(/^cuda:\d+\s*/i, "")
        .replace(/\s*:\s*cudaMallocAsync/i, "")
        .trim() || rawName;
}

function formatUptime(seconds?: number) {
    if (!seconds || seconds <= 0) return "";
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}小时${mins}分`;
    return `${mins}分钟`;
}

type ChannelSummary = {
    online: boolean;
    vramPercent: number;
    vramUsed: number;
    vramTotal: number;
    gpuName: string;
};

export function CanvasComfyuiMonitor() {
    const colorTheme = useThemeStore((state) => state.theme);
    const theme = canvasThemes[colorTheme];

    const channels = useConfigStore((state) => state.config.channels);
    const comfyChannels = useMemo(() => {
        const list = (channels || []).filter((c) => c.apiFormat === "comfyui" || c.comfyuiProxyUrl?.trim());
        return list.length > 0 ? list : channels;
    }, [channels]);

    // 当前选中的机器 ID，默认选中主渠道
    const [selectedChannelId, setSelectedChannelId] = useState<string>(() => comfyChannels[0]?.id || "");

    useEffect(() => {
        if (!comfyChannels.some((c) => c.id === selectedChannelId)) {
            setSelectedChannelId(comfyChannels[0]?.id || "");
        }
    }, [comfyChannels, selectedChannelId]);

    const activeChannel: ModelChannel = useMemo(() => {
        return comfyChannels.find((c) => c.id === selectedChannelId) || comfyChannels[0];
    }, [comfyChannels, selectedChannelId]);

    const baseUrl = (activeChannel?.comfyuiProxyUrl || activeChannel?.baseUrl || "http://127.0.0.1:8188").trim();
    const token = activeChannel?.comfyuiProxyToken || activeChannel?.apiKey;

    const [systemStats, setSystemStats] = useState<ComfyuiSystemStats | null>(null);
    const [runtimeStats, setRuntimeStats] = useState<ComfyuiRuntimeStats | null>(null);
    const [isOnline, setIsOnline] = useState<boolean>(false);
    const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
    const [isCleaning, setIsCleaning] = useState<boolean>(false);
    const [isCleaningAll, setIsCleaningAll] = useState<boolean>(false);
    const [popoverOpen, setPopoverOpen] = useState<boolean>(false);

    // 多台机器概览缓存（用于机器切换列表展示）
    const [channelSummaries, setChannelSummaries] = useState<Record<string, ChannelSummary>>({});

    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // 刷新当前选中的机器详情
    const refreshCurrent = useCallback(
        async (silent = false) => {
            if (!baseUrl) return;
            if (!silent) setIsRefreshing(true);
            try {
                const [sys, run] = await Promise.all([
                    getComfyuiSystemStats(baseUrl, token),
                    getComfyuiRuntimeStats(baseUrl, token),
                ]);

                if (sys || run) {
                    setIsOnline(true);
                    setSystemStats(sys);
                    setRuntimeStats(run);

                    // 同步更新摘要
                    let used = 0;
                    let total = 0;
                    let percent = 0;
                    const d = run?.data?.devices?.[0];
                    if (d) {
                        used = d.memory_used;
                        total = d.memory_total;
                        percent = Math.round(d.memory_percent);
                    } else if (sys?.devices?.[0]) {
                        total = sys.devices[0].vram_total;
                        used = total - (sys.devices[0].vram_free || 0);
                        percent = total > 0 ? Math.round((used / total) * 100) : 0;
                    }
                    const gpu = cleanGpuName(d?.name || sys?.devices?.[0]?.name);
                    setChannelSummaries((prev) => ({
                        ...prev,
                        [activeChannel.id]: {
                            online: true,
                            vramPercent: percent,
                            vramUsed: used,
                            vramTotal: total,
                            gpuName: gpu,
                        },
                    }));
                } else {
                    setIsOnline(false);
                    setChannelSummaries((prev) => ({
                        ...prev,
                        [activeChannel.id]: {
                            online: false,
                            vramPercent: 0,
                            vramUsed: 0,
                            vramTotal: 0,
                            gpuName: "未连接",
                        },
                    }));
                }
            } catch {
                setIsOnline(false);
            } finally {
                if (!silent) setIsRefreshing(false);
            }
        },
        [baseUrl, token, activeChannel?.id]
    );

    // 多机轻量概览探测
    const probeAllChannels = useCallback(async () => {
        if (comfyChannels.length <= 1) return;
        const targets = comfyChannels.filter((c) => c.id !== activeChannel?.id);
        await Promise.allSettled(
            targets.map(async (ch) => {
                const chUrl = (ch.comfyuiProxyUrl || ch.baseUrl || "").trim();
                const chToken = ch.comfyuiProxyToken || ch.apiKey;
                if (!chUrl) return;
                try {
                    const sys = await getComfyuiSystemStats(chUrl, chToken);
                    if (sys && sys.devices?.[0]) {
                        const total = sys.devices[0].vram_total;
                        const free = sys.devices[0].vram_free || 0;
                        const used = total - free;
                        const percent = total > 0 ? Math.round((used / total) * 100) : 0;
                        setChannelSummaries((prev) => ({
                            ...prev,
                            [ch.id]: {
                                online: true,
                                vramPercent: percent,
                                vramUsed: used,
                                vramTotal: total,
                                gpuName: cleanGpuName(sys.devices[0].name),
                            },
                        }));
                    } else {
                        setChannelSummaries((prev) => ({
                            ...prev,
                            [ch.id]: {
                                online: false,
                                vramPercent: 0,
                                vramUsed: 0,
                                vramTotal: 0,
                                gpuName: "离线",
                            },
                        }));
                    }
                } catch {
                    setChannelSummaries((prev) => ({
                        ...prev,
                        [ch.id]: {
                            online: false,
                            vramPercent: 0,
                            vramUsed: 0,
                            vramTotal: 0,
                            gpuName: "离线",
                        },
                    }));
                }
            })
        );
    }, [comfyChannels, activeChannel?.id]);

    // 轮询与后台休眠
    useEffect(() => {
        refreshCurrent(true);
        probeAllChannels();

        const handleVisibilityChange = () => {
            if (document.hidden) {
                if (timerRef.current) clearInterval(timerRef.current);
            } else {
                refreshCurrent(true);
                probeAllChannels();
                startInterval();
            }
        };

        const startInterval = () => {
            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = setInterval(() => {
                refreshCurrent(true);
            }, 3500);
        };

        startInterval();
        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, [refreshCurrent, probeAllChannels]);

    // 清理当前机器
    const handleFree = async () => {
        if (!baseUrl || isCleaning) return;
        setIsCleaning(true);
        try {
            const ok = await freeComfyuiMemory(baseUrl, token, { unload_models: true, free_memory: true });
            if (ok) {
                message.success(`已释放主机「${activeChannel?.name || "ComfyUI"}」模型与显存`);
                await refreshCurrent(true);
            } else {
                message.error("清理显存失败，请检查 ComfyUI 服务状态");
            }
        } catch (error) {
            message.error(`清理请求异常: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setIsCleaning(false);
        }
    };

    // 一键清理所有机器
    const handleFreeAll = async () => {
        if (isCleaningAll) return;
        setIsCleaningAll(true);
        let successCount = 0;
        try {
            await Promise.allSettled(
                comfyChannels.map(async (c) => {
                    const u = (c.comfyuiProxyUrl || c.baseUrl || "").trim();
                    const k = c.comfyuiProxyToken || c.apiKey;
                    if (!u) return;
                    const ok = await freeComfyuiMemory(u, k, { unload_models: true, free_memory: true });
                    if (ok) successCount += 1;
                })
            );
            if (successCount > 0) {
                message.success(`已完成 ${successCount} 台 ComfyUI 主机的显存与模型清理！`);
                await refreshCurrent(true);
                await probeAllChannels();
            } else {
                message.error("全部主机清理失败，请检查服务连接");
            }
        } catch (error) {
            message.error(`批量清理异常: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setIsCleaningAll(false);
        }
    };

    // 整合当前选中的机器指标
    const gpuDev = runtimeStats?.data?.devices?.[0] || systemStats?.devices?.[0];
    const gpuName = cleanGpuName(gpuDev?.name);

    let vramTotal = 0;
    let vramUsed = 0;
    let vramPercent = 0;

    if (runtimeStats?.data?.devices?.[0]) {
        const d = runtimeStats.data.devices[0];
        vramTotal = d.memory_total || 0;
        vramUsed = d.memory_used || 0;
        vramPercent = Math.min(100, Math.round(d.memory_percent || 0));
    } else if (systemStats?.devices?.[0]) {
        const d = systemStats.devices[0];
        vramTotal = d.vram_total || 0;
        const vramFree = d.vram_free || 0;
        vramUsed = Math.max(0, vramTotal - vramFree);
        vramPercent = vramTotal > 0 ? Math.min(100, Math.round((vramUsed / vramTotal) * 100)) : 0;
    }

    // 宿主机 RAM 内存
    let ramTotal = 0;
    let ramUsed = 0;
    let ramPercent = 0;

    if (runtimeStats?.data?.memory) {
        const m = runtimeStats.data.memory;
        ramTotal = m.total;
        ramUsed = m.used;
        ramPercent = Math.min(100, Math.round(m.percent));
    } else if (systemStats?.system?.ram_total) {
        ramTotal = systemStats.system.ram_total;
        const ramFree = systemStats.system.ram_free || 0;
        ramUsed = Math.max(0, ramTotal - ramFree);
        ramPercent = ramTotal > 0 ? Math.min(100, Math.round((ramUsed / ramTotal) * 100)) : 0;
    }

    const cpuPercent = runtimeStats?.data?.cpu?.percent !== undefined ? Math.round(runtimeStats.data.cpu.percent) : null;
    const gpuUtilization = runtimeStats?.data?.devices?.[0]?.utilization !== undefined ? Math.round(runtimeStats.data.devices[0].utilization) : null;
    const processMemory = runtimeStats?.data?.process?.memory_used;
    const uptimeSeconds = runtimeStats?.data?.process?.uptime_seconds;

    const dotColor = !isOnline
        ? theme.node.muted
        : vramPercent >= 90
        ? "#ef4444"
        : vramPercent >= 70
        ? "#f59e0b"
        : "#22c55e";

    const vramStatusStroke = vramPercent >= 90 ? "#ef4444" : vramPercent >= 70 ? "#f59e0b" : "#10b981";

    // 顶栏常驻展示文案（多机时展示机器名）
    const machinePrefix = comfyChannels.length > 1 ? `${activeChannel?.name || "ComfyUI"} · ` : "";
    const topBarText = !isOnline
        ? `${machinePrefix}离线`
        : vramTotal > 0
        ? `${machinePrefix}显存 ${vramPercent}% (${formatBytes(vramUsed)}/${formatBytes(vramTotal)})`
        : `${machinePrefix}就绪`;

    // 悬停/点击 Popover 展开面板
    const content = (
        <div className="w-80 select-none space-y-3 p-1 text-xs">
            {/* 多机切换下拉选择器 (当配置了 2 台及以上时呈现) */}
            {comfyChannels.length > 1 ? (
                <div className="border-b pb-2" style={{ borderColor: theme.node.stroke }}>
                    <div className="mb-1 flex items-center justify-between text-[11px] opacity-70">
                        <span className="flex items-center gap-1 font-medium">
                            <Server className="size-3" />
                            <span>算力主机 ({comfyChannels.length}台)</span>
                        </span>
                        <span>点击切换监控对象</span>
                    </div>
                    <Select
                        size="small"
                        value={selectedChannelId}
                        onChange={(id) => {
                            setSelectedChannelId(id);
                        }}
                        className="w-full text-xs"
                        options={comfyChannels.map((c) => {
                            const sum = channelSummaries[c.id];
                            const hostUrl = (c.comfyuiProxyUrl || c.baseUrl || "").replace(/^https?:\/\//i, "").replace(/\/+$/, "");
                            return {
                                value: c.id,
                                label: (
                                    <div className="flex items-center justify-between gap-1 text-xs">
                                        <div className="flex min-w-0 items-center gap-1.5">
                                            <span
                                                className="size-1.5 shrink-0 rounded-full"
                                                style={{
                                                    background: sum
                                                        ? sum.online
                                                            ? "#22c55e"
                                                            : "#a8a29e"
                                                        : c.id === activeChannel.id && isOnline
                                                        ? "#22c55e"
                                                        : "#a8a29e",
                                                }}
                                            />
                                            <span className="truncate max-w-[130px] font-medium">{c.name || "ComfyUI 主机"}</span>
                                        </div>
                                        <span className="text-[10px] opacity-60 font-mono truncate max-w-[100px]">
                                            {sum?.online ? `显存 ${sum.vramPercent}%` : hostUrl}
                                        </span>
                                    </div>
                                ),
                            };
                        })}
                    />
                </div>
            ) : null}

            {/* 顶栏：服务连接状态与地址 */}
            <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: theme.node.stroke }}>
                <div className="flex min-w-0 items-center gap-2">
                    <span className="relative flex size-2">
                        {isOnline ? (
                            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                        ) : null}
                        <span className="relative inline-flex size-2 rounded-full" style={{ background: dotColor }} />
                    </span>
                    <span className="truncate font-semibold" style={{ color: theme.node.text }}>
                        {activeChannel?.name || "ComfyUI"} {isOnline ? "(在线)" : "(未连通)"}
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    <Tooltip title="立即刷新状态">
                        <button
                            type="button"
                            onClick={() => refreshCurrent(false)}
                            disabled={isRefreshing}
                            className="grid size-6 place-items-center rounded transition hover:bg-black/5 dark:hover:bg-white/10"
                            style={{ color: theme.node.muted }}
                        >
                            <RefreshCw className={`size-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
                        </button>
                    </Tooltip>
                    {baseUrl ? (
                        <Tooltip title="在浏览器打开该主机原生 ComfyUI 页面">
                            <a
                                href={baseUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="grid size-6 place-items-center rounded transition hover:bg-black/5 dark:hover:bg-white/10"
                                style={{ color: theme.node.muted }}
                            >
                                <ExternalLink className="size-3.5" />
                            </a>
                        </Tooltip>
                    ) : null}
                </div>
            </div>

            {/* GPU 显存负载卡片 */}
            <div className="rounded-lg p-2.5" style={{ background: theme.mode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)" }}>
                <div className="mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-medium" style={{ color: theme.node.text }}>
                        <Cpu className="size-3.5 text-blue-500" />
                        <span className="truncate max-w-[170px]" title={gpuName}>
                            {gpuName}
                        </span>
                    </span>
                    {gpuUtilization !== null ? (
                        <span className="text-[11px] opacity-70">
                            负载 <strong className="font-semibold">{gpuUtilization}%</strong>
                        </span>
                    ) : null}
                </div>
                <Progress
                    percent={vramPercent}
                    size="small"
                    strokeColor={vramStatusStroke}
                    showInfo={false}
                    className="!m-0"
                />
                <div className="mt-1.5 flex items-center justify-between text-[11px] opacity-75">
                    <span>
                        显存占用: <strong>{vramPercent}%</strong>
                    </span>
                    <span>
                        {formatBytes(vramUsed)} / {formatBytes(vramTotal)}
                    </span>
                </div>
            </div>

            {/* 宿主机 RAM 内存与 CPU 卡片 */}
            <div className="rounded-lg p-2.5" style={{ background: theme.mode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)" }}>
                <div className="mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-medium" style={{ color: theme.node.text }}>
                        <HardDrive className="size-3.5 text-amber-500" />
                        <span>系统内存 (RAM)</span>
                    </span>
                    {cpuPercent !== null ? (
                        <span className="text-[11px] opacity-70">
                            CPU: <strong className="font-semibold">{cpuPercent}%</strong>
                            {runtimeStats?.data?.cpu?.logical_cores ? ` (${runtimeStats.data.cpu.logical_cores}核)` : ""}
                        </span>
                    ) : null}
                </div>
                <Progress
                    percent={ramPercent}
                    size="small"
                    strokeColor={ramPercent >= 90 ? "#ef4444" : "#10b981"}
                    showInfo={false}
                    className="!m-0"
                />
                <div className="mt-1.5 flex items-center justify-between text-[11px] opacity-75">
                    <span>
                        内存占用: <strong>{ramPercent}%</strong>
                    </span>
                    <span>
                        {formatBytes(ramUsed)} / {formatBytes(ramTotal)}
                    </span>
                </div>
            </div>

            {/* 进程与运行环境详情 */}
            <div className="space-y-1 rounded-lg px-2.5 py-2 text-[11px] opacity-75" style={{ background: theme.mode === "dark" ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.01)" }}>
                {systemStats?.system?.comfyui_version ? (
                    <div className="flex justify-between">
                        <span>ComfyUI 版本:</span>
                        <span className="font-mono">{systemStats.system.comfyui_version}</span>
                    </div>
                ) : null}
                {systemStats?.system?.pytorch_version ? (
                    <div className="flex justify-between">
                        <span>PyTorch 版本:</span>
                        <span className="font-mono truncate max-w-[180px]">{systemStats.system.pytorch_version}</span>
                    </div>
                ) : null}
                {processMemory ? (
                    <div className="flex justify-between">
                        <span>进程占用 / 运行:</span>
                        <span>
                            {formatBytes(processMemory)}
                            {uptimeSeconds ? ` · ${formatUptime(uptimeSeconds)}` : ""}
                        </span>
                    </div>
                ) : null}
            </div>

            {/* 底部清理操作 */}
            <div className="space-y-1.5 pt-1">
                <button
                    type="button"
                    onClick={handleFree}
                    disabled={isCleaning || !isOnline}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition hover:bg-black/5 dark:hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                    style={{
                        background: theme.mode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
                        color: theme.node.text,
                    }}
                >
                    {isCleaning ? (
                        <>
                            <Loader2 className="size-3.5 animate-spin" />
                            <span>正在清理当前主机...</span>
                        </>
                    ) : (
                        <>
                            <Eraser className="size-3.5" />
                            <span>卸载模型并释放显存 (当前主机)</span>
                        </>
                    )}
                </button>

                {comfyChannels.length > 1 ? (
                    <button
                        type="button"
                        onClick={handleFreeAll}
                        disabled={isCleaningAll}
                        className="flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs opacity-75 transition hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                        style={{ color: theme.node.text }}
                    >
                        {isCleaningAll ? (
                            <>
                                <Loader2 className="size-3.5 animate-spin" />
                                <span>正在清理全部主机...</span>
                            </>
                        ) : (
                            <>
                                <Sparkles className="size-3 text-amber-500" />
                                <span>一键清理全部 {comfyChannels.length} 台主机显存</span>
                            </>
                        )}
                    </button>
                ) : null}
            </div>
        </div>
    );

    return (
        <div className="flex items-center gap-0.5">
            {/* 常驻显存状态按钮 */}
            <Popover
                content={content}
                trigger={["click"]}
                open={popoverOpen}
                onOpenChange={setPopoverOpen}
                placement="bottomRight"
                arrow={false}
            >
                <button
                    type="button"
                    className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium transition hover:bg-black/5 dark:hover:bg-white/10"
                    style={{ color: theme.node.text }}
                    title="点击查看硬件负载与切换 ComfyUI 主机"
                >
                    <span className="size-2 rounded-full shrink-0" style={{ background: dotColor }} />
                    <span className="max-w-[200px] truncate opacity-90">{topBarText}</span>
                </button>
            </Popover>

            {/* 快速一键清理当前机器 */}
            <Tooltip title={isCleaning ? "正在释放显存..." : `清理「${activeChannel?.name || "ComfyUI"}」显存与模型`}>
                <button
                    type="button"
                    onClick={handleFree}
                    disabled={isCleaning || !isOnline}
                    aria-label="清理显存与卸载已加载模型"
                    className="grid size-8 place-items-center rounded-lg transition hover:bg-black/5 dark:hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                    style={{ color: theme.node.text }}
                >
                    {isCleaning ? (
                        <Loader2 className="size-3.5 animate-spin text-amber-500" />
                    ) : (
                        <Eraser className="size-3.5 opacity-80 transition-opacity hover:opacity-100" />
                    )}
                </button>
            </Tooltip>
        </div>
    );
}
