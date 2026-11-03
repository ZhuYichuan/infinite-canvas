import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ComfyuiJobBatchPoller } from "../comfyui";
import { ComfyuiProgressChannel, type ProgressChannelSocket } from "../comfyui-progress-channel";

const BASE_URL = "http://127.0.0.1:8188";
const JOB = "job-progress";
const POLL_INTERVAL_MS = 2000;

class FakeSocket implements ProgressChannelSocket {
    onopen: (() => void) | null = null;
    onmessage: ((event: { data: unknown }) => void) | null = null;
    onclose: (() => void) | null = null;
    closed = false;

    constructor(readonly url: string) {}

    close() {
        this.closed = true;
    }

    emit(type: string, data: unknown) {
        this.onmessage?.({ data: JSON.stringify({ type, data }) });
    }
}

interface ProgressUpdate {
    status: string;
    detail?: Record<string, unknown>;
}

const SUCCESS_HISTORY = {
    [JOB]: {
        status: { status_str: "success", completed: true },
        outputs: { "9": { images: [{ filename: "asset.png", type: "output" }] } },
    },
};

function createQueueResponse(running: boolean) {
    return { ok: true, status: 200, json: async () => ({ queue_running: running ? [[0, JOB]] : [], queue_pending: [] }) };
}

describe("ComfyuiJobBatchPoller × progress channel", () => {
    let fetchMock: ReturnType<typeof vi.fn>;
    let sockets: FakeSocket[];
    let channel: ComfyuiProgressChannel;

    beforeEach(() => {
        vi.useFakeTimers();
        fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
        sockets = [];
    });

    afterEach(() => {
        channel?.dispose();
        vi.unstubAllGlobals();
        vi.useRealTimers();
    });

    function setup(options?: { registerTopology?: boolean }) {
        channel = new ComfyuiProgressChannel({
            baseUrl: BASE_URL,
            clientId: "cid-fixed",
            createSocket: (url) => {
                const socket = new FakeSocket(url);
                sockets.push(socket);
                return socket;
            },
        });
        if (options?.registerTopology !== false) {
            channel.registerTask(JOB, { nodeCount: 5, classTypes: { "3": "KSampler" } });
        }
        const poller = new ComfyuiJobBatchPoller(BASE_URL, channel);
        const updates: ProgressUpdate[] = [];
        const result = poller.poll(JOB, undefined, undefined, Date.now() + 60_000, (status, detail) => updates.push({ status, detail }));
        return { poller, updates, result };
    }

    it("forwards progress percentages once the job is running", async () => {
        fetchMock.mockImplementation(async (url: string) => {
            if (url.includes("/queue")) return createQueueResponse(true);
            return { ok: true, status: 200, json: async () => ({}) };
        });
        const { updates } = setup();

        await vi.advanceTimersByTimeAsync(0);
        expect(updates.some((update) => update.status === "running")).toBe(true);
        expect(sockets).toHaveLength(1);

        sockets[0].emit("progress_state", {
            prompt_id: JOB,
            nodes: {
                "1": { state: "finished", value: 1, max: 1, node_id: "1" },
                "2": { state: "finished", value: 1, max: 1, node_id: "2" },
                "3": { state: "running", value: 30, max: 60, node_id: "3", display_node_id: "3" },
            },
        });

        expect(updates.at(-1)).toMatchObject({ status: "running", detail: { progressPct: 50, progressNodeClassType: "KSampler", progressNodeStep: 30, progressNodeSteps: 60 } });
    });

    it("stops reporting a percentage once the progress connection drops", async () => {
        fetchMock.mockImplementation(async (url: string) => {
            if (url.includes("/queue")) return createQueueResponse(true);
            return { ok: true, status: 200, json: async () => ({}) };
        });
        const { updates } = setup();

        await vi.advanceTimersByTimeAsync(0);
        sockets[0].emit("progress_state", {
            prompt_id: JOB,
            nodes: { "3": { state: "running", value: 30, max: 60, node_id: "3", display_node_id: "3" } },
        });
        expect(updates.at(-1)?.detail).toMatchObject({ progressPct: 10 });

        sockets[0].onclose?.();
        const last = updates.at(-1);
        expect(last?.detail?.progressPct).toBeUndefined();
    });

    it("settles immediately when the server reports execution end", async () => {
        let historyCalls = 0;
        let queueRounds = 0;
        fetchMock.mockImplementation(async (url: string) => {
            if (url.includes("/queue")) {
                queueRounds += 1;
                return createQueueResponse(queueRounds === 1);
            }
            if (url.includes(`/history/${JOB}`)) {
                historyCalls += 1;
                return { ok: true, status: 200, json: async () => SUCCESS_HISTORY };
            }
            return { ok: true, status: 200, json: async () => ({}) };
        });
        const { result } = setup();

        await vi.advanceTimersByTimeAsync(0);
        expect(historyCalls).toBe(0);

        sockets[0].emit("executing", { node: null, prompt_id: JOB });
        await vi.advanceTimersByTimeAsync(1);

        expect(historyCalls).toBe(1);
        await expect(result).resolves.toMatchObject({ outputs: [{ filename: "asset.png" }] });
    });

    it("closes the progress connection once the job settles", async () => {
        let queueRounds = 0;
        fetchMock.mockImplementation(async (url: string) => {
            if (url.includes("/queue")) {
                queueRounds += 1;
                return createQueueResponse(queueRounds === 1);
            }
            return { ok: true, status: 200, json: async () => SUCCESS_HISTORY };
        });
        const { result } = setup();

        await vi.advanceTimersByTimeAsync(0);
        expect(sockets).toHaveLength(1);
        await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
        await result;

        expect(sockets[0].closed).toBe(true);
    });

    it("does not connect at all for jobs without a registered workflow topology", async () => {
        fetchMock.mockImplementation(async (url: string) => {
            if (url.includes("/queue")) return createQueueResponse(true);
            return { ok: true, status: 200, json: async () => ({}) };
        });
        setup({ registerTopology: false });

        await vi.advanceTimersByTimeAsync(0);

        expect(sockets).toHaveLength(0);
    });
});
