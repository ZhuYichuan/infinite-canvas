import type { ComfyuiWorkflowJson } from "./comfyui";

/**
 * ComfyUI 进度通道
 *
 * 本地 ComfyUI 只在 WebSocket /ws 上推送执行进度（HTTP 侧没有任何进度字段），
 * 且推送是定向到提交 prompt 时携带的 client_id 的。本模块把这条连接与百分比
 * 估算集中到一处，对外只暴露「订阅任务 → 收到进度快照」。
 *
 * 关键约束（详见 docs/adr/0002-comfyui-progress-over-websocket.md）：
 * - 同一 clientId 只能有一条活连接，服务端在 sid 重复时会把旧 socket 静默踢掉
 * - 服务端不提供整体百分比，只有单节点的 value/max，整体进度由这里估算
 * - 通道只是增强层，任何事件缺失都不能影响终态判定
 */

export interface ProgressChannelSocket {
    onopen: (() => void) | null;
    onmessage: ((event: { data: unknown }) => void) | null;
    onclose: (() => void) | null;
    close(): void;
}

export interface ProgressSnapshot {
    /** 0~99 的整体进度估算；undefined 表示未知（未连上、已断开、不可用）。 */
    progressPct?: number;
    /** 当前节点标签，如 `KSampler 21/50`。 */
    nodeLabel?: string;
    /** 当前节点的 class_type，未识别时为 undefined。 */
    nodeClassType?: string;
    /** 当前节点已完成的步数。 */
    nodeStep?: number;
    /** 当前节点的总步数。 */
    nodeSteps?: number;
}

export interface ProgressTaskTopology {
    /** 提交时 workflow 的节点总数，作为整体进度的分母。 */
    nodeCount: number;
    /** 节点 id → class_type，用于给进度加节点标签。 */
    classTypes: Record<string, string>;
}

export interface SubscribeOptions {
    /** 收到 `executing: null`（服务端已把该任务写入 history）时触发。 */
    onExecutionEnd?: () => void;
}

export interface ComfyuiProgressChannelOptions {
    baseUrl: string;
    clientId: string;
    createSocket?: (url: string) => ProgressChannelSocket;
}

const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_BASE_DELAY_MS = 1000;

interface JobProgressState {
    topology: ProgressTaskTopology;
    finished: Set<string>;
    running: Map<string, { value: number; max: number }>;
    displayIds: Map<string, string>;
    lastPct: number;
    hasProgressState: boolean;
    currentExecutingNode?: string;
    listeners: Set<(snapshot: ProgressSnapshot) => void>;
    endListeners: Set<() => void>;
}

/** 从提交的 workflow 提炼进度所需的拓扑信息。 */
export function buildProgressTopology(workflow: ComfyuiWorkflowJson): ProgressTaskTopology {
    const classTypes: Record<string, string> = {};
    let nodeCount = 0;
    for (const [nodeId, node] of Object.entries(workflow)) {
        if (!node || typeof node !== "object") continue;
        nodeCount += 1;
        const classType = (node as { class_type?: unknown }).class_type;
        if (typeof classType === "string") classTypes[nodeId] = classType;
    }
    return { nodeCount, classTypes };
}

