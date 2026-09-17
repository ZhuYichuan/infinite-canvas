/**
 * infinite-canvas Official Website - Core Interactivity
 */

document.addEventListener("DOMContentLoaded", () => {
  initI18n();
  initMascot();
  initCanvasPlayground();
  initCapabilityMatrix();
  initQuickStartTabs();
  initVideoPlayer();
  initFooterEasterEgg();
});

/* ==========================================================================
   1. i18n Language Switcher
   ========================================================================== */
let currentLang = localStorage.getItem("site_lang") || "zh-CN";

function initI18n() {
  const langToggle = document.getElementById("lang-toggle");
  if (langToggle) {
    langToggle.addEventListener("click", () => {
      currentLang = currentLang === "zh-CN" ? "en" : "zh-CN";
      localStorage.setItem("site_lang", currentLang);
      applyTranslations();
    });
  }
  applyTranslations();
}

function applyTranslations() {
  const dict = window.I18N_DATA[currentLang] || window.I18N_DATA["zh-CN"];
  
  // Text nodes
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (dict[key]) {
      el.textContent = dict[key];
    }
  });

  // HTML nodes
  document.querySelectorAll("[data-i18n-html]").forEach((el) => {
    const key = el.getAttribute("data-i18n-html");
    if (dict[key]) {
      el.innerHTML = dict[key];
    }
  });

  // Update toggle button text
  const langBtnText = document.getElementById("lang-btn-text");
  if (langBtnText) {
    langBtnText.textContent = currentLang === "zh-CN" ? "EN" : "中";
  }

  // Update dynamic wires after translation render (in case heights shift)
  setTimeout(updateCanvasWires, 50);
}

/* ==========================================================================
   2. Interactive Mascot (Eyes Follow Cursor)
   ========================================================================== */
function initMascot() {
  const mascot = document.getElementById("hero-mascot");
  if (!mascot) return;

  const leftPupil = document.getElementById("mascot-pupil-left");
  const rightPupil = document.getElementById("mascot-pupil-right");

  window.addEventListener("mousemove", (e) => {
    if (!leftPupil || !rightPupil) return;
    const rect = mascot.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const deltaX = e.clientX - centerX;
    const deltaY = e.clientY - centerY;
    const angle = Math.atan2(deltaY, deltaX);
    const distance = Math.min(4, Math.hypot(deltaX, deltaY) / 40);

    const pupilX = Math.cos(angle) * distance;
    const pupilY = Math.sin(angle) * distance;

    leftPupil.style.transform = `translate(${pupilX}px, ${pupilY}px)`;
    rightPupil.style.transform = `translate(${pupilX}px, ${pupilY}px)`;
  });

  mascot.addEventListener("click", () => {
    showToast(currentLang === "zh-CN" ? "✨ 无限画布已就绪！" : "✨ Canvas ready for ComfyUI!");
    mascot.classList.add("scale-125");
    setTimeout(() => mascot.classList.remove("scale-125"), 200);
  });
}

/* ==========================================================================
   3. Interactive Canvas Playground (Draggable nodes & live cables)
   ========================================================================== */
let activeDrag = null;
let dragOffset = { x: 0, y: 0 };

function initCanvasPlayground() {
  const container = document.getElementById("canvas-viewport");
  const nodes = document.querySelectorAll(".canvas-node");
  if (!container || !nodes.length) return;

  nodes.forEach((node) => {
    const handle = node.querySelector(".node-drag-handle") || node;
    handle.style.cursor = "grab";

    handle.addEventListener("mousedown", (e) => {
      if (e.target.closest("button") || e.target.closest("input") || e.target.closest("textarea")) return;
      activeDrag = node;
      node.classList.add("dragging", "selected");
      nodes.forEach((n) => n !== node && n.classList.remove("selected"));

      const containerRect = container.getBoundingClientRect();
      const nodeRect = node.getBoundingClientRect();

      dragOffset.x = e.clientX - nodeRect.left;
      dragOffset.y = e.clientY - nodeRect.top;

      e.preventDefault();
    });
  });

  window.addEventListener("mousemove", (e) => {
    if (!activeDrag) return;
    const containerRect = container.getBoundingClientRect();

    let newLeft = e.clientX - containerRect.left - dragOffset.x;
    let newTop = e.clientY - containerRect.top - dragOffset.y;

    // Boundary constraints
    newLeft = Math.max(10, Math.min(containerRect.width - activeDrag.offsetWidth - 10, newLeft));
    newTop = Math.max(10, Math.min(containerRect.height - activeDrag.offsetHeight - 10, newTop));

    activeDrag.style.left = `${newLeft}px`;
    activeDrag.style.top = `${newTop}px`;

    updateCanvasWires();
  });

  window.addEventListener("mouseup", () => {
    if (activeDrag) {
      activeDrag.classList.remove("dragging");
      activeDrag = null;
    }
  });

  // Wire updates on resize
  window.addEventListener("resize", updateCanvasWires);
  setTimeout(updateCanvasWires, 100);

  // Run Flow Button
  const runBtn = document.getElementById("canvas-run-btn");
  if (runBtn) {
    runBtn.addEventListener("click", executeCanvasFlow);
  }

  // View Step Tabs (Glance / Inspect / Explore)
  const stepButtons = document.querySelectorAll("[data-step-view]");
  stepButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      stepButtons.forEach((b) => {
        b.classList.remove("bg-white/10", "text-white", "border-sky-400/40");
        b.classList.add("text-zinc-400", "border-transparent");
      });
      btn.classList.add("bg-white/10", "text-white", "border-sky-400/40");
      btn.classList.remove("text-zinc-400", "border-transparent");

      const viewMode = btn.getAttribute("data-step-view");
      applyCanvasViewMode(viewMode);
    });
  });
}

