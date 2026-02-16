import { convertFileSrc } from "@tauri-apps/api/core";

/**
 * Convert a local filesystem path into a URL that can be used as the src of <img>/<video> in Tauri.
 */
export function toAssetUrl(path: string): string {
    // Tauri v2 loads local files through the app's custom protocol.
    // Using the "asset" protocol is the expected way to show local video/image files.
    // If we aren't running inside Tauri (e.g. `pnpm dev`), return the raw path.
    const w = typeof window !== "undefined" ? (window as any) : undefined;
    const isTauri = Boolean(w && (w.__TAURI_INTERNALS__ || w.__TAURI__));

    // If the backend ever returns a percent-encoded path (or we persisted one),
    // decode it first. `convertFileSrc` expects a real filesystem path.
    const decodedPath = (() => {
        try {
            return decodeURIComponent(path);
        } catch {
            return path;
        }
    })();

    // Note: Tauri uses the `tauri://` protocol to safely serve local files.
    // `convertFileSrc` will build the correct URL for the current platform/webview.
    return isTauri ? convertFileSrc(decodedPath, "tauri") : decodedPath;
}
