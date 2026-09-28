import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Button, CodeEditor } from "../../src/personal-ui";
import "../../src/personal-ui/styles.css";

function CodeEditorFixture() {
  const [plain, setPlain] = useState("plain");
  const [indented, setIndented] = useState("first\nsecond\nthird");
  return (
    <main style={{ maxWidth: 520, margin: "48px auto" }}>
      <Button onClick={() => undefined}>Before editor</Button>
      <CodeEditor value={plain} onValueChange={setPlain} aria-label="Plain editor" />
      <CodeEditor value={indented} onValueChange={setIndented} tabBehavior="indent" aria-label="Indent editor" />
      <Button onClick={() => undefined}>After editor</Button>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<CodeEditorFixture />);
