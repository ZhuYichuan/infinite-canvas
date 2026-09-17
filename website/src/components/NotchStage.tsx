import React, { useState } from 'react';
import type { FeatureStep } from '../types';

interface NotchStageProps {
  t: (key: string) => string;
}

const GLANCE_PRESETS = [
  {
    id: 'cyber',
    label: '赛博朋克雨夜',
    prompt: '赛博朋克雨夜街道，霓虹积水倒影，超写实 8K 质感，电影级景深。',
    time: '0.8s',
    gradient: 'from-blue-950 via-indigo-950 to-purple-900',
    accent: '#38bdf8',
    detail: '丁达尔体积光 · 电影感焦外虚化',
  },
  {
    id: 'oriental',
    label: '新中式水墨意境',
    prompt: '新中式东方美学，青绿山水云雾缭绕，仙鹤飞掠，水墨淡雅笔触。',
    time: '0.8s',
    gradient: 'from-emerald-950 via-teal-950 to-stone-900',
    accent: '#34d399',
    detail: '宣纸纹理质感 · 留白构图意境',
  },
  {
    id: 'mecha',
    label: '黑金机甲光影',
    prompt: '未来机甲概念设计，黑金磨砂装甲，橙色动力核心发光，工业机械结构。',
    time: '0.8s',
    gradient: 'from-amber-950 via-zinc-950 to-stone-900',
    accent: '#fbbf24',
    detail: '硬表面建模细节 · 电动光芒反射',
  },
];

const INSPECT_SLOTS = [
  {
    id: 'prompt',
    title: '_meta.title = "prompt"',
    name: '正向提示词输入框',
    candidate: 'value / text / prompt',
    desc: '动态探测多行文本输入，未标记则自动退化为后台常量，不污染前端界面。',
  },
  {
    id: 'seed',
    title: '_meta.title = "seed"',
    name: '随机种子生成器',
    candidate: 'seed / noise_seed',
    desc: '自动绑定 ComfyUI 随机数发生器，支持一键锁定、随机骰子与重现。',
  },
  {
    id: 'ref_image',
    title: '_meta.title = "ref_image_01"',
    name: '多模态参考图槽位',
    candidate: 'image / ref_image',
    desc: '支持最多 9 图有序注入，未接入的空插槽在提交前自动剔除并抹除桥接节点。',
  },
  {
    id: 'ref_mask',
    title: '_meta.title = "ref_mask"',
    name: '局部重绘遮罩层',
    candidate: 'mask / ref_mask',
    desc: '直连 ComfyUI_LayerStyle 图层合成，无缝支持画板涂抹蒙版反向同步。',
  },
  {
    id: 'size',
    title: '_meta.title = "width / height"',
    name: '硬件分辨率锁死预设',
    candidate: 'width / height / size',
    desc: '收敛为 16:9 与 9:16 对称预设，严禁手动数字越界，上限锁死在 0.98 MP。',
  },
];

