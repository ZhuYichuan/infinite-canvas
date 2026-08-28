# ComfyUI 渠道完整指南

> 本文档面向已经把本地 ComfyUI 跑起来、希望通过无限画布调用 ComfyUI workflow 的用户。
> 如果你只是想大致了解这是什么、能做什么，先看 [`README.md`](../README.md) 里的 `## ComfyUI 渠道` 节，再回到这里看细节。

---

## 1. 架构与协议层

调用链分三层：

```
画布 (Web)
   ↓ HTTP
comfy-api-proxy（例：http://10.7.8.12:8189）
   ↓ HTTP
本机 ComfyUI（http://127.0.0.1:8188）
```

Web 端永远只跟 `comfy-api-proxy` 对话，不会直接连 ComfyUI。Proxy 把 ComfyUI 的「提交 workflow → 异步产出资产 → 资产可下载」三步，包装成同步 API：

| 端点 | 方法 | 用途 |
| --- | --- | --- |
| `/api/v2/assets` | `POST` | 上传参考图，返回 `asset_id` |
| `/api/v2/jobs` | `POST` | 提交 workflow JSON，返回 `job_id` |
| `/api/v2/jobs/{job_id}` | `GET` | 轮询 job 状态（`pending` / `in_progress` / `completed` / `failed`） |
| `/api/v2/jobs/{job_id}/cancel` | `POST` | 主动取消 |
| `/api/v2/assets/{asset_id}/content` | `GET` | 下载产出资产 |

