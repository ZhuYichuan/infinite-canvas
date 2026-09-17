import React from 'react';
import type { Language } from '../types';

interface NavbarProps {
  lang: Language;
  onToggleLang: () => void;
  t: (key: string) => string;
}

export const Navbar: React.FC<NavbarProps> = ({ lang, onToggleLang, t }) => {
  return (
    <div className="notch-nav-container">
      <header className="notch-nav">
        {/* Brand */}
        <a href="#overview" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-xl bg-zinc-900 border border-white/10 flex items-center justify-center p-1.5 shadow-sm group-hover:border-sky-400/40 transition-colors">
            <img src="/favicon.svg" alt="logo" className="w-full h-full" />
          </div>
          <span className="font-semibold text-xs tracking-tight text-white flex items-center gap-1.5">
            infinite-canvas
          </span>
        </a>

        {/* Links */}
        <nav className="hidden md:flex items-center gap-1 nav-links">
          <a href="#features">{t('nav_features')}</a>
          <a href="#ecosystem">{t('nav_workflows')}</a>
          <a href="#layout-demo">{t('nav_demo')}</a>
          <a href="#privacy">{t('nav_security')}</a>
          <a href="#launch-offer">{t('nav_quickstart')}</a>
          <a href="#faq">{t('nav_faq')}</a>
        </nav>

        {/* Right CTA & Lang */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleLang}
            className="px-2.5 py-1 text-xs font-medium rounded-full bg-white/5 border border-white/10 hover:border-white/20 text-zinc-300 hover:text-white transition-colors cursor-pointer"
            title="Switch Language"
          >
            <span>{lang === 'zh-CN' ? 'EN' : '中'}</span>
          </button>
          <a
            href="#launch-offer"
            className="px-3.5 py-1.5 text-xs font-semibold rounded-full bg-white text-zinc-950 hover:bg-zinc-200 transition-colors shadow-sm flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.76 3.08.81 1.18-.24 2.3-.95 3.56-.86 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.53 4.1l.01-.01ZM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25Z" />
            </svg>
            <span>{t('nav_launch')}</span>
          </a>
        </div>
      </header>
    </div>
  );
};