export const NotchStage: React.FC<NotchStageProps> = ({ t }) => {
  const [step, setStep] = useState<FeatureStep>('glance');

  // Glance mode state
  const [glancePreset, setGlancePreset] = useState(0);
  const [isGlanceRunning, setIsGlanceRunning] = useState(false);
  const [glanceProgress, setGlanceProgress] = useState(0);

  // Inspect mode state
  const [activeSlotId, setActiveSlotId] = useState('prompt');

  // Explore mode state
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulatedLog, setSimulatedLog] = useState('等待执行多模态调度...');

  const getTrackIndex = () => {
    if (step === 'glance') return 0;
    if (step === 'inspect') return 1;
    return 2;
  };

  const handleRunGlance = () => {
    if (isGlanceRunning) return;
    setIsGlanceRunning(true);
    setGlanceProgress(15);

    const timer = setInterval(() => {
      setGlanceProgress((p) => {
        if (p >= 90) {
          clearInterval(timer);
          return 90;
        }
        return p + 25;
      });
    }, 180);

    setTimeout(() => {
      clearInterval(timer);
      setGlanceProgress(100);
      setTimeout(() => {
        setIsGlanceRunning(false);
        setGlanceProgress(0);
      }, 300);
    }, 900);
  };

  const handleSimulateExplore = () => {
    if (isSimulating) return;
    setIsSimulating(true);
    setSimulatedLog('① 正在读取素材组 (Group) 内 2 图 + 1 视...');

    setTimeout(() => {
      setSimulatedLog('② 自动解包为 ref_image_01..02 与 ref_video_01 并抹除空槽位...');
    }, 600);

    setTimeout(() => {
      setSimulatedLog('③ 尺寸锁定 16:9 (0.98 MP)，正在调用 MiniMax H3 双轨生成...');
    }, 1200);

    setTimeout(() => {
      setSimulatedLog('✅ 调度成功！已完成全能视频渲染（已输出音画同步产物）');
      setIsSimulating(false);
    }, 1900);
  };

  const currentGlance = GLANCE_PRESETS[glancePreset];
  const activeSlot = INSPECT_SLOTS.find((s) => s.id === activeSlotId) || INSPECT_SLOTS[0];

  return (
    <section id="features" className="py-20 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div>
          <span className="text-xs font-mono text-[#86868b] uppercase tracking-wider block mb-2">
            {t('features_eyebrow')}
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#111113] leading-tight">
            {t('features_title_line1')}
            <br />
            <span className="text-[#6e6e73] font-normal">{t('features_title_line2')}</span>
          </h2>
          <p className="text-sm text-[#6e6e73] mt-2">{t('features_desc')}</p>
        </div>

        {/* 3-Step Slider Switcher (Glance / Inspect / Explore) */}
        <div className="relative flex items-center bg-zinc-900/90 border border-white/10 rounded-xl p-1 text-xs select-none">
          <button
            type="button"
            onClick={() => setStep('glance')}
            className={`px-4 py-2 font-medium flex flex-col items-start z-10 transition-colors cursor-pointer ${
              step === 'glance' ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <span className="text-[10px] font-mono text-sky-400">01</span>
            <strong>{t('step1_title')}</strong>
            <small className="text-zinc-500">预设工具化卡片</small>
          </button>
          <button
            type="button"
            onClick={() => setStep('inspect')}
            className={`px-4 py-2 font-medium flex flex-col items-start z-10 transition-colors cursor-pointer ${
              step === 'inspect' ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <span className="text-[10px] font-mono text-sky-400">02</span>
            <strong>{t('step2_title')}</strong>
            <small className="text-zinc-500">槽位动态驱动 UI</small>
          </button>
          <button
            type="button"
            onClick={() => setStep('explore')}
            className={`px-4 py-2 font-medium flex flex-col items-start z-10 transition-colors cursor-pointer ${
              step === 'explore' ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <span className="text-[10px] font-mono text-sky-400">03</span>
            <strong>{t('step3_title')}</strong>
            <small className="text-zinc-500">多模态流图调度</small>
          </button>

          {/* Active Track Bar */}
          <div
            className="absolute bottom-0 h-0.5 bg-sky-400 rounded-full transition-transform duration-300 w-1/3"
            style={{ transform: `translateX(${getTrackIndex() * 100}%)` }}
          />
        </div>
      </header>

      {/* Simulated Mac Screen Stage Container */}
      <div className="mac-stage min-h-[500px] flex flex-col bg-[#0b0b10] border border-white/10 rounded-2xl overflow-hidden shadow-2xl relative select-none">
        {/* Menubar */}
        <div className="h-8 px-5 bg-zinc-950/85 border-b border-white/5 flex items-center justify-between text-[11px] text-zinc-400 z-30 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <span className="text-white text-xs"></span>
            <span className="font-semibold text-white">{t('mac_finder')}</span>
            <span>{t('mac_file')}</span>
            <span>{t('mac_edit')}</span>
            <span>{t('mac_view')}</span>
            <span className="text-sky-400 font-mono">ComfyUI 8188</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-emerald-400 font-mono">● 127.0.0.1:8188 直连中</span>
            <span className="text-zinc-300">{t('mac_clock')}</span>
          </div>
        </div>

        {/* Physical Notch Cutout */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-44 h-7 bg-black rounded-b-xl z-30 flex items-center justify-center pointer-events-none">
          <div className="w-2.5 h-2.5 rounded-full bg-zinc-900 border border-white/10" />
        </div>

        {/* Living Notch / Interactive Metrics Widget Inside */}
        <div
          className="living-notch-pill"
          style={{
            maxWidth: step === 'glance' ? '380px' : step === 'inspect' ? '500px' : '580px',
          }}
        >
          <div className="flex flex-col items-start">
            <span className="text-sm font-bold text-white">0.8s</span>
            <span className="text-[10px] text-zinc-400 flex items-center gap-0.5">
              <span>Z-Image Turbo</span>
              <span className="text-emerald-400">↑ 28%</span>
            </span>
          </div>

          <div className="w-6 h-6 rounded-lg bg-zinc-800 border border-white/20 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-sky-400 pulse-subtle" />
          </div>

          <div className="flex flex-col items-end">
            <span className="text-sm font-bold text-white">6.4G</span>
            <span className="text-[10px] text-zinc-400 flex items-center gap-0.5">
              <span>显存占用</span>
              <span className="text-sky-400">峰值</span>
            </span>
          </div>
        </div>

        {/* Dynamic Stage Body Content */}
        <div className="flex-1 flex items-center justify-center p-6 sm:p-8 relative">
          {/* ========================================================
              TAB 1: 概览模式 (Glance Mode) - 预设工具化卡片
             ======================================================== */}
          {step === 'glance' && (
            <div className="w-full max-w-2xl grid grid-cols-1 md:grid-cols-2 gap-5 items-stretch">
              {/* Left: Preset Node Card */}
              <div className="rounded-xl bg-zinc-900/90 border border-white/15 p-4 shadow-2xl backdrop-blur-md flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-white/5 mb-3">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-sky-400" />
                      <strong className="text-xs text-white">Z-Image Turbo 预设节点</strong>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-400">8188 极速</span>
                  </div>

                  <p className="text-[11px] text-zinc-400 mb-3 leading-relaxed">
                    底层采样器、步数与模型已被锁死，仅暴露关键提示词，实现工具化即开即用：
                  </p>

                  {/* Preset Chips */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {GLANCE_PRESETS.map((p, idx) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setGlancePreset(idx)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                          glancePreset === idx
                            ? 'bg-sky-500/20 text-sky-300 border border-sky-400/40 shadow-sm'
                            : 'bg-white/5 text-zinc-400 hover:text-white border border-white/5'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  <div className="p-2.5 rounded-lg bg-black/50 border border-white/10 text-xs text-zinc-300 font-sans leading-relaxed mb-3">
                    {currentGlance.prompt}
                  </div>
                </div>

                {/* Progress bar */}
                {isGlanceRunning && (
                  <div className="mb-2">
                    <div className="flex justify-between text-[10px] font-mono text-sky-400 mb-1">
                      <span>ComfyUI 跑图中...</span>
                      <span>{glanceProgress}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-sky-400 to-emerald-400 transition-all duration-150"
                        style={{ width: `${glanceProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Action button */}
                <button
                  type="button"
                  onClick={handleRunGlance}
                  disabled={isGlanceRunning}
                  className={`w-full py-2.5 rounded-lg font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-md ${
                    isGlanceRunning
                      ? 'bg-zinc-800 text-zinc-400 cursor-not-allowed'
                      : 'bg-sky-500 hover:bg-sky-400 text-white active:scale-98'
                  }`}
                >
                  {isGlanceRunning ? (
                    <>
                      <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" strokeDasharray="30" strokeDashoffset="10" />
                      </svg>
                      <span>采样计算中...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                      <span>极速生成 ({currentGlance.time})</span>
                    </>
                  )}
                </button>
              </div>

              {/* Right: Output Artwork Card */}
              <div
                className={`rounded-xl bg-gradient-to-br ${currentGlance.gradient} border border-white/15 p-4 shadow-2xl flex flex-col justify-between relative overflow-hidden transition-all duration-500`}
              >
                <div className="flex justify-between items-center text-[10px] font-mono">
                  <span className="px-2 py-0.5 rounded bg-black/60 text-white font-bold backdrop-blur-md">
                    {currentGlance.label}
                  </span>
                  <span className="text-zinc-300 bg-black/60 px-2 py-0.5 rounded">
                    1088 × 1920 (9:16)
                  </span>
                </div>

                <div className="my-auto text-center py-6">
                  <div className="w-12 h-12 mx-auto rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center mb-2 shadow-inner border border-white/20">
                    <span className="text-xl">✨</span>
                  </div>
                  <strong className="text-sm font-bold text-white block">
                    {currentGlance.label}
                  </strong>
                  <p className="text-[11px] text-zinc-300 mt-1 opacity-90 leading-snug">
                    {currentGlance.detail}
                  </p>
                </div>

                <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 bg-black/60 px-2.5 py-1.5 rounded backdrop-blur-sm">
                  <span>采样器: euler · 8步</span>
                  <span className="text-emerald-400">已就绪 (0.8s)</span>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================
              TAB 2: 检查模式 (Inspect Mode) - 工作流槽位驱动 UI
             ======================================================== */}
          {step === 'inspect' && (
            <div className="w-full max-w-2xl grid grid-cols-1 md:grid-cols-2 gap-5 items-stretch">
              {/* Left: Slot Parser Inspector */}
              <div className="rounded-xl bg-zinc-900/90 border border-white/15 p-4 shadow-2xl backdrop-blur-md flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-white/5 mb-3">
                    <strong className="text-xs text-white">ComfyUI 槽位标注契约</strong>
                    <span className="text-[10px] font-mono text-sky-400">_meta.title 匹配</span>
                  </div>

                  <p className="text-[11px] text-zinc-400 mb-3">
                    点击测试不同标注槽位，右侧画布卡片将动态自适应呈现：
                  </p>

                  <div className="space-y-1.5">
                    {INSPECT_SLOTS.map((s) => {
                      const isActive = activeSlotId === s.id;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setActiveSlotId(s.id)}
                          className={`w-full text-left p-2 rounded-lg text-xs font-mono transition-all flex items-center justify-between cursor-pointer ${
                            isActive
                              ? 'bg-sky-500/20 text-white border border-sky-400/50 shadow-md'
                              : 'bg-white/[0.02] text-zinc-400 hover:text-white hover:bg-white/5 border border-white/5'
                          }`}
                        >
                          <span className="truncate">{s.title}</span>
                          <span className={`text-[10px] ${isActive ? 'text-sky-300' : 'text-zinc-500'}`}>
                            {isActive ? '● 正在映射 →' : s.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-3 p-2.5 rounded-lg bg-black/50 border border-white/5 text-[11px] text-zinc-400">
                  <span className="text-sky-300 font-mono block mb-0.5">
                    探测候选名: {activeSlot.candidate}
                  </span>
                  <span>{activeSlot.desc}</span>
                </div>
              </div>

              {/* Right: Dynamic Adaptive Canvas Node */}
              <div className="rounded-xl bg-zinc-950/90 border border-white/15 p-4 shadow-2xl backdrop-blur-md flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-white/5 mb-3">
                    <span className="flex items-center gap-1.5 text-xs text-white font-semibold">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span>工作流驱动动态卡片</span>
                    </span>
                    <span className="text-[10px] font-mono text-zinc-500">“未标记 = 不可用”</span>
                  </div>

                  {/* Adaptive Inputs with Glow Highlights */}
                  <div className="space-y-3">
                    {/* Prompt input */}
                    <div
                      className={`p-2 rounded-lg border transition-all ${
                        activeSlotId === 'prompt'
                          ? 'bg-sky-500/10 border-sky-400 ring-2 ring-sky-400/20'
                          : 'bg-white/[0.02] border-white/5 opacity-70'
                      }`}
                    >
                      <div className="flex justify-between text-[10px] font-mono mb-1">
                        <span className="text-sky-300">提示词输入端口 (prompt)</span>
                        <span className="text-zinc-500">多行文本</span>
                      </div>
                      <p className="text-xs text-zinc-200">"超写实细节视觉艺术，大师级构图..."</p>
                    </div>

                    {/* Seed input */}
                    <div
                      className={`p-2 rounded-lg border transition-all ${
                        activeSlotId === 'seed'
                          ? 'bg-sky-500/10 border-sky-400 ring-2 ring-sky-400/20'
                          : 'bg-white/[0.02] border-white/5 opacity-70'
                      }`}
                    >
                      <div className="flex justify-between text-[10px] font-mono">
                        <span className="text-sky-300">随机种子 (seed)</span>
                        <span className="text-zinc-200 font-mono">928104812</span>
                      </div>
                    </div>

                    {/* Ref image slot */}
                    <div
                      className={`p-2 rounded-lg border transition-all ${
                        activeSlotId === 'ref_image'
                          ? 'bg-sky-500/10 border-sky-400 ring-2 ring-sky-400/20'
                          : 'bg-white/[0.02] border-white/5 opacity-70'
                      }`}
                    >
                      <div className="flex justify-between text-[10px] font-mono">
                        <span className="text-sky-300">参考插槽 (ref_image_01)</span>
                        <span className="text-emerald-400">已连接素材</span>
                      </div>
                    </div>

                    {/* Mask layer */}
                    <div
                      className={`p-2 rounded-lg border transition-all ${
                        activeSlotId === 'ref_mask'
                          ? 'bg-sky-500/10 border-sky-400 ring-2 ring-sky-400/20'
                          : 'bg-white/[0.02] border-white/5 opacity-70'
                      }`}
                    >
                      <div className="flex justify-between text-[10px] font-mono">
                        <span className="text-sky-300">图层遮罩 (ref_mask)</span>
                        <span className="text-indigo-300">LayerStyle 联动</span>
                      </div>
                    </div>

                    {/* Width / Height locked */}
                    <div
                      className={`p-2 rounded-lg border transition-all ${
                        activeSlotId === 'size'
                          ? 'bg-sky-500/10 border-sky-400 ring-2 ring-sky-400/20'
                          : 'bg-white/[0.02] border-white/5 opacity-70'
                      }`}
                    >
                      <div className="flex justify-between text-[10px] font-mono">
                        <span className="text-sky-300">硬件尺寸锁定</span>
                        <span className="text-zinc-300 font-mono">16:9 (0.98 MP)</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-2 text-[10px] font-mono text-zinc-500 text-center">
                  Fail-Loud 机制：槽位命名冲突或未对齐时即时显式报错
                </div>
              </div>
            </div>
          )}

          {/* ========================================================
              TAB 3: 拓扑模式 (Explore Mode) - 全能视频多模态流图调度
             ======================================================== */}
          {step === 'explore' && (
            <div className="w-full max-w-2xl flex flex-col gap-4">
              {/* Header Badge */}
              <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
                <span className="font-mono text-sky-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                  <span>MiniMax H3 全能多模态参考视频流图 (9图 + 3视 + 3音)</span>
                </span>
                <span className="text-[11px] font-mono text-zinc-500">FIFO 顺序路由</span>
              </div>

              {/* Topology Visual Representation */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                {/* 1. Group Node (Virtual Container) */}
                <div className="rounded-xl bg-black/60 border border-white/10 p-3.5 shadow-xl text-left">
                  <div className="flex items-center justify-between text-xs text-amber-300 font-semibold mb-2">
                    <span className="flex items-center gap-1">
                      <span>📁</span>
                      <span>素材组 (Group)</span>
                    </span>
                    <span className="text-[9px] font-mono text-zinc-400 bg-white/5 px-1.5 py-0.5 rounded">
                      虚拟容器
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-400 leading-snug mb-2">
                    无需单独拉数十条连线，组节点自动解包内部所有资源：
                  </p>
                  <div className="space-y-1 text-[10px] font-mono">
                    <div className="p-1 rounded bg-white/5 text-zinc-300 flex justify-between">
                      <span>🖼️ 人物主体图</span>
                      <span className="text-zinc-500">01</span>
                    </div>
                    <div className="p-1 rounded bg-white/5 text-zinc-300 flex justify-between">
                      <span>🖼️ 场景氛围图</span>
                      <span className="text-zinc-500">02</span>
                    </div>
                    <div className="p-1 rounded bg-white/5 text-zinc-300 flex justify-between">
                      <span>🎥 动作参考视频</span>
                      <span className="text-sky-300">01</span>
                    </div>
                  </div>
                </div>

                {/* 2. Center Dynamic Router Pipeline */}
                <div className="flex flex-col items-center justify-center p-3 text-center space-y-2">
                  <div className="w-full flex items-center justify-center gap-1 text-sky-400 font-mono text-xs">
                    <span className="h-px flex-1 bg-gradient-to-r from-transparent to-sky-400" />
                    <span className="px-2 py-0.5 rounded bg-sky-500/10 border border-sky-400/30 text-[10px]">
                      动态解包与 FIFO 映射
                    </span>
                    <span className="h-px flex-1 bg-gradient-to-l from-transparent to-sky-400" />
                  </div>
                  <p className="text-[10px] text-zinc-400 leading-tight">
                    自动剔除未连满插槽，抹除 GetVideoComponents 级联桥接
                  </p>
                  <button
                    type="button"
                    onClick={handleSimulateExplore}
                    disabled={isSimulating}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-md ${
                      isSimulating
                        ? 'bg-zinc-800 text-zinc-400 cursor-not-allowed'
                        : 'bg-white text-zinc-950 hover:bg-zinc-200 active:scale-98'
                    }`}
                  >
                    {isSimulating ? '调度仿真中...' : '▶ 模拟多模态调度'}
                  </button>
                </div>

                {/* 3. Target MiniMax H3 Hub */}
                <div className="rounded-xl bg-black/60 border border-white/10 p-3.5 shadow-xl text-left">
                  <div className="flex items-center justify-between text-xs text-purple-300 font-semibold mb-2">
                    <span className="flex items-center gap-1">
                      <span>🎬</span>
                      <span>MiniMax H3 中枢</span>
                    </span>
                    <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                      硬件锁死
                    </span>
                  </div>
                  <div className="space-y-1 text-[10px] font-mono text-zinc-300">
                    <div className="flex justify-between p-1 rounded bg-white/5">
                      <span className="text-zinc-400">输出尺寸</span>
                      <strong className="text-white">16:9 (0.98 MP)</strong>
                    </div>
                    <div className="flex justify-between p-1 rounded bg-white/5">
                      <span className="text-zinc-400">音频 VAE</span>
                      <span className="text-sky-300">audio_vae_fp32</span>
                    </div>
                    <div className="flex justify-between p-1 rounded bg-white/5">
                      <span className="text-zinc-400">视频 VAE</span>
                      <span className="text-indigo-300">video_vae_fp16</span>
                    </div>
                  </div>
                  <div className="mt-2 text-[9px] font-mono text-zinc-500">
                    帧率锁定 24 FPS · 原生直连
                  </div>
                </div>
              </div>

              {/* Console log output */}
              <div className="p-2.5 rounded-lg bg-black/80 border border-white/10 font-mono text-[11px] text-sky-300 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-sky-400 shrink-0 animate-ping" />
                <span className="truncate">{simulatedLog}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
