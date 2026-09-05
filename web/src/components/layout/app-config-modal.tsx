import { App, Button, Form, Input, Modal, Progress, Select, Tabs } from "antd";
import type { TFunction } from "i18next";
import { Cloud, Download, Pencil, Plus, RefreshCw, Trash2, Upload, Wifi } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { ModelPicker } from "@/components/model-picker";
import { ChannelEditorDrawer } from "@/components/layout/channel-editor-drawer";
import { ComfyuiWorkflowEditor } from "@/components/layout/comfyui-workflow-editor";
import { ConfigPromptSources } from "@/components/layout/config-prompt-sources";
import { ConfigLocalStorage } from "@/components/layout/config-local-storage";
import type { AppLocale } from "@/i18n";
import { exportAppConfig, importAppConfig } from "@/services/config-file";
import { syncAppDataToWebdav, type AppSyncDomainKey, type AppSyncProgressEvent } from "@/services/app-sync";
import { testWebdavConnection, WEBDAV_MANIFEST_FILE_NAME } from "@/services/webdav-sync";
import {
    DEFAULT_COMFYUI_FRAME_VIDEO_WORKFLOW,
    DEFAULT_COMFYUI_I2I_WORKFLOW,
    DEFAULT_COMFYUI_INPAINT_WORKFLOW,
    DEFAULT_COMFYUI_T2I_WORKFLOW,
    DEFAULT_COMFYUI_TEXT_WORKFLOW,
    DEFAULT_COMFYUI_VIDEO_WORKFLOW,
} from "@/services/api/comfyui-default-workflows";
import { audioFormatOptions, audioVoiceOptions, normalizeAudioSpeedValue } from "@/lib/audio-generation";
import { createModelChannel, encodeChannelModel, isChannelReady, modelOptionsFromChannels, normalizeModelOptionValue, selectableModelsByCapability, useConfigStore, type AiConfig, type ApiCallFormat, type ComfyuiWorkflow, type ConfigTabKey, type ModelCapability, type ModelChannel } from "@/stores/use-config-store";

type ModelGroup = {
    capability: ModelCapability;
    modelKey: "imageModel" | "videoModel" | "textModel" | "audioModel";
    labelKey: string;
};

type WebdavDomainProgress = {
    stage: string;
    current?: number;
    total?: number;
    status?: "active" | "success" | "exception";
};

const modelGroups: ModelGroup[] = [
    { capability: "image", modelKey: "imageModel", labelKey: "config.preferences.defaultImageModel" },
    { capability: "video", modelKey: "videoModel", labelKey: "config.preferences.defaultVideoModel" },
    { capability: "text", modelKey: "textModel", labelKey: "config.preferences.defaultTextModel" },
    { capability: "audio", modelKey: "audioModel", labelKey: "config.preferences.defaultAudioModel" },
];

const webdavDomainKeys: AppSyncDomainKey[] = ["canvas", "assets", "image-workbench", "video-workbench"];
function createWebdavDomainProgress(): Record<AppSyncDomainKey, WebdavDomainProgress> {
    return webdavDomainKeys.reduce(
        (progress, key) => ({
            ...progress,
            [key]: { stage: "等待同步" },
        }),
        {} as Record<AppSyncDomainKey, WebdavDomainProgress>,
    );
}

