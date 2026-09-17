import React, { useEffect, useRef, useState } from 'react';

interface MascotProps {
  onInteract?: (msg: string) => void;
  lang: string;
}

export const Mascot: React.FC<MascotProps> = ({ onInteract, lang }) => {
  const [blinking, setBlinking] = useState(false);
  const [scale, setScale] = useState(false);
  const [pupilOffset, setPupilOffset] = useState({ x: 0, y: 0 });
  const mascotRef = useRef<HTMLDivElement>(null);

  // Pupil follows mouse
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!mascotRef.current) return;
      const rect = mascotRef.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const angle = Math.atan2(dy, dx);
      const dist = Math.min(3.5, Math.hypot(dx, dy) / 35);

      setPupilOffset({
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist,
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Periodic natural blinking
  useEffect(() => {
    const interval = setInterval(() => {
      setBlinking(true);
      setTimeout(() => setBlinking(false), 150);
    }, 4000 + Math.random() * 2500);

    return () => clearInterval(interval);
  }, []);

  const handleClick = () => {
    setScale(true);
    setTimeout(() => setScale(false), 200);
    if (onInteract) {
      onInteract(lang === 'zh-CN' ? '✨ 无限画布 8188 实时在线！' : '✨ ComfyUI 8188 online & ready!');
    }
  };

  return (
    <div
      ref={mascotRef}
      onClick={handleClick}
      className={`mascot-box transition-transform ${scale ? 'scale-110' : ''}`}
      title="我是画布助手！点击与我互动"
    >
      <div className="mascot-frame">
        <div className="mascot-eyes-wrap">
          <div className={`mascot-eye-socket ${blinking ? 'blink' : ''}`}>
            <div
              className="mascot-eye-pupil"
              style={{
                transform: `translate(${pupilOffset.x}px, ${pupilOffset.y}px)`,
              }}
            />
          </div>
          <div className={`mascot-eye-socket ${blinking ? 'blink' : ''}`}>
            <div
              className="mascot-eye-pupil"
              style={{
                transform: `translate(${pupilOffset.x}px, ${pupilOffset.y}px)`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
