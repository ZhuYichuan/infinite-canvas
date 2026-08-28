# T16 I2I 端到端手动测试

对应 issue：`.scratch/comfyui-channel/issues/16-e2e-i2i.md`（Phase 6 / Wave 6）。
本清单为**手动浏览器测试**，需人工逐项执行并记录 pass / fail。前置依赖 T15（T2I 端到端）已跑通。

背景与原理见 `docs/comfyui-channel.md`（尤其 §4 节点约定、§5 画布调用、§7 调试技巧）。

---

## 0. 前置条件

| 项 | 说明 |
| --- | --- |
| 分支 | `feat/comfyui` |
| dev server | `cd web && bun run dev`，浏览器打开输出的地址 |
| comfy-api-proxy | 本机运行，默认端口 8189。下文统一写 `http://10.7.8.12:8189`，**请替换为你本机实际地址** |
| ComfyUI 后端 | 8188 已启动，且 workflow 里用到的模型/节点全部就绪 |
| workflow 文件 | `comfyui_api_demo/i2i_ref1_api.json`、`comfyui_api_demo/i2i_ref3_api.json` |
| 浏览器 | DevTools 打开，切到 Network 面板过滤 `api/v2` |

> **先读这条**：`i2i_ref1_api.json` 里**没有 `_meta.title === "prompt"` 的节点**（只有 `ref_image_01` / `width` / `height`），
> 它的文本编码节点 title 是 `TextEncodeBooguEdit`。因此 A 组测试里你输入的 prompt **不会**被写进 workflow，
> 出图内容由 workflow 内置文案 + 参考图决定。这是 demo 文件本身的特性，不是 bug，评估 A 组结果时不要以「出图是否符合 prompt」为判据。
> `i2i_ref3_api.json` 有 `prompt` 节点（`PrimitiveStringMultiline`），B 组 prompt 会生效。

---

## A. I2I 1ref 路径

### A1. 上传 i2i_ref1 workflow

1. 打开配置面板 → channel 区，新建或选中已有 ComfyUI channel。
   - 若新建：`API 格式` 选 `ComfyUI`，填 `Proxy URL` = `http://10.7.8.12:8189`、`Proxy Token`。两者缺一保存按钮禁用。
2. 保存后确认 channel 下自动出现 3 个 model：`ComfyUI T2I` / `ComfyUI I2I 1ref` / `ComfyUI I2I 3ref`。
3. 编辑 `ComfyUI I2I 1ref` model，找到 workflow 编辑区（Script 编辑器旁）。
4. 点「上传 workflow JSON」，选 `comfyui_api_demo/i2i_ref1_api.json`。
5. **验证**：编辑区左侧显示 `i2i_ref1_api.json · 2.0KB`（文件名 + 压缩后 JSON 体积），且「清空」按钮出现。
6. 保存 channel，刷新页面后重新打开该 model，workflow 仍在（已持久化到 localStorage）。

pass / fail：______

### A2. 接 1 张 ref 图 + 生成

> **参考图来源**：画布上的参考图不是「拖到节点里」，而是**通过连线**注入的 —— 上游 image 节点连到生成节点（或生成节点连出的 Config 节点），
> 代码路径 `web/src/lib/canvas/canvas-resource-references.ts:getGenerationResourceNodes`。
> `ref_image_01..03` 的编号顺序 = **连线的创建顺序**（`connections` 数组顺序），不是节点在画布上的位置顺序。
> 具体连线交互按当前 UI 提示操作（从节点边缘的连接点拖出连线到目标节点）。

1. 画布上准备 1 张已有内容的 image 节点（已生成或已导入均可）。
2. 新建/选中生成节点，把这张 image 节点连到它，确认引用区显示 1 张图。
3. ModelPicker 选 `ComfyUI I2I 1ref`。
4. 输入 prompt，例如 `a cat wearing a hat`（注意上面的说明：ref1 workflow 不会用到它）。
5. 点生成。
6. **验证**：
   - [ ] 生成节点进入 LOADING
   - [ ] Network 面板：`POST /api/v2/assets` 恰好 **1 次**，返回 200 且 body 含 `id`
   - [ ] Network 面板：`POST /api/v2/jobs` 恰好 **1 次**，返回 200 且 body 含 `id`
   - [ ] `GET /api/v2/jobs/{id}` 每 2 秒一次轮询，status 由 `pending`/`in_progress` 变 `completed`
   - [ ] `GET /api/v2/assets/{id}/content` 拉取产出，200
   - [ ] 节点变 SUCCESS，图片落到画布
   - [ ] proxy stdout 对应显示上述 assets / jobs 请求
7. **检查日志**（见下方「调试 tips → 查看 image_generation_logs」）：新增 1 条 `status: "success"`、`provider: "comfyui"`、`jobId` 非空的记录。

pass / fail：______

---

## B. I2I 3ref 路径

### B1. 上传 i2i_ref3 workflow

同 A1，但编辑 `ComfyUI I2I 3ref` model，上传 `comfyui_api_demo/i2i_ref3_api.json`，
验证显示 `i2i_ref3_api.json · 4.3KB`。