function updateCanvasWires() {
  const container = document.getElementById("canvas-viewport");
  const svg = document.getElementById("canvas-wires-svg");
  if (!container || !svg) return;

  const wire1 = document.getElementById("wire-1"); // Prompt -> Workflow
  const wire2 = document.getElementById("wire-2"); // Workflow -> Output

  const portPOut = document.getElementById("port-prompt-out");
  const portWIn = document.getElementById("port-workflow-in");
  const portWOut = document.getElementById("port-workflow-out");
  const portOIn = document.getElementById("port-output-in");

  if (wire1 && portPOut && portWIn) {
    wire1.setAttribute("d", calculateBezier(container, portPOut, portWIn));
  }
  if (wire2 && portWOut && portOIn) {
    wire2.setAttribute("d", calculateBezier(container, portWOut, portOIn));
  }
}

function calculateBezier(container, portStart, portEnd) {
  const cRect = container.getBoundingClientRect();
  const sRect = portStart.getBoundingClientRect();
  const eRect = portEnd.getBoundingClientRect();

  const x1 = sRect.left + sRect.width / 2 - cRect.left;
  const y1 = sRect.top + sRect.height / 2 - cRect.top;
  const x2 = eRect.left + eRect.width / 2 - cRect.left;
  const y2 = eRect.top + eRect.height / 2 - cRect.top;

  const dx = Math.abs(x2 - x1) * 0.55;
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

function applyCanvasViewMode(mode) {
  const inspectPanel = document.getElementById("node-workflow-inspect");
  const nodeOutput = document.getElementById("node-output");
  const nodeExtra = document.getElementById("node-extra");

  if (mode === "glance") {
    if (inspectPanel) inspectPanel.classList.add("hidden");
    if (nodeExtra) nodeExtra.classList.add("hidden");
  } else if (mode === "inspect") {
    if (inspectPanel) inspectPanel.classList.remove("hidden");
    if (nodeExtra) nodeExtra.classList.add("hidden");
  } else if (mode === "explore") {
    if (inspectPanel) inspectPanel.classList.remove("hidden");
    if (nodeExtra) nodeExtra.classList.remove("hidden");
  }
  setTimeout(updateCanvasWires, 60);
}

function executeCanvasFlow() {
  const statusEl = document.getElementById("canvas-status");
  const runBtn = document.getElementById("canvas-run-btn");
  const wires = document.querySelectorAll(".canvas-wire");
  const outputImg = document.getElementById("output-result-img");
  const outputSpinner = document.getElementById("output-spinner");

  if (runBtn) runBtn.disabled = true;
  wires.forEach((w) => w.classList.add("wire-pulse", "stroke-sky-400"));

  const dict = window.I18N_DATA[currentLang] || window.I18N_DATA["zh-CN"];
  if (statusEl) {
    statusEl.innerHTML = `<span class="inline-block w-2 h-2 rounded-full bg-amber-400 animate-ping mr-2"></span>${dict.canvas_status_running}`;
    statusEl.className = "text-amber-400 text-xs font-mono flex items-center";
  }

  if (outputSpinner) outputSpinner.classList.remove("hidden");
  if (outputImg) outputImg.classList.add("opacity-25");

  setTimeout(() => {
    wires.forEach((w) => w.classList.remove("wire-pulse", "stroke-sky-400"));
    if (outputSpinner) outputSpinner.classList.add("hidden");
    if (outputImg) {
      outputImg.classList.remove("opacity-25");
      outputImg.classList.add("scale-105");
      setTimeout(() => outputImg.classList.remove("scale-105"), 300);
    }
    if (statusEl) {
      statusEl.innerHTML = `<span class="inline-block w-2 h-2 rounded-full bg-emerald-400 mr-2"></span>${dict.canvas_status_done}`;
      statusEl.className = "text-emerald-400 text-xs font-mono flex items-center";
    }
    if (runBtn) runBtn.disabled = false;
    showToast("🎉 ComfyUI 8188 任务渲染完毕！");
  }, 1200);
}

/* ==========================================================================
   4. Capability Matrix Interactive Switcher
   ========================================================================== */
const MATRIX_DATA = {
  t2i: {
    titleZh: "文生图 (Flux.1 / SDXL Turbo)",
    titleEn: "Text to Image (Flux.1 / SDXL Turbo)",
    slots: ["prompt", "seed", "width", "height", "steps", "cfg"],
    descZh: "极致画质与极速采样并存。节点自动根据模型特征挂载 LoRA 调节端口，UI 严格对齐硬件比例。",
    descEn: "Hyper-realistic image synthesis with rapid sampling. Dynamically mounts LoRA ports according to workflow definition.",
    badge: "Native ComfyUI"
  },
  i2i: {
    titleZh: "图生图 & 局部重绘 (Inpaint / Mask)",
    titleEn: "Image to Image & Inpaint (Mask)",
    slots: ["prompt", "denoise", "ref_image_01", "ref_mask", "grow_mask_by"],
    descZh: "画布内直接涂抹局部重绘遮罩，支持画中画合成与无缝扩图，反向传递给 ComfyUI KSampler 进行精准局部重构。",
    descEn: "Draw inpaint masks directly on canvas. Supports layered blending and seamless outpainting with KSampler precision.",
    badge: "LayerStyle"
  },
  video: {
    titleZh: "全能参考视频 (MiniMax H3 / Wan2.1)",
    titleEn: "Multimodal Video (MiniMax H3 / Wan2.1)",
    slots: ["prompt", "ref_image_01..09", "first_frame", "last_frame", "duration", "fps"],
    descZh: "严苛硬件尺寸对齐（0.2M~0.98M 9档预设）。最多支持 9 图 + 3 视频 + 3 音频多模态 FIFO 路由注入，未连满端口自动抹除防溢出。",
    descEn: "Strict hardware resolution alignment (0.2M~0.98M). Up to 9 images + 3 videos + 3 audio streams with dynamic pruning.",
    badge: "Multimodal Video Spec"
  },
  prompt: {
    titleZh: "提示词反推 & LLM 润色 (Qwen / kktools)",
    titleEn: "Prompt Interrogator & LLM (Qwen / kktools)",
    slots: ["input_image", "mode", "system_prompt", "output_text"],
    descZh: "本地视觉多模态大模型快速解析输入图像氛围感、光影构图与主体特征，一键生成结构化提示词流转至下游生图节点。",
    descEn: "Local vision models analyze aesthetics and composition, generating structured prompts seamlessly to downstream generators.",
    badge: "Comfyui-kktools"
  },
  custom: {
    titleZh: "自定义工作流 (Upload Any API JSON)",
    titleEn: "Custom Workflows (Upload Any API JSON)",
    slots: ["_meta.title 自由标记槽位", "自定义输入输出", "参数锁死模式"],
    descZh: "把你在 ComfyUI 原生连好的工作流导出为 API 格式并一键上传。只需在节点标题加标准词（如 prompt），画布秒级动态生成专属工具卡！",
    descEn: "Export your ComfyUI workflow as API JSON and upload instantly. Mark titles with keywords like 'prompt' to generate tailored UI cards.",
    badge: "Fail-loud Engine"
  }
};

function initCapabilityMatrix() {
  const buttons = document.querySelectorAll("[data-matrix-cat]");
  const titleEl = document.getElementById("matrix-card-title");
  const descEl = document.getElementById("matrix-card-desc");
  const badgeEl = document.getElementById("matrix-card-badge");
  const slotsContainer = document.getElementById("matrix-card-slots");

  if (!buttons.length || !titleEl) return;

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => {
        b.classList.remove("bg-sky-500/20", "text-sky-300", "border-sky-500/50");
        b.classList.add("text-zinc-400", "border-white/10");
      });
      btn.classList.add("bg-sky-500/20", "text-sky-300", "border-sky-500/50");
      btn.classList.remove("text-zinc-400", "border-white/10");

      const key = btn.getAttribute("data-matrix-cat");
      const item = MATRIX_DATA[key];
      if (!item) return;

      titleEl.textContent = currentLang === "zh-CN" ? item.titleZh : item.titleEn;
      descEl.textContent = currentLang === "zh-CN" ? item.descZh : item.descEn;
      badgeEl.textContent = item.badge;

      if (slotsContainer) {
        slotsContainer.innerHTML = item.slots
          .map(
            (slot) =>
              `<span class="px-2.5 py-1 text-xs font-mono rounded bg-white/5 border border-white/10 text-sky-300 flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-sky-400"></span>${slot}</span>`
          )
          .join("");
      }
    });
  });
}

