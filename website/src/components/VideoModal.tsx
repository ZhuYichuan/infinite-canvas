import React from 'react';

interface VideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  t: (key: string) => string;
}

export const VideoModal: React.FC<VideoModalProps> = ({ isOpen, onClose, t }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="max-w-md w-full rounded-2xl bg-zinc-900 border border-white/15 p-6 shadow-2xl">
        <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center mb-4">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="23 7 16 12 23 17 23 7" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
          </svg>
        </div>
        <h3 className="text-base font-bold text-white mb-2">{t('video_modal_title')}</h3>
        <p className="text-xs text-zinc-300 leading-relaxed mb-4">{t('video_modal_desc')}</p>
        <div className="p-3 rounded-lg bg-black/60 border border-white/10 font-mono text-[11px] text-sky-300 mb-5">
          website/public/videos/demo.mp4
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-semibold text-xs transition-colors cursor-pointer"
        >
          {t('video_modal_btn')}
        </button>
      </div>
    </div>
  );
};
