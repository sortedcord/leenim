import { useMemo } from "react";
import { toAssetUrl } from "../tauri/path";

export type LogKind = "install" | "render" | "info" | "error";

export type LogEntry = {
    id: string;
    ts: number;
    kind: LogKind;
    status: string;
    stdout?: string;
    stderr?: string;
    workDir?: string;
    scriptPath?: string;
    outputPath?: string | null;
};

export type LogsPageProps = {
    entries: LogEntry[];
    onBack: () => void;
    onClear: () => void;
};

function fmtTime(ts: number) {
    const d = new Date(ts);
    return d.toLocaleString();
}

export default function LogsPage({ entries, onBack, onClear }: LogsPageProps) {
    const newestFirst = useMemo(() => [...entries].sort((a, b) => b.ts - a.ts), [entries]);

    return (
        <div className="logsRoot">
            <div className="panelHeader">
                <div className="panelTitle">Logs</div>
                <div className="panelRight">
                    <button className="btn" onClick={onClear} disabled={entries.length === 0}>
                        Clear
                    </button>
                    <button className="btn" onClick={onBack}>
                        Back
                    </button>
                </div>
            </div>

            <div className="logsBody">
                {newestFirst.length === 0 ? (
                    <div className="logsEmpty">No logs yet.</div>
                ) : (
                    newestFirst.map((e) => (
                        <div key={e.id} className="logsEntry">
                            <div className="logsEntryHeader">
                                <div className={`logsKind logsKind-${e.kind}`}>{e.kind}</div>
                                <div className="logsStatus">{e.status}</div>
                                <div className="logsTime">{fmtTime(e.ts)}</div>
                            </div>

                            <div className="logsEntryMeta">
                                {e.outputPath ? <div>output: {e.outputPath}</div> : null}
                                {e.outputPath ? <div>playback url: {toAssetUrl(e.outputPath)}</div> : null}
                                {e.workDir ? <div>work: {e.workDir}</div> : null}
                                {e.scriptPath ? <div>script: {e.scriptPath}</div> : null}
                            </div>

                            {e.stderr ? (
                                <div className="previewLogBlock previewLogBlockErr">
                                    <div className="previewLogLabel">stderr</div>
                                    <pre className="previewLogPre">{e.stderr}</pre>
                                </div>
                            ) : null}

                            {e.stdout ? (
                                <div className="previewLogBlock">
                                    <div className="previewLogLabel">stdout</div>
                                    <pre className="previewLogPre">{e.stdout}</pre>
                                </div>
                            ) : null}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
