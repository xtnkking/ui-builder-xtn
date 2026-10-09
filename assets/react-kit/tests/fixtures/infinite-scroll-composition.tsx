import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Button, Stack } from "../../src/personal-ui";
import { InfiniteScrollExample, type InfinitePageExample } from "../../src/explorer/cases/navigation/infinite-scroll.case";
import "../../src/personal-ui/styles.css";

type PendingPage = { cursor: number; resolve: (value: InfinitePageExample) => void; reject: (reason: unknown) => void };
const requests: number[] = [];
const pending: PendingPage[] = [];
const source = Array.from({ length: 8 }, (_, index) => ({ id: `record-${index + 1}`, label: `审核记录 ${index + 1}` }));

function fetchPage(cursor: number): Promise<InfinitePageExample> {
  requests.push(cursor);
  return new Promise((resolve, reject) => pending.push({ cursor, resolve, reject }));
}

export type InfiniteFixtureDriver = {
  requestedCursors: number[];
  succeed: () => void;
  fail: () => void;
  setDisabled: (value: boolean) => void;
};

declare global {
  interface Window { infiniteFixture: InfiniteFixtureDriver }
}

function Fixture() {
  const [disabled, setDisabled] = useState(false);
  const [feedback, setFeedback] = useState("");
  useEffect(() => {
    window.infiniteFixture = {
      requestedCursors: requests,
      succeed: () => {
        const request = pending.shift();
        if (!request) throw new Error("No owned request is pending");
        const cursor = Math.min(request.cursor + 2, source.length);
        request.resolve({ records: source.slice(request.cursor, cursor), cursor, hasMore: cursor < source.length });
      },
      fail: () => {
        const request = pending.shift();
        if (!request) throw new Error("No owned request is pending");
        request.reject(new Error("服务器暂不可用"));
      },
      setDisabled,
    };
  }, []);
  return <main><Stack>
    <h1>连续记录加载</h1>
    <Button onClick={() => setFeedback("Before action")}>Before records</Button>
    <section aria-label="连续记录"><InfiniteScrollExample fetchPage={fetchPage} disabled={disabled} /></section>
    <Button onClick={() => setFeedback("After action")}>After records</Button>
    <p role="status">{feedback}</p>
  </Stack></main>;
}

createRoot(document.getElementById("root")!).render(<Fixture />);
