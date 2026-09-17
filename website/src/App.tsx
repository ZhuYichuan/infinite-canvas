import React, { useState } from 'react';
import type { Language } from './types';
import { DICTIONARY } from './data/i18n';
import { Navbar } from './components/Navbar';
import { Mascot } from './components/Mascot';
import { HeroVideo } from './components/HeroVideo';
import { NativeBanner } from './components/NativeBanner';
import { NotchStage } from './components/NotchStage';
import { EcosystemDashboard } from './components/EcosystemDashboard';
import { LayoutGrid } from './components/LayoutGrid';
import { Privacy } from './components/Privacy';
import { LaunchOffer } from './components/LaunchOffer';
import { Faq } from './components/Faq';
import { Footer } from './components/Footer';
import { VideoModal } from './components/VideoModal';

export const App: React.FC = () => {
  const [lang, setLang] = useState<Language>('zh-CN');
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const t = (key: string): string => {
    return DICTIONARY[lang]?.[key] || DICTIONARY['zh-CN']?.[key] || key;
  };

  const handleToggleLang = () => {
    setLang((prev) => (prev === 'zh-CN' ? 'en' : 'zh-CN'));
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((current) => (current === msg ? null : current));
    }, 2500);
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col selection:bg-sky-500/30 selection:text-sky-200">
      {/* 1. Floating Notch Navbar */}
      <Navbar lang={lang} onToggleLang={handleToggleLang} t={t} />

      {/* Main Content */}
      <main className="pt-32 pb-16 flex-1">
        {/* 2. Hero Section */}
        <section id="overview" className="px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto text-center">
          {/* Interactive Mascot */}
          <div className="flex justify-center mb-6">
            <Mascot onInteract={showToast} lang={lang} />
          </div>

          {/* Hero Title */}
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white mb-5 leading-tight">
            {t('hero_title_line1')}
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-indigo-300 to-cyan-300">
              {t('hero_title_line2')}
            </span>
          </h1>

          {/* Hero Subtitle */}
          <p className="text-base sm:text-lg text-zinc-400 max-w-2xl mx-auto mb-8 leading-relaxed">
            {t('hero_desc')}
          </p>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-3.5 mb-6">
            <a
              href="#launch-offer"
              className="px-5 py-2.5 rounded-full bg-white text-zinc-950 font-semibold text-xs sm:text-sm hover:bg-zinc-200 transition-colors shadow-lg shadow-white/5 flex items-center gap-2"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.76 3.08.81 1.18-.24 2.3-.95 3.56-.86 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.53 4.1l.01-.01ZM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25Z" />
              </svg>
              <span>{t('hero_cta_start')}</span>
            </a>
            <a
              href="https://github.com/ZhuYichuan/infinite-canvas"
              target="_blank"
              rel="noreferrer"
              className="px-5 py-2.5 rounded-full bg-zinc-900 border border-white/10 text-zinc-300 hover:text-white hover:border-white/20 text-xs sm:text-sm font-semibold transition-colors flex items-center gap-2"
            >
              <span>{t('hero_cta_doc')}</span>
            </a>
          </div>

          {/* Privacy Callout */}
          <p className="text-xs text-zinc-500 flex items-center justify-center gap-1.5 mb-14">
            <svg className="w-3.5 h-3.5 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <strong className="text-zinc-300">100% local.</strong>
            <span>{t('hero_badge_privacy')}</span>
          </p>

          {/* Hero Video Stage with Corner Brackets */}
          <HeroVideo onOpenModal={() => setIsVideoModalOpen(true)} t={t} />
        </section>

        {/* 3. 3-Column Native Banner */}
        <NativeBanner t={t} />

        {/* 4. Product Features (Living Notch & Device Stage) */}
        <NotchStage t={t} />

        {/* 5. Ecosystem & Workflow Dashboard */}
        <EcosystemDashboard t={t} />

        {/* 6. Interactive Layout Grid Canvas */}
        <LayoutGrid t={t} onToast={showToast} />

        {/* 7. Privacy Section */}
        <Privacy t={t} />

        {/* 8. Launch Offer & Quick Start */}
        <LaunchOffer t={t} onToast={showToast} lang={lang} />

        {/* 9. FAQ */}
        <Faq t={t} />
      </main>

      {/* 10. Footer */}
      <Footer t={t} onToast={showToast} lang={lang} />

      {/* Video Placeholder Modal */}
      <VideoModal
        isOpen={isVideoModalOpen}
        onClose={() => setIsVideoModalOpen(false)}
        t={t}
      />

      {/* Global Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 pointer-events-none">
          <div className="px-4 py-2.5 rounded-xl bg-zinc-900 border border-white/15 text-white text-xs shadow-2xl backdrop-blur-md flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
            <span className="w-2 h-2 rounded-full bg-sky-400" />
            <span>{toastMsg}</span>
          </div>
        </div>
      )}
    </div>
  );
};
