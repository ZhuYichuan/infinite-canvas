import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { App, Button, Card, Divider, Dropdown, Segmented, Select, Tag, Tooltip } from "antd";
import type { MenuProps } from "antd";
import {
    AlertCircle,
    ArrowRight,
    Check,
    CheckCircle2,
    ChevronDown,
    Copy,
    Download,
    ExternalLink,
    FileCode,
    FolderTree,
    HelpCircle,
    Info,
    Layers,
    Music,
    Package,
    Puzzle,
    RefreshCw,
    Sparkles,
    Terminal,
    Video,
    Wrench,
} from "lucide-react";
import { Link } from "react-router-dom";
import { saveAs } from "file-saver";

import { createZip } from "@/lib/zip";
import { useCopyText } from "@/hooks/use-copy-text";
import { type ModelChannel, useConfigStore } from "@/stores/use-config-store";

const CORS_FLAG = '--enable-cors-header "*"';
const LAUNCH_CMD_EXAMPLE = 'python.exe main.py --listen 0.0.0.0 --enable-manager --enable-cors-header "*"';

// 5 大通用基础必备扩展插件
export const CORE_PLUGINS = [
    {
        name: "Comfyui-kktools",
        repo: "zhiwendesign/Comfyui-kktools",
        url: "https://github.com/zhiwendesign/Comfyui-kktools",
        desc: "大语言模型多模态文本生成、提示词润色扩写与反推",
        usedBy: "文本生成 / 反推工作流",
    },
    {
        name: "ComfyUI-KJNodes",
        repo: "kijai/ComfyUI-KJNodes",
        url: "https://github.com/kijai/ComfyUI-KJNodes",
        desc: "高级逻辑控制与视频多模态组件解包提取 (GetVideoComponents 等)",
        usedBy: "全能参考视频 / 人脸精修",
    },
    {
        name: "ComfyLiterals",
        repo: "M1kep/ComfyLiterals",
        url: "https://github.com/M1kep/ComfyLiterals",
        desc: "字面量、常数类型及动态参数输入端口节点",
        usedBy: "首尾帧视频 / 全能参考视频 / 音乐生成",
    },
    {
        name: "ComfyUI-UniversalToolkit",
        repo: "whmc76/ComfyUI-UniversalToolkit",
        url: "https://github.com/whmc76/ComfyUI-UniversalToolkit",
        desc: "通用工具箱与多类型参数转接桥接",
        usedBy: "文本生成 / 反推工作流",
    },
    {
        name: "ComfyUI_LayerStyle",
        repo: "chflame163/ComfyUI_LayerStyle",
        url: "https://github.com/chflame163/ComfyUI_LayerStyle",
        desc: "图层样式合成与局部重绘遮罩 (Mask) 处理",
        usedBy: "局部编辑 (Inpaint) 工作流",
    },
];

// 人脸追踪精修与深度估计等进阶/专用扩展插件
export const ADVANCED_PLUGINS = [
    {
        name: "ComfyUI-MiniMaxH3-Myang",
        repo: "civilcoco/ComfyUI-MiniMaxH3-Myang",
        url: "https://github.com/civilcoco/ComfyUI-MiniMaxH3-Myang",
        desc: "人脸智能追踪裁剪、潜空间注入、原生口型音频锁与按帧去噪缝合",
        usedBy: "视频人脸追踪精修工作流",
    },
    {
        name: "ComfyUI-VideoHelperSuite (VHS)",
        repo: "Kosinkadink/ComfyUI-VideoHelperSuite",
        url: "https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite",
        desc: "视频流加载与音画组合封装输出节点 (LoadVideo, VHS_VideoCombine)",
        usedBy: "视频人脸追踪精修工作流",
    },
    {
        name: "ComfyUI-ReShot",
        repo: "maosika-ai/ComfyUI-ReShot",
        url: "https://github.com/maosika-ai/ComfyUI-ReShot",
        desc: "单目视频深度时序估计、运镜走位提取与结构条件处理 (ReShotDepthVideo)",
        usedBy: "视频深度估计工作流",
    },
];

export const CLONE_CORE_PLUGINS_CMD = [
    "cd custom_nodes",
    "git clone https://github.com/zhiwendesign/Comfyui-kktools.git",
    "git clone https://github.com/kijai/ComfyUI-KJNodes.git",
    "git clone https://github.com/M1kep/ComfyLiterals.git",
    "git clone https://github.com/whmc76/ComfyUI-UniversalToolkit.git",
    "git clone https://github.com/chflame163/ComfyUI_LayerStyle.git",
].join("\n");

export const CLONE_ADVANCED_PLUGINS_CMD = [
    "cd custom_nodes",
    "git clone https://github.com/civilcoco/ComfyUI-MiniMaxH3-Myang.git",
    "git clone https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite.git",
    "git clone https://github.com/maosika-ai/ComfyUI-ReShot.git",
    "python -m pip install -r ComfyUI-ReShot/requirements.txt",
].join("\n");

type WorkflowModelSpec = {
    category: string;
    folder: string;
    files: string[];
};

type WorkflowVariant = {
    id: string;
    label: string;
    badge: string;
    badgeColor?: string;
    baseModel: string;
    description: string;
    uiFileName: string;
    uiDownloadUrl: string;
    apiFileName: string;
    apiDownloadUrl: string;
    models: WorkflowModelSpec[];
    plugins?: { name: string; url: string }[];
    tips?: string;
};

type WorkflowItem = {
    id: string;
    name: string;
    category: "image" | "video" | "audio" | "refine";
    defaultVariantId: string;
    variants: WorkflowVariant[];
};

