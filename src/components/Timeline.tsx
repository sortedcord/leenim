// React import not needed with automatic JSX runtime

import { useEffect, useMemo, useRef, useState } from "react";

export type TimelineProps = {
    fps?: number;
    durationSeconds?: number;
    currentTimeSec?: number;
    onScrub?: (timeSec: number) => void;
    isPlaying?: boolean;
    onPlay?: () => void;
    onPause?: () => void;
    onStop?: () => void;
    onStep?: (deltaSeconds: number) => void;
};

export default function Timeline({
    fps = 60,
    durationSeconds = 10,
    currentTimeSec = 0,
    onScrub,
    isPlaying,
    onPlay,
    onPause,
    onStop,
    onStep,
}: TimelineProps) {
    const totalFrames = Math.round(durationSeconds * fps);

    const rulerRef = useRef<HTMLDivElement | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    const playheadPct = useMemo(() => {
        const d = durationSeconds > 0 ? durationSeconds : 1;
        const t = Math.min(Math.max(currentTimeSec, 0), d);
        return (t / d) * 100;
    }, [currentTimeSec, durationSeconds]);

    const { tickStepSec, tickCount } = useMemo(() => {
        const d = Math.max(durationSeconds, 0.001);
        // Aim for ~24 ticks across the ruler.
        const target = d / 24;
        const steps = [0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300];
        const step = steps.find((s) => s >= target) ?? 300;
        const count = Math.floor(d / step) + 1;
        return { tickStepSec: step, tickCount: count };
    }, [durationSeconds]);

    const scrubFromClientX = (clientX: number) => {
        const el = rulerRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const x = Math.min(Math.max(clientX - rect.left, 0), rect.width);
        const pct = rect.width > 0 ? x / rect.width : 0;
        const t = pct * durationSeconds;
        onScrub?.(t);
    };

    useEffect(() => {
        if (!isDragging) return;
        const onMove = (e: PointerEvent) => scrubFromClientX(e.clientX);
        const onUp = () => setIsDragging(false);
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp, { once: true });
        return () => {
            window.removeEventListener("pointermove", onMove);
        };
    }, [isDragging, durationSeconds]);

    return (
        <div className="timelineRoot">
            <div className="timelineToolbar">
                <div className="timelineTitle">Timeline</div>
                <div className="timelineControls">
                    <button
                        className="timelineControlButton"
                        type="button"
                        onClick={() => {
                            if (isPlaying) onPause?.();
                            else onPlay?.();
                        }}
                        disabled={!onPlay && !onPause}
                        aria-label={isPlaying ? "Pause" : "Play"}
                        title={isPlaying ? "Pause" : "Play"}
                    >
                        {isPlaying ? "Pause" : "Play"}
                    </button>
                    <button
                        className="timelineControlButton"
                        type="button"
                        onClick={() => onStop?.()}
                        disabled={!onStop}
                        aria-label="Stop"
                        title="Stop"
                    >
                        Stop
                    </button>
                    <div className="timelineControlDivider" />
                    <button
                        className="timelineControlButton"
                        type="button"
                        onClick={() => onStep?.(-1 / fps)}
                        disabled={!onStep}
                        aria-label="Step back"
                        title="Step back (1 frame)"
                    >
                        ◀
                    </button>
                    <button
                        className="timelineControlButton"
                        type="button"
                        onClick={() => onStep?.(1 / fps)}
                        disabled={!onStep}
                        aria-label="Step forward"
                        title="Step forward (1 frame)"
                    >
                        ▶
                    </button>
                    <div className="timelineTimecode" title="Current time / Duration">
                        {currentTimeSec.toFixed(2)} / {durationSeconds.toFixed(2)}
                    </div>
                </div>
                <div className="timelineMeta">
                    <span>{fps} fps</span>
                    <span>•</span>
                    <span>{durationSeconds}s</span>
                    <span>•</span>
                    <span>{totalFrames} frames</span>
                </div>
            </div>

            <div className="timelineBody">
                <div className="timelineGrid">
                    <div className="timelineLabelsCol">
                        <div className="timelineLabelsRulerSpacer" />
                        <div className="timelineLabelsScroll">
                            <div className="timelineTrackLabel">Scene</div>
                            <div className="timelineTrackLabel">Audio</div>
                        </div>
                    </div>

                    <div className="timelineLaneStack">
                        <div
                            className="timelinePlayhead timelinePlayheadSpan"
                            style={{ left: `${playheadPct}%` }}
                            aria-hidden
                        >
                            <div className="timelinePlayheadLine" />
                            <div className="timelinePlayheadHandle" />
                        </div>

                        <div
                            className="timelineRuler"
                            ref={rulerRef}
                            style={{ gridTemplateColumns: `repeat(${tickCount}, 1fr)` }}
                            onPointerDown={(e) => {
                                setIsDragging(true);
                                scrubFromClientX(e.clientX);
                            }}
                        >
                            {Array.from({ length: tickCount }).map((_, i) => {
                                const t = i * tickStepSec;
                                const isMajor = i % 5 === 0;
                                const label = isMajor ? `${t % 1 === 0 ? t.toFixed(0) : t.toFixed(1)}s` : null;
                                return (
                                    <div key={i} className={isMajor ? "timelineTick timelineTickMajor" : "timelineTick"}>
                                        {label ? <span className="timelineTickLabel">{label}</span> : null}
                                    </div>
                                );
                            })}
                        </div>

                        <div className="timelineTracks">
                            <div className="timelineTrackLane">
                                <div className="timelineClip" style={{ left: "40px", width: "240px" }}>
                                    Intro
                                </div>
                                <div className="timelineClip" style={{ left: "320px", width: "160px" }}>
                                    Anim
                                </div>
                            </div>

                            <div className="timelineTrackLane">
                                <div className="timelineClip timelineClipMuted" style={{ left: "80px", width: "120px" }}>
                                    Music
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
                <div className="timelinePlayheadReadout">{currentTimeSec.toFixed(2)}s</div>
            </div>
        </div>
    );
}
