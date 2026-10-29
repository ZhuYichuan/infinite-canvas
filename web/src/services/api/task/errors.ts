export type TaskErrorCategory =
    | "network"           // 网络连接中断或服务宕机 (可自动或手动重试)
    | "timeout"           // 任务执行超过系统或用户设定的总超时上限
    | "cancelled"         // 用户主动点击停止或服务端发送中断信号
    | "lost"              // 任务丢失 (服务端队列与历史均查无此 ID)
    | "execution_failed"; // 服务端执行报错 (语法错误、显存溢出、节点崩溃等)

export class TaskExecutionError extends Error {
    readonly category: TaskErrorCategory;
    readonly jobId?: string;
    readonly isRetryable: boolean;
    readonly causeError?: unknown;

    constructor(
        message: string,
        category: TaskErrorCategory,
        options?: { jobId?: string; isRetryable?: boolean; causeError?: unknown },
    ) {
        super(message);
        this.name = "TaskExecutionError";
        this.category = category;
        this.jobId = options?.jobId;
        this.isRetryable = options?.isRetryable ?? (category === "network" || category === "timeout");
        this.causeError = options?.causeError;
    }
}

/**
 * 便捷判断任务错误是否适宜引导用户再次重试
 */
export function isTaskRetryable(error: unknown): boolean {
    if (error instanceof TaskExecutionError) {
        return error.isRetryable;
    }
    return false;
}
