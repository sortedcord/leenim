// React import not needed with automatic JSX runtime

export type TimelineProps = {
    fps?: number;
    durationSeconds?: number;
};

export default function Timeline({ fps = 60, durationSeconds = 10 }: TimelineProps) {
    const totalFrames = Math.round(durationSeconds * fps);

    // Placeholder UI for now: track list + time ruler.
    return (
        <div className="timelineRoot">
            <div className="timelineToolbar">
                <div className="timelineTitle">Timeline</div>
                <div className="timelineMeta">
                    <span>{fps} fps</span>
                    <span>•</span>
                    <span>{durationSeconds}s</span>
                    <span>•</span>
                    <span>{totalFrames} frames</span>
                </div>
            </div>

            <div className="timelineBody">
                <div className="timelineTracks">
                    <div className="timelineTrack">
                        <div className="timelineTrackLabel">Scene</div>
                        <div className="timelineTrackLane">
                            <div className="timelineClip" style={{ left: "40px", width: "240px" }}>
                                Intro
                            </div>
                            <div className="timelineClip" style={{ left: "320px", width: "160px" }}>
                                Anim
                            </div>
                        </div>
                    </div>

                    <div className="timelineTrack">
                        <div className="timelineTrackLabel">Audio</div>
                        <div className="timelineTrackLane">
                            <div className="timelineClip timelineClipMuted" style={{ left: "80px", width: "120px" }}>
                                Music
                            </div>
                        </div>
                    </div>
                </div>

                <div className="timelineRuler">
                    {Array.from({ length: 21 }).map((_, i) => (
                        <div key={i} className={i % 5 === 0 ? "timelineTick timelineTickMajor" : "timelineTick"}>
                            {i % 5 === 0 ? <span className="timelineTickLabel">{i / 2}s</span> : null}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
