# ComfyUI 渠道调试经验

记录 Web 端（`web/src/services/api/comfyui.ts`）对接 **原生 ComfyUI API（默认端口 8188）** 过程中的架构升级、接口契约与调试踩坑总结。

> **特别说明（架构更新）**：
> 项目已全面去除 `comfy-api-proxy`（早期 8189 代理服务），改为由前端浏览器**直连原生 ComfyUI（端口 8188）**。
> 接口链路全部收敛为 ComfyUI 官方原生 HTTP REST 端点，无需中间层代理服务。

---

## 架构与调用链路概览

```
浏览器前端 (Web)
   ↓ HTTP 直连
本机 ComfyUI (默认 http://127.0.0.1:8188)
```

- **认证鉴权**：本地标准 ComfyUI 默认无鉴权，渠道配置中的 Token 为可选参数（仅在配置了反向代理/Bearer Token 时自动附加 `Authorization: Bearer <token>`）。
- **任务模型**：ComfyUI 采用纯异步任务流：
  1. 上传参考资源（图片/音频/视频）至 input 目录
  2. 提交 workflow JSON 获取 `prompt_id`（作为系统的 `jobId`）
  3. 轮询历史记录获取执行状态及各节点的 output 文件名
  4. 从 `/view` 端点拉取 Blob/二进制数据并转换为 DataURL 呈现

---

## 原生 ComfyUI 8188 API 契约速查

| 端点 | 方法 | 请求格式与关键字段 | 响应格式与提取方式 | 用途 |
| --- | --- | --- | --- | --- |
| `/upload/image` | `POST` | `multipart/form-data`<br>- `image`: Blob 二进制（带安全随机文件名前缀）<br>- `overwrite`: `"true"`<br>- `type`: `"input"` | `{ "name": "filename.png", "subfolder": "" }` | 上传参考图/视频/音频至 input 目录 |
| `/prompt` | `POST` | `application/json`<br>`{ "prompt": <workflow_json>, "client_id": "<uuid>" }` | `200`: `{ "prompt_id": "<uuid>", "number": 1 }`<br>`node_errors`: 节点语法/文件校验错误直接 Fail-loud 报错 | 提交 workflow 任务入队 |
| `/history/{prompt_id}` | `GET` | 无需请求体 | `{ [prompt_id]: { status: { status_str: "success" \| "error" }, outputs: { [node_id]: { images: [], videos: [], text: [] } } } }` | 轮询任务完成状态与节点产物 |
| `/view` | `GET` | Query 参数：<br>- `filename`: 文件名<br>- `subfolder`: 子目录（可选）<br>- `type`: `"output"` / `"input"` | 200 返回媒体资源二进制 Blob | 预览与下载生成产物 |
| `/interrupt` | `POST` | `application/json`<br>`{}` | 200 返回中断指令确认 | 用户取消任务时中断 GPU 当前运算 |

---

## 核心调试经验与踩坑记录

### 1. 报 `Model "ComfyUI T2I" has no ComfyUI workflow attached`

**现象**：画布选择 ComfyUI 渠道提交生成，直接报该错误。

**根因与历史**：早期占位模型未配置 workflow JSON 时抛出。

**当前现状与处理**：
- 系统已默认将 `Comfy-Api/` 中的 6 大常用 API 工作流内置为系统默认绑定（文生图、图生图、局部编辑、文本/反推、全能参考视频、首尾帧视频）。
- 渠道编辑抽屉中直观展示「系统内置」或「自定义」徽标；即使用户清空自定义工作流，执行层也会自动无缝回退到对应的内置工作流，确保开箱即用。

---

### 2. 任务提交：`/prompt` 请求体与 `node_errors` 校验

**对比说明**：
- 早期代理服务要求根字段为 `{ "workflow": ... }`。
- **原生 ComfyUI 8188 要求根字段为 `{ "prompt": <workflow_graph>, "client_id": "<id>" }`**。

**关键排查要点**：
- 若 workflow 存在缺失节点、类型不匹配或非法连线，`/prompt` 会在响应体中返回 `node_errors`（如 `{"9": {"errors": [{"message": "..."}]}}`）。
- 前端在提交处显式捕获并解析 `node_errors`，Fail-loud 抛出明确异常，而不是静默失败。

---

### 3. 参考图绑定：对象引用 vs 纯文件名字符串

**对比说明**：
- 早期代理对接曾使用 `{ "__type": "core/ASSET", "info": { "id": "<id>" } }` 对象格式。
- **原生 ComfyUI 8188 直连时**：
  - 参考资源通过 `/upload/image` 上传至 ComfyUI 的 `input` 目录，接口返回实际保存的 `name`（如 `8位随机_image.png`）。
  - 在 workflow 对应的 `LoadImage` / `LoadVideo` / `LoadAudio` 节点中，**直接写入纯文件名字符串**（例如 `record.inputs.image = "filename.png"`）。
  - 若使用对象引用反倒会被原生 ComfyUI 当作非法文件名校验报错。

---

### 4. 任务状态轮询与产物提取（从 outputs 树提取）

**现象**：任务提交后长时间轮询不到结果或找不到输出图片。

**原生协议解析规则**：
- 轮询地址为 `/history/{prompt_id}`：
  - 当任务仍在排队或运行中时，响应通常为空对象 `{}` 或不包含该 `prompt_id` 键。
  - 任务完成后，响应中包含 `{ [prompt_id]: { outputs: {...}, status: {...} } }`。
  - 终态判断：`status.status_str === "error"` 时提取 `status.messages` 抛出错误；存在有效输出且状态非 error 即判定成功。
- **产物提取**：
  - 产物按输出节点组织，遍历 `outputs` 字典中各节点的 `images`、`videos`、`gifs`、`audio` 数组，从中提取 `filename` 与 `subfolder`。
  - 通过 `/view?filename=${encodeURIComponent(filename)}&subfolder=${subfolder}&type=output` 端点拉取实际内容。

---

### 5. 局部重绘（Inpaint）与多输出优先级

**现象**：局部重绘工作流中可能包含原图 SaveImage 与合成重绘图 SaveImage 两个输出节点，轮询可能错误取到原图。

**处理**：
- 使用 `prioritizeInpaintOutput` 分析工作流拓扑结构，查找输入来源为 `ImageCompositeMasked` 的 `SaveImage` 节点。
- 将该合成节点的输出置顶优先作为主图展示，保证重绘结果准确呈现。

---

### 6. 任务中断与取消机制

**原生协议**：
- 用户点击停止或 AbortSignal 中断时，直连调用 `POST /interrupt`，ComfyUI 会立即停止当前正在进行的采样和推断计算，避免本地 GPU 算力被无效占用。
- 全模态节点同时记录并持久化 `jobId`；刷新页面或超时后可通过「重新查询」直接打 `/history/{jobId}`，实现无损断点续查。

---

## 调试方法推荐

1. **直连验证**：
   ```bash
   # 1. 检查 ComfyUI 服务存活
   curl http://127.0.0.1:8188/system_stats
   
   # 2. 检查任务历史与输出
   curl http://127.0.0.1:8188/history/<prompt_id>
   ```
2. **工作流排查三步法**：
   - **参数绑定阶段**：检查 `_meta.title`（`prompt`, `width`, `height`, `seed`, `ref_image_01..09` 等）是否准确匹配，未连槽位是否正确修剪。
   - **提交阶段**：看 `/prompt` 返回的 `node_errors`，定位是缺少模型文件还是输入类型不合规。
   - **结果提取阶段**：看 `/history/{id}` 返回的输出节点类型与文件名，确认是否正确调用 `/view` 获取。
