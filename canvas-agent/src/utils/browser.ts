import { spawn } from "node:child_process";

import { loadConfig } from "../config.js";
import { logger } from "./logger.js";

/** 在用户默认浏览器中打开指定链接。 */
export function openUrlInBrowser(targetUrl: string) {
    logger.info("Opening URL in system browser", { url: targetUrl });
    try {
        if (process.platform === "darwin") {
            spawn("open", [targetUrl], { detached: true, stdio: "ignore" }).unref();
        } else if (process.platform === "win32") {
            spawn("cmd.exe", ["/c", "start", '""', targetUrl], { detached: true, stdio: "ignore" }).unref();
        } else {
            spawn("xdg-open", [targetUrl], { detached: true, stdio: "ignore" }).unref();
        }
        return true;
    } catch (error) {
        logger.error("Failed to open browser", { error });
        return false;
    }
}

/** 打开 Infinite Canvas 画布并附带 Agent 连接凭据。 */
export function openCanvasInBrowser(options: { mode?: "new" | "recent" | "choose"; url?: string } = {}) {
    const config = loadConfig(true);
    const mode = options.mode || "new";
    const base = options.url || process.env.CANVAS_WEB_URL || "https://canvas.imihoo.com";
    const cleanBase = base.replace(/\/+$/, "");
    const targetUrl = `${cleanBase}/canvas?mode=${encodeURIComponent(mode)}#agentUrl=${encodeURIComponent(config.url)}&agentToken=${encodeURIComponent(config.token)}`;
    const opened = openUrlInBrowser(targetUrl);
    return {
        ok: opened,
        url: targetUrl,
        mode,
        message: opened ? `已在系统浏览器中打开 Infinite Canvas 画布（模式：${mode}）` : "打开浏览器失败，请手动访问链接",
    };
}
