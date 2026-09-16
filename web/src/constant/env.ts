export const REPO_URL = "https://github.com/ZhuYichuan/infinite-canvas";

export const DOCS_URL = import.meta.env.VITE_DOC_URL || "https://docs.canvas.imihoo.com";

// Official plugin registry URL: CI publishes to plugins-dist for jsDelivr delivery; an environment variable may override it for self-hosting.
export const PLUGIN_REGISTRY_URL = import.meta.env.VITE_PLUGIN_REGISTRY_URL || "https://cdn.jsdelivr.net/gh/basketikun/infinite-canvas@plugins-dist/official-plugins.json";
