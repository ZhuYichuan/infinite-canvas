import localforage from "localforage";
import type { StateStorage } from "zustand/middleware";

if (typeof localforage?.config === "function") {
    try {
        localforage.config({
            name: "infinite-canvas",
            storeName: "app_state",
        });
    } catch {
        // ignore if already configured or mocked
    }
}

export const localForageStorage: StateStorage = {
    getItem: async (name) => {
        if (typeof window === "undefined") return null;
        try {
            if (typeof localforage?.getItem === "function") {
                const val = await localforage.getItem<string>(name);
                if (val !== null && val !== undefined) return val;
            }
            return window.localStorage?.getItem(name) ?? null;
        } catch {
            return window.localStorage?.getItem(name) ?? null;
        }
    },
    setItem: async (name, value) => {
        if (typeof window === "undefined") return;
        try {
            if (typeof localforage?.setItem === "function") {
                await localforage.setItem(name, value);
                return;
            }
            window.localStorage?.setItem(name, value);
        } catch {
            window.localStorage?.setItem(name, value);
        }
    },
    removeItem: async (name) => {
        if (typeof window === "undefined") return;
        try {
            if (typeof localforage?.removeItem === "function") {
                await localforage.removeItem(name);
                return;
            }
            window.localStorage?.removeItem(name);
        } catch {
            window.localStorage?.removeItem(name);
        }
    },
};
