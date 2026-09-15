---
name: canvas
description: 操作 Infinite Canvas 网页画布：打开画布、读取节点状态、创建文本节点、组织多模态生成流程（文案/生图/视频）、连接与移动节点。
---

# Infinite Canvas 连接器

你正在帮助用户操作 Infinite Canvas 网页画布。需要打开、理解或改动画布时，优先使用已配置的 `infinite-canvas` MCP 工具；不要让用户手动复制 JSON、URL 或 token。

## 核心工作流

1. **打开与连接画布**：
   - 如果用户提到“打开画布”、“进入 Infinite Canvas”、“启动画布”，调用 `canvas_open` 工具（默认 `mode: "new"` 新建画布；用户明确要求查看最近画布时使用 `mode: "recent"`）。
   - 该工具会自动唤起系统默认浏览器并附带本地连接凭据，无需用户手动配置。

2. **读取与理解画布状态**：
   - 在进行节点新增或排版前，先用 `canvas_get_state` 读取当前画布中的节点、连线和视口。
   - 如果用户明确提到“选中内容”、“当前节点”或“这个”，先调用 `canvas_get_selection` 获取当前选中的节点。

3. **创建内容节点**：
   - 创建单个文本内容优先使用 `canvas_create_text_node`。
   - 批量创建多个结构化内容块（如大纲、章节、头脑风暴分支）优先使用 `canvas_create_text_nodes`。

4. **构建多模态生成流程**：
   - 需要文生图流程时，使用 `canvas_create_image_prompt_flow`（自动包含提示词节点与配置节点连线）。
   - 需要串联通用生成流程（如文生图、图生视频、文生视频）时，使用 `canvas_create_generation_flow`。
   - 需要一键触发生成并产出结果时，使用 `canvas_generate_text`、`canvas_generate_image` 或 `canvas_generate_video`。

5. **精细调整与排版**：
   - 批量增删改节点、调整视口、选区或连接连线时，使用 `canvas_apply_ops`。
   - 移动节点使用 `canvas_move_nodes`，避免多个节点重叠在同一坐标位置。

## 布局与交互规范

- 节点文案与说明默认使用中文。
- 批量生成或创建多个节点时，横向或纵向保持合理间距（建议节点间距 40~80px），避免堆叠。
- 媒体类节点（图片、视频）默认保持原始比例。
- 流程连线尽量简洁直观，方便用户在画布上直接拖拽或二次编辑。
