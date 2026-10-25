import { describe, expect, it } from "vitest";
import { extractComfyMetadataFromImage } from "../comfyui-image-parser";

describe("comfyui-image-parser", () => {
    it("extracts embedded workflow from PNG tEXt chunks", async () => {
        const workflowData = {
            nodes: [{ id: 1, type: "KSampler" }],
            links: [],
        };
        const jsonStr = JSON.stringify(workflowData);

        // Build a synthetic PNG buffer
        const header = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
        const keyword = new TextEncoder().encode("workflow");
        const jsonBytes = new TextEncoder().encode(jsonStr);

        // chunk payload: keyword + 0x00 + jsonBytes
        const chunkData = new Uint8Array(keyword.length + 1 + jsonBytes.length);
        chunkData.set(keyword, 0);
        chunkData[keyword.length] = 0;
        chunkData.set(jsonBytes, keyword.length + 1);

        const chunkLen = chunkData.length;
        const chunkType = new TextEncoder().encode("tEXt");
        const crc = new Uint8Array([0, 0, 0, 0]);

        const totalChunkSize = 4 + 4 + chunkLen + 4;
        const chunk = new Uint8Array(totalChunkSize);
        const view = new DataView(chunk.buffer);
        view.setUint32(0, chunkLen);
        chunk.set(chunkType, 4);
        chunk.set(chunkData, 8);
        chunk.set(crc, 8 + chunkLen);

        // Combine into full PNG
        const pngBytes = new Uint8Array(header.length + chunk.length);
        pngBytes.set(header, 0);
        pngBytes.set(chunk, header.length);

        const blob = new Blob([pngBytes], { type: "image/png" });
        const result = await extractComfyMetadataFromImage(blob);

        expect(result).not.toBeNull();
        expect(result?.workflow).toEqual(workflowData);
    });

    it("returns null for non-comfy image", async () => {
        const dummyBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
        const blob = new Blob([dummyBytes], { type: "image/png" });
        const result = await extractComfyMetadataFromImage(blob);
        expect(result).toBeNull();
    });
});
