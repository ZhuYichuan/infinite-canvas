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
| `/free` 或 `/api/free` | `POST` | `application/json`<br>`{ "unload_models": true, "free_memory": true }` | `200`: 空包体 | 卸载已加载模型并释放 PyTorch/显存缓存 |
| `/api/kktools/runtime_stats` | `GET` | Query 参数可选 `?t=<timestamp>` 防缓存 | `200`: `{ "ok": true, "data": { cpu, memory, process, devices } }` | 实时硬件监控（显存占用、GPU 利用率、CPU、内存） |
| `/system_stats` | `GET` | 无需请求体 | `200`: `{ "system": { ... }, "devices": [ ... ] }` | 官方原生系统环境、Python/PyTorch版本与设备列表 |

---

## 核心调试经验与踩坑记录

### 1. 报 `Model "ComfyUI T2I" has no ComfyUI workflow attached`

**现象**：画布选择 ComfyUI 渠道提交生成，直接报该错误。

**根因与历史**：早期占位模型未配置 workflow JSON 时抛出。

**当前现状与处理**：
- 系统已默认将 `Comfy/Comfy-Api/` 中的 6 大常用 API 工作流内置为系统默认绑定（文生图、图生图、局部编辑、文本/反推、全能参考视频、首尾帧视频）。
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

### 7. MiniMax Music 03 音频生成时长偏差补偿（少 1 秒问题）

**现象**：
- 用户在画布设置面板选择生成 10 秒音频，ComfyUI 实际导出的音乐产物时长恒定为 9 秒；选择 60 秒时实际导出 59 秒。

**根因**：
- 底层 MiniMax Music 03 扩散模型（DiT）与 ComfyUI 原生音频潜空间节点（`EmptyMiniMaxMusic3LatentAudio`）在根据采样步数与时长计算帧数时，因音频采样率帧对齐或去噪结尾帧裁剪，导致最终解码出的音频长度普遍比输入的 `duration` 整数少 1 秒。

**处理方案**：
- 在 `web/src/services/api/comfyui.ts` 的 `requestComfyuiAudio` 提交层中，保持前端 UI 与画布节点元数据展示用户真实选择的时长（如 10s），而在底层向 ComfyUI 提交工作流参数时自动追加 +1 秒偏差补偿（`submittedDuration = duration + 1`），使实际产出的音乐时长与用户设定值完全吻合。

---

### 8. 多节点输出与 `type = output` 正式产物优先级

**现象**：
- 工作流中同时包含输入加载/预览节点（如 `LoadVideo`、`PreviewImage`）和输出保存节点（如 `SaveVideo`、`SaveImage`）时，ComfyUI 的 `/history/{jobId}` 返回的 `outputs` 字典包含多个节点。
- 由于字典键按键名升序遍历（如节点 `1` 早于节点 `4`），前端简单遍历首个有效条目会错误取到输入参考视频（其在 ComfyUI 内部标识为 `type: "input"` 或 `"temp"`），导致生成结果误展示为原始输入素材。

**根因**：
- ComfyUI 原生规范中，`SaveImage` / `SaveVideo` / `VHS_VideoCombine` 保存的正式结果项其 `type` 字段为 `"output"`。
- 输入加载节点或临时预览节点其 `type` 字段为 `"input"` 或 `"temp"`。

**处理方案**：
- 在 `web/src/services/api/comfyui.ts` 中实现统一的产物优先级分级规则：
  - `rank 0`：`type === "output"`（最终正式落盘产物，最高优先级）
  - `rank 1`：`type === "temp"`（临时预览产物，无正式保存节点时的兜底）
  - `rank 2`：`type === "input"`（输入参考资产，最低优先级，仅作为极端备用）
- 在 `pollJobRaw` 中对解析出的 `outputs` 列表按该等级稳定排序，并在 `collectVideoAssetIds`、`collectImageAssetIds` 与 `collectAudioAssetIds` 收集器中严格优先返回 `type === "output"` 的条目，彻底杜绝多节点工作流误取输入节点素材的问题。

---

### 9. 硬件运行监控与显存模型清理契约（/free 与 /api/kktools/runtime_stats）

#### (1) 清理与卸载接口：`POST /free`（或 `/api/free`）

