import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { checkComfyuiConnection, ComfyuiApiError, ComfyuiNetworkError, getComfyuiSystemStats, submitJob } from "../comfyui";

const baseUrl = "http://127.0.0.1:8188";
const workflow = { "1": { class_type: "SaveImage", inputs: {} } };

beforeEach(() => {
    vi.spyOn(window.location, "protocol", "get").mockReturnValue("https:");
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

it("does not open a security modal for a single background status request", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const warning = vi.fn();
    window.addEventListener("comfyui:mixed-content-blocked", warning);
    try {
        expect(await getComfyuiSystemStats(baseUrl)).toBeNull();
        expect(warning.mock.calls.length).toBe(0);
    } finally {
        window.removeEventListener("comfyui:mixed-content-blocked", warning);
    }
});

it("reports the actual submission API without claiming a browser block", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const error = await submitJob(workflow, baseUrl).catch((error) => error);
    expect(error).toBeInstanceOf(ComfyuiNetworkError);
    expect(error.message).toContain(`POST ${baseUrl}/prompt`);
    expect(error.message).toContain("CORS");
    expect(error.message).not.toContain("浏览器安全策略拦截了");
});

it("preserves cancellation instead of turning it into a connection failure", async () => {
    const aborted = new DOMException("Aborted", "AbortError");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(aborted));
    await expect(submitJob(workflow, baseUrl)).rejects.toBe(aborted);
});

it.each([401, 403])("identifies HTTP %s and the failed API on explicit connection tests", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status })));
    const result = await checkComfyuiConnection(baseUrl);
    expect(result.ok).toBe(false);
    expect(result.error).toContain(`GET ${baseUrl}/system_stats`);
    expect(result.error).toContain(`HTTP ${status}`);
    expect(result.error).toContain("凭据");
});

it("keeps HTTP errors actionable when submitting a workflow", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: "Forbidden" } }), { status: 403 })));
    const error = await submitJob(workflow, baseUrl).catch((error) => error);
    expect(error).toBeInstanceOf(ComfyuiApiError);
    expect(error.status).toBe(403);
    expect(error.message).toContain(`POST ${baseUrl}/prompt`);
    expect(error.message).toContain("HTTP 403");
    expect(error.message).toContain("凭据");
});
