import { afterEach, expect, it, vi } from "vitest";

import { ComfyuiApiError, submitJob } from "@/services/api/comfyui";

vi.mock("localforage", () => ({ default: { createInstance: () => ({ setItem: vi.fn(async () => undefined) }) } }));

type InputError = { type: string; message: string; details: string; extra_info: { input_name: string; input_config?: unknown; received_value?: unknown } };
const inputMissing = (name: string): InputError => ({
    type: "required_input_missing",
    message: "Required input is missing",
    details: name,
    extra_info: { input_name: name },
});
const faceRefineValidationErrors = {
    "2": {
        class_type: "H3FaceTrackCrop",
        dependent_outputs: ["23"],
        errors: [
            {
                type: "value_not_in_list",
                message: "Value not in list",
                details: "detector: 'segm/person_yolov8m-seg.pt' not in ['face_yolov8m.pt', 'bbox\\face_yolov8m.pt', 'segm\\person_yolov8m-seg.pt']",
                extra_info: { input_name: "detector", input_config: [["face_yolov8m.pt", "bbox\\face_yolov8m.pt", "segm\\person_yolov8m-seg.pt"], {}], received_value: "segm/person_yolov8m-seg.pt" },
            },
            {
                type: "value_not_in_list",
                message: "Value not in list",
                details: "fallback_detector: 'bbox/face_yolov8m.pt' not in ['none', 'face_yolov8m.pt', 'bbox\\face_yolov8m.pt', 'segm\\person_yolov8m-seg.pt']",
                extra_info: { input_name: "fallback_detector", input_config: [["none", "face_yolov8m.pt", "bbox\\face_yolov8m.pt", "segm\\person_yolov8m-seg.pt"], {}], received_value: "bbox/face_yolov8m.pt" },
            },
            inputMissing("images"),
        ],
    },
    "13": { class_type: "MiniMaxH3NativeAudioLock", dependent_outputs: ["23"], errors: [inputMissing("audio")] },
    "22": { class_type: "H3FaceStitch", dependent_outputs: ["23"], errors: [inputMissing("base_images")] },
    "116": { class_type: "GetImageSize", dependent_outputs: ["23"], errors: [inputMissing("image")] },
};

afterEach(() => vi.unstubAllGlobals());

for (const [name, nodeErrors] of Object.entries({
    "the captured face-refine validation response": faceRefineValidationErrors,
    "a single installed node with a missing input": { "2": { class_type: "H3FaceTrackCrop", errors: [inputMissing("images")] } },
})) {
    it(`reports validation details without claiming a plugin is missing for ${name}`, async () => {
        vi.stubGlobal("fetch", vi.fn(async () => Response.json({
            error: { type: "prompt_outputs_failed_validation", message: "Prompt outputs failed validation", details: "" },
            node_errors: nodeErrors,
        }, { status: 400 })));

        const error = await submitJob({ "1": { class_type: "H3FaceTrackCrop", inputs: {} } }, "http://192.168.31.188:8188").catch((caught: unknown) => caught);

        expect(error).toBeInstanceOf(ComfyuiApiError);
        expect(error).toMatchObject({ status: 400 });
        expect((error as Error).message).toContain("POST http://192.168.31.188:8188/prompt");
        expect((error as Error).message).toContain("Required input is missing");
        expect((error as Error).message).toContain("images");
        expect((error as Error).message).toContain("节点 2（H3FaceTrackCrop）");
        expect((error as Error).message).toContain("缺少输入「images」");
        expect((error as Error).message).not.toContain("缺少核心依赖插件");
        expect((error as Error).message).not.toContain("git clone");
        expect(fetch).toHaveBeenCalledTimes(1);
    });
}

const detectorWorkflow = { "2": { class_type: "H3FaceTrackCrop", inputs: { detector: "segm/person_yolov8m-seg.pt", fallback_detector: "bbox/face_yolov8m.pt" } } };
const detectorErrors = { "2": { ...faceRefineValidationErrors["2"], errors: faceRefineValidationErrors["2"].errors.slice(0, 2) } };

it("uses exact server choices for each rejected detector path instead of flipping every path", async () => {
    const mixedChoices = structuredClone(detectorErrors);
    mixedChoices["2"].errors[1].extra_info!.input_config = [["bbox/face_yolov8m.pt"], {}];
    const submitted: typeof detectorWorkflow[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input, init) => {
        if (String(input).endsWith("/system_stats")) return Response.json({ system: { os: "posix" } });
        const workflow = JSON.parse(String(init?.body)).prompt as typeof detectorWorkflow;
        submitted.push(workflow);
        if (workflow["2"].inputs.detector === "segm\\person_yolov8m-seg.pt" && workflow["2"].inputs.fallback_detector === "bbox/face_yolov8m.pt") return Response.json({ prompt_id: "corrected-paths" });
        return Response.json({ node_errors: mixedChoices }, { status: 400 });
    }));
    await expect(submitJob(detectorWorkflow, "http://mixed-candidates:8188")).resolves.toBe("corrected-paths");
    expect(submitted).toHaveLength(2);
    expect(detectorWorkflow["2"].inputs.detector).toBe("segm/person_yolov8m-seg.pt");
});

it("surfaces the second validation response after path correction exposes missing video inputs", async () => {
    let posts = 0;
    vi.stubGlobal("fetch", vi.fn(async (input) => {
        if (String(input).endsWith("/system_stats")) return Response.json({ system: { os: "posix" } });
        posts += 1;
        return Response.json({ node_errors: posts === 1 ? detectorErrors : { "2": { class_type: "H3FaceTrackCrop", errors: [inputMissing("images")] } } }, { status: 400 });
    }));
    const error = await submitJob(detectorWorkflow, "http://second-validation:8188").catch((caught: unknown) => caught);
    expect(posts).toBe(2);
    expect((error as Error).message).toContain("images");
    expect((error as Error).message).not.toContain("value_not_in_list");
});

for (const status of [200, 401, 503]) {
    it(`does not repeat a task submission after an HTTP ${status} response containing detector-path text`, async () => {
        const posts = vi.fn(async () => Response.json({ node_errors: detectorErrors }, { status }));
        vi.stubGlobal("fetch", vi.fn(async (input) => String(input).endsWith("/system_stats")
            ? Response.json({ system: { os: "posix" } })
            : posts()));
        await expect(submitJob(detectorWorkflow, `http://status-${status}:8188`)).rejects.toBeInstanceOf(ComfyuiApiError);
        expect(posts).toHaveBeenCalledTimes(1);
    });
}

it("does not repeat submission after a network failure whose endpoint contains a path keyword", async () => {
    const posts = vi.fn(async () => { throw new TypeError("Failed to fetch"); });
    vi.stubGlobal("fetch", vi.fn(async (input) => String(input).endsWith("/system_stats")
        ? Response.json({ system: { os: "posix" } })
        : posts()));
    await expect(submitJob(detectorWorkflow, "http://bbox-host:8188")).rejects.toThrow("未能联通");
    expect(posts).toHaveBeenCalledTimes(1);
});

it("keeps an explicit outer node_type_not_found code when its message is only Unknown node", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ error: { type: "node_type_not_found", message: "Unknown node", details: "H3FaceTrackCrop" } }, { status: 400 })));
    const error = await submitJob({ "1": { class_type: "H3FaceTrackCrop", inputs: {} } }, "http://unknown-class:8188").catch((caught: unknown) => caught);
    expect((error as Error).message).toContain("缺少核心依赖插件「ComfyUI-MiniMaxH3-Myang」");
    expect((error as Error).message).toContain("node_type_not_found");
    expect((error as Error).message).toContain("Unknown node");
});