/* ==========================================================================
   5. Quick Start Tabs & Code Copy
   ========================================================================== */
const QUICKSTART_CODES = {
  bun: `# 克隆仓库并进入 web 目录
git clone git@github.com:ZhuYichuan/infinite-canvas.git
cd infinite-canvas/web

# 安装依赖并启动本地开发服务 (支持 HMR)
bun install
bun run dev

# 浏览器访问 http://localhost:3000`,

  docker: `# 克隆仓库并直接通过 Docker 启动
git clone git@github.com:ZhuYichuan/infinite-canvas.git
cd infinite-canvas

# 一键启动前端静态容器 (默认端口 3000)
docker compose up -d

# 浏览器访问 http://localhost:3000`,

  prereq: `# 1. 本机确保已安装并启动原生 ComfyUI (默认 8188 端口)
python main.py --listen 127.0.0.1 --port 8188 --enable-cors-header

# 2. 安装 5 大核心依赖插件到 ComfyUI/custom_nodes:
# - Comfyui-kktools (文本生成/反推)
# - ComfyUI-KJNodes (全能视频组件处理)
# - ComfyLiterals (常数字面量)
# - ComfyUI-UniversalToolkit (通用工具解析)
# - ComfyUI_LayerStyle (图层与遮罩)`
};

