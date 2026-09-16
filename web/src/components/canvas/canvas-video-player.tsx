import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize2, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { useTranslation } from "react-i18next";

type CanvasVideoPlayerProps = {
    nodeId: string;
    src: string;
    onPreview?: () => void;
};

function formatTime(seconds: number): string {
    if (!Number.isFinite(seconds) || isNaN(seconds) || seconds < 0) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function CanvasVideoPlayer({ nodeId, src, onPreview }: CanvasVideoPlayerProps) {
    const { t } = useTranslation();
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(true);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isHovered, setIsHovered] = useState(false);
    const [isScrubbing, setIsScrubbing] = useState(false);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;
        setIsPlaying(!video.paused);
    }, []);

    const handleTogglePlay = useCallback((event: React.MouseEvent) => {
        event.stopPropagation();
        const video = videoRef.current;
        if (!video) return;
        if (video.paused) {
            void video.play();
        } else {
            video.pause();
        }
    }, []);

    const handleToggleMute = useCallback((event: React.MouseEvent) => {
        event.stopPropagation();
        const video = videoRef.current;
        if (!video) return;
        video.muted = !video.muted;
        setIsMuted(video.muted);
    }, []);

    const handleSeek = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const time = Number(event.target.value);
        setCurrentTime(time);
        const video = videoRef.current;
        if (video) {
            video.currentTime = time;
        }
    }, []);

    const handlePreview = useCallback(
        (event?: React.MouseEvent) => {
            event?.stopPropagation();
            if (videoRef.current && !videoRef.current.paused) {
                videoRef.current.pause();
            }
            onPreview?.();
        },
        [onPreview],
    );

    const showControls = !isPlaying || isHovered || isScrubbing;

    return (
        <div
            className="group relative flex h-full w-full select-none items-center justify-center overflow-hidden rounded-[18px] bg-black"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <video
                ref={videoRef}
                src={src}
                data-canvas-video={nodeId}
                data-canvas-no-zoom
                loop
                muted={isMuted}
                playsInline
                preload="metadata"
                className="pointer-events-none h-full w-full object-contain"
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onTimeUpdate={() => {
                    if (!isScrubbing && videoRef.current) {
                        setCurrentTime(videoRef.current.currentTime);
                    }
                }}
                onLoadedMetadata={() => {
                    if (videoRef.current) {
                        setDuration(videoRef.current.duration || 0);
                    }
                }}
                onEnded={() => setIsPlaying(false)}
            />

            {/* Center play button when paused */}
            {!isPlaying && (
                <button
                    type="button"
                    className="absolute z-10 flex size-12 cursor-pointer items-center justify-center rounded-full bg-black/60 text-white shadow-xl backdrop-blur-md transition-all duration-200 hover:scale-110 hover:bg-black/80 active:scale-95"
                    onClick={handleTogglePlay}
                    onDoubleClick={handlePreview}
                    onMouseDown={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    aria-label={t("canvas.videoPlayer.play")}
                >
                    <Play className="size-5 translate-x-0.5 fill-white" />
                </button>
            )}

            {/* Bottom floating control bar */}
            <div
                className={`absolute inset-x-2 bottom-2 z-10 flex flex-col gap-1.5 rounded-xl bg-black/70 px-2.5 py-1.5 text-white shadow-lg backdrop-blur-md transition-opacity duration-200 ${
                    showControls ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
                }`}
                onMouseDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
            >
                {/* Progress bar */}
                <input
                    type="range"
                    min={0}
                    max={duration || 1}
                    step={0.01}
                    value={currentTime}
                    onChange={handleSeek}
                    onMouseDown={(e) => {
                        e.stopPropagation();
                        setIsScrubbing(true);
                    }}
                    onMouseUp={() => setIsScrubbing(false)}
                    onTouchStart={(e) => {
                        e.stopPropagation();
                        setIsScrubbing(true);
                    }}
                    onTouchEnd={() => setIsScrubbing(false)}
                    className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/25 accent-white outline-none hover:bg-white/40"
                />

                {/* Control buttons & time display */}
                <div className="flex items-center justify-between text-[11px] font-medium leading-none text-white/90">
                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            className="flex size-6 cursor-pointer items-center justify-center rounded-md transition hover:bg-white/20 active:scale-90"
                            onClick={handleTogglePlay}
                            title={isPlaying ? t("canvas.videoPlayer.pause") : t("canvas.videoPlayer.play")}
                        >
                            {isPlaying ? <Pause className="size-3.5 fill-white" /> : <Play className="size-3.5 translate-x-0.25 fill-white" />}
                        </button>
                        <span className="select-none text-[10px] tabular-nums opacity-80">
                            {formatTime(currentTime)} / {formatTime(duration)}
                        </span>
                    </div>

                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            className="flex size-6 cursor-pointer items-center justify-center rounded-md transition hover:bg-white/20 active:scale-90"
                            onClick={handleToggleMute}
                            title={isMuted ? t("canvas.videoPlayer.unmute") : t("canvas.videoPlayer.mute")}
                        >
                            {isMuted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
                        </button>
                        {onPreview ? (
                            <button
                                type="button"
                                className="flex size-6 cursor-pointer items-center justify-center rounded-md transition hover:bg-white/20 active:scale-90"
                                onClick={handlePreview}
                                title={t("canvas.videoPlayer.preview")}
                            >
                                <Maximize2 className="size-3.5" />
                            </button>
                        ) : null}
                    </div>
                </div>
            </div>
        </div>
    );
}