export function AppConfigPanel({ showDoneButton = false, initialTab = "channels" }: { showDoneButton?: boolean; initialTab?: ConfigTabKey }) {
    const { message } = App.useApp();
    const { i18n, t } = useTranslation();
    const configInputRef = useRef<HTMLInputElement>(null);
    const [activeTab, setActiveTab] = useState<ConfigTabKey>(initialTab);
    const [editingChannelId, setEditingChannelId] = useState("");
    const [testingWebdav, setTestingWebdav] = useState(false);
    const [syncingWebdav, setSyncingWebdav] = useState(false);
    const [webdavSyncStatus, setWebdavSyncStatus] = useState("");
    const [webdavDomainProgress, setWebdavDomainProgress] = useState(createWebdavDomainProgress);
    const config = useConfigStore((state) => state.config);
    const webdav = useConfigStore((state) => state.webdav);
    const setConfig = useConfigStore((state) => state.setConfig);
    const updateConfig = useConfigStore((state) => state.updateConfig);
    const updateWebdavConfig = useConfigStore((state) => state.updateWebdavConfig);
    const shouldPromptContinue = useConfigStore((state) => state.shouldPromptContinue);
    const setConfigDialogOpen = useConfigStore((state) => state.setConfigDialogOpen);
    const clearPromptContinue = useConfigStore((state) => state.clearPromptContinue);
    const webdavReady = Boolean(webdav.url.trim());
    const editingChannel = config.channels.find((channel) => channel.id === editingChannelId) || null;
    const locale = i18n.resolvedLanguage as AppLocale;
    useEffect(() => setActiveTab(initialTab), [initialTab]);

    const saveConfig = (nextConfig: AiConfig) => {
        setConfig(nextConfig);
    };

    const finishConfig = () => {
        const ready = config.channels.some((channel) => isChannelReady(channel));
        setConfigDialogOpen(false);
        if (!ready) return;
        message.success(t(shouldPromptContinue ? "config.savedContinue" : "config.saved"));
        clearPromptContinue();
    };

    const loadConfigFile = async (file: File) => {
        try {
            await importAppConfig(file);
            message.success(t("config.imported"));
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("config.importFailed"));
        } finally {
            if (configInputRef.current) configInputRef.current.value = "";
        }
    };

    const updateChannels = (channels: ModelChannel[], changed?: ModelChannel) => saveConfig(withChannels(config, channels, changed));

    const addChannel = () => {
        const channel = createModelChannel({ name: t("config.channels.numberedName", { count: config.channels.length + 1 }) });
        updateChannels([...config.channels, channel], channel);
        setEditingChannelId(channel.id);
    };

    const deleteChannel = (id: string) => {
        if (config.channels.length <= 1) {
            message.warning(t("config.channels.keepOne"));
            return;
        }
        updateChannels(config.channels.filter((channel) => channel.id !== id));
    };

    const saveChannel = (channel: ModelChannel) => {
        updateChannels(config.channels.map((item) => (item.id === channel.id ? channel : item)), channel);
    };

    const testWebdav = async () => {
        if (!webdavReady) {
            message.error(t("config.webdav.missingUrl"));
            return;
        }
        setTestingWebdav(true);
        try {
            await testWebdavConnection(webdav);
            message.success(t("config.webdav.available"));
        } catch (error) {
            message.error(error instanceof Error ? error.message : t("config.webdav.testFailed"));
        } finally {
            setTestingWebdav(false);
        }
    };

    const updateWebdavProgress = (event: AppSyncProgressEvent) => {
        setWebdavSyncStatus(event.stage);
        if (!event.domain) return;
        setWebdavDomainProgress((current) => ({
            ...current,
            [event.domain as AppSyncDomainKey]: {
                stage: event.stage,
                current: event.current,
                total: event.total,
                status: event.status,
            },
        }));
    };

    const syncWebdav = async () => {
        if (!webdavReady) {
            message.error(t("config.webdav.missingUrl"));
            return;
        }
        setSyncingWebdav(true);
        setWebdavDomainProgress(createWebdavDomainProgress());
        setWebdavSyncStatus(t("config.webdav.preparing"));
        try {
            const result = await syncAppDataToWebdav(webdav, updateWebdavProgress);
            updateWebdavConfig("lastSyncedAt", result.syncedAt);
            message.success(t("config.webdav.completed", { projects: result.projects, assets: result.assets, records: result.imageLogs + result.videoLogs, files: result.uploadedFiles, bytes: formatBytes(result.uploadedBytes) }));
        } catch (error) {
            setWebdavSyncStatus(error instanceof Error ? error.message : t("config.webdav.failed"));
            message.error(error instanceof Error ? error.message : t("config.webdav.failed"));
        } finally {
            setSyncingWebdav(false);
        }
    };

    return (
        <>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-3 dark:border-stone-800">
                <div className="text-xs text-stone-500">{t("config.fileSecurity")}</div>
                <div className="flex gap-2">
                    <Button icon={<Upload className="size-4" />} onClick={() => configInputRef.current?.click()}>
                        {t("config.import")}
                    </Button>
                    <Button icon={<Download className="size-4" />} onClick={exportAppConfig}>
                        {t("config.export")}
                    </Button>
                    <input ref={configInputRef} type="file" accept="application/json,.json" className="hidden" onChange={(event) => event.target.files?.[0] && void loadConfigFile(event.target.files[0])} />
                </div>
            </div>
            <Tabs
                activeKey={activeTab}
                onChange={(key) => setActiveTab(key as ConfigTabKey)}
                items={[
                    {
                        key: "channels",
                        label: t("config.tabs.channels"),
                        children: (
                            <div>
                                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                    <div className="text-xs text-stone-500">{t("config.channels.description")}</div>
                                    <Button type="primary" icon={<Plus className="size-4" />} onClick={addChannel}>
                                        {t("config.channels.add")}
                                    </Button>
                                </div>
                                <div className="space-y-3">
                                    {config.channels.map((channel) => {
                                        const isComfyui = channel.apiFormat === "comfyui";
                                        const t2iModel = channel.models.find((m) => m.name === "ComfyUI T2I") || channel.models[0];
                                        const t2iWorkflow = channel.comfyuiT2iWorkflow || t2iModel?.comfyuiWorkflow;
                                        const i2iModel = channel.models.find((m) => m.name === "ComfyUI I2I" || m.name.toLowerCase().includes("i2i") || m.name.includes("图生图"));
                                        const i2iWorkflow = channel.comfyuiI2iWorkflow || i2iModel?.comfyuiWorkflow;
                                        const inpaintModel = channel.models.find((m) => m.name === "ComfyUI Inpaint" || m.name.toLowerCase().includes("inpaint") || m.name.includes("局部编辑"));
                                        const inpaintWorkflow = channel.comfyuiInpaintWorkflow || inpaintModel?.comfyuiWorkflow;
                                        const textModel = channel.models.find((m) => m.name === "ComfyUI LLM" || m.capability === "text");
                                        const textWorkflow = channel.comfyuiTextWorkflow || textModel?.comfyuiWorkflow;
                                        const videoModel = channel.models.find((m) => m.name === "ComfyUI Video");
                                        const videoWorkflow = channel.comfyuiVideoWorkflow || videoModel?.comfyuiWorkflow;
                                        const frameVideoModel = channel.models.find((m) => m.name === "ComfyUI Frame Video" || m.name.toLowerCase().includes("frame") || m.name.includes("首尾帧"));
                                        const frameVideoWorkflow = channel.comfyuiFrameVideoWorkflow || frameVideoModel?.comfyuiWorkflow;

                                        const handleT2iWorkflowChange = (workflow: ComfyuiWorkflow | undefined) => {
                                            const targetName = t2iModel?.name || "ComfyUI T2I";
                                            const nextChannel: ModelChannel = {
                                                ...channel,
                                                comfyuiT2iWorkflow: workflow,
                                                models: channel.models.some((m) => m.name === targetName)
                                                    ? channel.models.map((m) => (m.name === targetName ? { ...m, comfyuiWorkflow: workflow } : m))
                                                    : [...channel.models, { name: targetName, capability: "image", comfyuiWorkflow: workflow }],
                                            };
                                            saveChannel(nextChannel);
                                        };

                                        const handleI2iWorkflowChange = (workflow: ComfyuiWorkflow | undefined) => {
                                            const targetName = i2iModel?.name || "ComfyUI I2I";
                                            const nextChannel: ModelChannel = {
                                                ...channel,
                                                comfyuiI2iWorkflow: workflow,
                                                models: channel.models.some((m) => m.name === targetName)
                                                    ? channel.models.map((m) => (m.name === targetName ? { ...m, comfyuiWorkflow: workflow } : m))
                                                    : [...channel.models, { name: targetName, capability: "image", comfyuiWorkflow: workflow }],
                                            };
                                            saveChannel(nextChannel);
                                        };

                                        const handleInpaintWorkflowChange = (workflow: ComfyuiWorkflow | undefined) => {
                                            const nextChannel: ModelChannel = {
                                                ...channel,
                                                comfyuiInpaintWorkflow: workflow,
                                                models: channel.models.map((m) =>
                                                    m.name === "ComfyUI Inpaint" || m.name.toLowerCase().includes("inpaint") || m.name.includes("局部编辑")
                                                        ? { ...m, comfyuiWorkflow: workflow }
                                                        : m,
                                                ),
                                            };
                                            saveChannel(nextChannel);
                                        };

                                        const handleTextWorkflowChange = (workflow: ComfyuiWorkflow | undefined) => {
                                            const nextChannel: ModelChannel = {
                                                ...channel,
                                                comfyuiTextWorkflow: workflow,
                                                models: channel.models.map((m) =>
                                                    m.name === "ComfyUI LLM" || m.capability === "text"
                                                        ? { ...m, comfyuiWorkflow: workflow }
                                                        : m,
                                                ),
                                            };
                                            saveChannel(nextChannel);
                                        };

                                        const handleVideoWorkflowChange = (workflow: ComfyuiWorkflow | undefined) => {
                                            const nextChannel: ModelChannel = {
                                                ...channel,
                                                comfyuiVideoWorkflow: workflow,
                                                models: channel.models.map((m) =>
                                                    m.name === "ComfyUI Video" ? { ...m, comfyuiWorkflow: workflow } : m,
                                                ),
                                            };
                                            saveChannel(nextChannel);
                                        };

                                        const handleFrameVideoWorkflowChange = (workflow: ComfyuiWorkflow | undefined) => {
                                            const targetName = frameVideoModel?.name || "ComfyUI Frame Video";
                                            const nextChannel: ModelChannel = {
                                                ...channel,
                                                comfyuiFrameVideoWorkflow: workflow,
                                                models: channel.models.some((m) => m.name === targetName)
                                                    ? channel.models.map((m) => (m.name === targetName ? { ...m, comfyuiWorkflow: workflow } : m))
                                                    : [...channel.models, { name: targetName, capability: "video", comfyuiWorkflow: workflow }],
                                            };
                                            saveChannel(nextChannel);
                                        };

                                        return (
                                            <div key={channel.id} className="rounded-lg border border-stone-200 p-4 dark:border-stone-800">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <div className="truncate text-sm font-semibold">{channel.name || t("config.channels.unnamed")}</div>
                                                        <div className="mt-1 truncate text-xs text-stone-500">
                                                             {apiFormatLabel(channel.apiFormat)} · {t("config.channels.modelCount", { count: channel.models.length })} · {isComfyui ? channel.comfyuiProxyUrl || "http://127.0.0.1:8188" : channel.baseUrl || t("config.channels.missingUrl")}
                                                        </div>
                                                    </div>
                                                    <div className="flex shrink-0 gap-2">
                                                        <Button size="small" icon={<Pencil className="size-3.5" />} onClick={() => setEditingChannelId(channel.id)}>
                                                            {t("common.edit")}
                                                        </Button>
                                                        <Button size="small" danger icon={<Trash2 className="size-3.5" />} onClick={() => deleteChannel(channel.id)} />
                                                    </div>
                                                </div>

                                                {isComfyui && (
                                                    <div className="mt-3.5 space-y-3 border-t border-stone-100 pt-3 dark:border-stone-800/80">
                                                        <div>
                                                            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                                                                <span className="text-xs font-semibold text-stone-700 dark:text-stone-300">{t("config.channelEditor.t2iWorkflowTitle")}</span>
                                                                <span className="text-[11px] text-stone-400">{t("config.channelEditor.t2iWorkflowDesc")}</span>
                                                            </div>
                                                            <div className="rounded-md border border-stone-100 bg-stone-50/50 p-2 dark:border-stone-800 dark:bg-stone-900/30">
                                                                <ComfyuiWorkflowEditor
                                                                    value={t2iWorkflow}
                                                                    defaultWorkflow={DEFAULT_COMFYUI_T2I_WORKFLOW}
                                                                    onChange={handleT2iWorkflowChange}
                                                                />
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                                                                <span className="text-xs font-semibold text-stone-700 dark:text-stone-300">{t("config.channelEditor.i2iWorkflowTitle")}</span>
                                                                <span className="text-[11px] text-stone-400">{t("config.channelEditor.i2iWorkflowDesc")}</span>
                                                            </div>
                                                            <div className="rounded-md border border-stone-100 bg-stone-50/50 p-2 dark:border-stone-800 dark:bg-stone-900/30">
                                                                <ComfyuiWorkflowEditor
                                                                    value={i2iWorkflow}
                                                                    defaultWorkflow={DEFAULT_COMFYUI_I2I_WORKFLOW}
                                                                    onChange={handleI2iWorkflowChange}
                                                                />
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                                                                <span className="text-xs font-semibold text-stone-700 dark:text-stone-300">{t("config.channelEditor.inpaintWorkflowTitle")}</span>
                                                                <span className="text-[11px] text-stone-400">{t("config.channelEditor.inpaintWorkflowDesc")}</span>
                                                            </div>
                                                            <div className="rounded-md border border-stone-100 bg-stone-50/50 p-2 dark:border-stone-800 dark:bg-stone-900/30">
                                                                <ComfyuiWorkflowEditor
                                                                    value={inpaintWorkflow}
                                                                    defaultWorkflow={DEFAULT_COMFYUI_INPAINT_WORKFLOW}
                                                                    onChange={handleInpaintWorkflowChange}
                                                                />
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                                                                <span className="text-xs font-semibold text-stone-700 dark:text-stone-300">{t("config.channelEditor.textWorkflowTitle")}</span>
                                                                <span className="text-[11px] text-stone-400">{t("config.channelEditor.textWorkflowDesc")}</span>
                                                            </div>
                                                            <div className="rounded-md border border-stone-100 bg-stone-50/50 p-2 dark:border-stone-800 dark:bg-stone-900/30">
                                                                <ComfyuiWorkflowEditor
                                                                    value={textWorkflow}
                                                                    defaultWorkflow={DEFAULT_COMFYUI_TEXT_WORKFLOW}
                                                                    onChange={handleTextWorkflowChange}
                                                                />
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                                                                <span className="text-xs font-semibold text-stone-700 dark:text-stone-300">{t("config.channelEditor.videoWorkflowTitle")}</span>
                                                                <span className="text-[11px] text-stone-400">{t("config.channelEditor.videoWorkflowDesc")}</span>
                                                            </div>
                                                            <div className="rounded-md border border-stone-100 bg-stone-50/50 p-2 dark:border-stone-800 dark:bg-stone-900/30">
                                                                <ComfyuiWorkflowEditor
                                                                    value={videoWorkflow}
                                                                    defaultWorkflow={DEFAULT_COMFYUI_VIDEO_WORKFLOW}
                                                                    onChange={handleVideoWorkflowChange}
                                                                />
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                                                                <span className="text-xs font-semibold text-stone-700 dark:text-stone-300">{t("config.channelEditor.frameVideoWorkflowTitle")}</span>
                                                                <span className="text-[11px] text-stone-400">{t("config.channelEditor.frameVideoWorkflowDesc")}</span>
                                                            </div>
                                                            <div className="rounded-md border border-stone-100 bg-stone-50/50 p-2 dark:border-stone-800 dark:bg-stone-900/30">
                                                                <ComfyuiWorkflowEditor
                                                                    value={frameVideoWorkflow}
                                                                    defaultWorkflow={DEFAULT_COMFYUI_FRAME_VIDEO_WORKFLOW}
                                                                    onChange={handleFrameVideoWorkflowChange}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ),
                    },
                    {
                        key: "preferences",
                        label: t("config.tabs.preferences"),
                        children: (
                            <Form layout="vertical" requiredMark={false}>
                                <div className="mb-2 text-sm font-semibold">{t("config.preferences.defaultModels")}</div>
                                <div className="mb-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                                    {modelGroups.map((group) => (
                                        <Form.Item key={group.modelKey} label={t(group.labelKey)} className="mb-0">
                                            <ModelPicker config={config} value={config[group.modelKey]} onChange={(model) => updateConfig(group.modelKey, model)} capability={group.capability} fullWidth />
                                        </Form.Item>
                                    ))}
                                </div>
                                <div className="mb-2 text-sm font-semibold">{t("config.preferences.generation")}</div>
                                <div className="grid gap-4 md:grid-cols-4">
                                    <Form.Item label={t("config.preferences.canvasImageCount")} extra={t("config.preferences.canvasImageCountDescription")} className="mb-4">
                                        <Input
                                            type="number"
                                            min={1}
                                            max={15}
                                            value={config.canvasImageCount}
                                            onChange={(event) => updateConfig("canvasImageCount", event.target.value)}
                                            onBlur={(event) => updateConfig("canvasImageCount", normalizeImageCount(event.target.value))}
                                        />
                                    </Form.Item>
                                    <Form.Item label={t("config.preferences.audioVoice")} className="mb-4">
                                        <Select value={config.audioVoice} options={audioVoiceOptions} onChange={(value) => updateConfig("audioVoice", value)} />
                                    </Form.Item>
                                    <Form.Item label={t("config.preferences.audioFormat")} className="mb-4">
                                        <Select value={config.audioFormat} options={audioFormatOptions} onChange={(value) => updateConfig("audioFormat", value)} />
                                    </Form.Item>
                                    <Form.Item label={t("config.preferences.audioSpeed")} className="mb-4">
                                        <Input
                                            type="number"
                                            min={0.25}
                                            max={4}
                                            step={0.05}
                                            value={config.audioSpeed}
                                            onChange={(event) => updateConfig("audioSpeed", event.target.value)}
                                            onBlur={(event) => updateConfig("audioSpeed", normalizeAudioSpeedValue(event.target.value))}
                                        />
                                    </Form.Item>
                                </div>
                                <Form.Item label={t("config.preferences.audioInstructions")} className="mb-4">
                                    <Input.TextArea rows={2} value={config.audioInstructions} placeholder={t("config.preferences.audioInstructionsPlaceholder")} onChange={(event) => updateConfig("audioInstructions", event.target.value)} />
                                </Form.Item>
                                <Form.Item label={t("config.preferences.systemPrompt")} className="mb-0">
                                    <Input.TextArea rows={4} value={config.systemPrompt} placeholder={t("config.preferences.systemPromptPlaceholder")} onChange={(event) => updateConfig("systemPrompt", event.target.value)} />
                                </Form.Item>
                            </Form>
                        ),
                    },
                    {
                        key: "prompt-sources",
                        label: t("config.tabs.promptSources"),
                        children: <ConfigPromptSources />,
                    },
                    {
                        key: "webdav",
                        label: "WebDAV",
                        children: (
                            <Form layout="vertical" requiredMark={false}>
                                <section className="rounded-lg border border-stone-200 p-3 dark:border-stone-800">
                                    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                            <div className="flex items-center gap-2 text-sm font-semibold">
                                                <Cloud className="size-4" />
                                                {t("config.webdav.title")}
                                            </div>
                                            <div className="mt-1 text-xs text-stone-500">{t("config.webdav.description")}</div>
                                        </div>
                                        <div className="text-xs text-stone-500">{webdav.lastSyncedAt ? t("config.webdav.lastSynced", { time: formatWebdavTime(webdav.lastSyncedAt, locale) }) : t("config.webdav.neverSynced")}</div>
                                    </div>
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <Form.Item label={t("config.webdav.url")} className="mb-4">
                                            <Input value={webdav.url} placeholder="https://nas.example.com/webdav" onChange={(event) => updateWebdavConfig("url", event.target.value)} />
                                        </Form.Item>
                                        <Form.Item label={t("config.webdav.directory")} extra={t("config.webdav.directoryDescription", { manifest: WEBDAV_MANIFEST_FILE_NAME })} className="mb-4">
                                            <Input value={webdav.directory} placeholder="infinite-canvas" onChange={(event) => updateWebdavConfig("directory", event.target.value)} />
                                        </Form.Item>
                                        <Form.Item label={t("config.webdav.username")} className="mb-0">
                                            <Input value={webdav.username} autoComplete="username" onChange={(event) => updateWebdavConfig("username", event.target.value)} />
                                        </Form.Item>
                                        <Form.Item label={t("config.webdav.password")} className="mb-0">
                                            <Input.Password value={webdav.password} autoComplete="current-password" onChange={(event) => updateWebdavConfig("password", event.target.value)} />
                                        </Form.Item>
                                    </div>
                                    <div className="mt-4 flex flex-wrap items-center gap-2">
                                        <Button icon={<Wifi className="size-4" />} disabled={!webdavReady || syncingWebdav} loading={testingWebdav} onClick={() => void testWebdav()}>
                                            {t("config.webdav.test")}
                                        </Button>
                                        <Button type="primary" icon={<RefreshCw className="size-4" />} disabled={!webdavReady || testingWebdav} loading={syncingWebdav} onClick={() => void syncWebdav()}>
                                            {t(syncingWebdav ? "config.webdav.syncing" : "config.webdav.syncNow")}
                                        </Button>
                                        {webdavSyncStatus ? <span className="text-xs text-stone-500">{syncStageLabel(webdavSyncStatus, t)}</span> : null}
                                    </div>
                                    {syncingWebdav || webdavSyncStatus ? <WebdavProgressGrid progress={webdavDomainProgress} t={t} /> : null}
                                </section>
                            </Form>
                        ),
                    },
                    {
                        key: "local-storage",
                        label: t("config.tabs.localStorage"),
                        children: <ConfigLocalStorage active={activeTab === "local-storage"} />,
                    },
                ]}
            />
            {showDoneButton ? (
                <div className="mt-4 flex justify-end">
                    <Button type="primary" onClick={finishConfig}>
                        {t("common.done")}
                    </Button>
                </div>
            ) : null}
            <ChannelEditorDrawer open={Boolean(editingChannel)} channel={editingChannel} onSave={saveChannel} onClose={() => setEditingChannelId("")} />
        </>
    );
}

export function AppConfigModal() {
    const { t } = useTranslation();
    const isConfigOpen = useConfigStore((state) => state.isConfigOpen);
    const configTab = useConfigStore((state) => state.configTab);
    const setConfigDialogOpen = useConfigStore((state) => state.setConfigDialogOpen);
    return (
        <Modal
            title={
                <div>
                    <div className="text-lg font-semibold">{t("config.title")}</div>
                    <div className="mt-1 text-xs font-normal text-stone-500">{t("config.modalDescription")}</div>
                </div>
            }
            open={isConfigOpen}
            width={980}
            centered
            onCancel={() => setConfigDialogOpen(false)}
            styles={{ body: { maxHeight: "72vh", overflowY: "auto", paddingRight: 12 } }}
            footer={null}
        >
            <AppConfigPanel showDoneButton initialTab={configTab} />
        </Modal>
    );
}

function withChannels(config: AiConfig, channels: ModelChannel[], changed?: ModelChannel): AiConfig {
    const next: AiConfig = {
        ...config,
        channels,
        models: modelOptionsFromChannels(channels),
        baseUrl: channels[0]?.baseUrl || config.baseUrl,
        apiKey: channels[0]?.apiKey || config.apiKey,
        apiFormat: channels[0]?.apiFormat || config.apiFormat,
    };
    let imageModel = pickDefaultModel(next, "image", config.imageModel);
    // A freshly added/edited ComfyUI channel becomes the default image model when none is set yet.
    if (!config.imageModel && changed?.apiFormat === "comfyui") {
        const preferred = changed.models.find((model) => model.capability === "image");
        if (preferred) imageModel = encodeChannelModel(changed.id, preferred.name);
    }
    return {
        ...next,
        imageModel,
        videoModel: pickDefaultModel(next, "video", config.videoModel),
        textModel: pickDefaultModel(next, "text", config.textModel),
        audioModel: pickDefaultModel(next, "audio", config.audioModel),
    };
}

function pickDefaultModel(config: AiConfig, capability: ModelCapability, current: string) {
    const options = selectableModelsByCapability(config, capability);
    const normalized = normalizeModelOptionValue(current, config.channels);
    return options.includes(normalized) ? normalized : options[0] || "";
}

function normalizeImageCount(value: string) {
    return String(Math.max(1, Math.min(15, Math.floor(Math.abs(Number(value)) || 3))));
}

function apiFormatLabel(_apiFormat: ApiCallFormat) {
    return "ComfyUI";
}

function formatWebdavTime(value: string, locale: AppLocale) {
    return new Date(value).toLocaleString(locale, { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function WebdavProgressGrid({ progress, t }: { progress: Record<AppSyncDomainKey, WebdavDomainProgress>; t: TFunction }) {
    return (
        <div className="mt-3 grid gap-2">
            {webdavDomainKeys.map((key) => {
                const item = progress[key];
                const count = item.total ? `${item.current || 0}/${item.total}` : "";
                return (
                    <div key={key} className="rounded-md border border-stone-200 px-3 py-2 dark:border-stone-800">
                        <div className="mb-1 flex min-w-0 items-center justify-between gap-3 text-xs">
                            <span className="shrink-0 font-medium text-stone-700 dark:text-stone-200">{t(`config.webdav.domains.${domainTranslationKey(key)}`)}</span>
                            <span className="min-w-0 truncate text-right text-stone-500">
                                {syncStageLabel(item.stage, t)}
                                {count ? ` · ${count}` : ""}
                            </span>
                        </div>
                        <Progress percent={getWebdavProgressPercent(item)} size="small" status={getWebdavProgressStatus(item)} showInfo={false} />
                    </div>
                );
            })}
        </div>
    );
}

function domainTranslationKey(domain: AppSyncDomainKey) {
    if (domain === "image-workbench") return "imageWorkbench";
    if (domain === "video-workbench") return "videoWorkbench";
    return domain;
}

function syncStageLabel(stage: string, t: TFunction) {
    if (stage === "等待本地数据加载") return t("config.webdav.stages.localWaiting");
    if (stage === "同步完成") return t("config.webdav.stages.syncComplete");
    if (stage === "等待同步") return t("config.webdav.stages.waiting");
    if (stage === "读取远端清单") return t("config.webdav.stages.remoteManifest");
    if (stage === "读取本地数据") return t("config.webdav.stages.localData");
    if (stage === "下载缺失媒体") return t("config.webdav.stages.downloadMedia");
    if (stage === "写入本地合并结果") return t("config.webdav.stages.writeMerge");
    if (stage === "上传新增媒体") return t("config.webdav.stages.uploadMedia");
    if (stage === "媒体已齐全") return t("config.webdav.stages.mediaReady");
    if (stage === "媒体无需上传") return t("config.webdav.stages.mediaSkipped");
    if (stage === "检查缺失媒体") return t("config.webdav.stages.checkMissingMedia");
    if (stage === "下载媒体") return t("config.webdav.stages.downloadMediaFile");
    if (stage === "检查本地媒体") return t("config.webdav.stages.checkLocalMedia");
    if (stage.startsWith("上传媒体 ")) return t("config.webdav.stages.uploadMediaFile", { size: stage.slice(5) });
    if (stage === "完成") return t("config.webdav.stages.complete");
    if (stage.startsWith("上传清单 ")) return t("config.webdav.stages.uploadManifest", { size: stage.slice(5) });
    return stage;
}

function getWebdavProgressPercent(item: WebdavDomainProgress) {
    if (item.status === "success") return 100;
    if (item.total) return Math.min(100, Math.round(((item.current || 0) / item.total) * 100));
    if (item.status === "exception") return 100;
    if (item.stage === "等待同步") return 0;
    if (item.stage === "读取远端清单") return 12;
    if (item.stage === "读取本地数据") return 24;
    if (item.stage === "下载缺失媒体") return 36;
    if (item.stage === "写入本地合并结果") return 58;
    if (item.stage === "上传新增媒体") return 66;
    if (item.stage === "媒体已齐全" || item.stage === "媒体无需上传") return 74;
    if (item.stage.startsWith("上传清单")) return 90;
    return item.status === "active" ? 30 : 0;
}

function getWebdavProgressStatus(item: WebdavDomainProgress): "normal" | "active" | "success" | "exception" {
    if (item.status === "success" || item.status === "exception") return item.status;
    return item.status === "active" ? "active" : "normal";
}

function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}
