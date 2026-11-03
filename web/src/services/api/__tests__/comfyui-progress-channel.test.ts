import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    ComfyuiProgressChannel,
    type ProgressChannelSocket,
    type ProgressSnapshot,
} from "../comfyui-progress-channel";

class FakeSocket implements ProgressChannelSocket {
    onopen: (() => void) | null = null;
    onmessage: ((event: { data: unknown }) => void) | null = null;
    onclose: (() => void) | null = null;
    closed = false;

    constructor(readonly url: string) {}

    close() {
        this.closed = true;
    }

    open() {
        this.onopen?.();
    }

    emit(type: string, data: unknown) {
        this.onmessage?.({ data: JSON.stringify({ type, data }) });
    }

    /** 模拟服务端断开（非本地主动关闭）。 */
    drop() {
        this.onclose?.();
    }
}

function createHarness() {
    const sockets: FakeSocket[] = [];
    const createSocket = (url: string) => {
        const socket = new FakeSocket(url);
        sockets.push(socket);
        return socket;
    };
    return { sockets, createSocket };
}

const BASE_URL = "http://127.0.0.1:8188";
const JOB = "job-1";

/** 5 个节点的工作流，class_type 映射足以覆盖标签与回退分支。 */
const TOPOLOGY = {
    nodeCount: 5,
    classTypes: { "1": "LoadImage", "2": "CLIPTextEncode", "3": "KSampler", "4": "VAEDecode", "5": "SaveImage" },
};

function setup() {
    const { sockets, createSocket } = createHarness();
    const channel = new ComfyuiProgressChannel({ baseUrl: BASE_URL, clientId: "cid-fixed", createSocket });
    channel.registerTask(JOB, TOPOLOGY);
    const updates: ProgressSnapshot[] = [];
    const unsubscribe = channel.subscribe(JOB, (snapshot) => updates.push(snapshot));
    return { channel, sockets, updates, unsubscribe };
}

