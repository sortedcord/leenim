import type { Config } from "tailwindcss";

export default {
    content: ["./index.html", "./src/**/*.{ts,tsx}"],
    theme: {
        extend: {
            colors: {
                app: {
                    bg: "#0b0e14",
                    panel: "#0f1320",
                    panel2: "#0d1018",
                    border: "rgba(255,255,255,0.08)",
                    text: "rgba(255,255,255,0.92)",
                    muted: "rgba(255,255,255,0.72)",
                    faint: "rgba(255,255,255,0.55)",
                    accent: "#3ea6ff",
                },
            },
            fontFamily: {
                ui: [
                    "ui-sans-serif",
                    "system-ui",
                    "-apple-system",
                    "Segoe UI",
                    "Roboto",
                    "Arial",
                    "Noto Sans",
                    "sans-serif",
                ],
                mono: [
                    "ui-monospace",
                    "SFMono-Regular",
                    "Menlo",
                    "Monaco",
                    "Consolas",
                    "Liberation Mono",
                    "Courier New",
                    "monospace",
                ],
            },
            boxShadow: {
                hairline: "0 0 0 1px rgba(0,0,0,0.25)",
            },
        },
    },
    plugins: [],
} satisfies Config;
