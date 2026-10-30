import { describe, expect, it } from "vitest";
import {
    translateComfyuiValidationError,
    COMFYUI_CORE_PLUGINS,
} from "../comfyui";

describe("translateComfyuiValidationError (Missing Plugin Friendly Translation)", () => {
    it("translates missing GetVideoComponents node into ComfyUI-KJNodes installation guidance", () => {
        const rawErr = `{"12": {"errors": [{"type": "class_not_found", "message": "Class not found: GetVideoComponents"}], "class_type": "GetVideoComponents"}}`;
        const translated = translateComfyuiValidationError(rawErr);
        expect(translated).toContain("ComfyUI-KJNodes");
        expect(translated).toContain("https://github.com/kijai/ComfyUI-KJNodes");
        expect(translated).toContain("全能参考视频及组件处理");
        expect(translated).toContain(rawErr);
    });

    it("translates missing H3FaceTrackCrop into ComfyUI-MiniMaxH3-Myang installation guidance", () => {
        const rawErr = `{"2": {"errors": [{"type": "class_not_found", "message": "Class not found: H3FaceTrackCrop"}], "class_type": "H3FaceTrackCrop"}}`;
        const translated = translateComfyuiValidationError(rawErr);
        expect(translated).toContain("ComfyUI-MiniMaxH3-Myang");
        expect(translated).toContain("https://github.com/civilcoco/ComfyUI-MiniMaxH3-Myang");
        expect(translated).toContain("人脸追踪精修");
        expect(translated).toContain(rawErr);
    });

    it("translates missing VHS_VideoCombine into ComfyUI-VideoHelperSuite installation guidance", () => {
        const rawErr = `{"23": {"errors": [{"type": "class_not_found", "message": "Class not found: VHS_VideoCombine"}], "class_type": "VHS_VideoCombine"}}`;
        const translated = translateComfyuiValidationError(rawErr);
        expect(translated).toContain("ComfyUI-VideoHelperSuite");
        expect(translated).toContain("https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite");
        expect(translated).toContain(rawErr);
    });

    it("translates missing PrimitiveInt into ComfyLiterals installation guidance", () => {
        const rawErr = `Prompt outputs failed validation: class_not_found: PrimitiveInt`;
        const translated = translateComfyuiValidationError(rawErr);
        expect(translated).toContain("ComfyLiterals");
        expect(translated).toContain("https://github.com/M1kep/ComfyLiterals");
        expect(translated).toContain(rawErr);
    });

    it("does not falsely identify unrelated errors containing 'int' or 'point' as ComfyLiterals", () => {
        const rawErr = `Checkpoint not found: person_yolov8m-seg.pt`;
        const translated = translateComfyuiValidationError(rawErr);
        expect(translated).not.toContain("ComfyLiterals");
        expect(translated).toBe(rawErr);
    });

    it("translates missing LayerStyle into ComfyUI_LayerStyle installation guidance", () => {
        const rawErr = `class not found: LayerStyle_Mask`;
        const translated = translateComfyuiValidationError(rawErr);
        expect(translated).toContain("ComfyUI_LayerStyle");
        expect(translated).toContain("https://github.com/chflame163/ComfyUI_LayerStyle");
        expect(translated).toContain(rawErr);
    });

    it("keeps generic validation errors separate from missing-plugin guidance", () => {
        const rawErr = `Prompt outputs failed validation: SomeUnknownNode`;
        const translated = translateComfyuiValidationError(rawErr);
        expect(translated).toContain("ComfyUI 节点校验失败");
        expect(translated).not.toContain("ComfyUI-KJNodes");
        expect(translated).not.toContain("git clone");
        expect(translated).toContain(rawErr);
    });

    it("preserves standard error messages without missing plugin keywords", () => {
        const rawErr = `Network connection timed out while fetching /prompt`;
        const translated = translateComfyuiValidationError(rawErr);
        expect(translated).toBe(rawErr);
    });

    it("maintains the core ComfyUI plugins catalog", () => {
        expect(COMFYUI_CORE_PLUGINS.length).toBeGreaterThanOrEqual(5);
        const names = COMFYUI_CORE_PLUGINS.map((p) => p.name);
        expect(names).toContain("ComfyUI-MiniMaxH3-Myang");
        expect(names).toContain("ComfyUI-VideoHelperSuite");
        expect(names).toContain("ComfyUI-KJNodes");
        expect(names).toContain("ComfyLiterals");
        expect(names).toContain("Comfyui-kktools");
        expect(names).toContain("ComfyUI-UniversalToolkit");
        expect(names).toContain("ComfyUI_LayerStyle");
    });
});
