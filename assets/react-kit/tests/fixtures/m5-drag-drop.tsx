import { useState } from "react";
import { createRoot } from "react-dom/client";
import { DragDrop, FileUpload } from "../../src/personal-ui";
import "../../src/personal-ui/styles.css";

function DragDropFixture() {
  const [accepted, setAccepted] = useState<string[]>([]);
  const [rejected, setRejected] = useState<string[]>([]);
  return (
    <main style={{ maxWidth: 520, margin: "48px auto" }}>
      <DragDrop ariaLabel="Image drop area" accept="image/*,.svg" onFiles={(files) => setAccepted(files.map((file) => file.name))} onRejected={(files) => setRejected(files.map((file) => file.name))}>
        Drop images here
      </DragDrop>
      <output aria-label="Accepted files">{accepted.join(", ")}</output>
      <output aria-label="Rejected files">{rejected.join(", ")}</output>
      <FileUpload items={[]} onFiles={() => undefined} browseLabel="Choose files with keyboard" />
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<DragDropFixture />);
