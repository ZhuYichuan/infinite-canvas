import React, { useRef, useState } from 'react';

interface HeroVideoProps {
  onOpenModal: () => void;
  t: (key: string) => string;
}

export const HeroVideo: React.FC<HeroVideoProps> = ({ onOpenModal, t }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handlePlay = () => {
    if (videoRef.current) {
      videoRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(() => {
        onOpenModal();
      });
    } else {
      onOpenModal();
    }
  };

  return (
    <div className="mac-showcase-container mt-12 mb-8">
      {/* 4 Electric Blue Corner Brackets (Exact TinyKPI Style) */}
      <svg className="blue-corner-bracket bracket-tl-corner" viewBox="0 0 40 40" fill="none">
        <path d="M36 6C18 6 6 18 6 36" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
      </svg>
      <svg className="blue-corner-bracket bracket-tr-corner" viewBox="0 0 40 40" fill="none">
        <path d="M36 6C18 6 6 18 6 36" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
      </svg>
      <svg className="blue-corner-bracket bracket-bl-corner" viewBox="0 0 40 40" fill="none">
        <path d="M36 6C18 6 6 18 6 36" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
      </svg>
      <svg className="blue-corner-bracket bracket-br-corner" viewBox="0 0 40 40" fill="none">
        <path d="M36 6C18 6 6 18 6 36" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
      </svg>

      {/* Mac Screen Frame */}
      <div className="mac-screen-frame">
        {/* Mac Menu Bar */}
        <div className="h-7 px-4 bg-black/90 flex items-center justify-between text-[11px] text-zinc-300 select-none z-30 relative">
          <div className="flex items-center gap-4">
            <span className="text-white text-xs"></span>
            <span className="font-semibold text-white">{t('mac_finder')}</span>
            <span>{t('mac_file')}</span>
            <span>{t('mac_edit')}</span>
            <span>{t('mac_view')}</span>
            <span>{t('mac_go')}</span>
            <span>{t('mac_window')}</span>
            <span>{t('mac_help')}</span>
          </div>
          <div className="flex items-center gap-3 text-zinc-400">
            <span>🔋</span>
            <span>📶</span>
            <span>🔍</span>
            <span className="text-white">{t('mac_clock')}</span>
          </div>
        </div>

        {/* Physical Screen Notch Cutout */}
        <div className="screen-notch-cutout">
          {/* Camera lens */}
          <div className="w-2.5 h-2.5 rounded-full bg-zinc-900 border border-white/10" />
        </div>

        {/* Active Living Notch Widget (Centered in Screen Notch) */}
        <div className="active-notch-bar">
          <div className="flex items-baseline gap-1.5 text-xs text-white">
            <strong className="font-bold">1.8s</strong>
            <span className="text-[10px] text-emerald-400 font-mono">Flux.1 ↑ 14%</span>
          </div>

          {/* Mini Mascot in Notch */}
          <div className="w-5 h-4 rounded bg-zinc-800 border border-white/20 flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-sky-400 pulse-subtle" />
          </div>

          <div className="flex items-baseline gap-1.5 text-xs text-white">
            <strong className="font-bold">8.2G</strong>
            <span className="text-[10px] text-sky-400 font-mono">{t('mac_vram')} ↓ 5%</span>
          </div>
        </div>

        {/* Screen Wallpaper & Video Viewport */}
        <div className="mac-screen-content relative flex items-center justify-center bg-gradient-to-br from-zinc-900 via-stone-900 to-amber-950/70">
          {/* Abstract Wallpaper Overlay */}
          <div
            className="absolute inset-0 opacity-40 mix-blend-overlay pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(circle at 70% 30%, #f59e0b 0%, transparent 60%), radial-gradient(circle at 20% 80%, #3b82f6 0%, transparent 50%)',
            }}
          />

          {/* Simulated Canvas Floating Nodes on the Mac Desktop */}
          <div className="absolute inset-0 p-12 flex items-center justify-between pointer-events-none opacity-85">
            {/* Left Prompt Node */}
            <div className="w-56 p-3 rounded-xl bg-black/60 backdrop-blur-md border border-white/15 text-left shadow-2xl">
              <span className="text-[10px] font-mono text-sky-400 block mb-1">{t('prompt_node_title')}</span>
              <p className="text-[11px] text-zinc-300 font-sans leading-snug">
                {t('prompt_node_val')}
              </p>
            </div>

            {/* Right Result Node */}
            <div className="w-56 p-2 rounded-xl bg-black/60 backdrop-blur-md border border-white/15 shadow-2xl">
              <div className="aspect-video w-full rounded-lg bg-zinc-900 overflow-hidden relative border border-white/10 flex items-center justify-center">
                <span className="text-[10px] font-mono text-emerald-400">{t('render_node_title')}</span>
              </div>
            </div>
          </div>

          {/* HTML5 Video Tag */}
          <video
            ref={videoRef}
            src="/videos/demo.mp4"
            className={`w-full h-full object-cover z-20 ${isPlaying ? 'block' : 'hidden'}`}
            playsInline
            controls
          />

          {/* Center Play Button Overlay (when video is not playing) */}
          {!isPlaying && (
            <button
              type="button"
              onClick={handlePlay}
              className="relative z-30 w-16 h-16 rounded-full bg-white/95 hover:bg-white text-zinc-950 flex items-center justify-center shadow-2xl transition-transform hover:scale-108 active:scale-95 cursor-pointer"
              aria-label={t('video_play_btn')}
            >
              <svg className="w-6 h-6 ml-0.5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M6 3.8c0-.8.9-1.3 1.6-.9l9 6.2a1.1 1.1 0 0 1 0 1.8l-9 6.2c-.7.4-1.6-.1-1.6-.9V3.8Z" />
              </svg>
            </button>
          )}

          {/* Bottom Caption */}
          <div className="absolute bottom-3 left-6 right-6 flex items-center justify-between text-[11px] text-zinc-400 z-30">
            <span className="text-zinc-300">{t('video_caption')}</span>
            <span className="flex items-center gap-1.5 font-mono text-[10px] bg-black/70 px-2.5 py-0.5 rounded-full border border-white/10 text-zinc-300">
              <svg className="w-3 h-3 text-sky-400" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M9 4 5 7H2v6h3l4 3V4Z" />
                <path d="M12 7a5 5 0 0 1 0 6m3-9a9 9 0 0 1 0 12" />
              </svg>
              <span>{t('video_hint')}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
