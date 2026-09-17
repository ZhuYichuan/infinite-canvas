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
          <span>{t('mac_finder')} &nbsp; {t('mac_file')} &nbsp; {t('mac_edit')} &nbsp; {t('mac_view')} &nbsp; ComfyUI</span>
          <span>{t('mac_clock')}</span>
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
            <span className="text-sm font-bold text-white">0.8s</span>
            <span className="text-[10px] text-zinc-400 flex items-center gap-0.5">
              <span>Z-Image</span>
              <span className="text-emerald-400">↓ 28%</span>
            </span>
          </div>

          <div className="w-6 h-6 rounded-lg bg-zinc-800 border border-white/20 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-sky-400 pulse-subtle" />
          </div>

          <div className="flex flex-col items-end">
            <span className="text-sm font-bold text-white">6.4G</span>
            <span className="text-[10px] text-zinc-400 flex items-center gap-0.5">
              <span>{t('stage_vram_label')}</span>
              <span className="text-sky-400">↑ 5%</span>
            </span>
          </div>
        </div>

        {/* Stage Content */}
        <div className="flex-1 flex items-center justify-center p-8 relative">
          {step === 'glance' && (
            <div className="inline-block p-4 rounded-2xl bg-black/60 border border-white/10 backdrop-blur-md text-left transition-all">
              <span className="text-xs font-mono text-sky-400 block mb-1">{t('stage_glance_title')}</span>
              <p className="text-xs text-zinc-300">{t('stage_glance_prompt')}</p>
              <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-500">
                <span>{t('stage_glance_sampler')}</span>
                <span className="text-emerald-400 font-mono">{t('stage_glance_status')}</span>
              </div>
            </div>
          )}

          {step === 'inspect' && (
            <div className="w-full max-w-md p-4 rounded-2xl bg-black/70 border border-white/15 backdrop-blur-md space-y-2.5 text-xs transition-all">
              <div className="flex items-center justify-between text-zinc-400 font-mono">
                <span>_meta.title</span>
                <span className="text-sky-400">{t('stage_inspect_slot')}</span>
              </div>
              <div className="flex justify-between py-1 border-t border-white/5">
                <span className="text-zinc-400">{t('stage_inspect_prompt')}</span>
                <span className="text-zinc-200">{t('stage_inspect_prompt_val')}</span>
              </div>
              <div className="flex justify-between py-1 border-t border-white/5">
                <span className="text-zinc-400">{t('stage_inspect_seed')}</span>
                <span className="font-mono text-sky-300">928104812</span>
              </div>
              <div className="flex justify-between py-1 border-t border-white/5">
                <span className="text-zinc-400">{t('stage_inspect_steps')}</span>
                <span className="font-mono text-zinc-200">20 / 3.5</span>
              </div>
            </div>
          )}

          {step === 'explore' && (
            <div className="w-full max-w-xl grid grid-cols-3 gap-3 text-xs transition-all">
              <div className="p-3.5 rounded-xl bg-black/60 border border-white/10">
                <span className="text-sky-400 font-mono block text-[10px]">{t('stage_node_txt2img')}</span>
                <p className="text-zinc-300 text-[11px] mt-1">Z-Image Turbo</p>
              </div>
              <div className="p-3.5 rounded-xl bg-black/60 border border-white/10">
                <span className="text-indigo-400 font-mono block text-[10px]">{t('stage_node_inpaint')}</span>
                <p className="text-zinc-300 text-[11px] mt-1">Qwen ControlNet</p>
              </div>
              <div className="p-3.5 rounded-xl bg-black/60 border border-white/10">
                <span className="text-purple-400 font-mono block text-[10px]">{t('stage_node_video')}</span>
                <p className="text-zinc-300 text-[11px] mt-1">MiniMax H3</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
