# @zhuyichuan/canvas-agent

Infinite Canvas 本地伴生服务与 MCP 连接器。为 **WorkBuddy** 及其他兼容 MCP（Model Context Protocol）协议的 AI 客户端提供与 Infinite Canvas 网页画布的实时协同与操作能力。

- 官方线上站点：[https://canvas.imihoo.com](https://canvas.imihoo.com)
- 源码仓库：[https://github.com/ZhuYichuan/infinite-canvas](https://github.com/ZhuYichuan/infinite-canvas)

---

## 功能特性

1. **WorkBuddy 官方连接器支持**：作为 WorkBuddy MCP Server，支持在 WorkBuddy 对话中通过自然语言打开画布、读取节点状态、创建排版、编排多模态生成流程。
2. **跨平台自动唤起**：提供 `canvas_open` 工具，可自动在系统默认浏览器中打开指定模式（新建、最近、选择）的画布页面并自动携带连接凭据完成配对。
3. **本地 HTTP / SSE 通信服务**：为网页端提供本地桥接服务（默认端口 `17371`），保障画布与本地 AI 交互的低延迟与高安全性。
4. **多模态流程编排**：支持文本、图片、视频节点的动态生成流程组装与属性注入。

---

## 快速使用

### 1. 以 MCP 模式启动（供 WorkBuddy 或其他 MCP 客户端调用）

```bash
npx -y @zhuyichuan/canvas-agent mcp
```

### 2. 启动本地 HTTP 伴生服务（供网页端手动连接）

```bash
npx -y @zhuyichuan/canvas-agent
```

启动后终端会输出连接参数：
```text
Local URL: http://127.0.0.1:17371
Connect token: <自动生成的随机密钥>
```
在画布网页（[https://canvas.imihoo.com](https://canvas.imihoo.com)）侧边栏填入上述地址与 Token 即可直连。

### 3. Debug 调试模式

需要排查连接、事件或工具调用详情时可追加 `--debug` 参数：

```bash
npx -y @zhuyichuan/canvas-agent --debug
```

日志将实时打印至终端，并自动归档至 `~/.infinite-canvas/logs/`。

---

## 在 WorkBuddy 中配置连接器

在 WorkBuddy 的连接器配置或 `mcp.json` 中配置如下：

```json
{
  "mcpServers": {
    "infinite-canvas": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@zhuyichuan/canvas-agent", "mcp"],
      "runtime": {
        "type": "node",
        "version": "20"
      },
      "npmRegistry": "https://registry.npmmirror.com"
    }
  }
}
```

也可以通过 WorkBuddy 开放平台直接安装或上传 `plugins/workbuddy-connector/infinite-canvas-connector.zip` 扩展包。

---

## 暴露的 MCP 工具列表

| 工具名称 | 描述 |
| :--- | :--- |
| `canvas_open` | 跨平台打开系统浏览器进入 Infinite Canvas 画布（支持 `new` / `recent` / `choose` 模式），并自动完成本地凭据携带与连接 |
| `canvas_get_state` | 读取当前画布完整状态（所有节点列表、连线关系、视口位置） |
| `canvas_get_selection` | 获取用户当前在画布中选中的节点集合 |
| `canvas_create_text_node` | 在画布指定位置创建单个文本卡片节点 |
| `canvas_create_text_nodes` | 批量创建多张结构化文本节点并自动按规范排版间距 |
| `canvas_create_image_prompt_flow` | 自动创建提示词节点与文生图配置节点的串联流程 |
| `canvas_create_generation_flow` | 组织多模态（文案/生图/视频）生成连线工作流 |
| `canvas_generate_text` | 触发文本生成任务 |
| `canvas_generate_image` | 触发图片生成任务 |
| `canvas_generate_video` | 触发视频生成任务 |
| `canvas_apply_ops` | 批量原子操作（增、删、改节点、调整属性及连线拓扑） |
| `canvas_move_nodes` | 调整节点坐标位置 |
| `canvas_export_snapshot` | 导出当前画布状态快照 |

---

## 本地开发

```bash
# 1. 克隆主仓库
git clone https://github.com/ZhuYichuan/infinite-canvas.git
cd infinite-canvas/canvas-agent

# 2. 安装依赖并编译
npm install
npm run build

# 3. 运行本地开发
npm run dev

# 4. 本地测试 MCP 模式
node dist/index.js mcp
```

---

## License

MIT