function initQuickStartTabs() {
  const tabs = document.querySelectorAll("[data-code-tab]");
  const codeBlock = document.getElementById("quickstart-code-block");
  const copyBtn = document.getElementById("copy-code-btn");

  if (!tabs.length || !codeBlock) return;

  let activeTab = "bun";

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => {
        t.classList.remove("bg-white/10", "text-white", "border-sky-400/40");
        t.classList.add("text-zinc-400", "border-transparent");
      });
      tab.classList.add("bg-white/10", "text-white", "border-sky-400/40");
      tab.classList.remove("text-zinc-400", "border-transparent");

      activeTab = tab.getAttribute("data-code-tab");
      codeBlock.textContent = QUICKSTART_CODES[activeTab] || "";
    });
  });

  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      const code = codeBlock.textContent || "";
      navigator.clipboard.writeText(code).then(() => {
        const dict = window.I18N_DATA[currentLang] || window.I18N_DATA["zh-CN"];
        showToast(dict.copy_success);
      });
    });
  }
}

/* ==========================================================================
   6. Video Player / Placeholder Handling
   ========================================================================== */
function initVideoPlayer() {
  const playBtn = document.getElementById("hero-play-btn");
  const videoEl = document.getElementById("hero-video");
  const placeholderEl = document.getElementById("video-placeholder-modal");
  const closeModalBtn = document.getElementById("close-placeholder-modal");

  if (playBtn) {
    playBtn.addEventListener("click", () => {
      // Test if local video exists
      if (videoEl && videoEl.src && !videoEl.src.endsWith("undefined")) {
        videoEl.play().catch(() => {
          // If video fails or does not exist yet, show placeholder guidance modal
          if (placeholderEl) placeholderEl.classList.remove("hidden");
        });
      } else {
        if (placeholderEl) placeholderEl.classList.remove("hidden");
      }
    });
  }

  if (closeModalBtn && placeholderEl) {
    closeModalBtn.addEventListener("click", () => {
      placeholderEl.classList.add("hidden");
    });
  }
}

/* ==========================================================================
   7. Footer Easter Egg & Toast Notifications
   ========================================================================== */
function initFooterEasterEgg() {
  const eggBtn = document.getElementById("footer-egg-btn");
  if (eggBtn) {
    eggBtn.addEventListener("click", () => {
      const dict = window.I18N_DATA[currentLang] || window.I18N_DATA["zh-CN"];
      showToast(dict.footer_quote_bubble);
      eggBtn.classList.add("rotate-180");
      setTimeout(() => eggBtn.classList.remove("rotate-180"), 400);
    });
  }
}

function showToast(message) {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = "toast-msg";
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(8px)";
    setTimeout(() => toast.remove(), 250);
  }, 2600);
}
