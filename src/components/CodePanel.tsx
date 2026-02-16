import { useMemo } from "react";
import Editor from "@monaco-editor/react";

export type CodePanelProps = {
    code: string;
    onChange: (next: string) => void;
};

export default function CodePanel({ code, onChange }: CodePanelProps) {
    const options = useMemo(
        () => ({
            minimap: { enabled: true },
            fontSize: 14,
            scrollBeyondLastLine: false,
            automaticLayout: true,
            wordWrap: "on" as const,
        }),
        [],
    );

    return (
        <div className="codeRoot">
            <div className="panelHeader">
                <div className="panelTitle">Script</div>
                <div className="panelRight">
                    <span className="badge">python</span>
                </div>
            </div>
            <div className="codeEditor">
                <Editor
                    height="100%"
                    defaultLanguage="python"
                    value={code}
                    onChange={(v: string | undefined) => onChange(v ?? "")}
                    theme="vs-dark"
                    options={options}
                />
            </div>
        </div>
    );
}
