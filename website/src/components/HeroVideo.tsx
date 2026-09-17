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
        // Video file does not exist yet; open guide modal
        onOpenModal();
      });
    } else {
      onOpenModal();
    }
  };

  return (
    <figure className="video-stage-frame max-w-4xl mx-auto">
      <div className="video-stage-inner">
        {/* 4 Corner Brackets */}
        <svg className="video-corner-bracket bracket-tl" viewBox="0 0 40 40" fill="none">
          <path d="M31 5C17.5 5 6.5 16 6.5 29.5" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
        </svg>
        <svg className="video-corner-bracket bracket-tr" viewBox="0 0 40 40" fill="none">
          <path d="M31 5C17.5 5 6.5 16 6.5 29.5" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
        </svg>
        <svg className="video-corner-bracket bracket-bl" viewBox="0 0 40 40" fill="none">
          <path d="M31 5C17.5 5 6.5 16 6.5 29.5" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
        </svg>
        <svg className="video-corner-bracket bracket-br" viewBox="0 0 40 40" fill="none">
          <path d="M31 5C17.5 5 6.5 16 6.5 29.5" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
        </svg>

        {/* Video Viewport / Animated Canvas Poster */}
        <div className="relative aspect-video w-full bg-[#0d0d12] flex items-center justify-center overflow-hidden">
          {/* Background Grid */}
          <div
            className="absolute inset-0 opacity-20 pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)',
              backgroundSize: '20px 20px',
            }}
          />

          {/* Actual Video Tag */}
          <video
            ref={videoRef}
            src="/videos/demo.mp4"
            className={`w-full h-full object-cover ${isPlaying ? 'block' : 'hidden'}`}
            playsInline
            controls
          />

          {/* Poster & Play Button (Shown when not playing) */}
          {!isPlaying && (
            <>
              <button
                type="button"
                onClick={handlePlay}
                className="relative z-10 w-16 h-16 rounded-full bg-white/90 hover:bg-white text-zinc-950 flex items-center justify-center shadow-2xl transition-transform hover:scale-105 active:scale-95 cursor-pointer"
                aria-label="Play Product Video"
              >
                <svg className="w-6 h-6 ml-0.5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M6 3.8c0-.8.9-1.3 1.6-.9l9 6.2a1.1 1.1 0 0 1 0 1.8l-9 6.2c-.7.4-1.6-.1-1.6-.9V3.8Z" />
                </svg>
              </button>

              <div className="absolute bottom-4 left-6 right-6 flex items-center justify-between text-xs text-zinc-400 z-10">
                <span>{t('video_caption')}</span>
                <span className="flex items-center gap-1.5 font-mono text-[11px] bg-black/60 px-3 py-1 rounded-full border border-white/10">
                  <svg className="w-3.5 h-3.5 text-sky-400" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M9 4 5 7H2v6h3l4 3V4Z" />
                    <path d="M12 7a5 5 0 0 1 0 6m3-9a9 9 0 0 1 0 12" />
                  </svg>
                  <span>{t('video_hint')}</span>
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </figure>
  );
};
