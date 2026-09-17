import React, { useState } from 'react';
import type { FeatureStep } from '../types';

interface NotchStageProps {
  t: (key: string) => string;
}

export const NotchStage: React.FC<NotchStageProps> = ({ t }) => {
  const [step, setStep] = useState<FeatureStep>('glance');

  const getTrackIndex = () => {
    if (step === 'glance') return 0;
    if (step === 'inspect') return 1;
    return 2;
  };

  return (
    <section id="features" className="py-20 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div>
          <span className="text-xs font-mono text-zinc-500 uppercase tracking-wider block mb-2">
            {t('features_eyebrow')}
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white leading-tight">
            {t('features_title_line1')}
            <br />
            <span className="text-zinc-400">{t('features_title_line2')}</span>
          </h2>
          <p className="text-sm text-zinc-400 mt-2">{t('features_desc')}</p>
        </div>

        {/* 3-Step Slider Switcher (Glance / Inspect / Explore) */}
        <div className="relative flex items-center bg-zinc-900/90 border border-white/10 rounded-xl p-1 text-xs">
          <button
            type="button"
            onClick={() => setStep('glance')}
            className={`px-4 py-2 font-medium flex flex-col items-start z-10 transition-colors cursor-pointer ${
              step === 'glance' ? 'text-white' : 'text-zinc-400'
            }`}
          >
            <span className="text-[10px] font-mono text-sky-400">01</span>
            <strong>{t('step1_title')}</strong>
            <small className="text-zinc-500">{t('step1_sub')}</small>
          </button>
          <button
            type="button"
            onClick={() => setStep('inspect')}
            className={`px-4 py-2 font-medium flex flex-col items-start z-10 transition-colors cursor-pointer ${
              step === 'inspect' ? 'text-white' : 'text-zinc-400'
            }`}
          >
            <span className="text-[10px] font-mono text-sky-400">02</span>
            <strong>{t('step2_title')}</strong>
            <small className="text-zinc-500">{t('step2_sub')}</small>
          </button>
          <button
            type="button"
            onClick={() => setStep('explore')}
            className={`px-4 py-2 font-medium flex flex-col items-start z-10 transition-colors cursor-pointer ${
              step === 'explore' ? 'text-white' : 'text-zinc-400'
            }`}
          >
            <span className="text-[10px] font-mono text-sky-400">03</span>
            <strong>{t('step3_title')}</strong>
            <small className="text-zinc-500">{t('step3_sub')}</small>
          </button>

          {/* Active Track Bar */}
          <div
            className="absolute bottom-0 h-0.5 bg-sky-400 rounded-full transition-transform duration-300 w-1/3"
            style={{ transform: `translateX(${getTrackIndex() * 100}%)` }}
          />
        </div>
      </header>

      {/* Simulated Mac Screen Stage */}
      <div className="mac-stage h-[420px] flex flex-col">
        {/* Menubar */}
        <div className="h-8 px-5 bg-zinc-900/90 border-b border-white/5 flex items-center justify-between text-[11px] text-zinc-400">
          <span>Finder &nbsp; File &nbsp; Edit &nbsp; View &nbsp; ComfyUI</span>
          <span>Wed 9:41</span>
        </div>

        {/* Physical Notch Cutout */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-44 h-7 bg-black rounded-b-xl z-30 flex items-center justify-center">
          <div className="w-2.5 h-2.5 rounded-full bg-zinc-900 border border-white/10" />
        </div>

        {/* Living Notch / Interactive Widget Inside */}
        <div
          className="living-notch-pill"
          style={{
            maxWidth: step === 'glance' ? '360px' : step === 'inspect' ? '480px' : '620px',
          }}
        >
          <div className="flex flex-col items-start">
            <span className="text-sm font-bold text-white">1.8s</span>
            <span className="text-[10px] text-zinc-400 flex items-center gap-0.5">
              <span>Flux.1</span>
              <span className="text-emerald-400">↓ 12%</span>
            </span>
          </div>

          <div className="w-6 h-6 rounded-lg bg-zinc-800 border border-white/20 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-sky-400 pulse-subtle" />
          </div>

          <div className="flex flex-col items-end">
            <span className="text-sm font-bold text-white">8.2G</span>
            <span className="text-[10px] text-zinc-400 flex items-center gap-0.5">
              <span>VRAM</span>
              <span className="text-sky-400">↑ 5%</span>
            </span>
          </div>
        </div>

        {/* Stage Content */}
        <div className="flex-1 flex items-center justify-center p-8 relative">
          {step === 'glance' && (
            <div className="inline-block p-4 rounded-2xl bg-black/60 border border-white/10 backdrop-blur-md text-left transition-all">
              <span className="text-xs font-mono text-sky-400 block mb-1">01 Glance Node</span>
              <p className="text-xs text-zinc-300">Prompt: "Cyberpunk rain, neon shadows, 8k"</p>
              <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-500">
                <span>Sampler: euler</span>
                <span className="text-emerald-400 font-mono">Ready 8188</span>
              </div>
            </div>
          )}

          {step === 'inspect' && (
            <div className="w-full max-w-md p-4 rounded-2xl bg-black/70 border border-white/15 backdrop-blur-md space-y-2.5 text-xs transition-all">
              <div className="flex items-center justify-between text-zinc-400 font-mono">
                <span>_meta.title</span>
                <span className="text-sky-400">Dynamic Slot Inspector</span>
              </div>
              <div className="flex justify-between py-1 border-t border-white/5">
                <span className="text-zinc-400">prompt</span>
                <span className="text-zinc-200">"hyper-detailed visual art..."</span>
              </div>
              <div className="flex justify-between py-1 border-t border-white/5">
                <span className="text-zinc-400">seed</span>
                <span className="font-mono text-sky-300">928104812</span>
              </div>
              <div className="flex justify-between py-1 border-t border-white/5">
                <span className="text-zinc-400">steps / cfg</span>
                <span className="font-mono text-zinc-200">20 / 3.5</span>
              </div>
            </div>
          )}

          {step === 'explore' && (
            <div className="w-full max-w-xl grid grid-cols-3 gap-3 text-xs transition-all">
              <div className="p-3.5 rounded-xl bg-black/60 border border-white/10">
                <span className="text-sky-400 font-mono block text-[10px]">T2I Node</span>
                <p className="text-zinc-300 text-[11px] mt-1">Flux.1 Dev</p>
              </div>
              <div className="p-3.5 rounded-xl bg-black/60 border border-white/10">
                <span className="text-indigo-400 font-mono block text-[10px]">Inpaint Node</span>
                <p className="text-zinc-300 text-[11px] mt-1">LayerStyle Mask</p>
              </div>
              <div className="p-3.5 rounded-xl bg-black/60 border border-white/10">
                <span className="text-purple-400 font-mono block text-[10px]">Video Node</span>
                <p className="text-zinc-300 text-[11px] mt-1">MiniMax H3</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
