import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Button, DragDrop, Switch } from "../../src/personal-ui";
import "../../src/personal-ui/styles.css";

function DragDropFixture() {
  const [accepted, setAccepted] = useState<string[]>([]);
  const [rejected, setRejected] = useState<string[]>([]);
  const [disabled, setDisabled] = useState(false);
  return (
    <main style={{ maxWidth: 520, margin: "48px auto" }}>
      <h1>Standalone file selection</h1>
      <Switch label="Disable file selection" checked={disabled} onChange={(event) => setDisabled(event.currentTarget.checked)} />
      <Button>Before files</Button>
      <DragDrop disabled={disabled} browseLabel="Choose files with keyboard" ariaLabel="Image drop area" accept="image/*,.svg" onFiles={(files) => setAccepted(files.map((file) => file.name))} onRejected={(files) => setRejected(files.map((file) => file.name))}>
        Drop images here
      </DragDrop>
      <output aria-label="Accepted files">{accepted.join(", ")}</output>
      <output aria-label="Rejected files">{rejected.join(", ")}</output>
      <Button>After files</Button>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<DragDropFixture />);
