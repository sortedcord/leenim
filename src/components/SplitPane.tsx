import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type SplitDirection = "horizontal" | "vertical";

export type SplitPaneProps = {
    direction: SplitDirection;
    /**
     * Initial ratio for the first pane (0..1). Used only when no persisted ratio exists.
     */
    initialRatio?: number;
    /**
     * localStorage persistence key. If provided, ratio is persisted.
     */
    storageKey?: string;
    minFirstPx?: number;
    minSecondPx?: number;
    gutterSizePx?: number;
    className?: string;
    first: React.ReactNode;
    second: React.ReactNode;
};

function clamp(v: number, a: number, b: number) {
    return Math.max(a, Math.min(b, v));
}

export default function SplitPane({
    direction,
    initialRatio = 0.5,
    storageKey,
    minFirstPx = 200,
    minSecondPx = 200,
    gutterSizePx = 8,
    className,
    first,
    second,
}: SplitPaneProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const draggingRef = useRef(false);

    const persistedRatio = useMemo(() => {
        if (!storageKey) return undefined;
        const raw = localStorage.getItem(storageKey);
        if (!raw) return undefined;
        const num = Number(raw);
        if (!Number.isFinite(num)) return undefined;
        return clamp(num, 0.05, 0.95);
    }, [storageKey]);

    const [ratio, setRatio] = useState<number>(persistedRatio ?? initialRatio);

    useEffect(() => {
        if (!storageKey) return;
        localStorage.setItem(storageKey, String(ratio));
    }, [ratio, storageKey]);

    const onPointerDown = useCallback((e: React.PointerEvent) => {
        draggingRef.current = true;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }, []);

    const onPointerUp = useCallback((e: React.PointerEvent) => {
        draggingRef.current = false;
        try {
            (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
        } catch {
            // ignore
        }
    }, []);

    const onPointerMove = useCallback(
        (e: React.PointerEvent) => {
            if (!draggingRef.current) return;
            const el = containerRef.current;
            if (!el) return;
            const rect = el.getBoundingClientRect();

            if (direction === "vertical") {
                const x = e.clientX - rect.left;
                const total = rect.width;
                const minRatio = minFirstPx / total;
                const maxRatio = 1 - minSecondPx / total;
                const next = clamp(x / total, minRatio, maxRatio);
                setRatio(next);
            } else {
                const y = e.clientY - rect.top;
                const total = rect.height;
                const minRatio = minFirstPx / total;
                const maxRatio = 1 - minSecondPx / total;
                const next = clamp(y / total, minRatio, maxRatio);
                setRatio(next);
            }
        },
        [direction, minFirstPx, minSecondPx],
    );

    const style =
        direction === "vertical"
            ? ({
                gridTemplateColumns: `${ratio * 100}% ${gutterSizePx}px ${(1 - ratio) * 100}%`,
            } as React.CSSProperties)
            : ({
                gridTemplateRows: `${ratio * 100}% ${gutterSizePx}px ${(1 - ratio) * 100}%`,
            } as React.CSSProperties);

    const gutterClass = direction === "vertical" ? "split-gutter split-gutter-v" : "split-gutter split-gutter-h";

    return (
        <div
            ref={containerRef}
            className={className ? `split ${className}` : "split"}
            style={style}
        >
            <div className="split-pane">{first}</div>
            <div
                className={gutterClass}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
            />
            <div className="split-pane">{second}</div>
        </div>
    );
}
