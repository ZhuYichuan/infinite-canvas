import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import type { InsertAssetPayload } from "@/components/canvas/asset-picker-modal";
import type { SystemPresetDataset } from "@/lib/assets/system-presets";

const dataset: SystemPresetDataset = {
    generatedAt: "2026-11-02",
    source: "test",
    renditions: ["line", "depth"],
    series: [
        { id: "full_single", name: "全身独奏·标准类型", count: 1, nsfw: false, groups: ["坐姿"] },
        { id: "duo", name: "双人纠缠", count: 1, nsfw: true, groups: ["贴身"] },
    ],
    assets: [
        { id: "full_single_P001", series: "full_single", group: "坐姿", name: "仰身后靠坐姿", angles: ["front", "side"], nsfw: false },
        { id: "duo_P001", series: "duo", group: "贴身", name: "双人贴身", angles: ["front"], nsfw: true },
    ],
};

const loadSystemPresets = vi.fn(() => Promise.resolve(dataset));
vi.mock("@/lib/assets/system-presets", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/lib/assets/system-presets")>()),
    loadSystemPresets: () => loadSystemPresets(),
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string, values?: Record<string, unknown>) => (values ? `${key}:${JSON.stringify(values)}` : key) }),
}));

const { SystemPresetGallery } = await import("@/components/assets/system-preset-gallery");

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

async function render(onInsert: (payload: InsertAssetPayload) => void) {
    await act(async () => {
        root.render(<SystemPresetGallery category="pose" onInsert={onInsert} />);
    });
    await act(async () => {
        await Promise.resolve();
    });
}

const nameNodes = () => Array.from(container.querySelectorAll(".line-clamp-1")).map((node) => node.textContent);
const insertButton = (name: string) => {
    const card = Array.from(container.querySelectorAll(".group")).find((element) => element.textContent?.includes(name));
    const button = card?.querySelector("button");
    if (!button) throw new Error(`未找到 ${name} 的插入按钮`);
    return button as HTMLButtonElement;
};

it("默认隐藏敏感分类，打开开关后出现", async () => {
    await render(() => {});
    expect(nameNodes().join()).toContain("仰身后靠坐姿");
    expect(nameNodes().join()).not.toContain("双人贴身");

    const seriesChips = () => Array.from(container.querySelectorAll(".prompt-filter-tag")).map((node) => node.textContent ?? "");
    expect(seriesChips().join()).not.toContain("双人纠缠");

    const sensitiveSwitch = container.querySelector(".ant-switch") as HTMLButtonElement;
    await act(async () => {
        sensitiveSwitch.click();
    });
    expect(seriesChips().join()).toContain("双人纠缠");

    const duoChip = Array.from(container.querySelectorAll(".prompt-filter-tag")).find((node) => node.textContent?.includes("双人纠缠")) as HTMLElement;
    await act(async () => {
        duoChip.click();
    });
    expect(nameNodes().join()).toContain("双人贴身");
});

it("点击插入时取原寸图并透传提示词", async () => {
    const onInsert = vi.fn();
    await render(onInsert);

    await act(async () => {
        insertButton("仰身后靠坐姿").click();
    });

    expect(onInsert).toHaveBeenCalledTimes(1);
    const payload = onInsert.mock.calls[0][0] as InsertAssetPayload;
    expect(payload.kind).toBe("image");
    if (payload.kind !== "image") throw new Error("payload 类型不符");
    expect(payload.dataUrl).toBe("https://ai-pose-gallery.pages.dev/img/full_single_P001_front.png");
    expect(payload.title).toBe("仰身后靠坐姿 (正面)");
});

it("默认机位取正面，缩略图使用 thumbs 路径", async () => {
    await render(() => {});
    const image = container.querySelector("img") as HTMLImageElement;
    expect(image.getAttribute("src")).toBe("https://ai-pose-gallery.pages.dev/thumbs/full_single_P001_front.jpg");
    expect(image.getAttribute("loading")).toBe("lazy");
});
