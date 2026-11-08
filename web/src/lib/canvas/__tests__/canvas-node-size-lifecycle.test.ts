import { describe, expect, it } from "vitest";
import {
    CANVAS_NODE_MAX_BOUND,
    fitNodeSize,
    isAspectRatioClose,
    nodeSizeFromRatio,
    resolveSkeletonDimensions,
} from "@/lib/canvas/canvas-node-size";
import { NODE_DEFAULT_SIZE, NODE_SPECS } from "@/constant/canvas";
import { CanvasNodeType, type CanvasNodeData } from "@/types/canvas";
import { calculateBranchNodePosition } from "@/lib/canvas/canvas-generation-helpers";

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

describe("Task Submission & Skeleton Pre-fitting Lifecycle", () => {
    it("computes correct skeleton dimensions for derived image node from config with 16:9 targetSize", () => {
        const configNodeSize = "16:9";
        const skeleton = resolveSkeletonDimensions({
            targetSize: configNodeSize,
            baseMaxBound: CANVAS_NODE_MAX_BOUND,
        });
        expect(skeleton).toEqual({ width: 420, height: 236 });
    });

    it("branches a new node to the right with new configuration dimensions when regenerating from an existing node with content", () => {
        const existingNode: CanvasNodeData = {
            id: "node-existing",
            type: CanvasNodeType.Image,
            title: "图片 1",
            width: 420,
            height: 420, // originally 1:1
            position: { x: 100, y: 100 },
            metadata: {
                status: "success",
                content: "https://example.com/original.png",
                size: "1:1",
            },
        };
        // User changed size configuration to 16:9 and clicked generate (repeat/branch)
        const newTargetSize = "16:9";
        const newDimensions = resolveSkeletonDimensions({
            targetSize: newTargetSize,
            baseMaxBound: CANVAS_NODE_MAX_BOUND,
        });
        const newPosition = calculateBranchNodePosition(existingNode, newDimensions, [existingNode]);

        // Existing parent node remains completely unchanged
        expect(existingNode.width).toBe(420);
        expect(existingNode.height).toBe(420);
        expect(existingNode.position).toEqual({ x: 100, y: 100 });

        // New node adopts the 16:9 420px baseline skeleton dimensions
        expect(newDimensions).toEqual({ width: 420, height: 236 });
        // New node is placed to the right with vertical centering
        expect(newPosition).toEqual({
            x: 100 + 420 + 96,
            y: 100 + 420 / 2 - 236 / 2,
        });
    });

    it("computes vertical 9:16 video skeleton correctly", () => {
        const skeleton = resolveSkeletonDimensions({
            targetSize: "9:16",
            baseMaxBound: 420,
        });
        expect(skeleton).toEqual({ width: 236, height: 420 });
    });
});

describe("Settlement Frame Lock & Child Node Sizing", () => {
    it("locks frame dimensions and position when image aspect ratio matches within tolerance (0-pixel jitter)", () => {
        const skeletonNode = {
            width: 420,
            height: 236,
            position: { x: 200, y: 300 },
        };
        const generatedImage = { width: 1280, height: 720 }; // 16:9

        const shouldLockFrame = isAspectRatioClose(
            skeletonNode.width,
            skeletonNode.height,
            generatedImage.width,
            generatedImage.height,
        );
        expect(shouldLockFrame).toBe(true);

        const settledSize = shouldLockFrame
            ? { width: skeletonNode.width, height: skeletonNode.height }
            : fitNodeSize(generatedImage.width, generatedImage.height, 420, 420);
        const settledPosition = shouldLockFrame
            ? skeletonNode.position
            : { x: 0, y: 0 };

        expect(settledSize).toEqual({ width: 420, height: 236 });
        expect(settledPosition).toEqual({ x: 200, y: 300 });
    });

    it("locks frame dimensions when freeResize is enabled regardless of aspect ratio", () => {
        const freeResizeNode = {
            width: 500,
            height: 300,
            metadata: { freeResize: true },
        };
        const generatedImage = { width: 1024, height: 1024 }; // 1:1 square

        const shouldLockFrame = Boolean(
            freeResizeNode.metadata.freeResize ||
            isAspectRatioClose(freeResizeNode.width, freeResizeNode.height, generatedImage.width, generatedImage.height)
        );
        expect(shouldLockFrame).toBe(true);
    });

    it("resolves video skeleton to 16:9 (420x236) default ratio when no targetSize is provided", () => {
        const skeleton = resolveSkeletonDimensions({
            defaultRatio: "16:9",
        });
        expect(skeleton).toEqual({ width: 420, height: 236 });
    });

    it("scales upscale and crop child nodes aligned with parent node edge instead of arbitrary 640", () => {
        const parentNode = { width: 420, height: 420 };
        const upscaledImage = { width: 2048, height: 2048 };

        const parentEdge = Math.max(parentNode.width, parentNode.height, CANVAS_NODE_MAX_BOUND);
        expect(parentEdge).toBe(420);

        const childSize = fitNodeSize(upscaledImage.width, upscaledImage.height, parentEdge, parentEdge);
        expect(childSize).toEqual({ width: 420, height: 420 });
    });
});
