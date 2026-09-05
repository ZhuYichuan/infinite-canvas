// Smoke test: parse + findNodes + checkRequired + applyBindings on the 3 demo workflows.
// No network calls. Just exercises the pure-function surface.

import { findNodes, checkRequired, applyBindings, parseStdin } from "../src/index.ts";
import { readFileSync } from "node:fs";

const DEMO_DIR = "../../comfyui_api";

const tests: Array<{ file: string; needs: { prompt: boolean; width: boolean; height: boolean; refImages: number } }> = [
    { file: "comfyuiT2iWorkflow_api.json", needs: { prompt: true, width: true, height: true, refImages: 0 } },
    { file: "comfyuiI2iWorkflow_api.json", needs: { prompt: true, width: true, height: true, refImages: 2 } },
];

let pass = 0;
let fail = 0;

for (const t of tests) {
    const raw = readFileSync(`${DEMO_DIR}/${t.file}`, "utf-8");
    const { workflow, outputCap } = parseStdin(raw);

    // Bind synthetic values
    const bindings = [];
    const prompt = findNodes(workflow, "prompt").filter((n) => !n.ignored)[0];
    if (prompt && t.needs.prompt) {
        bindings.push({ id: prompt.id, inputSlot: prompt.inputSlot!, value: "a cat" });
    }
    const width = findNodes(workflow, "width").filter((n) => !n.ignored)[0];
    if (width && t.needs.width) {
        bindings.push({ id: width.id, inputSlot: width.inputSlot!, value: 1024 });
    }
    const height = findNodes(workflow, "height").filter((n) => !n.ignored)[0];
    if (height && t.needs.height) {
        bindings.push({ id: height.id, inputSlot: height.inputSlot!, value: 768 });
    }
    const refImgs = findNodes(workflow, "ref_image").filter((n) => !n.ignored);
    for (let i = 0; i < refImgs.length; i++) {
        bindings.push({
            id: refImgs[i]!.id,
            inputSlot: refImgs[i]!.inputSlot!,
            value: { __type: "core/ASSET", info: { id: `asset_test_${i}` } },
        });
    }

    const bound = applyBindings(workflow, bindings);

    // Check the bound values are present
    let localFail = false;
    if (prompt && t.needs.prompt) {
        const v = bound[prompt.id].inputs[prompt.inputSlot!];
        if (v !== "a cat") { console.error(`  ✗ prompt value: ${v}`); localFail = true; }
    }
    if (width && t.needs.width) {
        const v = bound[width.id].inputs[width.inputSlot!];
        if (v !== 1024) { console.error(`  ✗ width value: ${v}`); localFail = true; }
    }
    if (height && t.needs.height) {
        const v = bound[height.id].inputs[height.inputSlot!];
        if (v !== 768) { console.error(`  ✗ height value: ${v}`); localFail = true; }
    }

    const checkErr = checkRequired(workflow, t.needs);
    const refCount = refImgs.length;

    if (localFail) {
        fail++;
        console.error(`✗ ${t.file}: binding failed`);
    } else {
        pass++;
        console.log(`✓ ${t.file}: ${Object.keys(workflow).length} nodes, prompt=${!!prompt}, width=${!!width}, height=${!!height}, ref_images=${refCount}, checkRequired=${checkErr ?? "OK"}`);
    }
}

console.log(`\n${pass} passed, ${fail} failed.`);
process.exit(fail > 0 ? 1 : 0);