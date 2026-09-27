import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Tree, TreeSelect } from "../../src/personal-ui";
import "../../src/personal-ui/styles.css";

const nodes = [
  { id: "account", label: "Account", children: [{ id: "profile", label: "Profile" }, { id: "blocked", label: "Blocked", disabled: true }] },
  { id: "settings", label: "Settings" },
];
const options = [
  { value: "account", label: "Account", children: [{ value: "profile", label: "Profile" }, { value: "blocked", label: "Blocked", disabled: true }] },
  { value: "settings", label: "Settings" },
];

function Fixture() {
  const [treeNodes, setTreeNodes] = useState(nodes);
  const [selected, setSelected] = useState("");
  return <main className="pui-theme pui-root" style={{ maxWidth: 640, padding: 24 }} data-ready="true">
    <button type="button">Before tree</button>
    <Tree nodes={treeNodes} ariaLabel="Account tree" value={selected} onValueChange={setSelected} />
    <button type="button" onClick={() => setTreeNodes(nodes.slice(0, 1))}>Remove settings</button>
    <form aria-label="Section form" onSubmit={(event) => event.preventDefault()}>
      <TreeSelect name="section" options={options} defaultValue="" ariaLabel="Section" />
      <button type="button">After tree select</button>
    </form>
  </main>;
}

createRoot(document.getElementById("root")!).render(<Fixture />);