完整协议与字段说明见 [`comfy-api-proxy` 仓库](https://github.com/basketikun/comfy-api-proxy)。

---

## 2. 安装 comfy-api-proxy

最小步骤：

1. 拉取并在能联通本机 ComfyUI 的机器上启动 proxy：
   ```bash
   git clone https://github.com/basketikun/comfy-api-proxy.git
   cd comfy-api-proxy
   bun install   # 或 npm install
   bun run start # 默认监听 http://127.0.0.1:8189
   ```
2. 启动 `--allow` 模式时，proxy 会要求每个请求带 `Authorization: Bearer <token>`，Web 端会把这个 token 写到 channel 的 `Proxy Token` 字段并自动附带。
3. 验证联通：在浏览器直接访问 `http://<proxy host>:8189/health`（或 proxy 自带 health 端点）确认 200。

> 如果你的 ComfyUI 跑在同一台机器但 Web 也想从局域网/公网访问，建议把 proxy 暴露到 `0.0.0.0:8189` 而不是 `127.0.0.1`，并在 channel 的 `Proxy URL` 填可路由的地址（如 `http://10.7.8.12:8189`）。

---

## 3. 在画布里配置一个 ComfyUI channel

1. 进入画布右上角「配置」面板的 channel 区，点新增 channel。
2. `API 格式` 下拉里选 `ComfyUI`（这是新增的第三个选项，与 `OpenAI 兼容` / `Gemini` 平行）。
3. 填写：
   - `Proxy URL`：proxy 的 base URL，例如 `http://10.7.8.12:8189`
   - `Proxy Token`：Bearer token（proxy `--allow` 模式下必填；不填保存按钮会被禁用并提示）
   - `Base URL` / `API Key`：ComfyUI 渠道下可忽略
4. 保存后会自动注入 3 个默认 image model（你之后可重命名、删除、上传 workflow）：
   - `ComfyUI T2I`（文生图）
   - `ComfyUI I2I 1ref`（1 张参考图）
   - `ComfyUI I2I 3ref`（最多 3 张参考图）
5. 首次创建 ComfyUI channel 时，`imageModel` 偏好会自动设为 `ComfyUI T2I`；`videoModel` / `textModel` / `audioModel` 保持空。

### ChannelEditorDrawer 必填校验

`apiFormat === "comfyui"` 时，`Proxy URL` 和 `Proxy Token` 两个字段是必填的，缺失时保存按钮禁用并显示对应错误文案（来自 `web/src/i18n/locales/*` 里的 `config.channelEditor.comfyuiProxyUrlRequired` / `comfyuiProxyTokenRequired`）。

---

## 4. 上传 workflow JSON

每个 `ChannelModel` 一对一绑定一份 workflow（`comfyuiWorkflow` 字段，嵌入 AiConfig）。

1. 在 channel 的 model 列表里点要编辑的 model，进入 `ComfyuiWorkflowEditor`（位于 Script 编辑器旁边）。
2. 点击「上传 workflow JSON」（来自 i18n key `comfyui.uploadWorkflow`）：
   - 弹出文件选择器，仅接受 `.json`
   - 读取后用 `JSON.parse` 校验；失败时显示 `comfyui.workflowParseFailed` 错误
   - 成功后写入 `channelModel.comfyuiWorkflow = { name, json, createdAt }`
3. 顶部会显示当前 workflow 的 `name`，便于你区分多份工作流。
4. 点「清空」（`comfyui.clearWorkflow`）可解绑当前 workflow。
5. 保存 channel 后 workflow 随 AiConfig 一起进 localStorage，并随 `exportAppConfig` 一起导出，导入新设备后无需重新上传。

> **节点约定**：上传的 workflow JSON 里，节点 `_meta.title` 需要等于以下字面量之一，Web 端才会写入对应 inputs：
>
> | `_meta.title` | 含义 | 写入字段 |
> | --- | --- | --- |
> | `prompt` | 文本提示词 | `inputs.text` |
> | `width` | 输出宽度 | `inputs.value` |
> | `height` | 输出高度 | `inputs.value` |
> | `ref_image_01` / `ref_image_02` / `ref_image_03` | 参考图 1/2/3 | `inputs.image`（写 asset 引用） |
>
> 这个约定继承自 `tools/comfyui-task/src/binding.ts` 的 `TITLE_TO_INPUT_SLOT` 映射，不要自行改名。

---

## 5. 在画布上调用

1. 在画布上选中或新建一个 generation 节点。
2. ModelPicker 选 `ComfyUI T2I` / `ComfyUI I2I 1ref` / `ComfyUI I2I 3ref`。
3. 输入 prompt，按生成：
   - T2I：仅 prompt
   - I2I 1ref：把 1 张已有图片拖到生成节点的引用槽
   - I2I 3ref：把最多 3 张已有图片拖到引用槽（拖入顺序决定 `ref_image_01..03`）
4. 节点状态进入 LOADING，等待后台完成。
5. ComfyUI 完成后图片作为新 image 节点出现在画布上。

> 图生图的 model 选择是手动行为，画布**不会**根据当前 prompt 里有没有参考图去自动切 model；用户自选避免歧义。

---

## 6. 进度、超时、取消

| 行为 | 表现 |
| --- | --- |
| 进行中 | generation 节点显示 LOADING |
| 完成 | 产出图落到画布 |
| **10 分钟超时** | UI 提示 `comfyui.timeout` 文案；**不会**调 `/api/v2/jobs/{id}/cancel`，GPU 不会被动释放，再次点生成会继续等待 |
| 用户手动取消 | 调用 `/api/v2/jobs/{job_id}/cancel`，UI 提示 `comfyui.cancelled` |
| Proxy 返回 `failed` | UI 提示 `comfyui.failed` |
| 缺 workflow | 立即抛错并提示（`comfyui.noWorkflowAttached`） |

> 取消 / 超时都会写一条 `image_generation_logs` 进 workbench 历史，可在「生成记录」里排查。

---

## 7. 调试技巧

- **Web 端 console**：`web/src/services/api/comfyui.ts:requestComfyuiImage` 会打印：
  - 提交后的 `job_id`
  - 每次轮询的状态与时间戳
  - 失败 / 超时的具体原因
  开发模式（`bun run dev`）下浏览器 DevTools Console 直接看。
- **Proxy 日志**：盯着 proxy 的 stdout，重点看：
  - `POST /api/v2/assets` —— 参考图是否上传成功（失败多为 CORS / 大小超限）
  - `POST /api/v2/jobs` —— workflow 是否被接受（失败多为节点缺字段 / 模型缺失）
  - `GET /api/v2/jobs/{id}` —— 轮询频率（默认 2 秒一次，不要再加速）
  - `GET /api/v2/assets/{id}/content` —— 产出下载是否 200
- **ComfyUI 后端**：连本机 ComfyUI 自己的 stdout 看 workflow 节点执行进度；Proxy 通常会把 verbose 模式打开以便对照。
- **快速回归**：在 proxy 端用 `curl` 模拟一次 `POST /api/v2/jobs` 能最快定位是 Web → Proxy 还是 Proxy → ComfyUI 哪一段挂了。

---

## 8. 常见问题

**Q: 选完 ComfyUI 模型后画布一直 LOADING，但 proxy 端没收到 `POST /api/v2/jobs`？**
A: 99% 是 channel 的 `Proxy URL` / `Proxy Token` 没填对，或者 Web → Proxy 这段网络不通（多见于反代 / HTTPS 自签证书）。

**Q: 提示 `workflow JSON 解析失败`？**
A: 你上传的 JSON 不是合法 JSON，或根节点缺 `_meta.title` 字段。先用本地编辑器或 `jq` 校验一下格式。

**Q: 输出图很小或被裁剪？**
A: 检查 workflow 里 `width` / `height` 节点的 `inputs.value` 是否被覆写；或者参考 `parseSize`（`web/src/services/api/comfyui.ts`）默认是 `1024x1024`。

**Q: 我想用 ComfyUI Cloud（cloud.comfy.org）行不行？**
A: 不行。本期只对接本地 `comfy-api-proxy`，Cloud 的鉴权用 `X-API-Key`、状态端点路径不同，需要另写一层 cloud adapter（属于未来扩展）。

**Q: 我能在多个 model 间复用同一份 workflow 吗？**
A: 当前数据模型是一对一绑定。如需复用，可把同一份 workflow JSON 单独上传到每个 model；或 fork model 后再传。

**Q: 我能编辑已上传的 workflow 吗？**
A: 一期只支持「上传 / 清空」，没有内置编辑器。请在 ComfyUI / VSCode 里改好 JSON 后重新上传。

---

## 9. 未来扩展

### 9.1 多模态（video / text / audio）

service 层（`requestComfyuiImage`）已基于 capability 抽象，video / text / audio 不需要新写 service，只需要：

1. 在 ComfyUI channel 下新增一个 model，`name: "ComfyUI T2V"`，`capability: "video"`（或 `"text"` / `"audio"`）。
2. 上传对应的 workflow JSON。
3. 在偏好面板把 `videoModel` / `textModel` / `audioModel` 设为该 model。

### 9.2 ComfyUI Cloud

Cloud 的协议与本地 proxy 不同：

- 鉴权用 `X-API-Key` 而不是 `Bearer`。
- 状态端点 `/api/jobs/{id}` vs 本地 `/api/job/{id}/status`。
- 资产下载路径与本地 proxy 不一致。

接入方式：在 `requestComfyuiImage` 之上加一层 cloud adapter，根据 `channel.comfyuiCloud === true` 走不同 fetch 调用即可。一期不实现。

### 9.3 Workflow 版本管理 / 复用

当前是一对一绑定 + 全量上传。未来若需要：

- 给 `ChannelModel.comfyuiWorkflow` 加 `version` 字段
- 提供「从已上传 workflow 复制到新 model」按钮
- 在 IndexedDB 维护一份 workflow 仓库，channel 只引用 `workflow_id`

均属于数据模型改造，需要新一期。

---

## 10. 相关代码位置

| 模块 | 文件 |
| --- | --- |
| Service 主入口 | `web/src/services/api/comfyui.ts` |
| Service 工具函数 | `parseSize` / `resolveReferenceImage`（同上文件） |
| image.ts 分支 | `web/src/services/api/image.ts` 顶部的 `if (apiFormat === "comfyui")` |
| 渠道编辑器 | `ChannelEditorDrawer` 里的 `apiFormat` 下拉 + proxyUrl/token 行 |
| Workflow 上传组件 | `ComfyuiWorkflowEditor` |
| 数据模型 | `ApiCallFormat` / `ModelChannel` / `ChannelModel` 的扩展字段 |
| i18n | `web/src/i18n/locales/zh-CN.ts` / `en-US.ts` 的 `comfyui.*` 块 |
| 测试 | `web/src/services/api/__tests__/comfyui.test.ts`（vitest） |
| Spec | `docs/specs/comfyui-channel.md` |

---

## 11. 参考链接

- [comfy-api-proxy 仓库](https://github.com/basketikun/comfy-api-proxy)
- [`docs/specs/comfyui-channel.md`](specs/comfyui-channel.md) — 完整协议与决策记录
- [ComfyUI 官方文档](https://github.com/comfyanonymous/ComfyUI)