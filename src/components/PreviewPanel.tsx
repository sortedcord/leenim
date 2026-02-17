import type React from "react";

export type PreviewPanelProps = {
    status?: string;
    onRender?: () => void;
    onInstallManim?: () => void;
    isInstalling?: boolean;
    outputUrl?: string | null;
    onVideoError?: (info: { src: string; code?: number; message?: string }) => void;
    showInstallButton?: boolean;
    onVideoTimeUpdate?: (timeSec: number, durationSec: number) => void;
    videoRef?: React.RefObject<HTMLVideoElement | null>;
};

export default function PreviewPanel({
    status = "Idle",
    onRender,
    onInstallManim,
    isInstalling,
    outputUrl,
    onVideoError,
    showInstallButton = true,
    onVideoTimeUpdate,
    videoRef,
}: PreviewPanelProps) {
    return (
        <div className="previewRoot">
            <div className="panelHeader">
                <div className="panelTitle">Preview</div>
                <div className="panelRight">
                    <span className="badge">{status}</span>
                    {showInstallButton ? (
                        <button className="btn" onClick={onInstallManim} disabled={!onInstallManim || Boolean(isInstalling)}>
                            {isInstalling ? "Installing..." : "Install Manim"}
                        </button>
                    ) : null}
                    <button className="btn" onClick={onRender}>Render</button>
                </div>
            </div>

            <div className="previewCanvas">
                {outputUrl ? (
                    <video
                        className="previewVideo"
                        ref={videoRef as any}
                        src={outputUrl}
                        controls
                        onLoadedMetadata={(e) => {
                            const el = e.currentTarget;
                            onVideoTimeUpdate?.(el.currentTime || 0, Number.isFinite(el.duration) ? el.duration : 0);
                        }}
                        onTimeUpdate={(e) => {
                            const el = e.currentTarget;
                            onVideoTimeUpdate?.(el.currentTime || 0, Number.isFinite(el.duration) ? el.duration : 0);
                        }}
                        onError={(e) => {
                            const el = e.currentTarget;
                            const err = el.error;
                            onVideoError?.({
                                src: outputUrl,
                                code: err?.code,
                                message: err ? String(err.message || "") : undefined,
                            });
                        }}
                    />
                ) : (
                    <div className="previewPlaceholder">
                        <div className="previewPlaceholderTitle">Render preview</div>
                        <div className="previewPlaceholderSub">
                            Render an animation to see it here. (Once rendered, it’ll appear as a video player.)
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
