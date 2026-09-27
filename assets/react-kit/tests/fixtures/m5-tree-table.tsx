import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Button, TreeTable, type TreeTableNode } from "../../src/personal-ui";
import "../../src/personal-ui/styles.css";

interface Team { name: string }
const columns = [{ id: "name", header: "Name", cell: (value: Team) => value.name }];

function TreeTableFixture() {
  const [nodes, setNodes] = useState<readonly TreeTableNode<Team>[]>([{ id: "team", value: { name: "Team" }, hasChildren: true }]);
  const [attempts, setAttempts] = useState(0);
  return (
    <main style={{ maxWidth: 520, margin: "48px auto" }}>
      <TreeTable
        nodes={nodes}
        columns={columns}
        treeColumnId="name"
        ariaLabel="Teams"
        getRowLabel={(node) => node.value.name}
        onRequestChildren={async () => {
          setAttempts((count) => count + 1);
          if (attempts === 0) throw new Error("Offline");
          setNodes([{ id: "team", value: { name: "Team" }, children: [{ id: "member", value: { name: "Member" } }] }]);
        }}
      />
      <Button onClick={() => undefined}>After table</Button>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<TreeTableFixture />);
