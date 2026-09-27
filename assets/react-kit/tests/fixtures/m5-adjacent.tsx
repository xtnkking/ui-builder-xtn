import { useState } from "react";
import { createRoot } from "react-dom/client";
import { CommandPalette, InfiniteScroll, ResizablePanels, Scheduler, Transfer } from "../../src/personal-ui";
import "../../src/personal-ui/styles.css";
import "./m5-adjacent.css";

const events = [
  { id: "late", title: "Late meeting", textValue: "Late meeting", start: new Date("2026-11-02T06:00:00Z"), end: new Date("2026-11-02T06:30:00Z") },
  { id: "early", title: "Early meeting", textValue: "Early meeting", start: new Date("2026-11-01T08:00:00Z"), end: new Date("2026-11-01T08:30:00Z") },
  { id: "middle", title: "Middle meeting", textValue: "Middle meeting", start: new Date("2026-11-01T09:00:00Z"), end: new Date("2026-11-01T09:30:00Z") },
];

function Fixture() {
  const [date, setDate] = useState(new Date("2026-11-01T07:30:00Z"));
  const [lastEvent, setLastEvent] = useState("");
  const [size, setSize] = useState(40);
  const [verticalSize, setVerticalSize] = useState(40);
  const [loadKey, setLoadKey] = useState(1);
  const [loadCount, setLoadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [failNext, setFailNext] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteLoading, setPaletteLoading] = useState(false);
  const [commandCount, setCommandCount] = useState(0);
  const [commandError, setCommandError] = useState("");
  const [submitted, setSubmitted] = useState("");

  return (
    <main>
      <section aria-label="Day agenda">
        <Scheduler date={date} events={events} locale="en-US" timeZone="America/Los_Angeles" onDateChange={setDate} onEventPress={(event) => setLastEvent(event.id)} />
        <output aria-label="Last event">{lastEvent}</output>
      </section>
      <section aria-label="Split workspace">
        <ResizablePanels
          ariaLabel="Resize workspace"
          first={<p>First pane</p>}
          second={<p>Second pane</p>}
          defaultSize={40}
          minSize={25}
          maxSize={75}
          onSizeChange={setSize}
        />
        <output aria-label="First pane size">{size}</output>
      </section>
      <section aria-label="Vertical workspace">
        <ResizablePanels
          ariaLabel="Resize vertical workspace"
          orientation="vertical"
          first={<button type="button">Top action</button>}
          second={<button type="button">Bottom action</button>}
          defaultSize={40}
          minSize={25}
          maxSize={75}
          onSizeChange={setVerticalSize}
        />
        <output aria-label="Top pane size">{verticalSize}</output>
      </section>
      <section aria-label="Paged items">
        <button type="button" onClick={() => setLoadKey((value) => value + 1)}>Advance cursor</button>
        <button type="button" onClick={() => setFailNext(true)}>Fail next request</button>
        <output aria-label="Load count">{loadCount}</output>
        <output aria-label="Load error">{loadError}</output>
        <InfiniteScroll
          hasMore
          loadKey={loadKey}
          loading={loading}
          onLoadError={(error) => setLoadError(String(error))}
          onLoadMore={async () => {
            setLoadCount((value) => value + 1);
            setLoading(true);
            await new Promise((resolve) => setTimeout(resolve, 30));
            setLoading(false);
            if (failNext) { setFailNext(false); throw new Error("Fetch failed"); }
          }}
        >
          <p>Cursor {loadKey}</p>
        </InfiniteScroll>
      </section>
      <section aria-label="Commands">
        <button type="button" onClick={() => { setPaletteLoading(false); setPaletteOpen(true); }}>Open commands</button>
        <button type="button" onClick={() => { setPaletteLoading(true); setPaletteOpen(true); }}>Open loading commands</button>
        <output aria-label="Command count">{commandCount}</output>
        <output aria-label="Command error">{commandError}</output>
        <CommandPalette
          open={paletteOpen}
          onOpenChange={setPaletteOpen}
          title="Commands"
          loading={paletteLoading}
          placeholder="Search commands"
          onCommandError={(error) => setCommandError(String(error))}
          commands={[
            { id: "alpha", label: "Alpha", textValue: "Alpha", onSelect: () => setCommandCount((value) => value + 1) },
            { id: "blocked", label: "Blocked", textValue: "Blocked", disabled: true, onSelect: () => undefined },
            { id: "beta", label: "Beta", textValue: "Beta", keywords: ["second"], onSelect: async () => { await new Promise((resolve) => setTimeout(resolve, 50)); setCommandCount((value) => value + 1); } },
            { id: "failure", label: "Failure", textValue: "Failure", onSelect: async () => { throw new Error("Command failed"); } },
          ]}
        />
      </section>
      <section aria-label="Transfer members">
        <form onSubmit={(event) => {
          event.preventDefault();
          setSubmitted(new FormData(event.currentTarget).getAll("members").join(","));
        }}>
          <Transfer
            ariaLabel="Move members"
            sourceTitle="Available"
            targetTitle="Chosen"
            name="members"
            required
            options={[
              { value: "alpha", label: "Alpha" },
              { value: "blocked", label: "Blocked", disabled: true },
              { value: "gamma", label: "Gamma" },
              { value: "delta", label: "Delta" },
            ]}
          />
          <button type="submit">Submit members</button>
          <button type="reset">Reset members</button>
        </form>
        <output aria-label="Submitted members">{submitted}</output>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<Fixture />);
