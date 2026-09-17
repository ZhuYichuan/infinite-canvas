/**
 * infinite-canvas Official Website - High-Fidelity TinyKPI Interactivity
 */

document.addEventListener("DOMContentLoaded", () => {
  initI18n();
  initTinyMascot();
  initLivingNotchStage();
  initEcosystemDashboard();
  initInteractiveLayoutGrid();
  initCountdownTimer();
  initVideoPlayer();
  initFooterCheckAgain();
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

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (dict[key]) el.textContent = dict[key];
  });

  document.querySelectorAll("[data-i18n-html]").forEach((el) => {
    const key = el.getAttribute("data-i18n-html");
    if (dict[key]) el.innerHTML = dict[key];
  });

  const langBtnText = document.getElementById("lang-btn-text");
  if (langBtnText) {
    langBtnText.textContent = currentLang === "zh-CN" ? "EN" : "中";
  }
}

/* ==========================================================================
   2. Interactive Mascot (Cursor Eye Tracking + Natural Blinking)
   ========================================================================== */
function initTinyMascot() {
  const mascot = document.getElementById("tiny-mascot");
  const leftSocket = document.getElementById("mascot-socket-left");
  const rightSocket = document.getElementById("mascot-socket-right");
  const leftPupil = document.getElementById("mascot-pupil-left");
  const rightPupil = document.getElementById("mascot-pupil-right");

  if (!mascot || !leftPupil || !rightPupil) return;

  // Eye tracking cursor
  window.addEventListener("mousemove", (e) => {
    const rect = mascot.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const angle = Math.atan2(dy, dx);
    const dist = Math.min(3.5, Math.hypot(dx, dy) / 35);

    const px = Math.cos(angle) * dist;
    const py = Math.sin(angle) * dist;

    leftPupil.style.transform = `translate(${px}px, ${py}px)`;
    rightPupil.style.transform = `translate(${px}px, ${py}px)`;
  });

  // Natural blinking
  setInterval(() => {
    if (leftSocket && rightSocket) {
      leftSocket.classList.add("blink");
      rightSocket.classList.add("blink");
      setTimeout(() => {
        leftSocket.classList.remove("blink");
        rightSocket.classList.remove("blink");
      }, 150);
    }
  }, 4000 + Math.random() * 2000);

  // Click mascot
  mascot.addEventListener("click", () => {
    showToast(currentLang === "zh-CN" ? "✨ 无限画布 8188 实时在线！" : "✨ ComfyUI 8188 online & ready!");
    mascot.classList.add("scale-110");
    setTimeout(() => mascot.classList.remove("scale-110"), 200);
  });
}

/* ==========================================================================
   3. Living Notch Device Stage (01 Glance / 02 Inspect / 03 Explore)
   ========================================================================== */
function initLivingNotchStage() {
  const stepBtns = document.querySelectorAll("[data-feature-step]");
  const sliderBar = document.getElementById("step-slider-track");
  const notchPill = document.getElementById("living-notch-pill");
  const glanceView = document.getElementById("stage-glance-view");
  const inspectView = document.getElementById("stage-inspect-view");
  const exploreView = document.getElementById("stage-explore-view");

  stepBtns.forEach((btn, idx) => {
    btn.addEventListener("click", () => {
      stepBtns.forEach((b) => {
        b.classList.remove("text-white");
        b.classList.add("text-zinc-400");
      });
      btn.classList.remove("text-zinc-400");
      btn.classList.add("text-white");

      if (sliderBar) {
        sliderBar.style.transform = `translateX(${idx * 100}%)`;
      }

      const step = btn.getAttribute("data-feature-step");
      if (step === "glance") {
        if (glanceView) glanceView.classList.remove("hidden");
        if (inspectView) inspectView.classList.add("hidden");
        if (exploreView) exploreView.classList.add("hidden");
        if (notchPill) notchPill.style.maxWidth = "360px";
      } else if (step === "inspect") {
        if (glanceView) glanceView.classList.add("hidden");
        if (inspectView) inspectView.classList.remove("hidden");
        if (exploreView) exploreView.classList.add("hidden");
        if (notchPill) notchPill.style.maxWidth = "480px";
      } else if (step === "explore") {
        if (glanceView) glanceView.classList.add("hidden");
        if (inspectView) inspectView.classList.add("hidden");
        if (exploreView) exploreView.classList.remove("hidden");
        if (notchPill) notchPill.style.maxWidth = "640px";
      }
    });
  });
}

