# T19 OpenAI/Gemini 回归手动测试

对应 issue：`.scratch/comfyui-channel/issues/19-openai-gemini-regression.md`（Phase 7 / Wave 7）。

本清单覆盖 vitest **无法自动化**的 UI 视觉验证。其它 acceptance criteria 已在 vitest 中覆盖：

- AC 2 / AC 5 → `web/src/stores/__tests__/use-config-store.test.ts` 新增的 `legacy persisted data normalization` 与 `OpenAI + ComfyUI coexistence` describe
- AC 3 / AC 4 / AC 6 / AC 7 → `web/src/services/api/__tests__/image-regression.test.ts`
- AC 8 → `web/src/services/api/__tests__/comfyui-log.test.ts`
- AC 1（drawer 下拉选项、字段显隐）→ 本清单手动验证

> 前置条件：dev server 已启动、已存在至少一个 OpenAI 渠道。无需启动 ComfyUI / comfy-api-proxy（视觉验证不依赖实际出图）。

---

## A. ChannelEditorDrawer apiFormat 下拉

### A1. 新建 OpenAI channel

1. 打开配置面板 → channel 区 → 点「新增 channel」。
2. **验证**：`API 格式` 下拉里**至少有**三个选项：
   - `OpenAI 兼容`
   - `Gemini`
   - `ComfyUI`
3. 选 `OpenAI 兼容`，点保存。
4. **验证**：OpenAI channel 卡片**不出现**「Proxy URL」「Proxy Token」两个字段（这两个是 ComfyUI 专属，OpenAI 渠道应隐藏）。

pass / fail：______

### A2. 新建 ComfyUI channel

1. 同 A1 步骤，但在第 2 步选 `ComfyUI`。
2. **验证**：ComfyUI channel 卡片**必现**「Proxy URL」「Proxy Token」两个字段，且两者都为空时保存按钮禁用。
3. 填入 `http://127.0.0.1:8189` 和任意 token，保存。
4. **验证**：channel 下**自动出现** model：`ComfyUI T2I`（capability 为 `image`）。

pass / fail：______

### A3. OpenAI + ComfyUI 共存

1. 保留 A1 创建的 OpenAI channel，**不要删除**。
2. 在 A2 步骤创建 ComfyUI channel。
3. **验证**：channel 列表里**同时存在**两个渠道，互不干扰。
4. 关闭并重新打开配置面板。
5. **验证**：两个渠道都还在（已持久化到 localStorage）。

pass / fail：______

---

## B. ModelPicker 切换

### B1. 切换到 ComfyUI T2I 后再切回 OpenAI gpt-image-2

1. 画布上新建/选中一个 generation 节点。
2. 打开 ModelPicker，选 `ComfyUI T2I`（任一 ComfyUI 渠道的 model）。
3. **验证**：节点的生成参数面板**没有** prompt 之外的特殊参数（ComfyUI 不依赖 size / quality 等 OpenAI 字段）。
4. 切回 `OpenAI 兼容` channel 下的 `gpt-image-2`。
5. **验证**：生成参数面板恢复 OpenAI 字段（size / quality / count 等）。
6. **验证**：store 状态不残留 ComfyUI 字段（关闭再打开配置面板，ComfyUI channel 仍正常）。

pass / fail：______

---

## C. i18n 验证

### C1. 英文 / 简体中文切换

1. 右上角语言切换：英文。
2. 打开 channel 编辑器，**验证**所有 ComfyUI 字段文案（Proxy URL / Proxy Token / workflow 提示等）显示英文。
3. 切回简体中文。
4. **验证**：同字段显示中文。

pass / fail：______

---

## D. 已自动化但需要端到端跑通

- AC 3/4：实际生图验证 OpenAI / Gemini 协议真的发出请求（DevTools Network 面板）
- AC 7：实际在只有 OpenAI channel 的状态下点生成，确认 ComfyUI 相关代码路径（DevTools Console 搜索 `requestComfyuiImage`）未被调用
- AC 8：在生图工作台查看生成历史，验证 OpenAI 和 ComfyUI 记录都有显示
