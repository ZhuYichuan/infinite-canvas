import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import type { Language } from '../types';

interface NavbarProps {
  lang: Language;
  onToggleLang: () => void;
  t: (key: string) => string;
}

export const Navbar: React.FC<NavbarProps> = ({ lang, onToggleLang, t }) => {
  return (
    <header className="top-notch-header">
      {/* Brand on Left */}
      <a href="#overview" className="flex items-center gap-2.5 group">
        <div className="w-5 h-5 flex items-center justify-center">
          <svg viewBox="0 0 24 18" fill="none" className="w-full h-full text-sky-400">
            <rect width="24" height="18" rx="6" fill="#181a32" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
            <circle cx="8" cy="9" r="2" fill="#ffffff" />
            <circle cx="16" cy="9" r="2" fill="#ffffff" />
          </svg>
        </div>
        <span className="font-semibold text-sm tracking-tight text-white flex items-center gap-1.5">
          无限画布
        </span>
      </a>

      {/* Nav Links in Center */}
      <nav className="hidden md:flex items-center gap-1">
        <a href="#features" className="nav-link-item">{t('nav_features')}</a>
        <a href="#ecosystem" className="nav-link-item">{t('nav_workflows')}</a>
        <a href="#layout-demo" className="nav-link-item">{t('nav_demo')}</a>
        <a href="#privacy" className="nav-link-item">{t('nav_security')}</a>
        <a href="#launch-offer" className="nav-link-item">{t('nav_quickstart')}</a>
        <a href="#faq" className="nav-link-item">{t('nav_faq')}</a>
      </nav>

      {/* Right Actions: Lang Switch + Download Button */}
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={onToggleLang}
          className="px-2 py-1 text-xs font-medium rounded-full text-zinc-400 hover:text-white transition-colors cursor-pointer"
          title="Switch Language"
        >
          <span>{lang === 'zh-CN' ? 'EN' : '中'}</span>
        </button>

        <a
          href="https://canvas.imihoo.com"
          target="_blank"
          rel="noopener noreferrer"
          className="px-3.5 py-1.5 text-xs font-semibold rounded-full bg-white text-black hover:bg-zinc-100 transition-colors shadow-sm flex items-center gap-1 cursor-pointer"
        >
          <span>{t('hero_cta_start')}</span>
          <ArrowUpRight className="w-3.5 h-3.5 opacity-70" />
        </a>
      </div>
    </header>
  );
};
