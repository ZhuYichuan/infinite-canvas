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
    });

    it("translates missing PrimitiveString/Int into ComfyLiterals installation guidance", () => {
        const rawErr = `Prompt outputs failed validation: class_not_found: PrimitiveStringMultiline`;
        const translated = translateComfyuiValidationError(rawErr);
        expect(translated).toContain("ComfyLiterals");
        expect(translated).toContain("https://github.com/M1kep/ComfyLiterals");
    });

    it("translates missing LayerStyle into ComfyUI_LayerStyle installation guidance", () => {
        const rawErr = `class not found: LayerStyle_Mask`;
        const translated = translateComfyuiValidationError(rawErr);
        expect(translated).toContain("ComfyUI_LayerStyle");
        expect(translated).toContain("https://github.com/chflame163/ComfyUI_LayerStyle");
    });

    it("translates generic Prompt outputs failed validation into core plugin check guidance", () => {
        const rawErr = `Prompt outputs failed validation: SomeUnknownNode`;
        const translated = translateComfyuiValidationError(rawErr);
        expect(translated).toContain("ComfyUI 节点校验失败");
        expect(translated).toContain("ComfyUI-KJNodes");
    });

    it("preserves standard error messages without missing plugin keywords", () => {
        const rawErr = `Network connection timed out while fetching /prompt`;
        const translated = translateComfyuiValidationError(rawErr);
        expect(translated).toBe(rawErr);
    });

    it("maintains the 5 core ComfyUI plugins catalog", () => {
        expect(COMFYUI_CORE_PLUGINS).toHaveLength(5);
        const names = COMFYUI_CORE_PLUGINS.map((p) => p.name);
        expect(names).toContain("ComfyUI-KJNodes");
        expect(names).toContain("ComfyLiterals");
        expect(names).toContain("Comfyui-kktools");
        expect(names).toContain("ComfyUI-UniversalToolkit");
        expect(names).toContain("ComfyUI_LayerStyle");
    });
});
