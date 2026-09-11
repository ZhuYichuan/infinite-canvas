import { beforeEach, describe, expect, it } from "vitest";

import { DEFAULT_PROMPT_SOURCES } from "@/services/api/prompt-source-presets";
import { usePromptSourceStore } from "@/stores/use-prompt-source-store";

describe("usePromptSourceStore persistence", () => {
    beforeEach(() => {
        usePromptSourceStore.setState({
            sources: DEFAULT_PROMPT_SOURCES,
            schedule: { intervalMinutes: 30, lastFetchedAt: "" },
        });
    });

    it("persists toggling built-in source enabled status across rehydration", async () => {
        const firstBuiltInId = DEFAULT_PROMPT_SOURCES[0].id;
        usePromptSourceStore.getState().toggleSource(firstBuiltInId, false);
        expect(usePromptSourceStore.getState().sources[0].enabled).toBe(false);

        await usePromptSourceStore.persist.rehydrate();

        const rehydratedFirst = usePromptSourceStore.getState().sources.find((s) => s.id === firstBuiltInId);
        expect(rehydratedFirst?.enabled).toBe(false);
    });

    it("persists custom added prompt source across rehydration", async () => {
        const newSource = usePromptSourceStore.getState().addSource();
        const custom = {
            ...newSource,
            name: "My Custom Source",
            url: "https://example.com/prompts.json",
            homepage: "https://example.com",
            enabled: true,
            builtIn: false,
        };
        usePromptSourceStore.getState().saveSource(custom);

        await usePromptSourceStore.persist.rehydrate();

        const rehydratedCustom = usePromptSourceStore.getState().sources.find((s) => s.id === custom.id);
        expect(rehydratedCustom).toBeDefined();
        expect(rehydratedCustom?.name).toBe("My Custom Source");
        expect(rehydratedCustom?.url).toBe("https://example.com/prompts.json");
    });

    it("persists schedule interval and lastFetchedAt across rehydration", async () => {
        usePromptSourceStore.getState().updateSchedule("intervalMinutes", 60);
        usePromptSourceStore.getState().updateSchedule("lastFetchedAt", "2026-09-11T12:00:00.000Z");

        await usePromptSourceStore.persist.rehydrate();

        const schedule = usePromptSourceStore.getState().schedule;
        expect(schedule.intervalMinutes).toBe(60);
        expect(schedule.lastFetchedAt).toBe("2026-09-11T12:00:00.000Z");
    });
});
