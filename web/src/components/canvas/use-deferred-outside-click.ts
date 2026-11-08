import { useEffect, useRef } from "react";

type UseDeferredOutsideClickOptions = {
    open: boolean;
    onClose: () => void;
    ignoreRefs: (React.RefObject<Element | null>)[];
    blurElementRef?: React.RefObject<Element | null>;
    onSyncPosition?: () => void;
};

export function useDeferredOutsideClick({
    open,
    onClose,
    ignoreRefs,
    blurElementRef,
    onSyncPosition,
}: UseDeferredOutsideClickOptions) {
    const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;
    const onSyncPositionRef = useRef(onSyncPosition);
    onSyncPositionRef.current = onSyncPosition;

    useEffect(() => {
        if (!open) return;

        const syncPosition = () => {
            onSyncPositionRef.current?.();
        };

        const closeOnOutsidePointer = (event: PointerEvent) => {
            const target = event.target;
            if (!(target instanceof Node)) return;
            const isIgnored = ignoreRefs.some((ref) => ref.current?.contains(target));
            if (
                isIgnored ||
                (target instanceof Element && Boolean(target.closest(".ant-tooltip, .ant-popover, .ant-dropdown, .ant-select-dropdown, .ant-picker-dropdown")))
            ) {
                return;
            }
            if (document.activeElement instanceof HTMLElement && blurElementRef?.current?.contains(document.activeElement)) {
                document.activeElement.blur();
            }
            if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
            closeTimerRef.current = setTimeout(() => {
                onCloseRef.current();
            }, 0);
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                onCloseRef.current();
            }
        };

        syncPosition();
        window.addEventListener("resize", syncPosition);
        window.addEventListener("scroll", syncPosition, true);
        window.addEventListener("pointerdown", closeOnOutsidePointer, true);
        window.addEventListener("keydown", handleKeyDown);

        return () => {
            if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
            window.removeEventListener("resize", syncPosition);
            window.removeEventListener("scroll", syncPosition, true);
            window.removeEventListener("pointerdown", closeOnOutsidePointer, true);
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [open, blurElementRef, ...ignoreRefs]);
}
