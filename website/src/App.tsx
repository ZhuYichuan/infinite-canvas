import React, { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
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
    <div className="min-h-screen bg-[#fbfbfd] text-[#1d1d1f] flex flex-col selection:bg-sky-500/20 selection:text-sky-900">
      {/* 1. Hanging Notch Navbar */}
      <Navbar lang={lang} onToggleLang={handleToggleLang} t={t} />

      {/* Main Content */}
      <main className="pt-28 pb-16 flex-1">
        {/* 2. Hero Section (Exact 1:1 match to screenshot) */}
        <section id="overview" className="px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto text-center">
          {/* Centered Mascot */}
          <div className="flex justify-center mb-7">
            <Mascot onInteract={showToast} lang={lang} />
          </div>

          {/* Big Bold Headline */}
          <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight text-[#111113] mb-6 leading-[1.06]">
            {t('hero_title_line1')}
            {t('hero_title_line2') ? (
              <>
                <br />
                <span>{t('hero_title_line2')}</span>
              </>
            ) : null}
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg text-[#6e6e73] max-w-xl mx-auto mb-8 leading-relaxed font-normal">
            {t('hero_desc')}
          </p>

          {/* Black Pill Button */}
          <div className="flex items-center justify-center mb-6">
            <a
              href="https://canvas.imihoo.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-[#000000] hover:bg-[#222226] text-white font-semibold text-sm transition-all shadow-xl shadow-black/10 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              <span>{t('hero_cta_start')}</span>
              <ArrowUpRight className="w-4 h-4 opacity-70" />
            </a>
          </div>

          {/* 100% Local Badge */}
          <div className="flex flex-col items-center justify-center text-xs text-[#6e6e73] gap-1 mb-8">
            <div className="flex items-center gap-1.5 font-bold text-[#1d1d1f]">
              <svg className="w-3.5 h-3.5 text-[#0071e3]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span>{t('hero_badge_local')}</span>
            </div>
            <span>{t('hero_badge_privacy')}</span>
          </div>

          {/* Mac Screen Showcase with Electric Blue Brackets */}
          <HeroVideo onOpenModal={() => setIsVideoModalOpen(true)} t={t} />
        </section>

        {/* 3. 3-Column Native Banner */}
        <NativeBanner t={t} />

        {/* 4. Product Features (Living Notch & Device Stage) */}
        <NotchStage t={t} />

        {/* 5. Ecosystem & Workflow Dashboard */}
        <EcosystemDashboard t={t} />

        {/* 6. Interactive Layout Grid Canvas */}
        <LayoutGrid t={t} onToast={showToast} lang={lang} />

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
          <div className="px-4 py-2.5 rounded-xl bg-black/90 text-white text-xs shadow-2xl backdrop-blur-md flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-sky-400" />
            <span>{toastMsg}</span>
          </div>
        </div>
      )}
    </div>
  );
};
