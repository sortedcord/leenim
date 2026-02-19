import { useEffect, useMemo, useRef, useState } from "react";
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

    const videoRef = useRef<HTMLVideoElement | null>(null);
    const [playheadSec, setPlayheadSec] = useState(0);
    const [videoDurationSec, setVideoDurationSec] = useState<number | null>(null);

    const [openMenu, setOpenMenu] = useState<null | "file" | "edit" | "view">(null);
    const menuRootRef = useRef<HTMLDivElement | null>(null);

    const handleQuit = async () => {
        setOpenMenu(null);
        try {
            // Best-effort: only works in Tauri.
            // Use a Rust-side command to terminate the process.
            const { invoke } = await import("@tauri-apps/api/core");
            await invoke("quit_app");
            return;
        } catch {
            // Not running in Tauri (or API unavailable). Try to close the tab/window.
        }

        try {
            window.close();
        } catch {
            // ignore
        }
    };

    // Close menus only when clicking outside the menu bar + dropdown.
    useEffect(() => {
        if (!openMenu) return;

        const onPointerDown = (ev: PointerEvent) => {
            const root = menuRootRef.current;
            if (!root) return;
            const target = ev.target as Node | null;
            if (target && root.contains(target)) return;
            setOpenMenu(null);
        };

        const opts: AddEventListenerOptions = { capture: true };
        document.addEventListener("pointerdown", onPointerDown, opts);
        return () => {
            document.removeEventListener("pointerdown", onPointerDown, opts);
        };
    }, [openMenu]);

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
                        videoRef={videoRef}
                        onVideoTimeUpdate={(t, d) => {
                            setPlayheadSec(t);
                            if (d && Number.isFinite(d)) setVideoDurationSec(d);
                        }}
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
        <div className="h-screen w-screen flex flex-col bg-app-bg text-[color:var(--tw-color-app-text)] text-white">
            <div className="h-10 shrink-0 flex items-center gap-2 px-2 border-b border-white/10 bg-app-panel relative">
                <div className="relative flex items-center gap-1" ref={menuRootRef}>
                    <button
                        className={
                            `px-2 py-1 rounded text-sm text-white/90 hover:bg-white/10 ` +
                            (openMenu === "file" ? "bg-white/12" : "")
                        }
                        onClick={() => setOpenMenu((m) => (m === "file" ? null : "file"))}
                        type="button"
                    >
                        File
                    </button>
                    <button
                        className={
                            `px-2 py-1 rounded text-sm text-white/90 hover:bg-white/10 ` +
                            (openMenu === "edit" ? "bg-white/12" : "")
                        }
                        onClick={() => setOpenMenu((m) => (m === "edit" ? null : "edit"))}
                        type="button"
                    >
                        Edit
                    </button>
                    <button
                        className={
                            `px-2 py-1 rounded text-sm text-white/90 hover:bg-white/10 ` +
                            (openMenu === "view" ? "bg-white/12" : "")
                        }
                        onClick={() => setOpenMenu((m) => (m === "view" ? null : "view"))}
                        type="button"
                    >
                        View
                    </button>

                    {openMenu ? (
                        <div className="absolute top-full left-0 mt-1 w-56 rounded-lg border border-white/12 bg-app-panel shadow-lg overflow-hidden z-50">
                            {openMenu === "file" ? (
                                <>
                                    <button
                                        className="w-full text-left px-3 py-2 text-sm text-white/90 hover:bg-white/10"
                                        type="button"
                                        onClick={() => setOpenMenu(null)}
                                    >
                                        New Project (todo)
                                    </button>
                                    <button
                                        className="w-full text-left px-3 py-2 text-sm text-white/90 hover:bg-white/10"
                                        type="button"
                                        onClick={() => setOpenMenu(null)}
                                    >
                                        Open… (todo)
                                    </button>
                                    <div className="h-px bg-white/10 my-1" />
                                    <button
                                        className="w-full text-left px-3 py-2 text-sm text-white/90 hover:bg-white/10 flex items-center justify-between"
                                        type="button"
                                        onClick={handleQuit}
                                    >
                                        <span>Quit</span>
                                        <span className="text-xs text-white/55">
                                            {navigator.platform.toLowerCase().includes("mac") ? "Cmd+Q" : "Ctrl+Q"}
                                        </span>
                                    </button>
                                </>
                            ) : null}

                            {openMenu === "edit" ? (
                                <>
                                    <button
                                        className="w-full text-left px-3 py-2 text-sm text-white/90 hover:bg-white/10"
                                        type="button"
                                        onClick={() => setOpenMenu(null)}
                                    >
                                        Undo (todo)
                                    </button>
                                    <button
                                        className="w-full text-left px-3 py-2 text-sm text-white/90 hover:bg-white/10"
                                        type="button"
                                        onClick={() => setOpenMenu(null)}
                                    >
                                        Redo (todo)
                                    </button>
                                    <div className="h-px bg-white/10 my-1" />
                                    <button
                                        className="w-full text-left px-3 py-2 text-sm text-white/90 hover:bg-white/10"
                                        type="button"
                                        onClick={() => setOpenMenu(null)}
                                    >
                                        Find… (todo)
                                    </button>
                                </>
                            ) : null}

                            {openMenu === "view" ? (
                                <>
                                    <button
                                        className="w-full text-left px-3 py-2 text-sm text-white/90 hover:bg-white/10"
                                        type="button"
                                        onClick={() => {
                                            setPage("editor");
                                            setOpenMenu(null);
                                        }}
                                    >
                                        Editor
                                    </button>
                                    <button
                                        className="w-full text-left px-3 py-2 text-sm text-white/90 hover:bg-white/10"
                                        type="button"
                                        onClick={() => {
                                            setPage("logs");
                                            setOpenMenu(null);
                                        }}
                                    >
                                        Logs
                                    </button>
                                </>
                            ) : null}
                        </div>
                    ) : null}
                </div>

                <div className="absolute left-1/2 -translate-x-1/2 font-semibold text-sm tracking-wide text-white/85 select-none">
                    Leenim
                </div>
                <div className="ml-auto flex items-center gap-2">
                    <button
                        className={
                            "h-7 px-3 rounded-md text-sm border border-white/10 bg-white/5 hover:bg-white/10 " +
                            (page === "logs" ? "text-white" : "text-white/80")
                        }
                        onClick={() => setPage("logs")}
                        type="button"
                    >
                        Logs
                    </button>
                    <button
                        className={
                            "h-7 px-3 rounded-md text-sm border border-white/10 bg-white/5 hover:bg-white/10 " +
                            (page === "editor" ? "text-white" : "text-white/80")
                        }
                        onClick={() => setPage("editor")}
                        type="button"
                    >
                        Editor
                    </button>
                </div>
            </div>

            <div className="flex-1 min-h-0">
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
                        second={
                            <Timeline
                                fps={60}
                                durationSeconds={videoDurationSec ?? 10}
                                currentTimeSec={playheadSec}
                                onScrub={(t) => {
                                    setPlayheadSec(t);
                                    const v = videoRef.current;
                                    if (v) v.currentTime = t;
                                }}
                            />
                        }
                    />
                )}
            </div>
        </div>
    );
}