import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Button, InfiniteScroll, Stack } from "../../src/personal-ui";
import "../../src/personal-ui/styles.css";

const requests: number[] = [];
let pending: { resolve: (end: boolean) => void; reject: (error: unknown) => void } | undefined;
declare global {
  interface Window {
    standaloneInfinite: { requests: number[]; succeed: (end?: boolean) => void; fail: () => void; disable: (value: boolean) => void };
    intersectStandaloneInfinite: () => void;
  }
}
function Fixture() {
  const [cursor, setCursor] = useState(2);
  const [hasMore, setHasMore] = useState(true);
  const [disabled, setDisabled] = useState(false);
  const [records, setRecords] = useState(["Record 1", "Record 2"]);
  useEffect(() => {
    window.standaloneInfinite = {
      requests,
      succeed: (end = false) => { if (!pending) throw new Error("No pending request"); pending.resolve(end); pending = undefined; },
      fail: () => { if (!pending) throw new Error("No pending request"); pending.reject(new Error("offline")); pending = undefined; },
      disable: setDisabled,
    };
  }, []);
  return <main><Stack>
    <h1>Standalone continuous loading</h1>
    <Button>Before records</Button>
    <InfiniteScroll hasMore={hasMore} disabled={disabled} loadKey={cursor} onLoadMore={() => {
      requests.push(cursor);
      return new Promise<boolean>((resolve, reject) => { pending = { resolve, reject }; }).then((end) => {
        setRecords((current) => [...current, `Record ${cursor + 1}`, `Record ${cursor + 2}`]);
        setCursor(cursor + 2);
        setHasMore(!end);
      });
    }}>
      <ul aria-label="Retained records">{records.map((record) => <li key={record}>{record}</li>)}</ul>
    </InfiniteScroll>
    <Button>After records</Button>
  </Stack></main>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