const WORKFLOWS: WorkflowItem[] = [
    {
        id: "t2i",
        name: "文生图工作流 (T2I)",
        category: "image",
        defaultVariantId: "qwen21",
        variants: [
            {
                id: "qwen21",
                label: "Qwen-Image-2.1 旗舰版",
                badge: "25 步旗舰 / 两栖",
                badgeColor: "purple",
                baseModel: "Qwen-Image-2.1 BF16",
                description: "依托 8B 级 Qwen3-VL 视觉语言大模型引导，对复杂长句、多主体关系与古风细节具备强大理解力；未连参考图时天然作为纯文生图工作流运行。",
                uiFileName: "qwen_image_21_api.json",
                uiDownloadUrl: "/workflows/qwen_image_21_api.json",
                apiFileName: "qwen_image_21_api.json",
                apiDownloadUrl: "/workflows/qwen_image_21_api.json",
                models: [
                    { category: "扩散模型", folder: "models/diffusion_models/", files: ["qwen_image_2.1_bf16.safetensors"] },
                    { category: "多模态CLIP", folder: "models/clip/", files: ["qwen3vl_8b_bf16.safetensors"] },
                    { category: "VAE", folder: "models/vae/", files: ["qwen_image_2.1_vae_bf16.safetensors"] },
                ],
                tips: "大模型级提示词遵循；内置 QwenImage21Cache 加速缓存；无参考图连线时自动作为纯文生图运行。",
            },
            {
                id: "qwen21_int8",
                label: "Qwen-Image-2.1 Int8 轻量版",
                badge: "25 步 / Int8 轻量",
                badgeColor: "cyan",
                baseModel: "Qwen-Image-2.1 Int8",
                description: "基于 Qwen-Image-2.1 与 Qwen3-VL 8B 的 Int8 量化模型，显存占用较 BF16 减半，消费级单卡（12G~16G）畅享大模型级提示词遵循与两栖生图能力。",
                uiFileName: "t2i_qwen_image_21_int8_workflow.json",
                uiDownloadUrl: "/workflows/t2i_qwen_image_21_int8_workflow.json",
                apiFileName: "t2i_qwen_image_21_int8_api.json",
                apiDownloadUrl: "/workflows/t2i_qwen_image_21_int8_api.json",
                models: [
                    { category: "扩散模型", folder: "models/diffusion_models/", files: ["qwen_image_2.1_turbo_int8_convrot.safetensors"] },
                    { category: "多模态CLIP", folder: "models/clip/", files: ["qwen3vl_8b_int8_convrot.safetensors"] },
                    { category: "VAE", folder: "models/vae/", files: ["qwen_image_2.1_vae_bf16.safetensors"] },
                ],
                tips: "UNet 与 CLIP 均采用 Int8 权重量化，显存更低；无参考图连线时自动作为纯文生图运行。",
            },
            {
                id: "turbo",
                label: "Z-Image-Turbo 极速版",
                badge: "4~8 步极速",
                badgeColor: "blue",
                baseModel: "Z-Image-Turbo Int8",
                description: "基于 Z-Image-Turbo 极速出图架构，在保持极快采样速度的同时生成高画质图像，适合画布快速创意发散与秒级反馈。",
                uiFileName: "z_image_turbo_workflow.json",
                uiDownloadUrl: "/workflows/z_image_turbo_workflow.json",
                apiFileName: "z_image_turbo_api.json",
                apiDownloadUrl: "/workflows/z_image_turbo_api.json",
                models: [
                    { category: "VAE", folder: "models/vae/", files: ["ae.safetensors"] },
                    { category: "扩散模型", folder: "models/diffusion_models/", files: ["z_image_turbo_bf16.safetensors"] },
                    { category: "文本编码器", folder: "models/text_encoders/", files: ["qwen_3_4b.safetensors"] },
                ],
                tips: "标准原生节点即可运行，显存最低仅需 8GB；ComfyUI 需确保支持新版 Qwen 文本编码器。",
            },
        ],
    },
    {
        id: "i2i",
        name: "图生图工作流 (I2I)",
        category: "image",
        defaultVariantId: "qwen21",
        variants: [
            {
                id: "qwen21",
                label: "Qwen-Image-2.1 多图参考",
                badge: "最多10张参考图",
                badgeColor: "cyan",
                baseModel: "Qwen-Image-2.1 BF16",
                description: "原生支持最多 10 张图片联合垫图与多模态特征融合；未连满的插槽在提交时自动剪除，完全无参考图时自动回退为纯文生图。",
                uiFileName: "qwen_image_21_api.json",
                uiDownloadUrl: "/workflows/qwen_image_21_api.json",
                apiFileName: "qwen_image_21_api.json",
                apiDownloadUrl: "/workflows/qwen_image_21_api.json",
                models: [
                    { category: "扩散模型", folder: "models/diffusion_models/", files: ["qwen_image_2.1_bf16.safetensors"] },
                    { category: "多模态CLIP", folder: "models/clip/", files: ["qwen3vl_8b_bf16.safetensors"] },
                    { category: "VAE", folder: "models/vae/", files: ["qwen_image_2.1_vae_bf16.safetensors"] },
                ],
                tips: "显式提供 ref_image_01 ~ ref_image_10 插槽；系统提交时智能自适应剪除未连线节点。",
            },
            {
                id: "qwen21_int8",
                label: "Qwen-Image-2.1 Int8 多图参考",
                badge: "最多10张图 / Int8",
                badgeColor: "blue",
                baseModel: "Qwen-Image-2.1 Int8",
                description: "原生支持最多 10 张图片联合垫图与多模态特征融合，UNet 与 CLIP 均采用 Int8 量化，显存更低且支持消费级显卡多图图生图。",
                uiFileName: "i2i_qwen_image_21_int8_workflow.json",
                uiDownloadUrl: "/workflows/i2i_qwen_image_21_int8_workflow.json",
                apiFileName: "i2i_qwen_image_21_int8_api.json",
                apiDownloadUrl: "/workflows/i2i_qwen_image_21_int8_api.json",
                models: [
                    { category: "扩散模型", folder: "models/diffusion_models/", files: ["qwen_image_2.1_turbo_int8_convrot.safetensors"] },
                    { category: "多模态CLIP", folder: "models/clip/", files: ["qwen3vl_8b_int8_convrot.safetensors"] },
                    { category: "VAE", folder: "models/vae/", files: ["qwen_image_2.1_vae_bf16.safetensors"] },
                ],
                tips: "显式提供 ref_image_01 ~ ref_image_10 插槽；系统提交时智能自适应剪除未连线节点，零图自动回退纯文生图。",
            },
            {
                id: "flux",
                label: "Flux2.Dev 风格迁移",
                badge: "8~16 步 Turbo",
                badgeColor: "purple",
                baseModel: "Flux2.Dev FP8",
                description: "基于 Flux2.Dev Flow Matching 架构，支持在画布中连接多张参考图进行风格迁移、融合推演与高质量图生图。",
                uiFileName: "flux2_dev_i2i_workflow.json",
                uiDownloadUrl: "/workflows/flux2_dev_i2i_workflow.json",
                apiFileName: "flux2_dev_i2i_api.json",
                apiDownloadUrl: "/workflows/flux2_dev_i2i_api.json",
                models: [
                    { category: "LoRA", folder: "models/loras/", files: ["Flux2TurboComfyv2.safetensors"] },
                    { category: "VAE", folder: "models/vae/", files: ["flux2-vae.safetensors"] },
                    { category: "扩散模型", folder: "models/diffusion_models/", files: ["flux2_dev_fp8mixed.safetensors"] },
                    { category: "文本编码器", folder: "models/text_encoders/", files: ["mistral_3_small_flux2_fp8.safetensors"] },
                ],
                tips: "Flow Matching 架构顶级质感，推荐 16GB 以上显存；显存较小可配置 ComfyUI 启动参数 --lowvram。",
            },
        ],
    },
    {
        id: "inpaint",
        name: "局部编辑工作流 (Inpaint)",
        category: "image",
        defaultVariantId: "qwen_inpaint",
        variants: [
            {
                id: "qwen_inpaint",
                label: "Qwen-Image 局部重绘",
                badge: "4 步 Lightning",
                badgeColor: "cyan",
                baseModel: "Qwen-Image Inpaint",
                description: "专为无限画布局部涂抹修图设计，接收前端遮罩图（ref_mask），借助 Qwen 2.5-VL 视觉理解实现无缝边缘贴合与局部内容修改替换。",
                uiFileName: "qwen_image_inpaint_workflow.json",
                uiDownloadUrl: "/workflows/qwen_image_inpaint_workflow.json",
                apiFileName: "qwen_image_inpaint_api.json",
                apiDownloadUrl: "/workflows/qwen_image_inpaint_api.json",
                plugins: [
                    { name: "ComfyUI_LayerStyle", url: "https://github.com/chflame163/ComfyUI_LayerStyle" },
                ],
                models: [
                    { category: "LoRA", folder: "models/loras/", files: ["Qwen-Image-Lightning-4steps-V1.0.safetensors"] },
                    { category: "VAE", folder: "models/vae/", files: ["qwen_image_vae.safetensors"] },
                    { category: "扩散模型", folder: "models/diffusion_models/", files: ["qwen_image_fp8_e4m3fn.safetensors"] },
                    { category: "文本编码器", folder: "models/text_encoders/", files: ["qwen_2.5_vl_7b_fp8_scaled.safetensors"] },
                ],
                tips: "画布节点涂抹生成的白色 Mask 会自动送入 ref_mask 槽位；依赖 ComfyUI_LayerStyle 插件处理遮罩与图层边缘融合。",
            },
        ],
    },
    {
        id: "llm",
        name: "文本生成 / 反推工作流 (LLM)",
        category: "refine",
        defaultVariantId: "qwen35",
        variants: [
            {
                id: "qwen35",
                label: "Qwen3.5 4B 端侧大模型",
                badge: "端侧 4B / 离线保密",
                badgeColor: "green",
                baseModel: "Qwen3.5 4B BF16",
                description: "用于无限画布中的多模态文本生成、提示词润色扩写与画面反推，由本地端侧 4B 轻量大语言模型直接驱动，仅需 4G~6G 显存。",
                uiFileName: "qwen3_5_text_workflow.json",
                uiDownloadUrl: "/workflows/qwen3_5_text_workflow.json",
                apiFileName: "qwen3_5_text_api.json",
                apiDownloadUrl: "/workflows/qwen3_5_text_api.json",
                plugins: [
                    { name: "Comfyui-kktools", url: "https://github.com/zhiwendesign/Comfyui-kktools" },
                    { name: "ComfyUI-UniversalToolkit", url: "https://github.com/whmc76/ComfyUI-UniversalToolkit" },
                ],
                models: [
                    { category: "语言模型", folder: "models/diffusion_models/", files: ["qwen3.5_4b_bf16.safetensors"] },
                ],
                tips: "依赖第三方插件 Comfyui-kktools 和 ComfyUI-UniversalToolkit；纯本地离线执行，提示词完全私密。",
            },
        ],
    },
    {
        id: "ref_video",
        name: "全能参考视频工作流 (Omni Video)",
        category: "video",
        defaultVariantId: "pdmd",
        variants: [
            {
                id: "pdmd",
                label: "FP8 4步 PDMD (极速版)",
                badge: "4 步极速 / EasyCache",
                badgeColor: "orange",
                baseModel: "MiniMax H3 ref2va (FP8 + PDMD LoRA)",
                description: "挂载 PDMD 4步蒸馏 LoRA 与 ComfyUI 原生 EasyCache 特征缓存加速，仅需 4 步采样秒级出片，大幅降低耗时与显存门槛。",
                uiFileName: "minimax_h3_ref2v_4step_pdmd_workflow.json",
                uiDownloadUrl: "/workflows/minimax_h3_ref2v_4step_pdmd_workflow.json",
                apiFileName: "minimax_h3_ref2v_4step_pdmd_api.json",
                apiDownloadUrl: "/workflows/minimax_h3_ref2v_4step_pdmd_api.json",
                plugins: [
                    { name: "ComfyUI-KJNodes", url: "https://github.com/kijai/ComfyUI-KJNodes" },
                    { name: "ComfyLiterals", url: "https://github.com/M1kep/ComfyLiterals" },
                ],
                models: [
                    { category: "LoRA", folder: "models/loras/", files: ["minimax_h3_pdmd_4step_lora_avg_rank_57_bf16.safetensors"] },
                    { category: "扩散模型", folder: "models/diffusion_models/", files: ["minimax_h3_ref2va_pruned_fp8_scaled.safetensors"] },
                    { category: "文本编码器", folder: "models/text_encoders/", files: ["qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors"] },
                    { category: "视频 VAE", folder: "models/vae/", files: ["minimax_h3_video_vae_fp16.safetensors"] },
                    { category: "音频 VAE", folder: "models/vae/", files: ["minimax_h3_audio_vae_fp32.safetensors"] },
                ],
                tips: "挂载 4 步 PDMD 蒸馏 LoRA + EasyCache 特征缓存，耗时极短；支持最多 9 图 + 3 视频 + 3 音频参考。",
            },
            {
                id: "fp8_20",
                label: "FP8 20步 (消费级推荐)",
                badge: "20 步标准 / 显存优化",
                badgeColor: "gold",
                baseModel: "MiniMax H3 ref2va (FP8)",
                description: "显存优化版，适合 RTX 3090/4090 或 16G~24G 单卡，提供标准 20 步稳健采样与原生音画同步生成。",
                uiFileName: "minimax_h3_ref2va_workflow.json",
                uiDownloadUrl: "/workflows/minimax_h3_ref2va_workflow.json",
                apiFileName: "minimax_h3_ref2va_fp8_20step_api.json",
                apiDownloadUrl: "/workflows/minimax_h3_ref2va_fp8_20step_api.json",
                plugins: [
                    { name: "ComfyUI-KJNodes", url: "https://github.com/kijai/ComfyUI-KJNodes" },
                    { name: "ComfyLiterals", url: "https://github.com/M1kep/ComfyLiterals" },
                ],
                models: [
                    { category: "扩散模型", folder: "models/diffusion_models/", files: ["minimax_h3_ref2va_pruned_fp8_scaled.safetensors"] },
                    { category: "文本编码器", folder: "models/text_encoders/", files: ["qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors"] },
                    { category: "视频 VAE", folder: "models/vae/", files: ["minimax_h3_video_vae_fp16.safetensors"] },
                    { category: "音频 VAE", folder: "models/vae/", files: ["minimax_h3_audio_vae_fp32.safetensors"] },
                ],
                tips: "标准消费级显存优化版，未连满的多模态插槽提交前自动优雅剔除。",
            },
            {
                id: "turbo_8",
                label: "BF16 8步 Turbo (性能版)",
                badge: "8 步 Turbo / 性能级",
                badgeColor: "cyan",
                baseModel: "MiniMax H3 ref2va (BF16 + Turbo LoRA)",
                description: "挂载 Turbo LoRA 加速，8 步极速采样，适合 24G+ / A100 / H100 专业级显卡算力环境。",
                uiFileName: "minimax_h3_ref2va_workflow.json",
                uiDownloadUrl: "/workflows/minimax_h3_ref2va_workflow.json",
                apiFileName: "minimax_h3_ref2va_bf16_8step_turbo_api.json",
                apiDownloadUrl: "/workflows/minimax_h3_ref2va_bf16_8step_turbo_api.json",
                plugins: [
                    { name: "ComfyUI-KJNodes", url: "https://github.com/kijai/ComfyUI-KJNodes" },
                    { name: "ComfyLiterals", url: "https://github.com/M1kep/ComfyLiterals" },
                ],
                models: [
                    { category: "LoRA", folder: "models/loras/", files: ["minimax_h3_ref2v_lightx2v_turbo_4step_v0.1_resized_avg_rank_20_bf16.safetensors"] },
                    { category: "扩散模型", folder: "models/diffusion_models/", files: ["minimax_h3_ref2va_bf16.safetensors"] },
                    { category: "文本编码器", folder: "models/text_encoders/", files: ["qwen3vl_32b_minimax_h3_bf16.safetensors"] },
                    { category: "视频 VAE", folder: "models/vae/", files: ["minimax_h3_video_vae_fp16.safetensors"] },
                    { category: "音频 VAE", folder: "models/vae/", files: ["minimax_h3_audio_vae_fp32.safetensors"] },
                ],
                tips: "全精度底模 + Turbo LoRA，生成速度与画质兼备，适合专业计算卡。",
            },
            {
                id: "bf16_20",
                label: "BF16 20步 (全量高精)",
                badge: "20 步全精度 / 旗舰画质",
                badgeColor: "blue",
                baseModel: "MiniMax H3 ref2va (BF16 全量)",
                description: "完整精度的 20 步标准采样，画质上限最高，具备极高保真度与多模态复杂场景推演能力。",
                uiFileName: "minimax_h3_ref2va_workflow.json",
                uiDownloadUrl: "/workflows/minimax_h3_ref2va_workflow.json",
                apiFileName: "minimax_h3_ref2va_bf16_20step_api.json",
                apiDownloadUrl: "/workflows/minimax_h3_ref2va_bf16_20step_api.json",
                plugins: [
                    { name: "ComfyUI-KJNodes", url: "https://github.com/kijai/ComfyUI-KJNodes" },
                    { name: "ComfyLiterals", url: "https://github.com/M1kep/ComfyLiterals" },
                ],
                models: [
                    { category: "扩散模型", folder: "models/diffusion_models/", files: ["minimax_h3_ref2va_bf16.safetensors"] },
                    { category: "文本编码器", folder: "models/text_encoders/", files: ["qwen3vl_32b_minimax_h3_bf16.safetensors"] },
                    { category: "视频 VAE", folder: "models/vae/", files: ["minimax_h3_video_vae_fp16.safetensors"] },
                    { category: "音频 VAE", folder: "models/vae/", files: ["minimax_h3_audio_vae_fp32.safetensors"] },
                ],
                tips: "画质上限最高，需 24GB+ 显存支持；分辨率严格锁定在 0.2M~0.98M 对齐档位。",
            },
        ],
    },
    {
        id: "frame_video",
        name: "首尾帧视频工作流 (FL2V)",
        category: "video",
        defaultVariantId: "pdmd",
        variants: [
            {
                id: "pdmd",
                label: "FP8 4步 PDMD (极速版)",
                badge: "4 步极速插值",
                badgeColor: "orange",
                baseModel: "MiniMax H3 fl2va (FP8 + PDMD LoRA)",
                description: "显存优化底模，挂载 PDMD 4步蒸馏 LoRA，仅需 4 步极速完成首尾两帧的平滑插值演化，大幅缩短生成等待耗时。",
                uiFileName: "minimax_h3_fl2va_fp8_4step_pdmd_workflow.json",
                uiDownloadUrl: "/workflows/minimax_h3_fl2va_fp8_4step_pdmd_workflow.json",
                apiFileName: "minimax_h3_fl2va_fp8_4step_pdmd_api.json",
                apiDownloadUrl: "/workflows/minimax_h3_fl2va_fp8_4step_pdmd_api.json",
                plugins: [
                    { name: "ComfyLiterals", url: "https://github.com/M1kep/ComfyLiterals" },
                ],
                models: [
                    { category: "LoRA", folder: "models/loras/", files: ["minimax_h3_pdmd_4step_lora_avg_rank_57_bf16.safetensors"] },
                    { category: "扩散模型", folder: "models/diffusion_models/", files: ["minimax_h3_fl2va_pruned_fp8_scaled.safetensors"] },
                    { category: "文本编码器", folder: "models/text_encoders/", files: ["qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors"] },
                    { category: "视频 VAE", folder: "models/vae/", files: ["minimax_h3_video_vae_fp16.safetensors"] },
                    { category: "音频 VAE", folder: "models/vae/", files: ["minimax_h3_audio_vae_fp32.safetensors"] },
                ],
                tips: "输入首尾两帧精准锚定运镜与动作插值；依赖 ComfyLiterals 节点。",
            },
            {
                id: "fp8_20",
                label: "FP8 20步 (消费级推荐)",
                badge: "20 步标准 / 显存优化",
                badgeColor: "gold",
                baseModel: "MiniMax H3 fl2va (FP8)",
                description: "显存优化版，适合 RTX 3090/4090 或 16G~24G 单卡，提供标准 20 步稳健首尾帧视频生成。",
                uiFileName: "minimax_h3_fl2va_workflow.json",
                uiDownloadUrl: "/workflows/minimax_h3_fl2va_workflow.json",
                apiFileName: "minimax_h3_fl2va_fp8_20step_api.json",
                apiDownloadUrl: "/workflows/minimax_h3_fl2va_fp8_20step_api.json",
                plugins: [
                    { name: "ComfyLiterals", url: "https://github.com/M1kep/ComfyLiterals" },
                ],
                models: [
                    { category: "扩散模型", folder: "models/diffusion_models/", files: ["minimax_h3_fl2va_pruned_fp8_scaled.safetensors"] },
                    { category: "文本编码器", folder: "models/text_encoders/", files: ["qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors"] },
                    { category: "视频 VAE", folder: "models/vae/", files: ["minimax_h3_video_vae_fp16.safetensors"] },
                    { category: "音频 VAE", folder: "models/vae/", files: ["minimax_h3_audio_vae_fp32.safetensors"] },
                ],
                tips: "标准 20 步首尾帧插值，音画同步输出。",
            },
            {
                id: "turbo_8",
                label: "BF16 8步 Turbo (性能版)",
                badge: "8 步 Turbo / 性能级",
                badgeColor: "cyan",
                baseModel: "MiniMax H3 fl2va (BF16 + Turbo LoRA)",
                description: "挂载 Turbo LoRA 加速，8 步极速出片，适合高性能工作站或专业计算卡环境。",
                uiFileName: "minimax_h3_fl2va_workflow.json",
                uiDownloadUrl: "/workflows/minimax_h3_fl2va_workflow.json",
                apiFileName: "minimax_h3_fl2va_bf16_8step_turbo_api.json",
                apiDownloadUrl: "/workflows/minimax_h3_fl2va_bf16_8step_turbo_api.json",
                plugins: [
                    { name: "ComfyLiterals", url: "https://github.com/M1kep/ComfyLiterals" },
                ],
                models: [
                    { category: "LoRA", folder: "models/loras/", files: ["minimax_h3_ref2v_lightx2v_turbo_4step_v0.1_resized_avg_rank_20_bf16.safetensors"] },
                    { category: "扩散模型", folder: "models/diffusion_models/", files: ["minimax_h3_fl2va_bf16.safetensors"] },
                    { category: "文本编码器", folder: "models/text_encoders/", files: ["qwen3vl_32b_minimax_h3_bf16.safetensors"] },
                    { category: "视频 VAE", folder: "models/vae/", files: ["minimax_h3_video_vae_fp16.safetensors"] },
                    { category: "音频 VAE", folder: "models/vae/", files: ["minimax_h3_audio_vae_fp32.safetensors"] },
                ],
                tips: "BF16 全精度底模 + Turbo LoRA，高帧率动作流畅平滑。",
            },
            {
                id: "bf16_20",
                label: "BF16 20步 (全量高精)",
                badge: "20 步全精度 / 旗舰过渡",
                badgeColor: "blue",
                baseModel: "MiniMax H3 fl2va (BF16 全量)",
                description: "完整精度的 20 步采样，首尾插值细节与画质表现力最强。",
                uiFileName: "minimax_h3_fl2va_workflow.json",
                uiDownloadUrl: "/workflows/minimax_h3_fl2va_workflow.json",
                apiFileName: "minimax_h3_fl2va_bf16_20step_api.json",
                apiDownloadUrl: "/workflows/minimax_h3_fl2va_bf16_20step_api.json",
                plugins: [
                    { name: "ComfyLiterals", url: "https://github.com/M1kep/ComfyLiterals" },
                ],
                models: [
                    { category: "扩散模型", folder: "models/diffusion_models/", files: ["minimax_h3_fl2va_bf16.safetensors"] },
                    { category: "文本编码器", folder: "models/text_encoders/", files: ["qwen3vl_32b_minimax_h3_bf16.safetensors"] },
                    { category: "视频 VAE", folder: "models/vae/", files: ["minimax_h3_video_vae_fp16.safetensors"] },
                    { category: "音频 VAE", folder: "models/vae/", files: ["minimax_h3_audio_vae_fp32.safetensors"] },
                ],
                tips: "最高画质首尾帧演化，显存需求较高。",
            },
        ],
    },
    {
        id: "depth_video",
        name: "视频深度估计工作流 (Depth Video)",
        category: "video",
        defaultVariantId: "depth_video_h3",
        variants: [
            {
                id: "depth_video_h3",
                label: "ReShot 视频深度估计 (VDA-Small)",
                badge: "深度提取 / 运镜复刻",
                badgeColor: "cyan",
                baseModel: "Video Depth Anything Small",
                description: "「复制走位与运镜，不复制演员与画风」：将输入参考视频转为时序连贯稳定的灰度深度视频（近白远黑），保留人物空间站位、肢体动作与摄像机运镜轨迹，彻底剥离演员外貌与画风，生成的深度视频可无缝作为 MiniMax H3 或 ControlNet 的强结构参考。",
                uiFileName: "depth_video_workflow.json",
                uiDownloadUrl: "/workflows/depth_video_workflow.json",
                apiFileName: "depth_video_api.json",
                apiDownloadUrl: "/workflows/depth_video_api.json",
                plugins: [
                    { name: "ComfyUI-ReShot", url: "https://github.com/maosika-ai/ComfyUI-ReShot" },
                ],
                models: [
                    { category: "深度估计模型", folder: "~/.cache/huggingface/hub/models--depth-anything--Video-Depth-Anything-Small/", files: ["video_depth_anything_vits.pth (约111MB，首次运行自动下载)"] },
                ],
                tips: "⚠️ 依赖 ComfyUI-ReShot 插件；权重首次执行自动下载（国内网络可设置 HF_ENDPOINT=https://hf-mirror.com 加速）；输出尺寸自动居中裁切对齐 32 整数倍（杜绝黑边干扰）。",
            },
        ],
    },
    {
        id: "audio",
        name: "音乐与音频工作流 (Audio / Music)",
        category: "audio",
        defaultVariantId: "music3",
        variants: [
            {
                id: "music3",
                label: "MiniMax Music 03",
                badge: "双文本驱动 / 30s~300s",
                badgeColor: "magenta",
                baseModel: "MiniMax Music 03 (DiT)",
                description: "基于 MiniMax Music 03 音频扩散大模型，支持全风格人声歌曲、BGM 伴奏与纯器乐生成；双文本驱动（caption 编曲风格 + lyrics 曲式歌词标签）；内置切块解码防爆显存。",
                uiFileName: "audio_minimax_music_3_workflow.json",
                uiDownloadUrl: "/workflows/audio_minimax_music_3_workflow.json",
                apiFileName: "audio_minimax_music_3_api.json",
                apiDownloadUrl: "/workflows/audio_minimax_music_3_api.json",
                plugins: [
                    { name: "ComfyLiterals", url: "https://github.com/M1kep/ComfyLiterals" },
                ],
                models: [
                    { category: "DiT扩散模型", folder: "models/diffusion_models/", files: ["minimax_music3_dit_fp16.safetensors"] },
                    { category: "文本编码器", folder: "models/text_encoders/", files: ["minimax_music3_text_encoder_pruned_int8_convrot.safetensors"] },
                    { category: "音频 VAE", folder: "models/vae/", files: ["minimax_music3_dav.safetensors"] },
                ],
                tips: "⚠️ ComfyUI 核心版本需更新至 v0.31.0+（原生集成 MiniMaxMusic3 节点）；在 lyrics 中使用 [intro]、[verse]、[chorus]、[inst] 控制曲式结构。",
            },
        ],
    },
    {
        id: "face_refine",
        name: "视频人脸追踪精修工作流 (Face Refine)",
        category: "refine",
        defaultVariantId: "face_refine_h3",
        variants: [
            {
                id: "face_refine_h3",
                label: "H3 Face Refine Auto Select",
                badge: "8 步 Turbo / 闭环精修",
                badgeColor: "volcano",
                baseModel: "MiniMax H3 ref2va + Turbo LoRA + YOLO",
                description: "专为解决 AI 视频中远景小脸崩坏、五官模糊扭曲、运镜面部抽搐闪烁设计；YOLO 时序追踪裁剪 + 原生口型音频锁 + 依据面部像素绝对尺寸逐帧动态去噪 + 逆几何变换无缝羽化缝合。",
                uiFileName: "H3_Face_Refine_Auto_Select_workflow.json",
                uiDownloadUrl: "/workflows/H3_Face_Refine_Auto_Select_workflow.json",
                apiFileName: "H3_Face_Refine_Auto_Select_Api.json",
                apiDownloadUrl: "/workflows/H3_Face_Refine_Auto_Select_Api.json",
                plugins: [
                    { name: "ComfyUI-MiniMaxH3-Myang", url: "https://github.com/civilcoco/ComfyUI-MiniMaxH3-Myang" },
                    { name: "ComfyUI-VideoHelperSuite", url: "https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite" },
                    { name: "ComfyUI-KJNodes", url: "https://github.com/kijai/ComfyUI-KJNodes" },
                    { name: "ComfyLiterals", url: "https://github.com/M1kep/ComfyLiterals" },
                ],
                models: [
                    { category: "扩散模型", folder: "models/diffusion_models/", files: ["minimax_h3_ref2va_pruned_fp8_scaled.safetensors"] },
                    { category: "LoRA", folder: "models/loras/", files: ["minimax_h3_fl2v_turbo_8step_v1.0_comfyui_bf16.safetensors"] },
                    { category: "文本编码器", folder: "models/text_encoders/", files: ["qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors"] },
                    { category: "视频 VAE", folder: "models/vae/", files: ["minimax_h3_video_vae_fp16.safetensors"] },
                    { category: "音频 VAE", folder: "models/vae/", files: ["minimax_h3_audio_vae_fp32.safetensors"] },
                    { category: "人体分割检测器", folder: "models/ultralytics/segm/", files: ["person_yolov8m-seg.pt"] },
                    { category: "人脸回退检测器", folder: "models/ultralytics/bbox/", files: ["face_yolov8m.pt"] },
                ],
                tips: "⚠️ 依赖 ComfyUI-MiniMaxH3-Myang 与 VHS 扩展插件；YOLO 权重需放入 models/ultralytics/ 目录；系统已内置 Windows 与 Linux 跨平台路径自适应转换。",
            },
        ],
    },
];

