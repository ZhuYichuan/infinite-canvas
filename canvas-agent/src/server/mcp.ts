import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { toolDescriptions, toolInputSchemas, toolNames, type ToolName } from "../canvas/schemas.js";
import { AGENT_PROMPT, loadConfig, type CanvasAgentConfig, VERSION } from "../config.js";
import { openCanvasInBrowser } from "../utils/browser.js";

type CanvasAgentToolResponse = { ok?: boolean; result?: unknown; error?: string };

/** 启动通过标准输入输出通信的 MCP 服务。 */
export async function startMcpServer() {
    const config = loadConfig(true);
    const server = new McpServer({ name: "canvas-agent", version: VERSION }, { instructions: AGENT_PROMPT });
    toolNames.forEach((name) => registerCanvasTool(server, config, name));
    await server.connect(new StdioServerTransport());
}

/** 向 MCP Server 注册单个 Canvas Agent 工具。 */
function registerCanvasTool(server: McpServer, config: CanvasAgentConfig, name: ToolName) {
    const schema = toolInputSchemas[name];
    server.registerTool(name, { description: toolDescriptions[name], inputSchema: schema.shape }, async (input: unknown) => {
        const result = await postCanvasAgentTool(config, name, schema.parse(input));
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    });
}

/** 检查本地 Canvas Agent HTTP 服务是否存活。 */
async function isServerAlive(url: string) {
    try {
        const res = await fetch(`${url}/api/session`, { method: "GET", signal: AbortSignal.timeout(1000) });
        return res.ok;
    } catch {
        return false;
    }
}

/** 确保本地 Canvas Agent 服务在后台运行。 */
async function ensureServerStarted(config: CanvasAgentConfig) {
    if (await isServerAlive(config.url)) return true;
    try {
        const entryPath = path.resolve(fileURLToPath(import.meta.url), "../../index.js");
        const child = spawn(process.execPath, [entryPath], {
            detached: true,
            stdio: "ignore",
            env: { ...process.env },
        });
        child.unref();

        for (let i = 0; i < 15; i++) {
            await new Promise((r) => setTimeout(r, 200));
            if (await isServerAlive(config.url)) return true;
        }
    } catch {
        // 忽略拉起失败，交由上层调用反馈
    }
    return false;
}

/** 将 MCP 工具调用转发到本地 Canvas Agent HTTP 服务。 */
async function postCanvasAgentTool(config: CanvasAgentConfig, name: ToolName, input: unknown) {
    const autoStart = process.env.CANVAS_AUTO_START === "true" || name === "canvas_open";
    if (autoStart) {
        await ensureServerStarted(config);
    }

    let res: Response;
    try {
        res = await fetch(`${config.url}/api/tools`, {
            method: "POST",
            headers: { "content-type": "application/json", "x-canvas-agent-token": config.token },
            body: JSON.stringify({ name, input }),
        });
    } catch {
        if (name === "canvas_open") {
            return openCanvasInBrowser((input as { mode?: "new" | "recent" | "choose"; url?: string }) || {});
        }
        throw new Error(`本地 Canvas Agent 服务未启动或无法连接（${config.url}）。请先调用 canvas_open 工具启动并打开画布，或在终端运行 npx -y @zhuyichuan/canvas-agent。`);
    }

    const body = (await res.json()) as CanvasAgentToolResponse;
    if (!body.ok) throw new Error(body.error || "tool call failed");
    return body.result;
}
