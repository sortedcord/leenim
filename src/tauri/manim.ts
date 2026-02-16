export type RenderResult = {
    ok: boolean;
    stdout: string;
    stderr: string;
    output_path: string | null;
    work_dir?: string;
    script_path?: string;
};

export type InstallResult = {
    ok: boolean;
    stdout: string;
    stderr: string;
    work_dir: string;
};

export type ReadFileBase64Result = {
    ok: boolean;
    mime: string;
    base64: string;
    bytes: number;
};

function isTauriRuntime() {
    // More robust than __TAURI__: different versions / dev setups may not expose it.
    // In Tauri v2, the IPC bridge is typically present as a `__TAURI_INTERNALS__` global.
    const w = typeof window !== "undefined" ? (window as any) : undefined;
    return Boolean(w && (w.__TAURI_INTERNALS__ || w.__TAURI__));
}

export async function renderManim(code: string): Promise<RenderResult> {
    if (!isTauriRuntime()) {
        return {
            ok: false,
            stdout: "",
            stderr: "Not running inside Tauri. Use `pnpm tauri dev` to enable native commands.",
            output_path: null,
        };
    }

    // Dynamic import avoids bundler/runtime edge-cases where static imports can be evaluated
    // even in non-Tauri contexts or swapped during dev reload.
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<RenderResult>("render_manim", { code });
}

export async function installManim(): Promise<InstallResult> {
    if (!isTauriRuntime()) {
        return {
            ok: false,
            stdout: "",
            stderr: "Not running inside Tauri. Use `pnpm tauri dev` to enable native commands.",
            work_dir: "",
        };
    }

    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<InstallResult>("install_manim");
}

export async function readFileBase64(path: string): Promise<ReadFileBase64Result> {
    if (!isTauriRuntime()) {
        return {
            ok: false,
            mime: "application/octet-stream",
            base64: "",
            bytes: 0,
        };
    }
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<ReadFileBase64Result>("read_file_base64", { path });
}