type CategoryFilter = "all" | "image" | "video" | "audio" | "refine";

type ChannelProbeStatus = {
    state: "unknown" | "probing" | "online" | "offline";
    statusCode?: number;
    latencyMs?: number;
    message?: string;
};

export default function GuidePage() {
    const { t, i18n } = useTranslation();
    const isZh = i18n.resolvedLanguage === "zh-CN";
    const { message } = App.useApp();
    const copyText = useCopyText();
    const [downloadingZip, setDownloadingZip] = useState(false);
    const [detecting, setDetecting] = useState(false);
    const [activeCategory, setActiveCategory] = useState<CategoryFilter>("all");

    // 保存每张卡片当前选中的规格 ID
    const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>(() => {
        const initial: Record<string, string> = {};
        for (const wf of WORKFLOWS) {
            initial[wf.id] = wf.defaultVariantId;
        }
        return initial;
    });

    const config = useConfigStore((state) => state.config);
    const comfyChannels = useMemo(() => {
        const list = config.channels.filter((c) => c.apiFormat === "comfyui" || c.comfyuiProxyUrl?.trim());
        return list.length > 0 ? list : config.channels;
    }, [config.channels]);

    const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>(() => {
        return comfyChannels.map((c) => c.id);
    });
    const [probeStatuses, setProbeStatuses] = useState<Record<string, ChannelProbeStatus>>({});

    useEffect(() => {
        setSelectedChannelIds((prev) => {
            const validIds = new Set(comfyChannels.map((c) => c.id));
            const filtered = prev.filter((id) => validIds.has(id));
            return filtered.length > 0 ? filtered : comfyChannels.map((c) => c.id);
        });
    }, [comfyChannels]);

    const probeSingleChannel = async (channel: ModelChannel): Promise<ChannelProbeStatus> => {
        const rawUrl = (channel.comfyuiProxyUrl || "").trim() || "http://127.0.0.1:8188";
        const baseEndpoint = rawUrl.replace(/\/+$/, "");
        const probeUrl = `${baseEndpoint}/system_stats`;
        const start = performance.now();

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4000);
            const headers: Record<string, string> = {};
            if (channel.comfyuiProxyToken?.trim()) {
                headers.Authorization = `Bearer ${channel.comfyuiProxyToken.trim()}`;
            }
            const res = await fetch(probeUrl, {
                method: "GET",
                headers,
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            const latencyMs = Math.round(performance.now() - start);

            if (res.ok) {
                return {
                    state: "online",
                    statusCode: res.status,
                    latencyMs,
                    message: "服务正常，已就绪",
                };
            } else {
                return {
                    state: "offline",
                    statusCode: res.status,
                    latencyMs,
                    message: `响应状态码: ${res.status}`,
                };
            }
        } catch (err) {
            const isAbort = err instanceof DOMException && err.name === "AbortError";
            return {
                state: "offline",
                message: isAbort ? "请求超时" : "未连通 / 跨域受限",
            };
        }
    };

    const handleProbeSelected = async (targetIds?: string[]) => {
        const ids = targetIds || selectedChannelIds;
        if (ids.length === 0) {
            message.warning("请至少选择一个渠道进行探测");
            return;
        }

        const targets = comfyChannels.filter((c) => ids.includes(c.id));
        if (targets.length === 0) return;

        setDetecting(true);
        setProbeStatuses((prev) => {
            const next = { ...prev };
            for (const t of targets) {
                next[t.id] = { state: "probing" };
            }
            return next;
        });

        const results = await Promise.allSettled(
            targets.map(async (channel) => {
                const res = await probeSingleChannel(channel);
                setProbeStatuses((prev) => ({
                    ...prev,
                    [channel.id]: res,
                }));
                return { channel, res };
            })
        );

        setDetecting(false);

        const onlineCount = results.filter(
            (r) => r.status === "fulfilled" && r.value.res.state === "online"
        ).length;
        if (onlineCount === targets.length) {
            message.success(`探测完成：全部 ${targets.length} 个渠道均在线就绪！`);
        } else if (onlineCount > 0) {
            message.info(`探测完成：${onlineCount}/${targets.length} 个渠道在线就绪`);
        } else {
            message.warning(`探测完成：选中的 ${targets.length} 个渠道均未能连通，请确认服务是否开启或跨域参数`);
        }
    };

    const handleProbeSingle = async (channel: ModelChannel) => {
        setProbeStatuses((prev) => ({
            ...prev,
            [channel.id]: { state: "probing" },
        }));
        const res = await probeSingleChannel(channel);
        setProbeStatuses((prev) => ({
            ...prev,
            [channel.id]: res,
        }));
        if (res.state === "online") {
            message.success(`渠道「${channel.name}」在线就绪 (${res.latencyMs}ms)`);
        } else {
            message.error(`渠道「${channel.name}」未连通 (${res.message || "请检查服务与跨域参数"})`);
        }
    };

    const handleDownloadSingle = (downloadUrl: string, fileName: string) => {
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        message.success(`开始下载 ${fileName}`);
    };

    const handleDownloadAllZip = async () => {
        setDownloadingZip(true);
        try {
            const zipFiles: Array<{ name: string; data: BlobPart }> = [];
            const collectedFiles = new Set<string>();

            // 收集所有 9 大能力矩阵下的全部变体文件（包括 UI 与 API 格式）
            for (const wf of WORKFLOWS) {
                for (const variant of wf.variants) {
                    if (!collectedFiles.has(variant.uiFileName)) {
                        collectedFiles.add(variant.uiFileName);
                        const res = await fetch(variant.uiDownloadUrl);
                        if (res.ok) {
                            const text = await res.text();
                            zipFiles.push({ name: `ui_workflows/${variant.uiFileName}`, data: text });
                        }
                    }
                    if (!collectedFiles.has(variant.apiFileName)) {
                        collectedFiles.add(variant.apiFileName);
                        const res = await fetch(variant.apiDownloadUrl);
                        if (res.ok) {
                            const text = await res.text();
                            zipFiles.push({ name: `api_workflows/${variant.apiFileName}`, data: text });
                        }
                    }
                }
            }

            const readmeContent = [
                "# Infinite Canvas · ComfyUI 官方全套内置工作流资产包",
                "",
                "本压缩包收录了 Infinite Canvas 官方推荐的全部 9 大能力矩阵工作流：",
                "- ui_workflows/: ComfyUI 可视化工作流（可直接拖拽入本地 ComfyUI Web 界面查看节点连线并调试）",
                "- api_workflows/: ComfyUI API 格式工作流（用于系统设置内模型渠道绑定与直接调度）",
                "",
                "==================================================",
                "9 大能力矩阵与模型放置清单：",
                "==================================================",
                ...WORKFLOWS.map((wf) => {
                    const variantDetails = wf.variants.map((v) => {
                        return [
                            `  * 规格: ${v.label} [${v.badge}]`,
                            `    - 核心底模: ${v.baseModel}`,
                            `    - UI 连线文件: ${v.uiFileName}`,
                            `    - API 格式文件: ${v.apiFileName}`,
                            `    - 依赖模型放置:`,
                            ...v.models.map((m) => `      [${m.category}] ${m.folder}: ${m.files.join(", ")}`),
                            v.tips ? `    - 调试注意: ${v.tips}` : "",
                        ].filter(Boolean).join("\n");
                    }).join("\n\n");

                    return `\n## ${wf.name}\n${variantDetails}`;
                }),
                "",
                "==================================================",
                "必备核心扩展插件清单：",
                "==================================================",
                "1. 通用必备 5 大基础插件（克隆至 custom_nodes/ 目录）：",
                ...CORE_PLUGINS.map((p, idx) => `   ${idx + 1}. ${p.name} (${p.url}) - ${p.desc} [${p.usedBy}]`),
                "",
                "   [一键克隆基础插件命令]：",
                CLONE_CORE_PLUGINS_CMD,
                "",
                "2. 视频人脸追踪精修与深度估计进阶套件（克隆至 custom_nodes/ 并安装依赖）：",
                ...ADVANCED_PLUGINS.map((p, idx) => `   ${idx + 1}. ${p.name} (${p.url}) - ${p.desc} [${p.usedBy}]`),
                "",
                "   [一键克隆进阶插件命令]：",
                CLONE_ADVANCED_PLUGINS_CMD,
                "",
                "==================================================",
                "环境与服务部署要点：",
                "==================================================",
                `1. {isZh ? "启动本地 ComfyUI" : "Launch ComfyUI"} 必须开启跨域：例如 \`${LAUNCH_CMD_EXAMPLE}\`；`,
                "2. 音频生成 (MiniMax Music 03) 依赖 ComfyUI 核心版本 >= v0.31.0+；",
                "3. 视频深度估计 (Video Depth Anything) 首次运行自动下载权重（约 111MB，国内可配置 HF_ENDPOINT=https://hf-mirror.com）；",
                "4. 人脸精修 YOLO 权重请放置于 ComfyUI models/ultralytics/ 对应子目录；",
                "5. 视频生成尺寸严格锁定在 0.2M~0.98M 的 9 档硬件对齐预设中（16:9 与 9:16 对称）；",
                "6. 将 UI 工作流拖入 ComfyUI 点击 Queue Prompt 测试成功后，回到系统「设置 → 模型渠道」确认服务端口即可畅享创作！",
            ].join("\n");

            zipFiles.push({ name: "README_模型与存放目录清单.txt", data: readmeContent });

            const zipBlob = await createZip(zipFiles);
            saveAs(zipBlob, "infinite-canvas-comfyui-workflows.zip");
            message.success("工作流全套合集打包下载成功！");
        } catch (error) {
            message.error(error instanceof Error ? error.message : "打包下载失败");
        } finally {
            setDownloadingZip(false);
        }
    };

    const filteredWorkflows = useMemo(() => {
        if (activeCategory === "all") return WORKFLOWS;
        return WORKFLOWS.filter((w) => w.category === activeCategory);
    }, [activeCategory]);

    return (
        <main className="h-full overflow-y-auto bg-background text-stone-950 dark:text-stone-100">
            <div className="mx-auto max-w-6xl px-6 py-8 pb-20">
                {/* 顶部标题区 */}
                <div className="mb-8 flex flex-col justify-between gap-4 border-b border-stone-200 pb-6 md:flex-row md:items-end dark:border-stone-800">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-stone-100/70 px-3 py-1 text-xs text-stone-600 dark:border-stone-800 dark:bg-stone-900/70 dark:text-stone-400">
                            <Layers className="size-3.5" />
                            <span>{isZh ? "本地自建 ComfyUI 原生 API 直连" : "Direct Native ComfyUI (8188) Connection"}</span>
                        </div>
                        <h1 className="mt-3 text-2xl font-bold tracking-tight text-stone-950 sm:text-3xl dark:text-stone-100">{isZh ? "用户使用手册与工作流下载" : "User Guide & Workflow Downloads"}</h1>
                        <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500 dark:text-stone-400">
                            {isZh ? "Infinite Canvas 采用纯前端无服务器架构，直连您本机的 ComfyUI（默认端口 8188）。系统内置 9 大核心能力矩阵，涵盖图像、视频、音频、深度估计及人脸精修。下载并导入下方官方预设工作流，配齐模型并在本地 ComfyUI 调试通过后，即可在无限画布中开展流畅的全流程 AI 创作。" : "Infinite Canvas uses a pure frontend architecture, connecting directly to your native ComfyUI (default port 8188). Built-in 9 core capability workflows cover image, video, audio, depth, and face refine. Download presets below to create seamlessly on canvas."}
                        </p>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2.5">
                        <Button
                            type="primary"
                            icon={<Package className="size-4" />}
                            loading={downloadingZip}
                            onClick={handleDownloadAllZip}
                        >
                            {isZh ? "打包下载全部工作流 (.zip)" : "Download All Workflows (.zip)"}
                        </Button>
                        <Link to="/config">
                            <Button icon={<ArrowRight className="size-4" />} iconPlacement="end">
                                {isZh ? "前往配置渠道" : "Configure Channels"}
                            </Button>
                        </Link>
                    </div>
                </div>

                {/* ComfyUI 服务连通性轻量诊断条 */}
                <div className="mb-8 rounded-lg border border-stone-200 bg-stone-50 p-4 dark:border-stone-800 dark:bg-stone-900/40">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-stone-200 dark:bg-stone-800">
                                <Terminal className="size-4 text-stone-700 dark:text-stone-300" />
                            </div>
                            <div>
                                <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                                    <span>{isZh ? "服务探测" : "Service Probe"}</span>
                                    <span className="text-xs text-stone-500">
                                        {isZh ? `(共 ${comfyChannels.length} 个配置渠道，已选 ${selectedChannelIds.length} 个)：` : `(${comfyChannels.length} channels configured, ${selectedChannelIds.length} selected):`}
                                    </span>
                                </div>
                                <p className="mt-0.5 text-xs text-stone-500">
                                    {isZh ? "选择需要测试连通性的 ComfyUI 服务渠道。启动时请务必开启跨域参数 " : "Select ComfyUI channels to test connectivity. Ensure CORS flag is enabled: "}
                                    <code className="font-semibold text-stone-800 dark:text-stone-200">{CORS_FLAG}</code>
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Link to="/config">
                                <Button size="small">{isZh ? "修改渠道配置" : "Channel Settings"}</Button>
                            </Link>
                            <Button
                                size="small"
                                type="primary"
                                icon={<RefreshCw className={`size-3.5 ${detecting ? "animate-spin" : ""}`} />}
                                loading={detecting}
                                disabled={selectedChannelIds.length === 0}
                                onClick={() => handleProbeSelected()}
                            >
                                {isZh ? "探测选中渠道" : "Probe Selected"}
                            </Button>
                        </div>
                    </div>

                    {/* 渠道多选控件栏 */}
                    <div className="mt-3.5 flex flex-wrap items-center gap-2 rounded-md border border-stone-200/80 bg-white/70 p-2 text-xs dark:border-stone-800 dark:bg-stone-950/40">
                        <span className="shrink-0 font-medium text-stone-500">选择探测渠道：</span>
                        <div className="min-w-[240px] flex-1">
                            <Select
                                mode="multiple"
                                size="small"
                                className="w-full"
                                placeholder="请选择要探测的渠道"
                                maxTagCount="responsive"
                                value={selectedChannelIds}
                                onChange={setSelectedChannelIds}
                                options={comfyChannels.map((c) => ({
                                    label: `${c.name} (${(c.comfyuiProxyUrl || "").trim() || "http://127.0.0.1:8188"})`,
                                    value: c.id,
                                }))}
                            />
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                            <Button
                                size="small"
                                type="text"
                                onClick={() => setSelectedChannelIds(comfyChannels.map((c) => c.id))}
                                className="text-xs text-stone-500 hover:text-stone-900 dark:hover:text-stone-100"
                            >
                                全选
                            </Button>
                            <Button
                                size="small"
                                type="text"
                                onClick={() => setSelectedChannelIds([])}
                                className="text-xs text-stone-500 hover:text-stone-900 dark:hover:text-stone-100"
                            >
                                清空
                            </Button>
                        </div>
                    </div>

                    {/* 选中的渠道状态展示清单 */}
                    {selectedChannelIds.length > 0 && (
                        <div className="mt-3 space-y-1.5">
                            {selectedChannelIds.map((channelId) => {
                                const channel = comfyChannels.find((c) => c.id === channelId);
                                if (!channel) return null;
                                const channelUrl = (channel.comfyuiProxyUrl || "").trim() || "http://127.0.0.1:8188";
                                const probe = probeStatuses[channel.id];

                                return (
                                    <div
                                        key={channel.id}
                                        className="flex flex-wrap items-center justify-between gap-2 rounded border border-stone-200/70 bg-stone-100/60 px-3 py-2 text-xs dark:border-stone-800/80 dark:bg-stone-900/60"
                                    >
                                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                                            <span className="font-medium text-stone-900 dark:text-stone-100">
                                                {channel.name}
                                            </span>
                                            <code className="max-w-[280px] truncate rounded bg-stone-200/60 px-1.5 py-0.5 font-mono text-[11px] text-stone-700 dark:bg-stone-800 dark:text-stone-300">
                                                {channelUrl}
                                            </code>
                                            {channel.id === config.channels[0]?.id && (
                                                <Tag className="m-0 origin-left scale-90 text-[10px]">
                                                    默认渠道
                                                </Tag>
                                            )}
                                        </div>

                                        <div className="flex shrink-0 items-center gap-2">
                                            {(!probe || probe.state === "unknown") && (
                                                <span className="text-xs text-stone-400">未测试</span>
                                            )}
                                            {probe?.state === "probing" && (
                                                <Tag color="processing" className="m-0 inline-flex items-center gap-1">
                                                    <RefreshCw className="size-3 animate-spin" /> 探测中...
                                                </Tag>
                                            )}
                                            {probe?.state === "online" && (
                                                <Tag color="success" className="m-0 inline-flex items-center gap-1">
                                                    <CheckCircle2 className="size-3" /> 在线就绪
                                                    {probe.latencyMs !== undefined && (
                                                        <span className="font-mono text-[10px] opacity-80">
                                                            {probe.latencyMs}ms
                                                        </span>
                                                    )}
                                                </Tag>
                                            )}
                                            {probe?.state === "offline" && (
                                                <Tag color="error" className="m-0 inline-flex items-center gap-1">
                                                    <AlertCircle className="size-3" /> 未连通 ({probe.message || "请加跨域参数"})
                                                </Tag>
                                            )}

                                            <Tooltip title="单独测试此渠道">
                                                <button
                                                    type="button"
                                                    disabled={probe?.state === "probing"}
                                                    onClick={() => handleProbeSingle(channel)}
                                                    className="inline-flex size-6 items-center justify-center rounded text-stone-400 transition hover:bg-stone-200/70 hover:text-stone-700 dark:hover:bg-stone-800 dark:hover:text-stone-200"
                                                >
                                                    <RefreshCw className={`size-3 ${probe?.state === "probing" ? "animate-spin" : ""}`} />
                                                </button>
                                            </Tooltip>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* 完整启动命令举例与一键复制 */}
                    <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 rounded-md border border-stone-200/70 bg-stone-100/80 px-3 py-2 text-xs dark:border-stone-800 dark:bg-stone-800/60">
                        <div className="flex min-w-0 items-center gap-2 font-mono text-[11px] text-stone-700 dark:text-stone-300">
                            <span className="shrink-0 font-sans font-medium text-stone-500">{isZh ? "推荐启动命令：" : "Launch Command: "}</span>
                            <span className="truncate">{LAUNCH_CMD_EXAMPLE}</span>
                        </div>
                        <Tooltip title={isZh ? "一键复制完整启动命令" : "Copy Full Launch Command"}>
                            <button
                                type="button"
                                onClick={() => copyText(LAUNCH_CMD_EXAMPLE, isZh ? "已复制完整启动命令" : "Launch command copied")}
                                className="inline-flex shrink-0 items-center gap-1 rounded bg-stone-200/70 px-2 py-1 text-[11px] font-medium text-stone-700 transition hover:bg-stone-300 dark:bg-stone-700/80 dark:text-stone-200 dark:hover:bg-stone-600"
                            >
                                <Copy className="size-3" /> {isZh ? "复制命令" : "Copy Command"}
                            </button>
                        </Tooltip>
                    </div>
                </div>

                {/* 极简快速起步四步法 */}
                <div className="mb-10">
                    <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-stone-900 dark:text-stone-100">
                        <Check className="size-4 text-emerald-600 dark:text-emerald-400" />
                        {isZh ? "快速起步：4 步完成本地 ComfyUI 对接" : "Quickstart: 4 Steps to Connect ComfyUI"}
                    </h2>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded-lg border border-stone-200 bg-card p-4 dark:border-stone-800">
                            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-stone-500">
                                <span className="flex size-5 items-center justify-center rounded-full bg-stone-900 !text-white dark:bg-stone-100 dark:!text-stone-900">
                                    1
                                </span>
                                启动本地 ComfyUI
                            </div>
                            <p className="text-xs leading-5 text-stone-600 dark:text-stone-400">{isZh ? "启动命令务必包含跨域参数：" : "Must include CORS flag in launch command:"}</p>
                            <div className="mt-2 flex items-center justify-between rounded bg-stone-100 px-2 py-1.5 font-mono text-[11px] text-stone-800 dark:bg-stone-800/80 dark:text-stone-200">
                                <span className="truncate">{CORS_FLAG}</span>
                                <button
                                    type="button"
                                    onClick={() => copyText(CORS_FLAG, "已复制跨域参数")}
                                    className="ml-1 text-stone-500 hover:text-stone-900 dark:hover:text-stone-100"
                                    title="复制跨域参数"
                                >
                                    <Copy className="size-3" />
                                </button>
                            </div>
                            <button
                                type="button"
                                onClick={() => copyText(LAUNCH_CMD_EXAMPLE, "已复制完整启动命令")}
                                className="mt-2 block text-[11px] text-stone-500 underline decoration-dotted hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
                            >
                                复制完整启动命令
                            </button>
                        </div>

                        <div className="rounded-lg border border-stone-200 bg-card p-4 dark:border-stone-800">
                            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-stone-500">
                                <span className="flex size-5 items-center justify-center rounded-full bg-stone-900 !text-white dark:bg-stone-100 dark:!text-stone-900">
                                    2
                                </span>
                                {isZh ? "下载工作流文件" : "Download Workflows"}
                            </div>
                            <p className="text-xs leading-5 text-stone-600 dark:text-stone-400">
                                {isZh ? "点击右上角打包下载全部工作流，或在下方 9 大能力卡片中按需切换规格下载 UI 连线版或 API 格式。" : "Click top right to download all workflows, or select variants below for UI/API formats."}
                            </p>
                        </div>

                        <div className="rounded-lg border border-stone-200 bg-card p-4 dark:border-stone-800">
                            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-stone-500">
                                <span className="flex size-5 items-center justify-center rounded-full bg-stone-900 !text-white dark:bg-stone-100 dark:!text-stone-900">
                                    3
                                </span>
                                {isZh ? "安装插件与模型" : "Install Plugins & Models"}
                            </div>
                            <p className="text-xs leading-5 text-stone-600 dark:text-stone-400">
                                {isZh ? <>将下方 5 大通用基础插件克隆至 <code className="font-mono">custom_nodes/</code>，权重放入 <code className="font-mono">models/</code> 对应子目录。</> : <>Clone the 5 core plugins to <code className="font-mono">custom_nodes/</code> and put weights in <code className="font-mono">models/</code>.</>}
                            </p>
                        </div>

                        <div className="rounded-lg border border-stone-200 bg-card p-4 dark:border-stone-800">
                            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-stone-500">
                                <span className="flex size-5 items-center justify-center rounded-full bg-stone-900 !text-white dark:bg-stone-100 dark:!text-stone-900">
                                    4
                                </span>
                                {isZh ? "调试成功后即可使用" : "Test & Start Creating"}
                            </div>
                            <p className="text-xs leading-5 text-stone-600 dark:text-stone-400">
                                {isZh ? "将工作流拖入 ComfyUI 页面点击 Queue 生成测试无报错后，回到本项目配置渠道，即可畅享画布生成！" : "Drag workflow into ComfyUI and test queue without errors. Then bind in Infinite Canvas and start generating!"}
                            </p>
                        </div>
                    </div>
                </div>

                {/* 分层核心插件专区 */}
                <div className="mb-12">
                    {/* 通用基础 5 大插件 */}
                    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg font-bold text-stone-950 dark:text-stone-100">
                                    {isZh ? "通用必备 5 大 ComfyUI 核心扩展插件" : "5 Essential Core ComfyUI Extension Plugins"}
                                </h2>
                                <Tag color="blue" className="m-0 text-xs">{isZh ? "基础必备" : "Essential"}</Tag>
                            </div>
                            <p className="mt-0.5 text-xs text-stone-500">
                                {isZh ? <>覆盖生图、图生图、局部编辑、大语言模型与视频基础生成。克隆至 ComfyUI 的 <code className="rounded bg-stone-100 px-1 py-0.5 font-mono text-[11px] text-stone-700 dark:bg-stone-800 dark:text-stone-300">custom_nodes/</code> 目录下并重启服务。</> : <>Covers text2img, img2img, inpaint, LLM, and video generation. Clone into ComfyUI custom_nodes/ and restart.</>}
                            </p>
                        </div>
                        <Button
                            size="small"
                            icon={<Copy className="size-3.5" />}
                            onClick={() => copyText(CLONE_CORE_PLUGINS_CMD, "已复制 5 大基础插件克隆命令")}
                        >
                            {isZh ? "一键复制 5 大基础插件克隆命令" : "Copy 5 Core Plugins Clone Commands"}
                        </Button>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {CORE_PLUGINS.map((plugin, idx) => (
                            <div
                                key={plugin.name}
                                className="flex flex-col justify-between rounded-lg border border-stone-200 bg-card p-4 shadow-sm dark:border-stone-800"
                            >
                                <div>
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-stone-100 font-mono text-[11px] font-semibold text-stone-600 dark:bg-stone-800 dark:text-stone-300">
                                                {idx + 1}
                                            </span>
                                            <a
                                                href={plugin.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 font-semibold text-stone-900 underline underline-offset-2 hover:text-blue-600 dark:text-stone-100 dark:hover:text-blue-400"
                                            >
                                                {plugin.name}
                                                <ExternalLink className="size-3" />
                                            </a>
                                        </div>
                                    </div>
                                    <p className="mt-2 text-xs leading-relaxed text-stone-600 dark:text-stone-400">
                                        {plugin.desc}
                                    </p>
                                    <div className="mt-2.5">
                                        <Tag className="text-[10px] text-stone-500 dark:text-stone-400">
                                            {plugin.usedBy}
                                        </Tag>
                                    </div>
                                </div>
                                <div className="mt-3 flex items-center justify-between rounded bg-stone-100 px-2 py-1.5 font-mono text-[11px] text-stone-700 dark:bg-stone-900/60 dark:text-stone-300">
                                    <span className="truncate" title={`git clone ${plugin.url}.git`}>
                                        git clone .../{plugin.name}.git
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => copyText(`git clone ${plugin.url}.git`, `已复制 ${plugin.name} 克隆命令`)}
                                        className="ml-1 shrink-0 text-stone-500 hover:text-stone-900 dark:hover:text-stone-100"
                                        title="复制克隆命令"
                                    >
                                        <Copy className="size-3" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* 进阶与专用扩展套件 */}
                    <div className="mt-6 rounded-lg border border-stone-200/90 bg-stone-50/70 p-4 dark:border-stone-800 dark:bg-stone-900/30">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="text-sm font-bold text-stone-950 dark:text-stone-100">
                                        {isZh ? "进阶与专用扩展套件 (人脸精修 / 视频深度估计)" : "Advanced Extension Plugins (Face Refine / Video Depth)"}
                                    </h3>
                                    <Tag color="volcano" className="m-0 text-xs">{isZh ? "按需安装" : "Optional"}</Tag>
                                </div>
                                <p className="mt-1 text-xs text-stone-500">
                                    {isZh ? "若需使用「视频人脸追踪精修」或「ReShot 视频深度估计」，需额外克隆以下专用插件以支持 YOLO 人脸追踪、视频音画封装及时序单目深度提取：" : "Required for video face refine or ReShot depth estimation to support YOLO face tracking and depth extraction:"}
                                </p>
                            </div>
                            <Button
                                size="small"
                                icon={<Copy className="size-3.5" />}
                                onClick={() => copyText(CLONE_ADVANCED_PLUGINS_CMD, "已复制进阶插件克隆命令")}
                            >
                                {isZh ? "复制进阶套件克隆命令" : "Copy Advanced Plugins Command"}
                            </Button>
                        </div>

                        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {ADVANCED_PLUGINS.map((plugin) => (
                                <div
                                    key={plugin.name}
                                    className="flex flex-col justify-between rounded-md border border-stone-200 bg-white p-3 dark:border-stone-800 dark:bg-stone-900/60"
                                >
                                    <div>
                                        <div className="flex items-center gap-2 font-medium">
                                            <a
                                                href={plugin.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 text-xs text-stone-900 underline hover:text-blue-600 dark:text-stone-100 dark:hover:text-blue-400"
                                            >
                                                {plugin.name}
                                                <ExternalLink className="size-3" />
                                            </a>
                                        </div>
                                        <p className="mt-1 text-xs text-stone-500">{plugin.desc}</p>
                                    </div>
                                    <div className="mt-2 flex items-center justify-between rounded bg-stone-100 px-2 py-1 font-mono text-[11px] text-stone-700 dark:bg-stone-800 dark:text-stone-300">
                                        <span className="truncate">git clone {plugin.url}.git</span>
                                        <button
                                            type="button"
                                            onClick={() => copyText(`git clone ${plugin.url}.git`, `已复制 ${plugin.name} 命令`)}
                                            className="ml-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
                                        >
                                            <Copy className="size-3" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 9 大核心能力矩阵卡片专区 */}
                <div className="mb-12">
                    <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg font-bold text-stone-950 dark:text-stone-100">
                                    {isZh ? "官方内置 9 大核心能力工作流矩阵" : "9 Official Built-in Capability Workflows"}
                                </h2>
                                <Tag color="blue" className="m-0 text-xs">{isZh ? "共 9 大能力" : "9 Capabilities"}</Tag>
                            </div>
                            <p className="mt-0.5 text-xs text-stone-500">
                                {isZh ? "默认下载 UI 连线版（可拖入 ComfyUI 可视化调试）；下拉选项可直接下载 API 格式 JSON 供系统绑定。" : "Downloads UI workflow for ComfyUI visual editing; dropdown lets you download API format JSON."}
                            </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                            <Button
                                size="small"
                                icon={<Download className="size-3.5" />}
                                loading={downloadingZip}
                                onClick={handleDownloadAllZip}
                            >
                                {isZh ? "一键打包全部 (.zip)" : "Download All (.zip)"}
                            </Button>
                        </div>
                    </div>

                    {/* 模态分类筛选 Tabs */}
                    <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-stone-200 pb-3 dark:border-stone-800">
                        <span className="text-xs font-medium text-stone-500">{isZh ? "分类筛选：" : "Categories: "}</span>
                        <div className="flex flex-wrap gap-1.5">
                            {[
                                { key: "all", label: isZh ? "全部能力" : "All", icon: Layers, count: 9 },
                                { key: "image", label: isZh ? "图像生成" : "Image", icon: Sparkles, count: 3 },
                                { key: "video", label: isZh ? "视频生成" : "Video", icon: Video, count: 3 },
                                { key: "audio", label: isZh ? "音乐音频" : "Audio", icon: Music, count: 1 },
                                { key: "refine", label: isZh ? "精修与辅助" : "Refine & Utility", icon: Wrench, count: 2 },
                            ].map((item) => {
                                const Icon = item.icon;
                                const isActive = activeCategory === item.key;
                                return (
                                    <button
                                        key={item.key}
                                        type="button"
                                        onClick={() => setActiveCategory(item.key as CategoryFilter)}
                                        className={`inline-flex cursor-pointer select-none items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${
                                            isActive
                                                ? "bg-stone-900 text-stone-50 shadow-xs dark:bg-stone-100 dark:text-stone-900"
                                                : "bg-stone-100 text-stone-600 hover:bg-stone-200/80 hover:text-stone-900 dark:bg-stone-800 dark:text-stone-400 dark:hover:bg-stone-700 dark:hover:text-stone-200"
                                        }`}
                                    >
                                        <Icon className={`size-3 shrink-0 ${isActive ? "text-stone-50 dark:text-stone-900" : "text-stone-500 dark:text-stone-400"}`} />
                                        <span className={isActive ? "text-stone-50 dark:text-stone-900" : "text-stone-700 dark:text-stone-300"}>{item.label}</span>
                                        <span className={`text-[10px] ${isActive ? "text-stone-300 dark:text-stone-600 font-medium" : "text-stone-400 dark:text-stone-500"}`}>({item.count})</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>


                    {/* 卡片网格 */}
                    <div className="grid gap-5 md:grid-cols-2">
                        {filteredWorkflows.map((wf) => {
                            const currentVariantId = selectedVariants[wf.id] || wf.defaultVariantId;
                            const activeVariant =
                                wf.variants.find((v) => v.id === currentVariantId) || wf.variants[0];

                            const downloadMenuItems: MenuProps["items"] = [
                                {
                                    key: "ui",
                                    label: (
                                        <div className="flex items-center gap-2 py-0.5">
                                            <Layers className="size-3.5 text-blue-500" />
                                            <div>
                                                <div className="text-xs font-medium">{isZh ? "下载 UI 可视化工作流 (.json)" : "Download UI Workflow (.json)"}</div>
                                                <div className="text-[10px] text-stone-400 font-mono">
                                                    {activeVariant.uiFileName}
                                                </div>
                                            </div>
                                        </div>
                                    ),
                                    onClick: () => handleDownloadSingle(activeVariant.uiDownloadUrl, activeVariant.uiFileName),
                                },
                                {
                                    key: "api",
                                    label: (
                                        <div className="flex items-center gap-2 py-0.5">
                                            <FileCode className="size-3.5 text-emerald-500" />
                                            <div>
                                                <div className="text-xs font-medium">{isZh ? "下载 API 格式工作流 (.json)" : "Download API Workflow (.json)"}</div>
                                                <div className="text-[10px] text-stone-400 font-mono">
                                                    {activeVariant.apiFileName}
                                                </div>
                                            </div>
                                        </div>
                                    ),
                                    onClick: () => handleDownloadSingle(activeVariant.apiDownloadUrl, activeVariant.apiFileName),
                                },
                            ];

                            return (
                                <Card
                                    key={wf.id}
                                    className="flex flex-col justify-between border-stone-200 bg-card shadow-sm dark:border-stone-800"
                                    styles={{
                                        body: {
                                            padding: "18px",
                                            display: "flex",
                                            flexDirection: "column",
                                            height: "100%",
                                        },
                                    }}
                                >
                                    <div>
                                        {/* 卡片头部 */}
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="font-semibold text-stone-950 dark:text-stone-100">
                                                        {wf.name}
                                                    </span>
                                                    <Tag color={activeVariant.badgeColor} className="m-0 text-[11px]">
                                                        {activeVariant.badge}
                                                    </Tag>
                                                </div>
                                                <div className="mt-1 text-xs text-stone-500">
                                                    核心算法：
                                                    <span className="font-medium text-stone-700 dark:text-stone-300">
                                                        {activeVariant.baseModel}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* 双格式下载按钮 */}
                                            <div className="flex shrink-0 items-center">
                                                <Button
                                                    type="primary"
                                                    size="small"
                                                    icon={<Download className="size-3.5" />}
                                                    onClick={() =>
                                                        handleDownloadSingle(
                                                            activeVariant.uiDownloadUrl,
                                                            activeVariant.uiFileName
                                                        )
                                                    }
                                                    className="rounded-r-none"
                                                >
                                                    下载工作流
                                                </Button>
                                                <Dropdown
                                                    menu={{ items: downloadMenuItems }}
                                                    placement="bottomRight"
                                                    trigger={["click"]}
                                                >
                                                    <Button
                                                        type="primary"
                                                        size="small"
                                                        className="rounded-l-none border-l border-white/20 px-1.5"
                                                        title="选择下载格式 (UI 连线版 / API 格式)"
                                                    >
                                                        <ChevronDown className="size-3" />
                                                    </Button>
                                                </Dropdown>
                                            </div>
                                        </div>

                                        {/* 多规格切换器 */}
                                        {wf.variants.length > 1 && (
                                            <div className="mt-3">
                                                <Segmented
                                                    size="small"
                                                    block
                                                    value={activeVariant.id}
                                                    onChange={(val) =>
                                                        setSelectedVariants((prev) => ({
                                                            ...prev,
                                                            [wf.id]: val as string,
                                                        }))
                                                    }
                                                    options={wf.variants.map((v) => ({
                                                        label: (
                                                            <span className="truncate text-xs px-1 font-medium">
                                                                {v.label}
                                                            </span>
                                                        ),
                                                        value: v.id,
                                                    }))}
                                                />
                                            </div>
                                        )}

                                        {/* 描述 */}
                                        <p className="mt-3 text-xs leading-5 text-stone-600 dark:text-stone-400">
                                            {activeVariant.description}
                                        </p>

                                        {/* 依赖插件 */}
                                        {activeVariant.plugins && activeVariant.plugins.length > 0 && (
                                            <div className="mt-2.5 flex flex-wrap items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50/60 px-2.5 py-1.5 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                                                <Puzzle className="size-3.5 shrink-0" />
                                                <span>依赖扩展：</span>
                                                <div className="inline-flex flex-wrap items-center gap-2">
                                                    {activeVariant.plugins.map((plugin) => (
                                                        <a
                                                            key={plugin.name}
                                                            href={plugin.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1 font-medium underline underline-offset-2 hover:text-amber-950 dark:hover:text-amber-100"
                                                        >
                                                            {plugin.name}
                                                            <ExternalLink className="size-3" />
                                                        </a>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* 模型目录要求 */}
                                        <div className="mt-3.5 rounded-lg border border-stone-200/80 bg-stone-50/80 p-3 dark:border-stone-800/80 dark:bg-stone-900/40">
                                            <div className="mb-2 flex items-center justify-between text-[11px] font-semibold text-stone-600 dark:text-stone-400">
                                                <div className="flex items-center gap-1.5">
                                                    <FolderTree className="size-3.5" />
                                                    <span>本地模型存放路径要求 (ComfyUI models/)</span>
                                                </div>
                                                <Tooltip title="一键复制当前规格所需全部模型文件名">
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            copyText(
                                                                activeVariant.models
                                                                    .flatMap((m) =>
                                                                        m.files.map((f) => `${m.folder}${f}`)
                                                                    )
                                                                    .join("\n"),
                                                                "已复制模型路径清单"
                                                            )
                                                        }
                                                        className="inline-flex items-center gap-1 text-[11px] text-stone-500 transition hover:text-stone-950 dark:hover:text-stone-200"
                                                    >
                                                        <Copy className="size-3" /> 复制清单
                                                    </button>
                                                </Tooltip>
                                            </div>

                                            <div className="space-y-2">
                                                {activeVariant.models.map((m) => (
                                                    <div key={m.folder} className="text-xs">
                                                        <div className="font-mono text-[11px] text-stone-400">
                                                            {m.folder}
                                                        </div>
                                                        <div className="mt-0.5 space-y-1">
                                                            {m.files.map((file) => (
                                                                <div
                                                                    key={file}
                                                                    className="flex items-center justify-between rounded bg-white px-2 py-1 text-xs text-stone-800 shadow-xs dark:bg-stone-800/70 dark:text-stone-200"
                                                                >
                                                                    <span className="truncate font-mono font-medium">
                                                                        {file}
                                                                    </span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() =>
                                                                            copyText(file, `已复制模型名：${file}`)
                                                                        }
                                                                        className="ml-2 text-stone-400 hover:text-stone-700 dark:hover:text-stone-100"
                                                                        title="复制文件名"
                                                                    >
                                                                        <Copy className="size-3" />
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* 底部提示 */}
                                    {activeVariant.tips && (
                                        <div className="mt-3 flex items-start gap-1.5 text-[11px] leading-4 text-stone-500 dark:text-stone-400">
                                            <Info className="mt-0.5 size-3 shrink-0 text-stone-400" />
                                            <span>{activeVariant.tips}</span>
                                        </div>
                                    )}
                                </Card>
                            );
                        })}
                    </div>
                </div>

                <Divider className="my-10" />

                {/* 常见问题与排错指引 */}
                <div>
                    <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-stone-950 dark:text-stone-100">
                        <HelpCircle className="size-5 text-stone-600 dark:text-stone-400" />
                        {isZh ? "常见排错与调试 FAQ" : "Frequently Asked Questions & Troubleshooting (FAQ)"}
                    </h2>
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-lg border border-stone-200 p-4 dark:border-stone-800">
                            <h3 className="flex items-center gap-2 text-sm font-semibold text-stone-900 dark:text-stone-100">
                                <AlertCircle className="size-4 text-amber-500" />
                                1. 提示 Failed to fetch 或跨域 CORS 错误？
                            </h3>
                            <p className="mt-2 text-xs leading-5 text-stone-600 dark:text-stone-400">
                                浏览器基于安全策略禁止跨域访问。请在启动 ComfyUI 的脚本或命令行中追加跨域参数{" "}
                                <code className="rounded bg-stone-100 px-1 py-0.5 font-mono text-stone-800 dark:bg-stone-800 dark:text-stone-200">
                                    {CORS_FLAG}
                                </code>
                                。
                            </p>
                            <div className="mt-2.5 rounded bg-stone-100 p-2 font-mono text-[11px] text-stone-700 dark:bg-stone-800 dark:text-stone-300">
                                <div className="mb-1 text-[10px] text-stone-400">典型启动命令示例（Windows bat 或终端）：</div>
                                <div className="flex items-center justify-between gap-2">
                                    <span className="truncate">{LAUNCH_CMD_EXAMPLE}</span>
                                    <button
                                        type="button"
                                        onClick={() => copyText(LAUNCH_CMD_EXAMPLE, "已复制启动命令")}
                                        className="text-stone-500 hover:text-stone-900 dark:hover:text-stone-100"
                                        title="复制命令"
                                    >
                                        <Copy className="size-3" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-lg border border-stone-200 p-4 dark:border-stone-800">
                            <h3 className="flex items-center gap-2 text-sm font-semibold text-stone-900 dark:text-stone-100">
                                <Wrench className="size-4 text-blue-500" />
                                2. 工作流导入后显示红色缺失节点 (Missing Nodes)？
                            </h3>
                            <p className="mt-2 text-xs leading-5 text-stone-600 dark:text-stone-400">
                                请在 ComfyUI 网页界面中打开 <span className="font-semibold text-stone-800 dark:text-stone-200">ComfyUI-Manager</span>，点击 <span className="font-semibold text-stone-800 dark:text-stone-200">Install Missing Custom Nodes</span> 自动查找并安装缺失的扩展节点，安装完毕后重启 ComfyUI。
                            </p>
                        </div>

                        <div className="rounded-lg border border-stone-200 p-4 dark:border-stone-800">
                            <h3 className="flex items-center gap-2 text-sm font-semibold text-stone-900 dark:text-stone-100">
                                <Layers className="size-4 text-purple-500" />
                                3. 显存不足 (CUDA Out of Memory) 报错？
                            </h3>
                            <p className="mt-2 text-xs leading-5 text-stone-600 dark:text-stone-400">
                                MiniMax H3 视频与 Flux 模型显存需求较高。启动时添加{" "}
                                <code className="rounded bg-stone-100 px-1 py-0.5 font-mono text-stone-800 dark:bg-stone-800 dark:text-stone-200">
                                    --lowvram
                                </code>{" "}
                                或优先选用带 <span className="font-semibold text-stone-800 dark:text-stone-200">FP8 4步 PDMD</span> 极速版规格，可以大幅削减显存峰值占用与推理耗时。
                            </p>
                        </div>

                        <div className="rounded-lg border border-stone-200 p-4 dark:border-stone-800">
                            <h3 className="flex items-center gap-2 text-sm font-semibold text-stone-900 dark:text-stone-100">
                                <FileCode className="size-4 text-emerald-500" />
                                4. 如何使用自己调整过的自定义工作流？
                            </h3>
                            <p className="mt-2 text-xs leading-5 text-stone-600 dark:text-stone-400">
                                在 ComfyUI 设置中勾选 <span className="font-semibold text-stone-800 dark:text-stone-200">Enable Dev mode Options</span>，通过 <span className="font-semibold text-stone-800 dark:text-stone-200">Save (API Format)</span> 导出 API 格式 JSON；然后在本项目「配置 → 模型渠道 → 编辑」中上传绑定即可。
                            </p>
                        </div>

                        <div className="rounded-lg border border-stone-200 p-4 dark:border-stone-800">
                            <h3 className="flex items-center gap-2 text-sm font-semibold text-stone-900 dark:text-stone-100">
                                <FolderTree className="size-4 text-rose-500" />
                                5. 人脸精修 YOLO 权重路径与跨系统兼容？
                            </h3>
                            <p className="mt-2 text-xs leading-5 text-stone-600 dark:text-stone-400">
                                人脸精修依赖 YOLO 实例分割与人脸检测权重。请将 <code className="rounded bg-stone-100 px-1 py-0.5 font-mono text-stone-800 dark:bg-stone-800 dark:text-stone-200">person_yolov8m-seg.pt</code> 放入 <code className="rounded bg-stone-100 px-1 py-0.5 font-mono text-stone-800 dark:bg-stone-800 dark:text-stone-200">models/ultralytics/segm/</code> 目录。系统向 ComfyUI 提交任务时会自动识别宿主系统，并在 Windows 反斜杠 (<code className="font-mono">\</code>) 与 Linux 正斜杠 (<code className="font-mono">/</code>) 间自适应平滑转换。
                            </p>
                        </div>

                        <div className="rounded-lg border border-stone-200 p-4 dark:border-stone-800">
                            <h3 className="flex items-center gap-2 text-sm font-semibold text-stone-900 dark:text-stone-100">
                                <Music className="size-4 text-fuchsia-500" />
                                6. 音乐与音频生成对 ComfyUI 版本的需求？
                            </h3>
                            <p className="mt-2 text-xs leading-5 text-stone-600 dark:text-stone-400">
                                MiniMax Music 03 依赖 ComfyUI 原生集成的 <code className="font-mono">MiniMaxMusic3TextEncode</code> 与 <code className="font-mono">SaveAudioAdvanced</code> 等节点，请确保您的 ComfyUI 核心版本已升级至 <span className="font-semibold text-stone-800 dark:text-stone-200">v0.31.0 或更高版本</span>。
                            </p>
                        </div>

                        <div className="rounded-lg border border-stone-200 p-4 dark:border-stone-800">
                            <h3 className="flex items-center gap-2 text-sm font-semibold text-stone-900 dark:text-stone-100">
                                <Video className="size-4 text-orange-500" />
                                7. 视频生成分辨率硬件锁死规则说明？
                            </h3>
                            <p className="mt-2 text-xs leading-5 text-stone-600 dark:text-stone-400">
                                为保证 MiniMax H3 多模态架构的绝对稳定与不花屏，系统严禁手动输入任意分辨率数字。所有视频生成尺寸均已收敛在 <span className="font-semibold text-stone-800 dark:text-stone-200">0.2M ~ 0.98M 的 9 档硬件对齐预设</span> 中（16:9 与 9:16 画幅对称对调，上限严格锁定在 0.98 MP）。
                            </p>
                        </div>

                        <div className="rounded-lg border border-stone-200 p-4 dark:border-stone-800">
                            <h3 className="flex items-center gap-2 text-sm font-semibold text-stone-900 dark:text-stone-100">
                                <Sparkles className="size-4 text-cyan-500" />
                                8. 视频深度估计 (ReShot) 权重下载与加速？
                            </h3>
                            <p className="mt-2 text-xs leading-5 text-stone-600 dark:text-stone-400">
                                首次执行 <code className="font-mono">ReShotDepthVideo</code> 时，插件会自动从 HuggingFace 下载 <code className="font-mono">video_depth_anything_vits.pth</code>（约 111 MB）并常驻内存。国内网络建议启动 ComfyUI 前设置镜像环境变量 <code className="rounded bg-stone-100 px-1 py-0.5 font-mono text-stone-800 dark:bg-stone-800 dark:text-stone-200">HF_ENDPOINT=https://hf-mirror.com</code>，或将权重文件夹完整拷贝至 <code className="font-mono">~/.cache/huggingface/hub/models--depth-anything--Video-Depth-Anything-Small/</code> 离线使用。
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
