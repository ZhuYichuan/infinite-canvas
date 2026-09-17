/**
 * infinite-canvas Official Website - Bilingual Dictionary (zh-CN & en)
 */

window.I18N_DATA = {
  "zh-CN": {
    nav_features: "核心特性",
    nav_workflows: "工作流生态",
    nav_demo: "交互演示",
    nav_security: "架构与隐私",
    nav_quickstart: "快速上手",
    nav_faq: "常见问题",
    nav_github: "GitHub 开源",
    nav_launch: "立即体验",
    
    hero_eyebrow: "专为 COMFYUI 深度定制的开源可视化创作台",
    hero_title: "无限画卷，<span class='text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-indigo-400 to-cyan-300'>直连你的本地 ComfyUI</span>",
    hero_desc: "告别散乱的节点网络与复杂的商用中转代理。基于原生 8188 端口直连，工作流槽位驱动参数面板，多图参考、全能视频生成与本地 Agent 智能体，全在一块无垠画布中自由编排。",
    hero_cta_start: "极速启动 (Dev / Docker)",
    hero_cta_doc: "查看完整文档 ↗",
    hero_badge_privacy: "100% 本地直连 · 零中转服务 · 数据不出本机",
    
    video_caption: "大作灵感，在无边画布流转。",
    video_hint: "0:34 · 演示视频",
    video_placeholder_title: "🎬 演示视频预留位",
    video_placeholder_desc: "将您的 30 秒演示视频命名为 demo.mp4 并放置于 assets/videos/ 目录，即可自动切换为高清实录播放。",

    prop1_title: "原生 8188 直连",
    prop1_desc: "浏览器前端直通本地 ComfyUI REST/WebSocket 端点，彻底剔除中间代理层。",
    prop2_title: "工作流驱动 UI",
    prop2_desc: "基于 _meta.title 动态自适应表单，未标记槽位绝不冗余展示，告别模板束缚。",
    prop3_title: "纯本地安全架构",
    prop3_desc: "工程配置、海量素材、历史生图与凭证全量持久化在本地 IndexedDB，绝不上云。",

    features_eyebrow: "无拘无束的视觉探索空间",
    features_title: "为创作者而生。<br/><span class='text-zinc-400'>由你的本地 ComfyUI 驱动。</span>",
    features_desc: "拖拽节点、连线流转、全能多模态调度，体验丝滑灵动的 60FPS 画布。",
    
    step_glance_num: "01",
    step_glance_title: "轻量速览",
    step_glance_sub: "极简提示词流",
    step_inspect_num: "02",
    step_inspect_title: "槽位检查",
    step_inspect_sub: "动态参数调优",
    step_explore_num: "03",
    step_explore_title: "全景拓扑",
    step_explore_sub: "多模态级联生成",

    canvas_demo_hint: "💡 试一试：直接用鼠标在上方拖拽节点卡片，点击「⚡ 触发执行」体验信号流动！",
    canvas_run_btn: "⚡ 触发执行 ComfyUI",
    canvas_status_idle: "就绪 (127.0.0.1:8188 监听中)",
    canvas_status_running: "正在向 ComfyUI 派发 Prompt 任务...",
    canvas_status_done: "执行完毕！图像已渲染至输出节点",

    matrix_eyebrow: "COMFYUI CAPABILITY MATRIX",
    matrix_title: "原生工作流，开箱即用",
    matrix_desc: "覆盖从高精度图像合成到下一代多模态视频生成的完整链路。",
    
    cat_t2i: "文生图 (Flux / SDXL)",
    cat_i2i: "图生图 & 局部重绘",
    cat_video: "全能参考视频 (MiniMax H3)",
    cat_prompt: "提示词反推 & LLM",
    cat_custom: "自定义工作流",

    layout_eyebrow: "EXTENSIBLE & POWERFUL",
    layout_title: "不仅仅是画布，<br/><span class='text-zinc-400'>更是你的 AI 工作流超级中枢。</span>",
    layout_desc: "从虚拟组节点打包到本地 Agent MCP 调度，让 AI 创作成倍提速。",
    
    feature_card1_title: "虚拟组节点 (Group Container)",
    feature_card1_desc: "不破坏纯数据结构，自由框选成组；向外连线时动态解包为批量资源包，实现多图多资产协同流转。",
    feature_card2_title: "本地 Canvas Agent & MCP",
    feature_card2_desc: "支持通过 MCP 协议连接 Codex、Claude Code。让 Agent 读懂当前画布，自动排版节点、生成指令并插回画布。",
    feature_card3_title: "独立插件体系 (TypeScript SDK)",
    feature_card3_desc: "无需侵入核心代码，支持通过 URL 动态加载第三方插件节点，拥有完整的类型定义与生命周期钩子。",
    feature_card4_title: "提示词库与素材管理",
    feature_card4_desc: "前端直连 GitHub 开源提示词集并本地缓存，素材库支持拖拽即用，告别到处复制粘贴。",

    privacy_eyebrow: "PRIVACY & LOCAL FIRST",
    privacy_title: "数据与创意，<br/><span>100% 留在你的设备上。</span>",
    privacy_badge: "本地优先 · 零云端依赖",
    privacy_desc: "没有远程数据库，没有第三方埋点，没有中间代理服务。你的 API Key、生成的私密画面、自建工作流全部保存在本地浏览器与 ComfyUI 服务端。",

    deploy_eyebrow: "GET STARTED IN SECONDS",
    deploy_title: "极速开始，<br/><span class='text-zinc-400'>一行命令唤醒无限画布。</span>",
    deploy_desc: "支持本地源码极速开发、Docker 一键启动或直连你现有的 ComfyUI。",
    
    tab_bun: "Bun 源码启动 (推荐)",
    tab_docker: "Docker Compose 部署",
    tab_prereq: "运行前置条件",
    
    copy_btn: "复制代码",
    copy_success: "已成功复制到剪贴板！",

    faq_eyebrow: "FAQ",
    faq_title: "常见疑问与解答",
    
    faq_q1: "我需要启动本地 ComfyUI 才能使用吗？",
    faq_a1: "是的。本项目是一个专注于 ComfyUI 的可视化创作前端，前端通过 WebSocket 和 REST API 直连 ComfyUI（默认 127.0.0.1:8188）。启动项目前请确保本地或局域网内的 ComfyUI 已经正常运行。",
    
    faq_q2: "为什么不需要后端服务？我的图片存放在哪里？",
    faq_a2: "本项目采用纯前端架构，所有画布拓扑、历史记录、凭据配置均存储在当前浏览器的 localforage (IndexedDB) 中。生成的图片直接保存在本地 ComfyUI 的 output 目录并通过直连加载，没有任何云端第三方服务介入。",
    
    faq_q3: "直连报错 CORS (跨域拦截) 怎么办？",
    faq_a3: "启动 ComfyUI 时请加入 --enable-cors-header 启动参数（如 python main.py --listen 127.0.0.1 --port 8188 --enable-cors-header），或在反向代理（如 Nginx）中放通 Access-Control-Allow-Origin 请求头即可。",

    faq_q4: "全能参考视频 (MiniMax H3) 支持连多少张图？",
    faq_a4: "根据项目多模态视频规格，支持最多 9 张参考图 + 3 段视频 + 3 段音频。系统在提交前会自动校验并剔除未连满的插槽，且视频分辨率硬件锁死在 0.2M~0.98M 之间，防止显存爆炸。",

    faq_q5: "需要安装哪些 ComfyUI 核心插件？",
    faq_a5: "推荐安装 5 大核心插件：Comfyui-kktools（文本反推）、ComfyUI-KJNodes（全能组件处理）、ComfyLiterals（基础字面量）、ComfyUI-UniversalToolkit（通用参数解析）与 ComfyUI_LayerStyle（图层与遮罩）。",

    footer_quote: "在 ComfyUI 里连一整天线不算在摸鱼。<br/><span class='text-zinc-500'>不过…再连一条也行。</span>",
    footer_quote_btn: "再连一条",
    footer_quote_bubble: "创意流转中... ⚡",
    footer_docs: "文档中心",
    footer_workflows: "工作流指南",
    footer_deploy: "部署与发布",
    footer_github: "GitHub 源码"
  },
  "en": {
    nav_features: "Features",
    nav_workflows: "Workflows",
    nav_demo: "Interactive Demo",
    nav_security: "Architecture",
    nav_quickstart: "Quick Start",
    nav_faq: "FAQ",
    nav_github: "GitHub",
    nav_launch: "Launch App",

    hero_eyebrow: "OPEN-SOURCE VISUAL CANVAS TAILORED FOR COMFYUI",
    hero_title: "Infinite Canvas, <span class='text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-indigo-400 to-cyan-300'>Direct to your ComfyUI</span>",
    hero_desc: "Say goodbye to chaotic spaghetti noodles and closed-source proxies. Native 8188 direct connection, dynamic workflow-driven UI slots, multi-image reference, and local AI agent orchestration — all inside an infinite creative space.",
    hero_cta_start: "Quick Start (Dev / Docker)",
    hero_cta_doc: "Documentation ↗",
    hero_badge_privacy: "100% Local Connection · Zero Middleware · Zero Telemetry",

    video_caption: "Big picture. Limitless visual flow.",
    video_hint: "0:34 · Demo Video",
    video_placeholder_title: "🎬 Demo Video Placeholder",
    video_placeholder_desc: "Place your recorded demo video at assets/videos/demo.mp4 to automatically activate full HD real player mode.",

    prop1_title: "Native 8188 Direct",
    prop1_desc: "Browser connects directly to ComfyUI REST & WebSocket endpoints. Zero middleware proxies.",
    prop2_title: "Workflow-Driven UI",
    prop2_desc: "Node UI forms adapt dynamically to workflow slots (_meta.title). Unmarked inputs are never shown.",
    prop3_title: "Local-First Architecture",
    prop3_desc: "Canvas topology, assets, generation history and credentials persist purely in local IndexedDB.",

    features_eyebrow: "UNCONSTRAINED VISUAL PLAYGROUND",
    features_title: "Engineered for creators.<br/><span class='text-zinc-400'>Powered by your local ComfyUI.</span>",
    features_desc: "Drag nodes, route multimodal assets, and experience butter-smooth 60FPS infinite canvas.",

    step_glance_num: "01",
    step_glance_title: "Glance",
    step_glance_sub: "Minimal Prompt Flow",
    step_inspect_num: "02",
    step_inspect_title: "Inspect",
    step_inspect_sub: "Dynamic Slot Tuning",
    step_explore_num: "03",
    step_explore_title: "Explore",
    step_explore_sub: "Multimodal Topology",

    canvas_demo_hint: "💡 Try it: Drag nodes freely, click '⚡ Execute Flow' to experience simulated signal execution!",
    canvas_run_btn: "⚡ Execute ComfyUI Flow",
    canvas_status_idle: "Ready (Listening on 127.0.0.1:8188)",
    canvas_status_running: "Dispatching prompt payload to ComfyUI...",
    canvas_status_done: "Execution complete! Image rendered to output node",

    matrix_eyebrow: "COMFYUI CAPABILITY MATRIX",
    matrix_title: "Native Workflows, Ready Out of the Box",
    matrix_desc: "Covering the full pipeline from hyper-realistic image synthesis to next-gen multimodal video generation.",

    cat_t2i: "Text to Image (Flux / SDXL)",
    cat_i2i: "Image to Image & Inpaint",
    cat_video: "Multimodal Video (MiniMax H3)",
    cat_prompt: "Prompt Interrogator & LLM",
    cat_custom: "Custom Workflows",

    layout_eyebrow: "EXTENSIBLE & POWERFUL",
    layout_title: "Not just a canvas,<br/><span class='text-zinc-400'>your central AI workflow station.</span>",
    layout_desc: "From virtual group unpacking to local agent MCP orchestration, accelerating your visual iteration.",

    feature_card1_title: "Virtual Group Containers",
    feature_card1_desc: "Group nodes without mutating data models; automatically unpacks into batch resource bundles upon downstream connection.",
    feature_card2_title: "Local Canvas Agent & MCP",
    feature_card2_desc: "Connects with Codex and Claude Code via MCP protocol. Agents can read canvas layout, arrange nodes, and stream results.",
    feature_card3_title: "Modular Plugin System (TS SDK)",
    feature_card3_desc: "Dynamically load third-party node plugins via URL with full TypeScript definitions and lifecycle hooks.",
    feature_card4_title: "Prompt Hub & Asset Library",
    feature_card4_desc: "Directly syncs public GitHub prompt repositories with local IndexedDB cache, drag-and-drop assets into canvas instantly.",

    privacy_eyebrow: "PRIVACY & LOCAL FIRST",
    privacy_title: "Your creations,<br/><span>strictly on your machine.</span>",
    privacy_badge: "Local First · Zero Cloud Dependencies",
    privacy_desc: "No remote databases. No third-party trackers. No relay proxy servers. All credentials, generation history, and custom workflows stay safe on your Mac/PC.",

    deploy_eyebrow: "GET STARTED IN SECONDS",
    deploy_title: "Wake up your canvas,<br/><span class='text-zinc-400'>with a single command.</span>",
    deploy_desc: "Quick start via Bun development mode, Docker Compose deployment, or local git clone.",

    tab_bun: "Bun Source (Recommended)",
    tab_docker: "Docker Compose",
    tab_prereq: "Prerequisites Checklist",

    copy_btn: "Copy Code",
    copy_success: "Copied to clipboard!",

    faq_eyebrow: "FAQ",
    faq_title: "Frequently Asked Questions",

    faq_q1: "Do I need a running ComfyUI instance to use this?",
    faq_a1: "Yes. infinite-canvas is a modern visual UI client for ComfyUI. It connects via native WebSockets and REST API directly to 127.0.0.1:8188. Ensure ComfyUI is running locally or in your local network.",

    faq_q2: "Why is no backend server required? Where are images stored?",
    faq_a2: "It adopts a pure front-end architecture. Canvas topology, history, and configs persist in browser IndexedDB. Generated outputs reside in ComfyUI's local output directory with direct previews.",

    faq_q3: "How do I resolve CORS issues when connecting?",
    faq_a3: "Launch ComfyUI with the --enable-cors-header flag (e.g. python main.py --listen 127.0.0.1 --port 8188 --enable-cors-header), or configure Access-Control-Allow-Origin headers in Nginx reverse proxy.",

    faq_q4: "How many reference assets does Multimodal Video support?",
    faq_a4: "Up to 9 images + 3 videos + 3 audio tracks. Unconnected slots are automatically pruned before queueing to avoid redundant memory overhead.",

    faq_q5: "Which core ComfyUI custom nodes are required?",
    faq_a5: "5 core plugins are recommended: Comfyui-kktools, ComfyUI-KJNodes, ComfyLiterals, ComfyUI-UniversalToolkit, and ComfyUI_LayerStyle.",

    footer_quote: "Staring at ComfyUI wires all day doesn’t count as slacking.<br/><span class='text-zinc-500'>Connect one more though.</span>",
    footer_quote_btn: "Connect Wire",
    footer_quote_bubble: "Routing signals... ⚡",
    footer_docs: "Documentation",
    footer_workflows: "Workflow Guide",
    footer_deploy: "Deployment",
    footer_github: "GitHub Source"
  }
};
