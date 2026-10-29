import { afterEach, describe, expect, it, vi } from "vitest";
import type { ModelChannel } from "@/stores/use-config-store";
import { TaskExecutionError } from "../errors";
import { getTaskDriver, registerTaskDriver, resetTaskDrivers } from "../registry";
import { resumeTask } from "../resume";
import type { TaskLifecycleDriver, TaskSnapshot } from "../types";

const mockChannel: ModelChannel = {
    id: "chan_mock",
    name: "Mock Channel",
    baseUrl: "http://mock-service",
    apiKey: "key",
    apiFormat: "mock_protocol",
    models: [],
};

describe("Task Registry and resumeTask Orchestrator", () => {
    afterEach(() => {
        resetTaskDrivers();
        vi.restoreAllMocks();
    });

    describe("Registry", () => {
        it("returns comfyuiTaskDriver by default when protocol is not found", () => {
            const driver = getTaskDriver("unknown_proto");
            expect(driver.protocol).toBe("comfyui");
        });

        it("registers and retrieves custom driver case-insensitively", () => {
            const customDriver: TaskLifecycleDriver = {
                protocol: "custom_proto",
                queryStatus: vi.fn(),
                poll: vi.fn(),
            };
            registerTaskDriver("Custom_Proto", customDriver);
            expect(getTaskDriver("custom_proto")).toBe(customDriver);
            expect(getTaskDriver("CUSTOM_PROTO")).toBe(customDriver);
        });
    });

    describe("resumeTask", () => {
        it("returns snapshot immediately if initial check is success without polling", async () => {
            const mockDriver: TaskLifecycleDriver = {
                protocol: "mock_protocol",
                queryStatus: vi.fn().mockResolvedValue({
                    jobId: "job_1",
                    phase: "success",
                    artifacts: [{ type: "text", text: "done" }],
                } as TaskSnapshot),
                poll: vi.fn(),
            };
            registerTaskDriver("mock_protocol", mockDriver);

            const result = await resumeTask("job_1", mockChannel);
            expect(result.phase).toBe("success");
            expect(result.artifacts?.[0]).toEqual({ type: "text", text: "done" });
            expect(mockDriver.queryStatus).toHaveBeenCalledWith("job_1", mockChannel, { isLocallyActive: true });
            expect(mockDriver.poll).not.toHaveBeenCalled();
        });

        it("throws TaskExecutionError(cancelled) when initial check is cancelled", async () => {
            const mockDriver: TaskLifecycleDriver = {
                protocol: "mock_protocol",
                queryStatus: vi.fn().mockResolvedValue({
                    jobId: "job_cancel",
                    phase: "cancelled",
                } as TaskSnapshot),
                poll: vi.fn(),
            };
            registerTaskDriver("mock_protocol", mockDriver);

            await expect(resumeTask("job_cancel", mockChannel)).rejects.toMatchObject({
                name: "TaskExecutionError",
                category: "cancelled",
                jobId: "job_cancel",
            });
            expect(mockDriver.poll).not.toHaveBeenCalled();
        });

        it("throws TaskExecutionError(lost) when initial check is lost", async () => {
            const mockDriver: TaskLifecycleDriver = {
                protocol: "mock_protocol",
                queryStatus: vi.fn().mockResolvedValue({
                    jobId: "job_lost",
                    phase: "lost",
                } as TaskSnapshot),
                poll: vi.fn(),
            };
            registerTaskDriver("mock_protocol", mockDriver);

            await expect(resumeTask("job_lost", mockChannel)).rejects.toMatchObject({
                name: "TaskExecutionError",
                category: "lost",
                jobId: "job_lost",
            });
            expect(mockDriver.poll).not.toHaveBeenCalled();
        });

        it("throws TaskExecutionError(execution_failed) when initial check is error", async () => {
            const mockDriver: TaskLifecycleDriver = {
                protocol: "mock_protocol",
                queryStatus: vi.fn().mockResolvedValue({
                    jobId: "job_err",
                    phase: "error",
                    error: "CUDA out of memory",
                } as TaskSnapshot),
                poll: vi.fn(),
            };
            registerTaskDriver("mock_protocol", mockDriver);

            await expect(resumeTask("job_err", mockChannel)).rejects.toMatchObject({
                name: "TaskExecutionError",
                category: "execution_failed",
                message: "CUDA out of memory",
                jobId: "job_err",
            });
            expect(mockDriver.poll).not.toHaveBeenCalled();
        });

        it("seamlessly delegates to poll when initial check is pending or running", async () => {
            const mockPollSnapshot: TaskSnapshot = {
                jobId: "job_running",
                phase: "success",
                artifacts: [{ type: "image", url: "http://image.png" }],
            };

            const mockDriver: TaskLifecycleDriver = {
                protocol: "mock_protocol",
                queryStatus: vi.fn().mockResolvedValue({
                    jobId: "job_running",
                    phase: "running",
                } as TaskSnapshot),
                poll: vi.fn().mockResolvedValue(mockPollSnapshot),
            };
            registerTaskDriver("mock_protocol", mockDriver);

            const onProgress = vi.fn();
            const result = await resumeTask("job_running", mockChannel, { onProgress });

            expect(mockDriver.queryStatus).toHaveBeenCalledWith("job_running", mockChannel, { isLocallyActive: true });
            expect(mockDriver.poll).toHaveBeenCalledWith("job_running", mockChannel, { onProgress });
            expect(result).toBe(mockPollSnapshot);
        });
    });
});
