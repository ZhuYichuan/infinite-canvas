import { useRef, useState } from "react";
import { Select } from "antd";
import { useTranslation } from "react-i18next";

import { useDeferredOutsideClick } from "./use-deferred-outside-click";
import { cn } from "@/lib/utils";

const sizeOptions = ["auto", "1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16"];

type CanvasSizePickerProps = {
    value: string;
    className?: string;
    onChange: (value: string) => void;
};

export function CanvasSizePicker({ value, className, onChange }: CanvasSizePickerProps) {
    const { t } = useTranslation();
    const rootRef = useRef<HTMLDivElement>(null);
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const extraOptions = [value, search.trim()].filter((item) => item && !sizeOptions.includes(item));
    const options = [...sizeOptions, ...Array.from(new Set(extraOptions))].map((size) => ({ value: size, label: size }));
    const selectSize = (next: string) => {
        onChange(next.trim());
        setSearch("");
        setOpen(false);
    };

    useDeferredOutsideClick({
        open,
        onClose: () => setOpen(false),
        ignoreRefs: [rootRef],
    });

    return (
        <div ref={rootRef} className={className}>
            <Select
                showSearch
                open={open}
                className={cn("canvas-compact-control canvas-control-select h-full w-full")}
                value={value || undefined}
                searchValue={search}
                placeholder={t("canvas.controls.ratio")}
                options={options}
                popupMatchSelectWidth={false}
                popupRender={(menu) => (
                    <div onMouseDown={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
                        {menu}
                    </div>
                )}
                onOpenChange={setOpen}
                onSearch={setSearch}
                onChange={selectSize}
                onBlur={() => {
                    if (search.trim()) selectSize(search);
                }}
                onInputKeyDown={(event) => {
                    if (event.key === "Enter" && search.trim()) selectSize(search);
                }}
            />
        </div>
    );
}
