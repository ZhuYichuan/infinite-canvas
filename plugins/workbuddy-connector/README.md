# Infinite Canvas - WorkBuddy 连接器

本目录为 WorkBuddy 官方连接器（Connector）工程包，用于将 Infinite Canvas 注册并上架至 WorkBuddy 能力市场。

## 文件结构

```text
plugins/workbuddy-connector/
├── connector-meta.json     # 连接器市场元信息（中英文名称、描述、示例）
├── mcp.json                # MCP 服务连接配置（stdio 运行 @zhuyichuan/canvas-agent）
├── icon.svg                # 64x64 品牌 SVG 市场图标
├── skills/
│   └── canvas/
│       └── SKILL.md        # WorkBuddy AI 使用与调度说明
└── README.md
```

## 本地测试与接入

1. 确保本地安装并构建了最新版本的 `@zhuyichuan/canvas-agent`：
   ```bash
   cd canvas-agent
   npm install
   npm run build
   ```

2. 验证 MCP 命令正常输出协议信息：
   ```bash
   npx -y @zhuyichuan/canvas-agent mcp
   ```

3. 打开 Infinite Canvas 并执行操作测试：
   WorkBuddy 用户只需在对话框中输入例如：“帮我打开 Infinite Canvas 画布，并创建一个关于科技趋势的思维导图”，AI 将自动调用 `canvas_open` 唤醒画布并完成节点排版。

## 上架与发布流程

1. 将当前目录下的文件（包含 `connector-meta.json`、`mcp.json`、`icon.svg`、`skills/`）打包为 zip 文件：
   ```bash
   cd plugins/workbuddy-connector
   zip -r infinite-canvas-connector.zip connector-meta.json mcp.json icon.svg skills/
   ```

2. 登录 [WorkBuddy 开放平台控制台](https://open.workbuddy.cn)。
3. 在「能力管理」或「发布管理」中选择「新建连接器」，上传 `infinite-canvas-connector.zip`。
4. 确认信息无误后提交审核，审核通过后即上架至 WorkBuddy 能力市场。
