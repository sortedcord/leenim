import { useEffect, useMemo, useState } from "react";
import SplitPane from "../components/SplitPane";
import CodePanel from "../components/CodePanel";
import PreviewPanel from "../components/PreviewPanel";
import Timeline from "../components/Timeline";
import { installManim, manimStatus, renderManim } from "../tauri/manim";
import LogsPage, { type LogEntry } from "./LogsPage";
import { toAssetUrl } from "../tauri/path";
import { readFileBase64 } from "../tauri/manim";

const DEFAULT_CODE = `from manim import *

class Test(Scene):
    def construct(self):
        title = Text("Hello, Manim!")
        self.play(Write(title))
        self.wait(1)
`;

export default function EditorLayout() {
    const [page, setPage] = useState<"editor" | "logs">("editor");
    const [code, setCode] = useState(DEFAULT_CODE);
    const [renderStatus, setRenderStatus] = useState<string>("Idle");
    const [stdout, setStdout] = useState<string>("");
    const [stderr, setStderr] = useState<string>("");
    const [outputPath, setOutputPath] = useState<string | null>(null);
    const [outputUrl, setOutputUrl] = useState<string | null>(null);
    const [blobUrl, setBlobUrl] = useState<string | null>(null);
    const [workDir, setWorkDir] = useState<string>("");
    const [scriptPath, setScriptPath] = useState<string>("");
    const [isInstalling, setIsInstalling] = useState(false);
    const [isManimInstalled, setIsManimInstalled] = useState(false);
    const [isCheckingManim, setIsCheckingManim] = useState(true);
    const [logEntries, setLogEntries] = useState<LogEntry[]>([]);

    // One-time status check (best-effort). Avoids showing Install when already installed.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const s = await manimStatus();
                if (!cancelled && s.ok) setIsManimInstalled(Boolean(s.installed));
            } catch {
                // ignore
            } finally {
                if (!cancelled) setIsCheckingManim(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const pushLog = (entry: Omit<LogEntry, "id">) => {
        setLogEntries((prev) => [
            {
                ...entry,
                id: `${entry.ts}-${Math.random().toString(16).slice(2)}`,
            },
            ...prev,
        ]);
    };

    const top = useMemo(
        () => (
            <SplitPane
                direction="vertical"
                initialRatio={0.55}
                storageKey="leenim.split.top"
                minFirstPx={320}
                minSecondPx={280}
                first={<CodePanel code={code} onChange={setCode} />}
                second={
                    <PreviewPanel
                        status={renderStatus}
                        outputUrl={outputUrl}
                        isInstalling={isInstalling}
                        showInstallButton={!isCheckingManim && !isManimInstalled}
                        onVideoError={(info) => {
                            pushLog({
                                ts: Date.now(),
                                kind: "error",
                                status: "Preview video failed to load",
                                stderr: `src=${info.src}\ncode=${info.code ?? ""}\nmessage=${info.message ?? ""}`.trim(),
                            });
                        }}
                        onInstallManim={async () => {
                            setIsInstalling(true);
                            setRenderStatus("Installing...");
                            setStdout("");
                            setStderr("");
                            try {
                                const res = await installManim();
                                setWorkDir(res.work_dir || "");
                                setStdout(res.stdout || "");
                                setStderr(res.stderr || "");
                                setRenderStatus(res.ok ? "Installed" : "Install failed");
                                if (res.ok) setIsManimInstalled(true);

                                pushLog({
                                    ts: Date.now(),
                                    kind: "install",
                                    status: res.ok ? "Installed" : "Install failed",
                                    stdout: res.stdout || "",
                                    stderr: res.stderr || "",
                                    workDir: res.work_dir || "",
                                });
                            } catch (e) {
                                setRenderStatus("Install error");
                                setStderr(String(e));

                                pushLog({
                                    ts: Date.now(),
                                    kind: "error",
                                    status: "Install error",
                                    stderr: String(e),
                                });
                            } finally {
                                setIsInstalling(false);
                            }
                        }}
                        onRender={async () => {
                            setRenderStatus("Rendering...");
                            setStdout("");
                            setStderr("");
                            setOutputPath(null);
                            setOutputUrl(null);
                            if (blobUrl) {
                                URL.revokeObjectURL(blobUrl);
                                setBlobUrl(null);
                            }
                            try {
                                const res = await renderManim(code);
                                if (res.ok) setRenderStatus(res.output_path ? "Rendered" : "Rendered (no file found)");
                                else setRenderStatus("Failed");

                                setStdout(res.stdout ?? "");
                                setStderr(res.stderr ?? "");
                                setOutputPath(res.output_path ?? null);
                                setWorkDir(res.work_dir ?? "");
                                setScriptPath(res.script_path ?? "");

                                if (res.output_path) {
                                    // Prefer a blob URL to avoid WebView protocol/range edge-cases.
                                    const file = await readFileBase64(res.output_path);
                                    if (file.ok && file.base64) {
                                        const bin = Uint8Array.from(atob(file.base64), (c) => c.charCodeAt(0));
                                        const blob = new Blob([bin], { type: file.mime || "video/mp4" });
                                        const url = URL.createObjectURL(blob);
                                        setBlobUrl(url);
                                        setOutputUrl(url);
                                    } else {
                                        // Fallback to the protocol URL.
                                        setOutputUrl(toAssetUrl(res.output_path));
                                    }
                                }

                                pushLog({
                                    ts: Date.now(),
                                    kind: "render",
                                    status: res.ok ? "Rendered" : "Failed",
                                    stdout: res.stdout ?? "",
                                    stderr: res.stderr ?? "",
                                    workDir: res.work_dir ?? "",
                                    scriptPath: res.script_path ?? "",
                                    outputPath: res.output_path ?? null,
                                });
                            } catch (e) {
                                setRenderStatus("Error");
                                setStderr(String(e));

                                pushLog({
                                    ts: Date.now(),
                                    kind: "error",
                                    status: "Render error",
                                    stderr: String(e),
                                });
                            }
                        }}
                    />
                }
            />
        ),
        [
            code,
            renderStatus,
            outputUrl,
            isInstalling,
            blobUrl,
            outputPath,
            scriptPath,
            stderr,
            stdout,
            workDir,
        ],
    );

    return (
        <div className="appRoot">
            <div className="appTopBar">
                <div className="appBrand">leenim</div>
                <div className="appHint">A friendlier Manim editor (work in progress)</div>
                <div className="appTopActions">
                    <button className="btn" onClick={() => setPage("logs")}>Logs</button>
                    <button className="btn" onClick={() => setPage("editor")}>Editor</button>
                </div>
            </div>

            <div className="appMain">
                {page === "logs" ? (
                    <LogsPage
                        entries={logEntries}
                        onBack={() => setPage("editor")}
                        onClear={() => setLogEntries([])}
                    />
                ) : (
                    <SplitPane
                        direction="horizontal"
                        initialRatio={0.62}
                        storageKey="leenim.split.main"
                        minFirstPx={280}
                        minSecondPx={180}
                        first={top}
                        second={<Timeline fps={60} durationSeconds={10} />}
                    />
                )}
            </div>
        </div>
    );
}