/* ==========================================================================
   4. Ecosystem & Model Explorer ("Your tools. One view.")
   ========================================================================== */
const ECOSYSTEM_METRICS = {
  flux: {
    name: "Flux.1 Dev Turbo",
    category: "图像生成",
    speed: "1.8s",
    speedDiff: "+14.2%",
    images: "1,420",
    imagesDiff: "+9.8%",
    steps: "20",
    vram: "8.2 GB",
    alignment: "96.4%",
    activeFlows: "18",
    fps: "N/A",
    successRate: "99.4%"
  },
  minimax: {
    name: "MiniMax H3 / Wan2.1",
    category: "全能多模态视频",
    speed: "14.2s",
    speedDiff: "+22.5%",
    images: "386",
    imagesDiff: "+15.0%",
    steps: "35",
    vram: "15.4 GB",
    alignment: "98.1%",
    activeFlows: "6",
    fps: "24 fps",
    successRate: "98.8%"
  },
  sdxl: {
    name: "SDXL Lightning",
    category: "超快速出图",
    speed: "0.9s",
    speedDiff: "+35.1%",
    images: "4,820",
    imagesDiff: "+28.4%",
    steps: "8",
    vram: "5.8 GB",
    alignment: "91.2%",
    activeFlows: "24",
    fps: "N/A",
    successRate: "99.9%"
  },
  qwen: {
    name: "Qwen2.5-VL Interrogator",
    category: "视觉反推与提示词",
    speed: "1.2s",
    speedDiff: "+8.4%",
    images: "890",
    imagesDiff: "+12.1%",
    steps: "1",
    vram: "7.1 GB",
    alignment: "99.0%",
    activeFlows: "9",
    fps: "N/A",
    successRate: "99.6%"
  }
};

function initEcosystemDashboard() {
  const chips = document.querySelectorAll("[data-model-chip]");
  const titleEl = document.getElementById("eco-model-title");
  const speedEl = document.getElementById("metric-val-speed");
  const countEl = document.getElementById("metric-val-count");
  const vramEl = document.getElementById("metric-val-vram");
  const alignEl = document.getElementById("metric-val-align");

  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      chips.forEach((c) => {
        c.classList.remove("bg-white/10", "border-sky-400/50", "text-sky-300");
        c.classList.add("text-zinc-400", "border-white/5");
      });
      chip.classList.add("bg-white/10", "border-sky-400/50", "text-sky-300");
      chip.classList.remove("text-zinc-400", "border-white/5");

      const key = chip.getAttribute("data-model-chip");
      const data = ECOSYSTEM_METRICS[key];
      if (!data) return;

      if (titleEl) titleEl.textContent = data.name;
      if (speedEl) speedEl.textContent = data.speed;
      if (countEl) countEl.textContent = data.images;
      if (vramEl) vramEl.textContent = data.vram;
      if (alignEl) alignEl.textContent = data.alignment;
    });
  });
}

/* ==========================================================================
   5. Interactive Layout Grid (TinyKPI Move / Resize Arrows)
   ========================================================================== */
function initInteractiveLayoutGrid() {
  const grid = document.getElementById("interactive-layout-grid");
  const resetBtn = document.getElementById("layout-reset-btn");
  const addCardBtn = document.getElementById("layout-add-btn");

  if (!grid) return;

  // Delegate clicks for Wider/Narrower and Taller/Shorter buttons
  grid.addEventListener("click", (e) => {
    const tile = e.target.closest(".layout-tile");
    if (!tile) return;

    // Remove button
    if (e.target.closest(".btn-remove-tile")) {
      tile.remove();
      return;
    }

    // Toggle width (span 1 <-> span 2)
    if (e.target.closest(".btn-toggle-width")) {
      if (tile.classList.contains("col-span-2")) {
        tile.classList.remove("col-span-2");
        tile.classList.add("col-span-1");
      } else {
        tile.classList.remove("col-span-1");
        tile.classList.add("col-span-2");
      }
      updateTileSizeLabel(tile);
    }

    // Toggle height (row span 1 <-> row span 2)
    if (e.target.closest(".btn-toggle-height")) {
      if (tile.classList.contains("row-span-2")) {
        tile.classList.remove("row-span-2");
        tile.classList.add("row-span-1");
      } else {
        tile.classList.remove("row-span-1");
        tile.classList.add("row-span-2");
      }
      updateTileSizeLabel(tile);
    }
  });

  // Reset button
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      showToast(currentLang === "zh-CN" ? "画布网格已重置" : "Layout grid reset");
      location.reload();
    });
  }

  // Add card button
  if (addCardBtn) {
    addCardBtn.addEventListener("click", () => {
      const newCard = document.createElement("div");
      newCard.className = "layout-tile col-span-1 row-span-1";
      newCard.innerHTML = `
        <div class="flex items-center justify-between text-xs text-zinc-300 font-semibold">
          <span class="flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>自定义参数节点</span>
        </div>
        <p class="text-[11px] text-zinc-400 my-2">动态挂载至 ComfyUI 8188 槽位</p>
        <div class="tile-toolbar">
          <button class="tile-btn btn-remove-tile" title="删除"><svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
          <button class="tile-btn btn-toggle-width" title="改变宽度"><svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3m8-18h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3"/></svg></button>
          <span class="tile-size-tag text-[10px] font-mono text-zinc-500">1 × 1</span>
          <button class="tile-btn btn-toggle-height" title="改变高度"><svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 8V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3m-18 8v3a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3"/></svg></button>
        </div>
      `;
      grid.appendChild(newCard);
    });
  }
}

