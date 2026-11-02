import { describe, expect, it } from "vitest";

import costumes from "@/data/system-presets/costumes.json";
import portraits from "@/data/system-presets/portraits.json";
import poses from "@/data/system-presets/poses.json";
import { POSE_ANGLE_KEYS, defaultPoseAngle, filterPresetAssets, mergePresetPrompt, presetImageUrl, presetInsertTitle, type SystemPresetAsset, type SystemPresetDataset } from "@/lib/assets/system-presets";

const datasets: Array<[string, SystemPresetDataset]> = [
    ["poses", poses as unknown as SystemPresetDataset],
    ["costumes", costumes as unknown as SystemPresetDataset],
    ["portraits", portraits as unknown as SystemPresetDataset],
];

describe("presetImageUrl", () => {
    it("姿态按机位与渲染方式拼出 CDN 地址", () => {
        expect(presetImageUrl("pose", "full_single_P001", { tier: "thumb", angle: "front" })).toBe("https://ai-pose-gallery.pages.dev/thumbs/full_single_P001_front.jpg");
        expect(presetImageUrl("pose", "full_single_P001", { tier: "full", angle: "diag", rendition: "depth" })).toBe("https://ai-pose-depth-gallery.pages.dev/img/full_single_P001_diag.png");
    });

    it("服装三档分别来自不同路径，原寸走专用域名", () => {
        expect(presetImageUrl("costume", "SPR-0001")).toBe("https://ai-costume-gallery.pages.dev/thumbs/SPR-0001.webp");
        expect(presetImageUrl("costume", "SPR-0001", { tier: "mid" })).toBe("https://ai-costume-gallery.pages.dev/img/SPR-0001.webp");
        expect(presetImageUrl("costume", "SPR-0001", { tier: "full" })).toBe("https://ai-costume-anime-gallery.pages.dev/png/SPR-0001.png");
    });

    it("发型缩略图与原寸路径不同", () => {
        expect(presetImageUrl("portrait", "f009cba9893")).toBe("https://ai-portrait-gallery.pages.dev/img/thumb/f009cba9893.webp");
        expect(presetImageUrl("portrait", "f009cba9893", { tier: "full" })).toBe("https://ai-portrait-gallery.pages.dev/img/full/f009cba9893.png");
    });
});

describe("filterPresetAssets", () => {
    const asset = (patch: Partial<SystemPresetAsset>): SystemPresetAsset => ({
        id: "a1",
        series: "s1",
        name: "S 型曲线站姿",
        nsfw: false,
        ...patch,
    });

    it("默认隐藏敏感资产，开关打开后一并返回", () => {
        const assets = [asset({ id: "safe" }), asset({ id: "risky", nsfw: true })];
        expect(filterPresetAssets(assets).map((item) => item.id)).toEqual(["safe"]);
        expect(filterPresetAssets(assets, { includeSensitive: true }).map((item) => item.id)).toEqual(["safe", "risky"]);
    });

    it("按系列与分组过滤", () => {
        const assets = [asset({ id: "1", series: "s1", group: "站立" }), asset({ id: "2", series: "s2", group: "坐姿" })];
        expect(filterPresetAssets(assets, { series: "s2" }).map((item) => item.id)).toEqual(["2"]);
        expect(filterPresetAssets(assets, { group: "站立" }).map((item) => item.id)).toEqual(["1"]);
    });

    it("关键字命中名称、编号与提示词", () => {
        const assets = [asset({ id: "SPR-0001", name: "春·SPR-0001", promptText: "ivory frill knit" })];
        expect(filterPresetAssets(assets, { keyword: "knit" })).toHaveLength(1);
        expect(filterPresetAssets(assets, { keyword: "spr-0001" })).toHaveLength(1);
        expect(filterPresetAssets(assets, { keyword: "春·" })).toHaveLength(1);
        expect(filterPresetAssets(assets, { keyword: "absent" })).toHaveLength(0);
    });
});

describe("插入辅助函数", () => {
    it("默认机位优先正面", () => {
        expect(defaultPoseAngle(["side", "front"])).toBe("front");
        expect(defaultPoseAngle(["side", "high"])).toBe("side");
        expect(defaultPoseAngle(undefined)).toBe("front");
    });

    it("标题带机位后缀", () => {
        expect(presetInsertTitle({ id: "x", series: "s", name: "仰身后靠坐姿", nsfw: false }, "正面")).toBe("仰身后靠坐姿 (正面)");
    });

    it("提示词并入已有输入", () => {
        expect(mergePresetPrompt("", "ivory frill")).toBe("ivory frill");
        expect(mergePresetPrompt("a girl", "ivory frill")).toBe("a girl, ivory frill");
        expect(mergePresetPrompt("a girl")).toBe("a girl");
    });
});

describe.each(datasets)("%s 数据完整性", (_name, dataset) => {
    it("包含资产且 id 唯一", () => {
        expect(dataset.assets.length).toBeGreaterThan(0);
        expect(new Set(dataset.assets.map((asset) => asset.id)).size).toBe(dataset.assets.length);
    });

    it("每条资产的系列都能在系列表中找到，且计数一致", () => {
        const seriesIds = new Set(dataset.series.map((series) => series.id));
        for (const asset of dataset.assets) expect(seriesIds.has(asset.series)).toBe(true);
        for (const series of dataset.series) {
            expect(series.count).toBe(dataset.assets.filter((asset) => asset.series === series.id).length);
        }
    });

    it("资产都带有可读名称", () => {
        for (const asset of dataset.assets) expect(asset.name.trim().length).toBeGreaterThan(0);
    });
});

describe("姿态数据", () => {
    const dataset = poses as unknown as SystemPresetDataset;

    it("每个姿态都有合法机位", () => {
        for (const asset of dataset.assets) {
            expect(asset.angles?.length).toBeGreaterThan(0);
            for (const angle of asset.angles ?? []) expect(POSE_ANGLE_KEYS).toContain(angle);
        }
    });

    it("提供线稿与深度两种渲染", () => {
        expect(dataset.renditions).toEqual(["line", "depth"]);
    });

    it("敏感系列被标记，不再依赖硬编码黑名单", () => {
        const risky = dataset.series.filter((series) => series.nsfw).map((series) => series.id);
        expect(risky).toContain("duo");
        for (const asset of dataset.assets) {
            expect(asset.nsfw).toBe(dataset.series.find((series) => series.id === asset.series)?.nsfw);
        }
    });
});

describe("服装与发型数据", () => {
    it("服装资产带英文提示词关键词", () => {
        const dataset = costumes as unknown as SystemPresetDataset;
        const withPrompt = dataset.assets.filter((asset) => asset.promptText?.trim());
        expect(withPrompt.length).toBeGreaterThan(dataset.assets.length * 0.95);
    });

    it("发型资产带原始尺寸，用于节点等比摆放", () => {
        const dataset = portraits as unknown as SystemPresetDataset;
        for (const asset of dataset.assets) {
            expect(asset.width).toBeGreaterThan(0);
            expect(asset.height).toBeGreaterThan(0);
        }
    });
});
