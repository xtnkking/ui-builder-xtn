import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Button, ConfirmDialog, ContextMenu, Dialog } from "../../src/personal-ui";
import "./m5-context-menu.css";

function Fixture() {
  const [selected, setSelected] = useState("none");
  const [buttonClicks, setButtonClicks] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const items = [
    { id: "alpha", label: "Alpha", onSelect: () => setSelected("Alpha") },
    { id: "blocked", label: "Blocked", disabled: true, onSelect: () => setSelected("Blocked") },
    { id: "bravo", label: "Bravo", onSelect: () => setSelected("Bravo") },
    { id: "charlie", label: "Charlie", onSelect: () => setSelected("Charlie") },
  ];
  return (
    <main>
      <Button onClick={() => undefined}>Before</Button>
      <ContextMenu ariaLabel="Record actions" items={items}>
        <span className="context-target">Static record</span>
      </ContextMenu>
      <ContextMenu ariaLabel="Button actions" items={items}>
        <Button onClick={() => setButtonClicks((count) => count + 1)}>Button record</Button>
      </ContextMenu>
      <Button onClick={() => undefined}>After</Button>
      <output aria-label="Selected action">{selected}</output>
      <output aria-label="Button clicks">{buttonClicks}</output>
      <Button onClick={() => setDialogOpen(true)}>Open dialog</Button>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen} title="Records dialog">
        <ContextMenu ariaLabel="Dialog actions" items={[
          { id: "open-confirm", label: "Open confirmation", onSelect: () => setConfirmOpen(true) },
          { id: "disabled", label: "Unavailable", disabled: true, onSelect: () => undefined },
          { id: "inspect", label: "Inspect", onSelect: () => setSelected("Inspect") },
        ]}>
          <button type="button" className="context-target">Dialog record</button>
        </ContextMenu>
        <Button onClick={() => undefined}>Dialog next</Button>
        <ConfirmDialog open={confirmOpen} onOpenChange={setConfirmOpen} title="Confirm action" onConfirm={() => setConfirmOpen(false)} />
      </Dialog>
      <div className="edge-trigger">
        <ContextMenu ariaLabel="Edge actions" items={items}>
          <button type="button">Edge record</button>
        </ContextMenu>
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<Fixture />);
