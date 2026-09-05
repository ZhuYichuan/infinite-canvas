import { BookOpen } from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { AppConfigPanel } from "@/components/layout/app-config-modal";

export default function ConfigPage() {
    const { t } = useTranslation();

    return (
        <main className="h-full overflow-y-auto bg-background">
            <div className="mx-auto max-w-6xl px-6 py-6">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h1 className="text-xl font-semibold text-stone-950 dark:text-stone-100">{t("config.title")}</h1>
                        <p className="mt-1 text-sm text-stone-500">{t("config.description")}</p>
                    </div>
                    <Link
                        to="/guide"
                        className="inline-flex items-center gap-2 rounded-lg border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:bg-stone-100 dark:border-stone-800 dark:bg-stone-900/60 dark:text-stone-300 dark:hover:bg-stone-800"
                    >
                        <BookOpen className="size-3.5 text-stone-500" />
                        <span>查看 ComfyUI 部署手册与工作流下载</span>
                    </Link>
                </div>
                <AppConfigPanel />
            </div>
        </main>
    );
}
