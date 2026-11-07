import { describe, expect, it } from "vitest";
import {
    CANVAS_NODE_MAX_BOUND,
    fitNodeSize,
    isAspectRatioClose,
    nodeSizeFromRatio,
    resolveSkeletonDimensions,
} from "@/lib/canvas/canvas-node-size";
import { NODE_DEFAULT_SIZE, NODE_SPECS } from "@/constant/canvas";
import { CanvasNodeType } from "@/types/canvas";

describe("CANVAS_NODE_MAX_BOUND & Baseline Spec", () => {
    it("defines 420 as the unified symmetric baseline bound", () => {
        expect(CANVAS_NODE_MAX_BOUND).toBe(420);
    });

    it("upgrades CanvasNodeType.Image default size to 420x420 square baseline", () => {
        expect(NODE_DEFAULT_SIZE[CanvasNodeType.Image].width).toBe(420);
        expect(NODE_DEFAULT_SIZE[CanvasNodeType.Image].height).toBe(420);
        expect(NODE_SPECS[CanvasNodeType.Image].width).toBe(420);
        expect(NODE_SPECS[CanvasNodeType.Image].height).toBe(420);
    });

    it("preserves Video node symmetric 420 baseline width", () => {
        expect(NODE_DEFAULT_SIZE[CanvasNodeType.Video].width).toBe(420);
        expect(NODE_DEFAULT_SIZE[CanvasNodeType.Video].height).toBe(236);
    });
});

describe("nodeSizeFromRatio", () => {
    it("resolves standard aspect ratios on 420 baseline accurately", () => {
        // 1:1 Square
        expect(nodeSizeFromRatio("1:1")).toEqual({ width: 420, height: 420 });
        expect(nodeSizeFromRatio("1024x1024")).toEqual({ width: 420, height: 420 });

        // 16:9 Landscape
        expect(nodeSizeFromRatio("16:9")).toEqual({ width: 420, height: 236 });
        expect(nodeSizeFromRatio("1280x720")).toEqual({ width: 420, height: 236 });
        expect(nodeSizeFromRatio("1920x1080")).toEqual({ width: 420, height: 236 });

        // 9:16 Portrait (Symmetric to 16:9)
        expect(nodeSizeFromRatio("9:16")).toEqual({ width: 236, height: 420 });
        expect(nodeSizeFromRatio("720x1280")).toEqual({ width: 236, height: 420 });

        // 4:3 and 3:4
        expect(nodeSizeFromRatio("4:3")).toEqual({ width: 420, height: 315 });
        expect(nodeSizeFromRatio("3:4")).toEqual({ width: 315, height: 420 });
    });

    it("supports custom baseline bounds", () => {
        expect(nodeSizeFromRatio("1:1", 600, 600)).toEqual({ width: 600, height: 600 });
        expect(nodeSizeFromRatio("16:9", 600, 600)).toEqual({ width: 600, height: 338 });
        expect(nodeSizeFromRatio("9:16", 600, 600)).toEqual({ width: 338, height: 600 });
    });

    it("safely handles extreme ratios and invalid inputs", () => {
        expect(nodeSizeFromRatio(null)).toBeNull();
        expect(nodeSizeFromRatio(undefined)).toBeNull();
        expect(nodeSizeFromRatio("invalid")).toBeNull();

        // Ratios < 0.25 or > 4.0 fall back to base
        expect(nodeSizeFromRatio("1:10")).toEqual({ width: 420, height: 420 });
        expect(nodeSizeFromRatio("10:1")).toEqual({ width: 420, height: 420 });
    });
});

describe("resolveSkeletonDimensions", () => {
    it("defaults to 420x420 symmetric square when no options are provided", () => {
        expect(resolveSkeletonDimensions()).toEqual({ width: 420, height: 420 });
        expect(resolveSkeletonDimensions({})).toEqual({ width: 420, height: 420 });
    });

    it("pre-fits skeleton to targetSize directly", () => {
        expect(resolveSkeletonDimensions({ targetSize: "16:9" })).toEqual({ width: 420, height: 236 });
        expect(resolveSkeletonDimensions({ targetSize: "9:16" })).toEqual({ width: 236, height: 420 });
        expect(resolveSkeletonDimensions({ targetSize: "1024x1024" })).toEqual({ width: 420, height: 420 });
    });

    it("inherits aspect ratio from reference image when target size is not given", () => {
        // Reference image is 3:2 landscape (e.g. 1200x800)
        expect(resolveSkeletonDimensions({ referenceWidth: 1200, referenceHeight: 800 })).toEqual({
            width: 420,
            height: 280,
        });

        // Reference image is 2:3 portrait (e.g. 800x1200)
        expect(resolveSkeletonDimensions({ referenceWidth: 800, referenceHeight: 1200 })).toEqual({
            width: 280,
            height: 420,
        });
    });

    it("preserves user manually enlarged dimensions as new bounding scale", () => {
        // User manually enlarged node to 600x600, with 16:9 targetSize
        expect(
            resolveSkeletonDimensions({
                userWidth: 600,
                userHeight: 600,
                targetSize: "16:9",
            }),
        ).toEqual({ width: 600, height: 338 });

        // User manually enlarged node to 600x450 without new targetSize
        expect(
            resolveSkeletonDimensions({
                userWidth: 600,
                userHeight: 450,
            }),
        ).toEqual({ width: 600, height: 450 });
    });

    it("strictly respects freeResize flag", () => {
        expect(
            resolveSkeletonDimensions({
                userWidth: 800,
                userHeight: 500,
                freeResize: true,
                targetSize: "1:1",
            }),
        ).toEqual({ width: 800, height: 500 });
    });
});

describe("isAspectRatioClose", () => {
    it("evaluates matching and close aspect ratios within tolerance", () => {
        // Exact match
        expect(isAspectRatioClose(420, 420, 1024, 1024)).toBe(true);

        // Small alignment discrepancy (e.g. 1024x576 vs 16:9 = 1.7777 vs 1.7777)
        expect(isAspectRatioClose(420, 236, 1280, 720)).toBe(true);

        // Within 8% discrepancy
        expect(isAspectRatioClose(420, 315, 1024, 768, 0.08)).toBe(true);
    });

    it("rejects mismatched aspect ratios beyond tolerance", () => {
        // 1:1 vs 16:9
        expect(isAspectRatioClose(420, 420, 1280, 720)).toBe(false);

        // 16:9 vs 9:16
        expect(isAspectRatioClose(420, 236, 720, 1280)).toBe(false);

        // Invalid / zero inputs
        expect(isAspectRatioClose(0, 0, 100, 100)).toBe(false);
    });
});
