import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Form, MarkdownEditor, RichTextEditor } from "../../src/personal-ui";
import "../../src/personal-ui/styles.css";

function Fixture() {
  const [source, setSource] = useState("Hello world");
  const [legacy, setLegacy] = useState("Old source");
  const [disabled, setDisabled] = useState(false);

  return (
    <main className="pui-theme pui-root" style={{ maxWidth: 680, padding: 24 }} data-ready="true">
      <Form aria-label="Notes" onSubmit={(event) => event.preventDefault()}>
        <MarkdownEditor value={source} onValueChange={setSource} name="markdown" aria-label="Markdown source" toolbarLabel="Markdown formatting" rows={4} disabled={disabled} />
        <RichTextEditor value={legacy} onValueChange={setLegacy} name="legacy" aria-label="Legacy source" rows={3} />
      </Form>
      <button type="button" onClick={() => setDisabled((value) => !value)}>Toggle disabled</button>
      <output data-testid="source-value">{source}</output>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<Fixture />);
