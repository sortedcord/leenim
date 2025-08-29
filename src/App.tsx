import Editor from "@monaco-editor/react";

export default function App() {
  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <div style={{ flex: 1 }}>
        <Editor
          height="100%"
          defaultLanguage="python"
          defaultValue={`from manim import *\n\nclass Test(Scene):\n    def construct(self):\n        self.play(Write(Text("Hello, Manim!")))`}
        />
      </div>
      <div style={{ flex: 1, borderLeft: "1px solid gray" }}>
        <p>Preview goes here</p>
      </div>
    </div>
  );
}
