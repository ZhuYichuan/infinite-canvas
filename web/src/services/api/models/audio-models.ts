import type { WorkflowModelProfile } from "./types";

/**
 * MiniMax Music 03 扩散音乐大模型
 * 专为全长歌曲与高质量器乐伴奏设计：
 * - 风格描述（Caption）：支持丰富的乐器、曲风、情绪与流派标签；
 * - 歌词生成（Lyrics）：支持结构化分段歌词（Verse/Chorus/Bridge），留空则生成纯器乐伴奏；
 * - 生成时长：支持 10s ~ 300s（最长 5 分钟），常用档位 60s / 120s / 180s；
 * - 硬件偏差补偿：因潜空间音频解码截断自动 +1s (durationOffset: 1)。
 */
export const audioMinimaxMusic3Profile: WorkflowModelProfile = {
    id: "audio-minimax-music-3",
    name: "MiniMax Music 03",
    capability: "audio",
    protocol: "comfyui",
    category: "audio",
    durationOffset: 1,
    capabilityConfig: {
        version: 1,
        references: {
            promptMaxChars: 3000,
            minImages: 0,
            maxImages: 0,
            maskSupported: false,
            minVideos: 0,
            maxVideos: 0,
            maxAudios: 0,
        },
        duration: {
            selection: "range",
            min: 10,
            max: 300,
            step: 1,
            default: 60,
            tags: [60, 120, 180],
        },
    },
    slotMapping: {
        caption: "caption",
        lyrics: "lyrics",
        prompt: "caption",
        duration: "duration",
        seed: "seed",
        audioOutput: "output_audio",
    },
    description: "MiniMax Music 03 扩散音乐大模型，支持最长 5 分钟完整歌曲与纯器乐伴奏生成。",
};

export const BUILTIN_AUDIO_WORKFLOW_MODELS: WorkflowModelProfile[] = [
    audioMinimaxMusic3Profile,
];

/**
 * 智能解析音频提示词中的风格描述 (caption) 与歌词 (lyrics)
 * 支持 [caption]... 与 [lyrics]... 结构化伪标签，若未包含则全量视为风格描述，歌词留空。
 */
export function parseAudioPrompt(rawPrompt: string): { caption: string; lyrics: string } {
    const text = (rawPrompt || "").trim();
    if (!text) return { caption: "", lyrics: "" };

    const captionMatch = /\[caption\]([\s\S]*?)(?=\[lyrics\]|$)/i.exec(text);
    const lyricsMatch = /\[lyrics\]([\s\S]*?)(?=\[caption\]|$)/i.exec(text);

    if (captionMatch || lyricsMatch) {
        return {
            caption: (captionMatch ? captionMatch[1] : "").trim(),
            lyrics: (lyricsMatch ? lyricsMatch[1] : "").trim(),
        };
    }

    return {
        caption: text,
        lyrics: "",
    };
}

