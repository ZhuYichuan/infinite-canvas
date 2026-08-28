import { beforeEach, describe, expect, it, vi } from "vitest";

import { parseSize, resolveReferenceImage } from "@/services/api/comfyui";
import { getImageBlob } from "@/services/image-storage";

vi.mock("@/services/image-storage", () => ({
    getImageBlob: vi.fn(),
}));

const mockedGetImageBlob = vi.mocked(getImageBlob);

describe("parseSize", () => {
    it("parses pixel sizes", () => {
        expect(parseSize("1024x1024")).toEqual({ width: 1024, height: 1024 });
        expect(parseSize("1024x1536")).toEqual({ width: 1024, height: 1536 });
        expect(parseSize(" 1536 x 1024 ")).toEqual({ width: 1536, height: 1024 });
    });

    it("parses aspect ratios with a 1024 base edge", () => {
        expect(parseSize("1:1")).toEqual({ width: 1024, height: 1024 });
        expect(parseSize("3:4")).toEqual({ width: 1024, height: 1366 });
        expect(parseSize("4:3")).toEqual({ width: 1366, height: 1024 });
        expect(parseSize("16:9")).toEqual({ width: 1820, height: 1024 });
    });

    it("falls back to 1024x1024 for empty or auto input", () => {
        expect(parseSize()).toEqual({ width: 1024, height: 1024 });
        expect(parseSize("")).toEqual({ width: 1024, height: 1024 });
        expect(parseSize("   ")).toEqual({ width: 1024, height: 1024 });
        expect(parseSize("auto")).toEqual({ width: 1024, height: 1024 });
        expect(parseSize("AUTO")).toEqual({ width: 1024, height: 1024 });
    });

    it("parses 2k/4k ratio tiers with a long-edge base", () => {
        expect(parseSize("1:1-2k")).toEqual({ width: 2048, height: 2048 });
        expect(parseSize("16:9-2k")).toEqual({ width: 2048, height: 1152 });
        expect(parseSize("9:16-2k")).toEqual({ width: 1152, height: 2048 });
        expect(parseSize("16:9-4k")).toEqual({ width: 3840, height: 2160 });
        expect(parseSize("9:16-4k")).toEqual({ width: 2160, height: 3840 });
    });

    it("rounds explicit pixel sizes to even and rejects oversized input", () => {
        expect(parseSize("1025x1024")).toEqual({ width: 1026, height: 1024 });
        expect(() => parseSize("9000x1024")).toThrow();
    });

    it("throws for invalid input", () => {
        expect(() => parseSize("garbage")).toThrow();
        expect(() => parseSize("0x1024")).toThrow();
        expect(() => parseSize("1:0")).toThrow();
        expect(() => parseSize("1024")).toThrow();
    });
});

describe("resolveReferenceImage", () => {
    beforeEach(() => {
        mockedGetImageBlob.mockReset();
        vi.unstubAllGlobals();
    });

    it("reads a stored image by storage key", async () => {
        const blob = new Blob(["fake-png"], { type: "image/png" });
        mockedGetImageBlob.mockResolvedValue(blob);
        const reference = await resolveReferenceImage("image:abc123");
        expect(mockedGetImageBlob).toHaveBeenCalledWith("image:abc123");
        expect(reference.blob).toBe(blob);
        expect(reference.dataUrl).toBe("data:image/png;base64,ZmFrZS1wbmc=");
    });

    it("throws when the stored image is missing", async () => {
        mockedGetImageBlob.mockResolvedValue(null);
        await expect(resolveReferenceImage("image:missing")).rejects.toThrow("not found");
    });

    it("resolves a data URL without re-encoding", async () => {
        const png = new Blob(["fake-png"], { type: "image/png" });
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, blob: async () => png, status: 200 }));
        const reference = await resolveReferenceImage("data:image/png;base64,ZmFsa2UtcG5n");
        expect(reference.blob).toBe(png);
        expect(reference.dataUrl).toBe("data:image/png;base64,ZmFsa2UtcG5n");
    });

    it("fetches a remote URL and encodes the blob", async () => {
        const png = new Blob(["fake-png"], { type: "image/png" });
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, blob: async () => png, status: 200 }));
        const reference = await resolveReferenceImage("http://10.7.8.12:8189/output/x.png");
        expect(reference.blob).toBe(png);
        expect(reference.dataUrl).toBe("data:image/png;base64,ZmFrZS1wbmc=");
    });

    it("throws on a failed fetch", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, blob: async () => new Blob() }));
        await expect(resolveReferenceImage("http://10.7.8.12:8189/output/x.png")).rejects.toThrow("Failed to load reference image: 500");
    });

    it("throws on an empty blob", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, blob: async () => new Blob() }));
        await expect(resolveReferenceImage("http://10.7.8.12:8189/output/x.png")).rejects.toThrow("Reference image is empty");
    });

    it("throws on empty input", async () => {
        await expect(resolveReferenceImage("  ")).rejects.toThrow("Empty reference image");
    });
});