* **请求格式**：
  ```json
  {
    "unload_models": true,
    "free_memory": true
  }
  ```
* **字段详解**：
  | 字段 | 类型 | 必填 | 默认值 | 作用与底层实现 |
  | --- | --- | --- | --- | --- |
  | `unload_models` | `boolean` | 否 | `false` | 为 `true` 时调用 `model_management.unload_all_models()`，强制卸载当前载入显存中的所有 Checkpoint/UNET/CLIP/VAE/LoRA 等模型权重，彻底释放占用显存 |
  | `free_memory` | `boolean` | 否 | `false` | 为 `true` 时调用 `model_management.soft_empty_cache()`，执行 `torch.cuda.empty_cache()` 与 Python `gc.collect()`，将缓存显存归还操作系统 |
* **本地官方文档对比与排查要点**：
  - 官方文档 `Comfy/Comfy-Org/docs/development/comfyui-server/comms_routes.mdx` 中仅记录了 `/free` 路由用途为 "free memory by unloading specified models"，但**遗漏了请求体 JSON 参数说明**。
  - 若调用时传入空对象 `{}`，ComfyUI 默认两个字段均为 `false`，导致实际上未卸载模型也未清缓存；前端封装 `freeComfyuiMemory` 时已将两者默认置为 `true`。
  - 部分代理环境使用 `/api/free`，官方原生直接走 `/free`，前端实现应优先请求 `/api/free`，遇到 404 自动回退 `/free`。

---

#### (2) 硬件运行时状态监控：`GET /api/kktools/runtime_stats`

由本项目核心依赖插件 `Comfyui-kktools` 提供，返回高频采样的 CPU、RAM、GPU 显存与核心利用率。

* **响应数据字段详解**：
  ```json
  {
    "ok": true,
    "data": {
      "cpu": {
        "percent": 8.5,             // [number] CPU 整体使用率百分比 (0.0 ~ 100.0)
        "logical_cores": 12         // [number] CPU 逻辑核心总数
      },
      "memory": {
        "total": 68642123776,       // [number] 宿主机总物理内存 (字节 Bytes)
        "available": 54574084096,   // [number] 宿主机当前可用物理内存 (字节 Bytes)
        "used": 14068039680,        // [number] 宿主机当前已用物理内存 (字节 Bytes)
        "percent": 20.5             // [number] 宿主机物理内存使用率百分比 (0.0 ~ 100.0)
      },
      "process": {
        "memory_used": 1522647040,  // [number] ComfyUI Python 后端进程自身内存 (字节 Bytes)
        "uptime_seconds": 51380     // [number] ComfyUI 服务进程自启动以来的运行秒数 (Seconds)
      },
      "devices": [
        {
          "name": "cuda:0 NVIDIA GeForce RTX 3090 Ti : cudaMallocAsync", // [string] 设备名与内存分配器
          "type": "cuda",                                                // [string] 设备类型 (cuda, mps, cpu 等)
          "index": 0,                                                   // [number] 设备物理索引
          "utilization": 0.0,                                           // [number] GPU 核心实时计算利用率百分比 (0.0 ~ 100.0)
          "memory_total": 25756696576,                                  // [number] GPU 物理显存总容量 (字节 Bytes)
          "memory_free": 24361566208,                                   // [number] GPU 物理显存当前空闲量 (字节 Bytes)
          "memory_used": 1395130368,                                    // [number] GPU 物理显存当前占用量 (字节 Bytes)
          "memory_percent": 5.4                                         // [number] GPU 显存占用百分比 (0.0 ~ 100.0)
        }
      ]
    }
  }
  ```
* **对比官方 `/system_stats` 接口**：
  - 官方 `/system_stats` 仅提供静态环境（操作系统、Python/PyTorch 版本、启动参数）及瞬时 `vram_total` / `vram_free`。
  - `/system_stats` **不包含** GPU 计算核心利用率（`utilization`）、宿主机 CPU 使用率（`cpu.percent`）、ComfyUI 进程自身内存占用与启动运行时间。因此画布实时监控看板优先使用 `/api/kktools/runtime_stats`，未安装插件时才降级读取 `/system_stats`。

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
