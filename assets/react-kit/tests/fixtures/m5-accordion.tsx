import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Accordion, type AccordionItem } from "../../src/personal-ui";
import "../../src/personal-ui/styles.css";

const items: AccordionItem[] = [
  { id: "profile", title: "Profile", content: <button type="button">Profile action</button> },
  { id: "security", title: "Security", content: <button type="button">Security action</button> },
  { id: "billing", title: "Billing", content: <button type="button">Billing action</button>, disabled: true },
];

function Fixture() {
  const [available, setAvailable] = useState(items);
  const [openIds, setOpenIds] = useState<string[]>(["profile"]);
  const [controlledAvailable, setControlledAvailable] = useState(items);
  const [controlledOpenIds, setControlledOpenIds] = useState<string[]>(["profile"]);

  return (
    <main className="pui-theme pui-root" style={{ maxWidth: 640, padding: 24 }} data-ready="true">
      <button type="button">Before accordion</button>
      <section aria-label="Uncontrolled disclosure">
        <h2>Uncontrolled disclosure</h2>
        <Accordion items={available} defaultValue={["profile"]} onValueChange={setOpenIds} />
        <output data-testid="open-ids">{openIds.join(",")}</output>
        <button type="button" onClick={() => setAvailable((current) => current.filter((item) => item.id !== "security"))}>Remove security</button>
        <button type="button" onClick={() => setAvailable(items)}>Restore security</button>
      </section>
      <section aria-label="Controlled disclosure">
        <h2>Controlled disclosure</h2>
        <Accordion items={controlledAvailable} type="single" value={controlledOpenIds} onValueChange={setControlledOpenIds} />
        <output data-testid="controlled-open-ids">{controlledOpenIds.join(",")}</output>
        <button type="button" onClick={() => setControlledAvailable((current) => current.filter((item) => item.id !== "profile"))}>Remove controlled profile</button>
        <button type="button" onClick={() => setControlledAvailable(items)}>Restore controlled profile</button>
      </section>
      <button type="button">After accordion</button>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<Fixture />);
