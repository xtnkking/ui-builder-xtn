import { useState } from "react";
import { createRoot } from "react-dom/client";
import { SortableList, type SortableItem } from "../../src/personal-ui";
import "../../src/personal-ui/styles.css";

function SortableListFixture() {
  const [items, setItems] = useState<SortableItem<string>[]>([
    { id: "a", value: "Alpha" },
    { id: "b", value: "Beta" },
    { id: "c", value: "Gamma" },
  ]);
  return (
    <main style={{ maxWidth: 520, margin: "48px auto" }}>
      <SortableList items={items} onReorder={setItems} renderItem={(value) => value} getItemLabel={(item) => item.value} ariaLabel="Priority" />
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<SortableListFixture />);
