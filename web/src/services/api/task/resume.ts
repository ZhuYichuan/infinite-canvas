import type { ModelChannel } from "@/stores/use-config-store";
import { TaskExecutionError } from "./errors";
import { getTaskDriver } from "./registry";
import type { TaskPollOptions, TaskSnapshot } from "./types";

/**
 * 统一任务接续恢复调度器
 * 页面加载或网络恢复时调用：
 * 1. 先单次轻量探测远端历史与队列
 * 2. 若已就绪直接返回产物，避免重复建立长轮询
 * 3. 若仍在排队/执行中，平滑接入长轮询并分发进度
 * 4. 若已被清理或查无此任务，抛出结构化 TaskExecutionError 引导重试
 */
export async function resumeTask(
    jobId: string,
    channel: ModelChannel,
    options?: TaskPollOptions,
): Promise<TaskSnapshot> {
    const driver = getTaskDriver(channel.apiFormat);

    // 1. 单次主动探测
    const initialCheck = await driver.queryStatus(jobId, channel, { isLocallyActive: true });

    if (initialCheck.phase === "success") {
        return initialCheck;
    }

    if (initialCheck.phase === "cancelled") {
        throw new TaskExecutionError("任务已被中断取消", "cancelled", { jobId });
    }

    if (initialCheck.phase === "lost") {
        throw new TaskExecutionError("任务在服务端已丢失，请重新发起", "lost", { jobId });
    }

    if (initialCheck.phase === "error") {
        throw new TaskExecutionError(initialCheck.error || "任务执行失败", "execution_failed", { jobId });
    }

    // 2. 依然处于 pending 或 running 状态：无缝接入持续轮询
    return driver.poll(jobId, channel, options);
}
