import { describe, expect, it } from "vitest";
import {
    extractVideoSizeTiers,
    normalizeVideoSizeValue,
    parseVideoSize,
    videoSecondsLabel,
    videoSizeLabel,
    MINIMAX_VIDEO_SIZE_TIERS,
} from "../video-settings-panel";
import {
    videoMinimaxH3OmniProfile,
    videoMinimaxH3FrameProfile,
} from "@/services/api/models";

describe("Video Settings Panel DSL & Sizing Helpers", () => {
    it("extractVideoSizeTiers dynamically parses discrete dimension pairs into sorted landscape tiers", () => {
        const tiers = extractVideoSizeTiers(videoMinimaxH3OmniProfile.capabilityConfig.size?.values);
        expect(tiers).toHaveLength(12);
        expect(tiers[0]).toEqual({ landscapeW: 864, landscapeH: 480 });
        expect(tiers[tiers.length - 1]).toEqual({ landscapeW: 1920, landscapeH: 1088 });
    });

    it("extractVideoSizeTiers falls back to default tiers when no values provided", () => {
        const tiers = extractVideoSizeTiers(undefined);
        expect(tiers).toEqual(MINIMAX_VIDEO_SIZE_TIERS);
    });

    it("parseVideoSize correctly resolves 16:9 landscape dimensions and matching tier", () => {
        const result = parseVideoSize("1280x736");
        expect(result.aspect).toBe("16:9");
        expect(result.width).toBe(1280);
        expect(result.height).toBe(736);
        expect(result.tier.landscapeW).toBe(1280);
        expect(result.tier.landscapeH).toBe(736);
    });

    it("parseVideoSize correctly resolves 9:16 portrait dimensions symmetrically", () => {
        const result = parseVideoSize("736x1280");
        expect(result.aspect).toBe("9:16");
        expect(result.width).toBe(736);
        expect(result.height).toBe(1280);
        expect(result.tier.landscapeW).toBe(1280);
        expect(result.tier.landscapeH).toBe(736);
    });

    it("normalizeVideoSizeValue validates against model DSL allowed values", () => {
        // Valid 16:9 size from profile
        expect(normalizeVideoSizeValue("1280x736", videoMinimaxH3OmniProfile)).toBe("1280x736");
        // Valid 9:16 size from profile
        expect(normalizeVideoSizeValue("736x1280", videoMinimaxH3FrameProfile)).toBe("736x1280");
        // Valid 2.0 MP tier
        expect(normalizeVideoSizeValue("1920x1088", videoMinimaxH3OmniProfile)).toBe("1920x1088");
        expect(normalizeVideoSizeValue("1088x1920", videoMinimaxH3FrameProfile)).toBe("1088x1920");
        // Disallowed custom size falls back to profile default (middle tier index 6: 1344x768)
        expect(normalizeVideoSizeValue("1920x1080", videoMinimaxH3OmniProfile)).toBe("1344x768");
        // Removed 0.2 and 0.3 tiers fall back to profile default
        expect(normalizeVideoSizeValue("608x352", videoMinimaxH3OmniProfile)).toBe("1344x768");
        expect(normalizeVideoSizeValue("736x416", videoMinimaxH3OmniProfile)).toBe("1344x768");
        // Empty size falls back to profile dynamic middle default
        expect(normalizeVideoSizeValue("", videoMinimaxH3FrameProfile)).toBe("1344x768");

        // Custom profile with odd number of tiers (e.g. 3 tiers -> middle is 864x480)
        const customProfile = {
            ...videoMinimaxH3OmniProfile,
            capabilityConfig: {
                ...videoMinimaxH3OmniProfile.capabilityConfig,
                size: {
                    parameter: "size" as const,
                    values: ["608x352", "352x608", "864x480", "480x864", "1344x768", "768x1344"],
                    default: "864x480",
                    allowCustom: false,
                },
            },
        };
        expect(normalizeVideoSizeValue("invalid", customProfile)).toBe("864x480");
    });

    it("videoSizeLabel produces human-readable label with aspect ratio", () => {
        expect(videoSizeLabel("1280x736", videoMinimaxH3OmniProfile)).toBe("1280×736 (16:9)");
        expect(videoSizeLabel("736x1280", videoMinimaxH3OmniProfile)).toBe("736×1280 (9:16)");
    });

    it("videoSecondsLabel clamps duration between DSL min and max and formats with 's'", () => {
        expect(videoSecondsLabel(5, videoMinimaxH3OmniProfile)).toBe("5s");
        expect(videoSecondsLabel(15, videoMinimaxH3OmniProfile)).toBe("15s");
        // Clamps below 1 to min 1
        expect(videoSecondsLabel(0, videoMinimaxH3OmniProfile)).toBe("1s");
        // Clamps above 15 to max 15
        expect(videoSecondsLabel(20, videoMinimaxH3OmniProfile)).toBe("15s");
        // Invalid falls back to profile default 5s
        expect(videoSecondsLabel("invalid", videoMinimaxH3OmniProfile)).toBe("5s");
    });
});
