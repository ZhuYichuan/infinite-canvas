import crypto from "node:crypto";

import { getWorkbuddyConfig, loadConfig, saveConfig, type CanvasAgentConfig, type WorkbuddyConfig } from "../config.js";
import { logger } from "../utils/logger.js";
import type { AgentEmit } from "./types.js";

type WorkbuddyMessage = {
    message_id: string;
    role: "user" | "assistant";
    content: string[];
    msg_type: string;
    created_at: string;
    attachments?: unknown[];
    metadata?: Record<string, unknown>;
};

type WorkbuddyStatusResponse = {
    code: number;
    msg: string;
    data?: { online: boolean };
};

type WorkbuddySendMessageResponse = {
    code: number;
    msg: string;
    data?: { message_id: string };
};

type WorkbuddyMessagesResponse = {
    code: number;
    msg: string;
    data?: { messages: WorkbuddyMessage[] };
};

/** 检测当前 WorkBuddy PC 桌面端本地助理是否在线。 */
export async function checkWorkbuddyStatus(config?: CanvasAgentConfig) {
    const currentConfig = config || loadConfig(true);
    const { accessToken, baseUrl } = getWorkbuddyConfig(currentConfig);
    if (!accessToken) return { ok: false, online: false, error: "未配置 WorkBuddy Access Token" };

    try {
        const res = await fetch(`${baseUrl}/openapi/v2/localassistant`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: "application/json",
            },
            signal: AbortSignal.timeout(5000),
        });
        const body = (await res.json()) as WorkbuddyStatusResponse;
        if (body.code !== 0) return { ok: false, online: false, error: body.msg || "查询失败" };
        return { ok: true, online: Boolean(body.data?.online) };
    } catch (error) {
        logger.error("WorkBuddy status check failed", { error });
        return { ok: false, online: false, error: error instanceof Error ? error.message : "连接超时" };
    }
}

/** 保存 WorkBuddy 相关配置至用户配置目录。 */
export function updateWorkbuddyConfig(patch: Partial<WorkbuddyConfig>) {
    const config = loadConfig(true);
    config.workbuddy = { ...(config.workbuddy || {}), ...patch };
    saveConfig(config);
    return getWorkbuddyConfig(config);
}

/** 执行一次 WorkBuddy 本地助理对话任务。 */
export async function runWorkbuddyTurn(prompt: string, emit: AgentEmit, options: { threadId?: string; sourceClientId?: string } = {}) {
    const config = loadConfig(true);
    const { accessToken, baseUrl } = getWorkbuddyConfig(config);
    const threadId = options.threadId || config.workspace?.activeThreadId || "workbuddy-session";
    const turnId = `wb-turn-${crypto.randomUUID().slice(0, 8)}`;

    if (!accessToken) {
        emit("agent_error", { message: "请先在 Agent 设置中配置 WorkBuddy Access Token。" });
        return;
    }

    emit("agent_event", {
        agent: "workbuddy",
        type: "turn.started",
        threadId,
        turnId,
        sourceClientId: options.sourceClientId,
    });

    try {
        // 1. 发送消息到本地助理
        const sendRes = await fetch(`${baseUrl}/openapi/v2/localassistant/message`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            body: JSON.stringify({
                content: prompt,
                msg_type: "text",
            }),
            signal: AbortSignal.timeout(10000),
        });

        const sendBody = (await sendRes.json()) as WorkbuddySendMessageResponse;
        if (sendBody.code !== 0 || !sendBody.data?.message_id) {
            throw new Error(sendBody.msg || "向 WorkBuddy 助理发送消息失败");
        }

        const initialMessageId = sendBody.data.message_id;
        logger.info("WorkBuddy message sent", { messageId: initialMessageId, threadId, turnId });

        // 2. 轮询本地助理的回复消息
        const maxPollCount = 120; // 120 * 1.5s = 最长等待 3 分钟
        let completed = false;

        for (let i = 0; i < maxPollCount; i++) {
            await new Promise((r) => setTimeout(r, 1500));

            const pollRes = await fetch(`${baseUrl}/openapi/v2/localassistant/message?message_id=${encodeURIComponent(initialMessageId)}`, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    Accept: "application/json",
                },
                signal: AbortSignal.timeout(5000),
            });

            const pollBody = (await pollRes.json()) as WorkbuddyMessagesResponse;
            if (pollBody.code === 0 && pollBody.data?.messages?.length) {
                const assistantMessages = pollBody.data.messages.filter((m) => m.role === "assistant");
                if (assistantMessages.length > 0) {
                    for (const msg of assistantMessages) {
                        const replyText = (msg.content || []).join("\n");
                        const itemId = msg.message_id || `wb-msg-${crypto.randomUUID().slice(0, 8)}`;

                        emit("agent_event", {
                            agent: "workbuddy",
                            type: "item.completed",
                            threadId,
                            turnId,
                            item: {
                                id: itemId,
                                type: "agent_message",
                                text: replyText,
                            },
                        });

                        emit("chat_message", {
                            threadId,
                            turnId,
                            message: {
                                id: itemId,
                                role: "assistant",
                                title: "WorkBuddy",
                                text: replyText,
                                threadId,
                                turnId,
                            },
                        });
                    }
                    completed = true;
                    break;
                }
            }
        }

        if (!completed) {
            emit("agent_event", {
                agent: "workbuddy",
                type: "item.completed",
                threadId,
                turnId,
                item: {
                    id: `wb-timeout-${turnId}`,
                    type: "agent_message",
                    text: "WorkBuddy 助理回复等待超时，请在桌面端 WorkBuddy 客户端中确认任务执行状态。",
                },
            });
        }

        emit("agent_event", {
            agent: "workbuddy",
            type: "turn.completed",
            threadId,
            turnId,
        });
        emit("agent_done", { agent: "workbuddy", code: 0 });
    } catch (error) {
        const text = error instanceof Error ? error.message : String(error);
        logger.error("WorkBuddy turn execution failed", { error: text });
        emit("agent_error", { message: text });
        emit("agent_event", {
            agent: "workbuddy",
            type: "turn.completed",
            threadId,
            turnId,
        });
        emit("agent_done", { agent: "workbuddy", code: 1 });
    }
}

/** 回复 WorkBuddy 助理的权限审批或问卷选择。 */
export async function replyWorkbuddyPermission(requestId: string, answers: Record<string, unknown>) {
    const config = loadConfig(true);
    const { accessToken, baseUrl } = getWorkbuddyConfig(config);
    if (!accessToken) throw new Error("未配置 WorkBuddy Access Token");

    const res = await fetch(`${baseUrl}/openapi/v2/localassistant/message`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            Accept: "application/json",
        },
        body: JSON.stringify({
            content: JSON.stringify({
                outcome: "selected",
                requestId,
                answers,
            }),
            msg_type: "permission_response",
        }),
    });

    const body = (await res.json()) as WorkbuddySendMessageResponse;
    if (body.code !== 0) throw new Error(body.msg || "提交审批回复失败");
    return { ok: true, messageId: body.data?.message_id };
}