function updateTileSizeLabel(tile) {
  const isCol2 = tile.classList.contains("col-span-2");
  const isRow2 = tile.classList.contains("row-span-2");
  const tag = tile.querySelector(".tile-size-tag");
  if (tag) {
    tag.textContent = `${isCol2 ? 2 : 1} × ${isRow2 ? 2 : 1}`;
  }
}

/* ==========================================================================
   6. Countdown Timer (TinyKPI Launch Offer Timer)
   ========================================================================== */
function initCountdownTimer() {
  const timerEl = document.getElementById("offer-countdown");
  if (!timerEl) return;

  // 6 days, 11 hours, 45 minutes target
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + 6);
  targetDate.setHours(targetDate.getHours() + 11);

  function update() {
    const now = new Date();
    const diff = targetDate - now;
    if (diff <= 0) {
      timerEl.textContent = "00:00:00";
      return;
    }

    const d = Math.floor(diff / (1000 * 60 * 60 * 24));
    const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const m = Math.floor((diff / 1000 / 60) % 60);
    const s = Math.floor((diff / 1000) % 60);

    timerEl.textContent = currentLang === "zh-CN"
      ? `${d} 天 ${h} 小时 ${m} 分 ${s} 秒`
      : `${d}d ${h}h ${m}m ${s}s`;
  }

  update();
  setInterval(update, 1000);
}

/* ==========================================================================
   7. Video Player & Graceful Placeholder
   ========================================================================== */
function initVideoPlayer() {
  const playBtn = document.getElementById("hero-video-play");
  const modal = document.getElementById("video-modal");
  const closeBtn = document.getElementById("video-modal-close");

  if (playBtn && modal) {
    playBtn.addEventListener("click", () => {
      modal.classList.remove("hidden");
    });
  }

  if (closeBtn && modal) {
    closeBtn.addEventListener("click", () => {
      modal.classList.add("hidden");
    });
  }
}

/* ==========================================================================
   8. Footer "Check Again" Button (TinyKPI Humorous Easter Egg)
   ========================================================================== */
function initFooterCheckAgain() {
  const checkBtn = document.getElementById("footer-recheck-btn");
  const replyEl = document.getElementById("footer-recheck-reply");

  if (checkBtn && replyEl) {
    checkBtn.addEventListener("click", () => {
      checkBtn.querySelector("svg")?.classList.add("rotate-180");
      replyEl.textContent = currentLang === "zh-CN" ? "纯粹为了激发艺术灵感。" : "Strictly for artistic inspiration.";
      showToast(currentLang === "zh-CN" ? "正在检查 127.0.0.1:8188 队列..." : "Checking 127.0.0.1:8188 queue...");
      setTimeout(() => {
        checkBtn.querySelector("svg")?.classList.remove("rotate-180");
      }, 400);
    });
  }
}

/* Helper Toast Notification */
function showToast(msg) {
  let box = document.getElementById("toast-box");
  if (!box) {
    box = document.createElement("div");
    box.id = "toast-box";
    document.body.appendChild(box);
  }

  const toast = document.createElement("div");
  toast.className = "px-4 py-2.5 rounded-xl bg-zinc-900 border border-white/15 text-white text-xs shadow-2xl backdrop-blur-md mb-2 flex items-center gap-2";
  toast.innerHTML = `<span class="w-2 h-2 rounded-full bg-sky-400"></span>${msg}`;
  box.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transition = "opacity 0.3s";
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}
