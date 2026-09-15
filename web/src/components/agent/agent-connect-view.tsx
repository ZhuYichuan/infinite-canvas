import { Fragment, useEffect, useState } from "react";
import { App, Button, Input, Tooltip } from "antd";
import copyToClipboard from "copy-to-clipboard";
import { Bot, Copy, KeyRound, Link2, PlugZap, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";

import { canvasThemes } from "@/lib/canvas-theme";
import { fetchWorkbuddyConfig, fetchWorkbuddyStatus, saveWorkbuddyConfig } from "@/services/api/canvas-agent";

const AGENT_PLUGIN_REMOVE_COMMAND = "codex plugin remove infinite-canvas";
const AGENT_MCP_REMOVE_COMMAND = "codex mcp remove infinite-canvas";

export function AgentConnectView({
    theme,
    url,
    token,
    enabled,
    connected,
    activity,
    connectError,
    onUrlChange,
    onTokenChange,
    onToggleEnabled,
}: {
    theme: (typeof canvasThemes)[keyof typeof canvasThemes];
    url: string;
    token: string;
    enabled: boolean;
    connected: boolean;
    activity: string;
    connectError: string;
    onUrlChange: (value: string) => void;
    onTokenChange: (value: string) => void;
    onToggleEnabled: () => void;
}) {
    const { t } = useTranslation();
    const { message } = App.useApp();
    const [wbToken, setWbToken] = useState("");
    const [wbOnline, setWbOnline] = useState<boolean | null>(null);
    const [wbChecking, setWbChecking] = useState(false);
    const [wbSaving, setWbSaving] = useState(false);

    useEffect(() => {
        if (!connected || !url || !token) return;
        let active = true;
        void fetchWorkbuddyConfig(url, token).then((res) => {
            if (!active) return;
            if (res.hasToken) {
                void fetchWorkbuddyStatus(url, token).then((status) => {
                    if (active) setWbOnline(Boolean(status.online));
                });
            }
        });
        return () => { active = false; };
    }, [connected, url, token]);

    const handleCheckWbStatus = async () => {
        if (!connected) return;
        setWbChecking(true);
        try {
            const res = await fetchWorkbuddyStatus(url, token);
            setWbOnline(Boolean(res.online));
            if (res.online) message.success("WorkBuddy 桌面端助理在线");
            else message.warning(res.error || "未检测到 WorkBuddy 桌面端运行");
        } catch {
            setWbOnline(false);
            message.error("检测失败，请确保本地 Agent 已连接");
        } finally {
            setWbChecking(false);
        }
    };

    const handleSaveWbToken = async () => {
        if (!connected) {
            message.warning("请先连接本地 Canvas Agent");
            return;
        }
        setWbSaving(true);
        try {
            await saveWorkbuddyConfig(url, token, { accessToken: wbToken.trim() });
            message.success("WorkBuddy 配置已保存");
            void handleCheckWbStatus();
        } catch (err) {
            message.error(err instanceof Error ? err.message : "保存配置失败");
        } finally {
            setWbSaving(false);
        }
    };

    const steps = [{ title: t("agent.connect.pluginTitle"), text: t("agent.connect.pluginText") }, { title: t("agent.connect.directTitle"), text: t("agent.connect.directText"), command: "npx -y @zhuyichuan/canvas-agent" }];
    const statusText = connectError ? t("agent.status.failed") : connected ? activity : enabled ? t("agent.status.connecting") : t("agent.status.disconnected");
    const statusColor = connectError ? "#dc2626" : connected ? "#16a34a" : enabled ? "#d97706" : theme.node.muted;
    const copyCommand = (command: string) => {
        copyToClipboard(command);
        message.success(t("agent.connect.commandCopied"));
    };
    const codexPluginReminder = (
        <div className="rounded-lg border px-3 py-2.5 text-xs leading-5" style={{ borderColor: theme.node.stroke, color: theme.node.muted }}>
            <div className="font-medium" style={{ color: theme.node.text }}>
                {t("agent.connect.pluginReminder")}
            </div>
            <div className="mt-1">{t("agent.connect.pluginReminderText")}</div>
            <div className="mt-2 grid gap-1.5">
                {[
                    [t("agent.connect.removePlugin"), AGENT_PLUGIN_REMOVE_COMMAND],
                    [t("agent.connect.removeMcp"), AGENT_MCP_REMOVE_COMMAND],
                ].map(([label, command]) => (
                    <div key={command} className="flex items-center gap-2 rounded-md border bg-transparent px-2 py-1.5" style={{ borderColor: theme.node.stroke, color: theme.node.text }}>
                        <span className="shrink-0 text-[11px]" style={{ color: theme.node.muted }}>
                            {label}
                        </span>
                        <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap text-[11px] leading-5">{command}</code>
                        <Tooltip title={t("agent.connect.copyCommand")}>
                            <Button size="small" type="text" className="!h-6 !w-6 !min-w-6" icon={<Copy className="size-3.5" />} onClick={() => copyCommand(command)} />
                        </Tooltip>
                    </div>
                ))}
            </div>
        </div>
    );
    return (
        <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto p-4">
            <div className="space-y-4">
                <div>
                    <div className="text-base font-semibold leading-6">{t("agent.connect.title")}</div>
                    <div className="mt-1 text-xs leading-5" style={{ color: theme.node.muted }}>
                        {t("agent.connect.description")}
                    </div>
                </div>
                <div className="space-y-2">
                    {steps.map((step, index) => {
                        const command = "command" in step ? step.command : "";
                        return (
                            <Fragment key={step.title}>
                                <div className="rounded-lg px-3 py-2.5">
                                    <div className="text-sm font-medium leading-5">{step.title}</div>
                                    <div className="mt-1 text-xs leading-5" style={{ color: theme.node.muted }}>
                                        {step.text}
                                    </div>
                                    {command ? (
                                        <div className="mt-2 flex items-center gap-2 rounded-md border bg-transparent px-2 py-1.5" style={{ borderColor: theme.node.stroke, color: theme.node.text }}>
                                            <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap text-[11px] leading-5">{command}</code>
                                            <Tooltip title={t("agent.connect.copyCommand")}>
                                                <Button size="small" type="text" className="!h-6 !w-6 !min-w-6" icon={<Copy className="size-3.5" />} onClick={() => copyCommand(command)} />
                                            </Tooltip>
                                        </div>
                                    ) : null}
                                </div>
                                {index === 0 ? codexPluginReminder : null}
                            </Fragment>
                        );
                    })}
                </div>
                <div className="rounded-lg border p-3" style={{ borderColor: theme.node.stroke }}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 items-center gap-2">
                                <span className="shrink-0 text-sm font-medium leading-5">{t("agent.connect.webConnection")}</span>
                                <span
                                    className="inline-flex min-w-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] leading-4"
                                    style={{ borderColor: connected || enabled || connectError ? statusColor : theme.node.stroke, color: statusColor }}
                                >
                                    <span className="size-1.5 shrink-0 rounded-full" style={{ background: statusColor }} />
                                    <span className="truncate">{statusText}</span>
                                </span>
                            </div>
                            <div className="mt-1 text-xs leading-5" style={{ color: theme.node.muted }}>
                                {t("agent.connect.autoDiscover")}
                            </div>
                        </div>
                        <Button className="!h-8 !px-3" type={enabled ? "default" : "primary"} icon={<PlugZap className="size-4" />} onClick={onToggleEnabled}>
                            {t(enabled ? "agent.connect.disconnect" : "agent.connect.connect")}
                        </Button>
                    </div>
                    <div className="mt-3 grid gap-2.5">
                        <label className="grid gap-1.5">
                            <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: theme.node.muted }}>
                                <Link2 className="size-3.5" />
                                {t("agent.connect.localAddress")}
                                <span className="font-normal opacity-70">Local URL</span>
                            </span>
                            <Input size="large" prefix={<Link2 className="mr-1 size-4" style={{ color: theme.node.faint }} />} value={url} onChange={(event) => onUrlChange(event.target.value)} placeholder={t("agent.connect.urlPlaceholder")} />
                        </label>
                        <label className="grid gap-1.5">
                            <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: theme.node.muted }}>
                                <KeyRound className="size-3.5" />
                                {t("agent.connect.token")}
                                <span className="font-normal opacity-70">Connect token</span>
                            </span>
                            <Input.Password
                                size="large"
                                prefix={<KeyRound className="mr-1 size-4" style={{ color: theme.node.faint }} />}
                                value={token}
                                onChange={(event) => onTokenChange(event.target.value)}
                                placeholder={t("agent.connect.tokenPlaceholder")}
                            />
                        </label>
                        {connectError ? (
                            <div className="rounded-md border px-2.5 py-2 text-xs leading-5" style={{ borderColor: "rgba(220,38,38,.35)", color: "#dc2626" }}>
                                {connectError}
                            </div>
                        ) : null}
                    </div>
                </div>

                <div className="rounded-lg border p-3" style={{ borderColor: theme.node.stroke }}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 items-center gap-2">
                                <span className="shrink-0 text-sm font-medium leading-5">WorkBuddy 桌面助理</span>
                                <span
                                    className="inline-flex min-w-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] leading-4"
                                    style={{
                                        borderColor: wbOnline ? "#16a34a" : wbOnline === false ? "#d97706" : theme.node.stroke,
                                        color: wbOnline ? "#16a34a" : wbOnline === false ? "#d97706" : theme.node.muted,
                                    }}
                                >
                                    <span
                                        className="size-1.5 shrink-0 rounded-full"
                                        style={{ background: wbOnline ? "#16a34a" : wbOnline === false ? "#d97706" : theme.node.muted }}
                                    />
                                    <span className="truncate">{wbChecking ? "检测中..." : wbOnline ? "桌面助理在线" : wbOnline === false ? "未检测到运行" : "待配置"}</span>
                                </span>
                            </div>
                            <div className="mt-1 text-xs leading-5" style={{ color: theme.node.muted }}>
                                配置 WorkBuddy Access Token 即可直连本机正在运行的 WorkBuddy 桌面端助理，享受双向智能协同。
                            </div>
                        </div>
                        <Button className="!h-8 !px-3" icon={<RefreshCw className={`size-3.5 ${wbChecking ? "animate-spin" : ""}`} />} onClick={() => void handleCheckWbStatus()} disabled={!connected}>
                            刷新状态
                        </Button>
                    </div>
                    <div className="mt-3 grid gap-2.5">
                        <label className="grid gap-1.5">
                            <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: theme.node.muted }}>
                                <KeyRound className="size-3.5" />
                                WorkBuddy Access Token
                                <span className="font-normal opacity-70">open.workbuddy.cn</span>
                            </span>
                            <Input.Password
                                size="large"
                                prefix={<KeyRound className="mr-1 size-4" style={{ color: theme.node.faint }} />}
                                value={wbToken}
                                onChange={(event) => setWbToken(event.target.value)}
                                placeholder="填入在 WorkBuddy 开放平台生成的 Access Token"
                            />
                        </label>
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                            <span className="text-[11px]" style={{ color: theme.node.muted }}>
                                权限需求：user.localassistant.readable, user.localassistant.invokable
                            </span>
                            <Button type="primary" className="!h-8 !px-3" loading={wbSaving} onClick={() => void handleSaveWbToken()} disabled={!connected}>
                                保存配置
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
