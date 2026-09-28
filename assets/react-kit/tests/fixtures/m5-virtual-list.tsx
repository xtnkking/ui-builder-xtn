import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Button, VirtualList } from "../../src/personal-ui";
import "../../src/personal-ui/styles.css";

declare global {
  interface Window { virtualListEndCalls: number }
}

window.virtualListEndCalls = 0;
const initialItems = Array.from({ length: 100 }, (_, index) => ({ id: `row-${index + 1}`, label: `Row ${index + 1}` }));

function VirtualListFixture() {
  const [items, setItems] = useState(initialItems);
  const [height, setHeight] = useState(160);
  return (
    <main style={{ maxWidth: 520, margin: "48px auto" }}>
      <Button onClick={() => setItems(initialItems.slice(0, 2))}>Shrink data</Button>
      <Button onClick={() => setItems((current) => [...current, ...initialItems.slice(2, 8)])}>Append data</Button>
      <Button onClick={() => setHeight(80)}>Resize viewport</Button>
      <VirtualList
        items={items}
        itemKey={(item) => item.id}
        renderItem={(item) => <Button size="small">{item.label}</Button>}
        height={height}
        itemSize={40}
        overscan={2}
        ariaLabel="Records"
        onEndReached={() => { window.virtualListEndCalls += 1; }}
      />
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<VirtualListFixture />);