function toProgressSocketUrl(baseUrl: string, clientId: string): string {
    const normalized = baseUrl.trim().replace(/\/+$/, "");
    const wsBase = normalized.replace(/^http(s?):\/\//i, (_match, secure: string) => (secure ? "wss://" : "ws://"));
    return `${wsBase}/ws?clientId=${encodeURIComponent(clientId)}`;
}

function defaultCreateSocket(url: string): ProgressChannelSocket {
    return new WebSocket(url) as unknown as ProgressChannelSocket;
}

export class ComfyuiProgressChannel {
    readonly baseUrl: string;
    private readonly clientId: string;
    private readonly createSocket: (url: string) => ProgressChannelSocket;

    private socket: ProgressChannelSocket | null = null;
    private reconnectAttempts = 0;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private disabled = false;
    private disposed = false;
    private jobs = new Map<string, JobProgressState>();

    constructor(options: ComfyuiProgressChannelOptions) {
        this.baseUrl = options.baseUrl.trim().replace(/\/+$/, "");
        this.clientId = options.clientId;
        this.createSocket = options.createSocket || defaultCreateSocket;
    }

    /** 登记任务拓扑（提交拿到 prompt_id 后调用）。 */
    registerTask(jobId: string, topology: ProgressTaskTopology) {
        const state = this.ensureJobState(jobId);
        state.topology = topology;
    }

    /** 是否已登记任务拓扑；未登记时无法估算百分比，不应建连。 */
    hasTask(jobId: string): boolean {
        const state = this.jobs.get(jobId);
        return Boolean(state && state.topology.nodeCount > 0);
    }

    subscribe(jobId: string, onUpdate: (snapshot: ProgressSnapshot) => void, options?: SubscribeOptions): () => void {
        const state = this.ensureJobState(jobId);
        state.listeners.add(onUpdate);
        if (options?.onExecutionEnd) state.endListeners.add(options.onExecutionEnd);

        if (this.disabled) {
            onUpdate({ progressPct: undefined });
        } else {
            // 上一次任务把重连额度耗尽后，新任务应当重新获得完整额度
            if (!this.socket) this.reconnectAttempts = 0;
            this.connect();
        }

        return () => {
            state.listeners.delete(onUpdate);
            if (options?.onExecutionEnd) state.endListeners.delete(options.onExecutionEnd);
            if (this.subscriberCount() === 0) {
                this.teardownSocket();
            }
        };
    }

    /** 任务已结算：释放拓扑与监听，未完成的就地清理。 */
    forgetTask(jobId: string) {
        this.jobs.delete(jobId);
        if (this.subscriberCount() === 0) this.teardownSocket();
    }

    dispose() {
        this.disposed = true;
        this.teardownSocket();
        this.jobs.clear();
    }

    private ensureJobState(jobId: string): JobProgressState {
        let state = this.jobs.get(jobId);
        if (!state) {
            state = {
                topology: { nodeCount: 0, classTypes: {} },
                finished: new Set(),
                running: new Map(),
                displayIds: new Map(),
                lastPct: 0,
                hasProgressState: false,
                listeners: new Set(),
                endListeners: new Set(),
            };
            this.jobs.set(jobId, state);
        }
        return state;
    }

    private subscriberCount(): number {
        let total = 0;
        for (const state of this.jobs.values()) total += state.listeners.size;
        return total;
    }

    private connect() {
        if (this.disposed || this.disabled || this.socket) return;
        let socket: ProgressChannelSocket;
        try {
            socket = this.createSocket(toProgressSocketUrl(this.baseUrl, this.clientId));
        } catch {
            // https 页面连 ws:// 会被浏览器直接拦下：不重试，该渠道本次会话不再尝试进度
            this.disabled = true;
            this.broadcast({ progressPct: undefined });
            return;
        }

        socket.onopen = () => {
            this.reconnectAttempts = 0;
            // 重连不补当前节点步数，只能等下一个事件
            for (const state of this.jobs.values()) {
                state.running.clear();
                state.currentExecutingNode = undefined;
            }
        };
        socket.onmessage = (event) => this.handleRawMessage(event.data);
        socket.onclose = () => this.handleSocketClosed(socket);
        this.socket = socket;
    }

    private handleSocketClosed(socket: ProgressChannelSocket) {
        if (this.socket !== socket) return;
        this.socket = null;
        if (this.disposed || this.disabled || this.subscriberCount() === 0) return;

        this.broadcast({ progressPct: undefined });
        this.reconnectAttempts += 1;
        if (this.reconnectAttempts > MAX_RECONNECT_ATTEMPTS) return;

        const delay = RECONNECT_BASE_DELAY_MS * 2 ** (this.reconnectAttempts - 1);
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
        }, delay);
    }

    private teardownSocket() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        const socket = this.socket;
        this.socket = null;
        this.reconnectAttempts = 0;
        if (socket) {
            socket.onmessage = null;
            socket.onclose = null;
            socket.onopen = null;
            socket.close();
        }
    }

    private handleRawMessage(raw: unknown) {
        if (typeof raw !== "string") return;
        let parsed: { type?: unknown; data?: unknown };
        try {
            parsed = JSON.parse(raw) as { type?: unknown; data?: unknown };
        } catch {
            return;
        }
        if (!parsed || typeof parsed !== "object") return;
        const type = typeof parsed.type === "string" ? parsed.type : "";
        const data = (parsed.data || {}) as Record<string, unknown>;
        const jobId = typeof data.prompt_id === "string" ? data.prompt_id : undefined;
        const state = jobId ? this.jobs.get(jobId) : undefined;
        if (!state) return;

        switch (type) {
            case "progress_state":
                this.applyProgressState(state, data);
                break;
            case "progress":
                this.applyProgressEvent(state, data);
                break;
            case "executing":
                this.applyExecuting(state, data);
                break;
            case "execution_cached":
                this.applyExecutionCached(state, data);
                break;
            case "execution_start":
                state.finished.clear();
                state.running.clear();
                state.displayIds.clear();
                state.hasProgressState = false;
                state.currentExecutingNode = undefined;
                state.lastPct = 0;
                break;
            default:
                return;
        }
    }

    private applyExecutionCached(state: JobProgressState, data: Record<string, unknown>) {
        const nodes = Array.isArray(data.nodes) ? data.nodes : [];
        for (const nodeId of nodes) {
            if (typeof nodeId === "string") state.finished.add(nodeId);
        }
        this.emit(state);
    }

    private applyProgressState(state: JobProgressState, data: Record<string, unknown>) {
        const nodes = data.nodes && typeof data.nodes === "object" ? (data.nodes as Record<string, Record<string, unknown>>) : {};
        state.hasProgressState = true;
        // 服务端每次推送的是全体非 pending 节点的完整快照，因此用本次消息重建 running 集合；
        // finished 保留历史（execution_cached 命中的节点不会再出现在任何快照里）。
        const nextRunning = new Map<string, { value: number; max: number }>();
        for (const [nodeId, node] of Object.entries(nodes)) {
            if (!node || typeof node !== "object") continue;
            const displayId = typeof node.display_node_id === "string" ? node.display_node_id : typeof node.node_id === "string" ? node.node_id : nodeId;
            state.displayIds.set(nodeId, displayId);
            const nodeState = node.state;
            if (nodeState === "finished") {
                state.finished.add(nodeId);
            } else if (nodeState === "running") {
                state.finished.delete(nodeId);
                nextRunning.set(nodeId, {
                    value: typeof node.value === "number" ? node.value : 0,
                    max: typeof node.max === "number" ? node.max : 0,
                });
            }
        }
        state.running = nextRunning;
        this.emit(state);
    }

    private applyProgressEvent(state: JobProgressState, data: Record<string, unknown>) {
        if (state.hasProgressState) return; // progress_state 更权威，避免两套计数混算
        const nodeId = typeof data.node === "string" ? data.node : undefined;
        if (!nodeId) return;
        state.finished.delete(nodeId);
        state.running.set(nodeId, {
            value: typeof data.value === "number" ? data.value : 0,
            max: typeof data.max === "number" ? data.max : 0,
        });
        this.emit(state);
    }

    private applyExecuting(state: JobProgressState, data: Record<string, unknown>) {
        const nodeId = typeof data.node === "string" ? data.node : undefined;
        if (!nodeId) {
            // executing: null 表示全部节点执行完毕，此时服务端已把任务写入 history
            for (const listener of state.endListeners) listener();
            this.emit(state);
            return;
        }
        const previous = state.currentExecutingNode;
        if (previous && previous !== nodeId) {
            state.running.delete(previous);
            state.finished.add(previous);
        }
        state.currentExecutingNode = nodeId;
        if (!state.hasProgressState) this.emit(state);
    }

    private emit(state: JobProgressState) {
        const progressPct = this.computeProgressPct(state);
        const node = this.describeCurrentNode(state);
        const snapshot: ProgressSnapshot = { progressPct };
        if (node?.label) snapshot.nodeLabel = node.label;
        if (node?.classType) snapshot.nodeClassType = node.classType;
        if (node?.step !== undefined) snapshot.nodeStep = node.step;
        if (node?.steps !== undefined) snapshot.nodeSteps = node.steps;
        for (const listener of state.listeners) {
            listener({ ...snapshot });
        }
    }

    private broadcast(snapshot: ProgressSnapshot) {
        for (const state of this.jobs.values()) {
            for (const listener of state.listeners) listener(snapshot);
        }
    }

    private computeProgressPct(state: JobProgressState): number {
        const nodeCount = state.topology.nodeCount;
        if (!nodeCount || nodeCount <= 0) return state.lastPct;

        let completed = state.finished.size;
        for (const [nodeId, progress] of state.running) {
            if (state.finished.has(nodeId)) continue;
            completed += progress.max > 0 ? Math.min(1, Math.max(0, progress.value / progress.max)) : 0;
        }

        const raw = Math.round((completed / nodeCount) * 100);
        state.lastPct = Math.min(99, Math.max(state.lastPct, Math.max(0, raw)));
        return state.lastPct;
    }

    private describeCurrentNode(state: JobProgressState): { label?: string; classType?: string; step?: number; steps?: number } | undefined {
        let best: { nodeId: string; value: number; max: number } | undefined;
        for (const [nodeId, progress] of state.running) {
            if (state.finished.has(nodeId)) continue;
            if (!best || progress.max > best.max) best = { nodeId, value: progress.value, max: progress.max };
        }

        const nodeId = best?.nodeId || state.currentExecutingNode;
        if (!nodeId) return undefined;
        const classType = this.resolveClassType(state, nodeId);
        if (!classType) return undefined;

        if (best && best.max > 1) {
            const step = Math.round(best.value);
            const steps = Math.round(best.max);
            return { label: `${classType} ${step}/${steps}`, classType, step, steps };
        }
        return { label: classType, classType };
    }

    private resolveClassType(state: JobProgressState, nodeId: string): string | undefined {
        const classTypes = state.topology.classTypes;
        const displayId = state.displayIds.get(nodeId);
        if (displayId && classTypes[displayId]) return classTypes[displayId];
        return classTypes[nodeId];
    }
}
