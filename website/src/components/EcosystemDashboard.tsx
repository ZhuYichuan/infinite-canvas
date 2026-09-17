import React, { useState } from 'react';
import { ECOSYSTEM_MODELS } from '../data/ecosystem';

interface EcosystemDashboardProps {
  t: (key: string) => string;
}

export const EcosystemDashboard: React.FC<EcosystemDashboardProps> = ({ t }) => {
  const [selectedModel, setSelectedModel] = useState('flux');
  const data = ECOSYSTEM_MODELS[selectedModel] || ECOSYSTEM_MODELS.flux;

  return (
    <section id="ecosystem" className="py-20 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="mb-10">
        <span className="text-xs font-mono text-zinc-500 uppercase tracking-wider block mb-2">
          {t('eco_eyebrow')}
        </span>
        <h3 className="text-3xl font-extrabold text-white">{t('eco_title')}</h3>
        <p className="text-sm text-zinc-400 mt-2">{t('eco_desc')}</p>
      </div>

      {/* Model Chips */}
      <div className="flex flex-wrap gap-2 mb-8">
        <button
          type="button"
          onClick={() => setSelectedModel('flux')}
          className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
            selectedModel === 'flux'
              ? 'border-sky-400/50 bg-white/10 text-sky-300'
              : 'border-white/5 text-zinc-400 hover:text-white'
          }`}
        >
          Flux.1 Turbo
        </button>
        <button
          type="button"
          onClick={() => setSelectedModel('minimax')}
          className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
            selectedModel === 'minimax'
              ? 'border-sky-400/50 bg-white/10 text-sky-300'
              : 'border-white/5 text-zinc-400 hover:text-white'
          }`}
        >
          MiniMax H3 Video
        </button>
        <button
          type="button"
          onClick={() => setSelectedModel('sdxl')}
          className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
            selectedModel === 'sdxl'
              ? 'border-sky-400/50 bg-white/10 text-sky-300'
              : 'border-white/5 text-zinc-400 hover:text-white'
          }`}
        >
          SDXL Lightning
        </button>
        <button
          type="button"
          onClick={() => setSelectedModel('qwen')}
          className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
            selectedModel === 'qwen'
              ? 'border-sky-400/50 bg-white/10 text-sky-300'
              : 'border-white/5 text-zinc-400 hover:text-white'
          }`}
        >
          Qwen2.5-VL
        </button>
      </div>

      {/* Live Metric Grid Dashboard */}
      <div className="rounded-2xl bg-[#0f0f14] border border-white/10 p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-5 border-b border-white/5 mb-6">
          <div>
            <strong className="text-base text-white font-bold">{data.name}</strong>
            <span className="text-xs text-zinc-500 block">ComfyUI 8188 · Local Direct</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
            <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-sky-400">30d</span>
            <span>Today</span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {/* Tile 1: Speed with Sparkline */}
          <div className="bg-[#141419] border border-white/10 rounded-xl p-4 col-span-2">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-zinc-400 font-medium">生成耗时 (Sampling Time)</span>
              <b className="text-emerald-400">{data.speedDiff}</b>
            </div>
            <div className="text-2xl font-bold text-white mb-2">{data.speed}</div>
            <svg className="w-full h-12 overflow-visible" viewBox="0 0 180 50">
              <polyline points="2,40 25,32 50,36 75,25 100,20 125,24 150,14 178,8" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" />
              <circle cx="178" cy="8" r="2.5" fill="#38bdf8" />
            </svg>
          </div>

          {/* Tile 2: Count with Sparkline */}
          <div className="bg-[#141419] border border-white/10 rounded-xl p-4 col-span-2">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-zinc-400 font-medium">已渲染图像 (Images Count)</span>
              <b className="text-emerald-400">{data.imagesDiff}</b>
            </div>
            <div className="text-2xl font-bold text-white mb-2">{data.images}</div>
            <svg className="w-full h-12 overflow-visible" viewBox="0 0 180 50">
              <polyline points="2,38 25,30 50,33 75,22 100,26 125,18 150,15 178,6" fill="none" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" />
              <circle cx="178" cy="6" r="2.5" fill="#818cf8" />
            </svg>
          </div>

          {/* Tile 3 */}
          <div className="bg-[#141419] border border-white/10 rounded-xl p-4">
            <span className="text-xs text-zinc-400 block mb-1">显存峰值 (VRAM)</span>
            <strong className="text-xl text-white font-bold">{data.vram}</strong>
          </div>

          {/* Tile 4 */}
          <div className="bg-[#141419] border border-white/10 rounded-xl p-4">
            <span className="text-xs text-zinc-400 block mb-1">提示词对齐率</span>
            <strong className="text-xl text-white font-bold">{data.alignment}</strong>
          </div>

          {/* Tile 5 */}
          <div className="bg-[#141419] border border-white/10 rounded-xl p-4">
            <span className="text-xs text-zinc-400 block mb-1">多模态参考插槽</span>
            <strong className="text-xl text-white font-bold">9 图 + 3 视</strong>
          </div>

          {/* Tile 6 */}
          <div className="bg-[#141419] border border-white/10 rounded-xl p-4">
            <span className="text-xs text-zinc-400 block mb-1">任务成功率</span>
            <strong className="text-xl text-emerald-400 font-bold">{data.successRate}</strong>
          </div>
        </div>
      </div>
    </section>
  );
};