describe("ComfyuiProgressChannel", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("does not open a socket before the first subscription", () => {
        const { sockets } = createHarness();
        const channel = new ComfyuiProgressChannel({ baseUrl: BASE_URL, clientId: "cid-fixed", createSocket: (url) => {
            const socket = new FakeSocket(url);
            sockets.push(socket);
            return socket;
        } });
        expect(sockets).toHaveLength(0);
        channel.dispose();
    });

    it("connects with the stable client id and reports progress from progress_state", () => {
        const { sockets, updates } = setup();
        expect(sockets).toHaveLength(1);
        expect(sockets[0].url).toBe("ws://127.0.0.1:8188/ws?clientId=cid-fixed");

        sockets[0].emit("progress_state", {
            prompt_id: JOB,
            nodes: {
                "1": { state: "finished", value: 1, max: 1, node_id: "1" },
                "2": { state: "finished", value: 1, max: 1, node_id: "2" },
                "3": { state: "running", value: 30, max: 60, node_id: "3", display_node_id: "3" },
            },
        });

        expect(updates.at(-1)).toEqual({ progressPct: 50, nodeLabel: "KSampler 30/60", nodeClassType: "KSampler", nodeStep: 30, nodeSteps: 60 });
    });

    it("counts execution_cached nodes as finished so progress never falls back", () => {
        const { sockets, updates } = setup();
        sockets[0].emit("execution_cached", { prompt_id: JOB, nodes: ["1", "2"] });

        expect(updates.at(-1)?.progressPct).toBe(40);
    });

    it("never decreases and caps below 100", () => {
        const { sockets, updates } = setup();
        sockets[0].emit("progress_state", {
            prompt_id: JOB,
            nodes: {
                "1": { state: "finished", value: 1, max: 1, node_id: "1" },
                "2": { state: "finished", value: 1, max: 1, node_id: "2" },
                "3": { state: "running", value: 30, max: 60, node_id: "3" },
            },
        });
        expect(updates.at(-1)?.progressPct).toBe(50);

        sockets[0].emit("progress_state", { prompt_id: JOB, nodes: { "1": { state: "finished", value: 1, max: 1, node_id: "1" } } });
        expect(updates.at(-1)?.progressPct).toBe(50);

        sockets[0].emit("progress_state", {
            prompt_id: JOB,
            nodes: {
                "1": { state: "finished", value: 1, max: 1, node_id: "1" },
                "2": { state: "finished", value: 1, max: 1, node_id: "2" },
                "3": { state: "finished", value: 1, max: 1, node_id: "3" },
                "4": { state: "finished", value: 1, max: 1, node_id: "4" },
                "5": { state: "running", value: 1, max: 1, node_id: "5" },
            },
        });
        expect(updates.at(-1)?.progressPct).toBe(99);
    });

    it("treats a node with no step denominator as zero progress instead of NaN", () => {
        const { sockets, updates } = setup();
        sockets[0].emit("progress_state", {
            prompt_id: JOB,
            nodes: { "1": { state: "running", value: 5, max: 0, node_id: "1" } },
        });
        expect(updates.at(-1)?.progressPct).toBe(0);
    });

    it("resolves the node label through display_node_id and drops it when unknown", () => {
        const { sockets, updates } = setup();
        sockets[0].emit("progress_state", {
            prompt_id: JOB,
            nodes: { "3:12": { state: "running", value: 21, max: 50, node_id: "3:12", display_node_id: "3" } },
        });
        expect(updates.at(-1)?.nodeLabel).toBe("KSampler 21/50");

        sockets[0].emit("progress_state", {
            prompt_id: JOB,
            nodes: { "9:99": { state: "running", value: 40, max: 50, node_id: "9:99", display_node_id: "9:99" } },
        });
        expect(updates.at(-1)?.nodeLabel).toBeUndefined();
    });

    it("falls back to executing transitions plus progress events when progress_state is absent", () => {
        const { sockets, updates } = setup();
        sockets[0].emit("executing", { node: "1", prompt_id: JOB });
        sockets[0].emit("executing", { node: "3", prompt_id: JOB });
        expect(updates.at(-1)?.progressPct).toBe(20);

        sockets[0].emit("progress", { prompt_id: JOB, node: "3", value: 30, max: 60 });
        expect(updates.at(-1)).toEqual({ progressPct: 30, nodeLabel: "KSampler 30/60", nodeClassType: "KSampler", nodeStep: 30, nodeSteps: 60 });
    });

    it("ignores messages belonging to another prompt", () => {
        const { sockets, updates } = setup();
        sockets[0].emit("progress_state", {
            prompt_id: "job-other",
            nodes: { "1": { state: "running", value: 1, max: 1, node_id: "1" } },
        });
        expect(updates).toHaveLength(0);
    });

    it("shares one socket between subscriptions on the same host", () => {
        const { channel, sockets } = setup();
        const otherUpdates: ProgressSnapshot[] = [];
        channel.registerTask("job-2", TOPOLOGY);
        const off = channel.subscribe("job-2", (snapshot) => otherUpdates.push(snapshot));
        expect(sockets).toHaveLength(1);
        off();
    });

    it("closes the socket when the last subscriber leaves", () => {
        const { sockets, unsubscribe } = setup();
        unsubscribe();
        expect(sockets[0].closed).toBe(true);
    });

    it("reports unknown progress and retries 1s/2s/4s before giving up", () => {
        const { sockets, updates } = setup();
        sockets[0].drop();
        expect(updates.at(-1)).toEqual({ progressPct: undefined });

        vi.advanceTimersByTime(1000);
        expect(sockets).toHaveLength(2);
        sockets[1].drop();

        vi.advanceTimersByTime(2000);
        expect(sockets).toHaveLength(3);
        sockets[2].drop();

        vi.advanceTimersByTime(4000);
        expect(sockets).toHaveLength(4);
        sockets[3].drop();

        vi.advanceTimersByTime(60000);
        expect(sockets).toHaveLength(4);
    });

    it("signals execution end when the server reports a null node", () => {
        const { channel, sockets } = setup();
        const ends: number[] = [];
        channel.subscribe(JOB, () => {}, { onExecutionEnd: () => ends.push(Date.now()) });

        sockets[0].emit("executing", { node: "3", prompt_id: JOB });
        expect(ends).toHaveLength(0);
        sockets[0].emit("executing", { node: null, prompt_id: JOB });
        expect(ends).toHaveLength(1);
    });

    it("gives a new subscription a fresh reconnect allowance after giving up", () => {
        const { channel, sockets, unsubscribe } = setup();
        for (let i = 0; i < 4; i++) {
            const socket = sockets.at(-1)!;
            socket.drop();
            vi.advanceTimersByTime(60_000);
        }
        expect(sockets).toHaveLength(4);
        unsubscribe();

        const lateUpdates: ProgressSnapshot[] = [];
        channel.registerTask("job-late", TOPOLOGY);
        const lateOff = channel.subscribe("job-late", (snapshot) => lateUpdates.push(snapshot));
        expect(sockets).toHaveLength(5);
        lateOff();
    });

    it("gives up immediately when the socket cannot be created", () => {
        const createSocket = vi.fn(() => {
            throw new Error("SecurityError: mixed content");
        });
        const channel = new ComfyuiProgressChannel({ baseUrl: BASE_URL, clientId: "cid-fixed", createSocket });
        channel.registerTask(JOB, TOPOLOGY);
        const updates: ProgressSnapshot[] = [];
        channel.subscribe(JOB, (snapshot) => updates.push(snapshot));

        expect(updates.at(-1)).toEqual({ progressPct: undefined });
        vi.advanceTimersByTime(60000);
        expect(createSocket).toHaveBeenCalledTimes(1);
    });
});