pass / fail：______

### B2. 接 3 张 ref 图 + 生成

1. 画布上准备 3 张不同的 image 节点。
2. 依次连到同一个生成节点，**记下连线顺序**（第 1 条 → `ref_image_01`，第 2 条 → `ref_image_02`，第 3 条 → `ref_image_03`）。
3. ModelPicker 选 `ComfyUI I2I 3ref`。
4. 输入 prompt，建议用能体现图序的文案，例如
   `让图片1中的人物出现在图片2的场景中，参考图片3的风格`（这样出图能反证编号顺序是否正确）。
5. 点生成。
6. **验证**：
   - [ ] `POST /api/v2/assets` 恰好 **3 次**，全部 200
   - [ ] `POST /api/v2/jobs` 1 次，200
   - [ ] 轮询 → `completed` → 下载产出 → 节点 SUCCESS，图片落到画布
   - [ ] 出图内容与「图片1/2/3」的语义对应（用于验证编号顺序，主观判断）
   - [ ] `image_generation_logs` 新增 1 条 success
7. **附加验证（推荐）**：在 Network 里点开 `POST /api/v2/jobs` 的 request payload，
   展开 `prompt` 字段（即 bound workflow），确认节点 `9` / `13` / `14` 的 `inputs.image` 已被替换成
   三个不同的 asset id 字符串（原值是 demo 里的中文文件名）。

pass / fail：______

---

## C. 错误 / 边界路径（bonus）

以下为**代码推导出的预期行为**，实测若不符请记录并反馈，不要当成已定论的正确行为。

| 场景 | 代码推导的预期 | 实测 |
| --- | --- | --- |
| I2I 1ref 不接任何 ref 图，直接生成 | 走 `requestGeneration`（`images: []`），`ref_image_01` 节点保留 demo 里的原始文件名 `Boogu_image_edit_00002.png`。若 ComfyUI 输入目录里没有该文件 → job `failed`；有则用旧图出图。**不会**在 Web 端提前报错 | ______ |
| I2I 1ref 接 2 张 ref 图 | **2 张都会上传**（2 次 `POST /api/v2/assets`），但 workflow 只有 `ref_image_01`，第 2 个 asset 被静默丢弃。不报错 | ______ |
| I2I 3ref 只接 1 张 ref 图 | 上传 1 次；`ref_image_01` 被替换，`ref_image_02` / `ref_image_03` **保留 demo 原始文件名**，大概率 job `failed` 或混入无关旧图 | ______ |
| I2I 3ref 接 4 张 ref 图 | **4 张全部上传**（4 次 assets），第 4 个静默丢弃。不报错 | ______ |
| model 未绑定 workflow 就生成 | 立即抛 `ComfyuiNoWorkflowError`，UI 提示，且**不会**发出任何 `/api/v2` 请求；日志写入 1 条 `failed` | ______ |
| 生成中点取消 | `POST /api/v2/jobs/{id}/cancel`，UI 提示 `ComfyUI 生成已取消`，日志 1 条 `failed` | ______ |
| proxy 停掉后生成 | assets 上传网络错误 → UI 报错，日志 1 条 `failed` | ______ |

---

## D. 结果记录

- 测试人：______________
- 日期：______________
- 分支 / commit：______________
- proxy 地址：______________
- A 组 pass / 总数：____ / 2
- B 组 pass / 总数：____ / 2
- C 组实测异常项：______________
- 备注：

---

## 调试 tips

### 查看 image_generation_logs

DevTools → Application → IndexedDB → `infinite-canvas` → `image_generation_logs`，按 `createdAt` 排序看最新一条。
或在 Console 执行（页面已加载 localforage）：

```js
const s = localforage.createInstance({ name: "infinite-canvas", storeName: "image_generation_logs" });
const rows = []; await s.iterate((v) => { rows.push(v); });
rows.sort((a, b) => b.createdAt - a.createdAt).slice(0, 3);
```

关注字段：`status` / `provider` / `jobId` / `durationMs` / `successCount` / `errorMessage`。

### job_id 与轮询状态

`requestComfyuiImage` 目前**没有 console.log**，也没有从 `image.ts` 传入 `onProgress` 回调，
所以 job_id 和轮询状态**不会**打到 Console（`docs/comfyui-channel.md` §7 的描述与现状不符）。
请改用 **DevTools → Network，过滤 `api/v2`** 观察：请求序列、返回体里的 `id` 和 `status`。

### 其它

- proxy 日志：`tail -f <你的 proxy 日志路径>`，重点看 `POST /api/v2/assets`、`POST /api/v2/jobs`、`GET /api/v2/jobs/{id}`。
- ComfyUI 后端 stdout：看节点级执行进度，定位是「Web → Proxy」还是「Proxy → ComfyUI」哪段挂了。
- 参考图取值优先级（`web/src/services/api/image.ts:798-803`）：`dataUrl` → `url` → `image:{storageKey}`。
  画布节点通常走 `dataUrl`（可能是 `blob:` 形式的 object URL）。
- 更多见 `docs/comfyui-channel.md` §7「调试技巧」、§8「常见问题」。
