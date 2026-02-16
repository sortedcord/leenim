// import React from "react"; // This line is commented out to remove unnecessary import

export type PreviewPanelProps = {
    status?: string;
    onRender?: () => void;
    onInstallManim?: () => void;
    isInstalling?: boolean;
    outputUrl?: string | null;
    onVideoError?: (info: { src: string; code?: number; message?: string }) => void;
    showInstallButton?: boolean;
};

export default function PreviewPanel({
    status = "Idle",
    onRender,
    onInstallManim,
    isInstalling,
    outputUrl,
    onVideoError,
    showInstallButton = true,
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
                        src={outputUrl}
                        controls
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
