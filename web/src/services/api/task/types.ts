import type { ModelChannel } from "@/stores/use-config-store";

/**
 * 任务生命周期统一阶段 (6 大核心状态)
 */
export type TaskPhase =
    | "pending"     // 排队中 (在远端队列等待算力调度)
    | "running"     // 执行中 (正在计算生成)
    | "success"     // 执行成功 (生成完毕且产物就绪)
    | "error"       // 执行失败 (模型推理报错或非法参数)
    | "cancelled"   // 任务取消 (用户主动中断或远端撤销)
    | "lost";       // 任务丢失 (远端无此任务痕迹，但本地存在等待上下文)

/**
 * 多模态统一产物契约
 */
export type TaskArtifact =
    | { type: "image"; url: string; assetId?: string; width?: number; height?: number }
    | { type: "video"; url: string; assetId?: string; duration?: number }
    | { type: "audio"; url: string; assetId?: string; duration?: number }
    | { type: "text"; text: string };

/**
 * 网络断线重试动态信息
 */
export interface TaskNetworkRetryInfo {
    count: number;
    maxRetries: number;
    baseUrl: string;
    message?: string;
}

/**
 * 任务即时快照值对象
 */
export interface TaskSnapshot {
    jobId: string;
    phase: TaskPhase;
    queuePosition?: number;              // 排队位次（从 1 开始）
    progressPct?: number;                // 0 ~ 100 执行进度
    error?: string;                      // 失败诊断文本
    artifacts?: TaskArtifact[];          // 成功时的产物列表
    networkRetry?: TaskNetworkRetryInfo; // 临时断线重试态
    raw?: unknown;                       // 原始厂商 Payload (供调试与日志)
}

/**
 * 任务轮询与进度监听参数
 */
export interface TaskPollOptions {
    signal?: AbortSignal;
    deadlineMs?: number;
    onProgress?: (snapshot: TaskSnapshot) => void;
}

/**
 * 任务单次查询参数
 */
export interface TaskQueryOptions {
    isLocallyActive?: boolean;
    isLocallyCancelled?: boolean;
}

/**
 * 任务生命周期驱动适配器接口 (The Seam)
 */
export interface TaskLifecycleDriver {
    readonly protocol: string; // 如 "comfyui" | "external_http" | "mock"

    /**
     * 单次即时探测任务当前状态（无长时轮询副作用）
     */
    queryStatus(
        jobId: string,
        channel: ModelChannel,
        options?: TaskQueryOptions,
    ): Promise<TaskSnapshot>;

    /**
     * 持续轮询或订阅任务进度，直到进入终端状态 (success / error / cancelled / lost)
     */
    poll(
        jobId: string,
        channel: ModelChannel,
        options?: TaskPollOptions,
    ): Promise<TaskSnapshot>;

    /**
     * 主动撤销/取消远端正在执行或排队的任务
     */
    cancel?(
        jobId: string,
        channel: ModelChannel,
    ): Promise<void>;
}
