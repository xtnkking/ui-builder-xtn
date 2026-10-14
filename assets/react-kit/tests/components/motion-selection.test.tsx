// @ui-coverage {"kind":"unit","runner":"components","exports":["Tabs","SegmentedControl"]}
import { StrictMode, useState } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SegmentedControl, Tabs } from "../../src/ui";

const items = [
  { id: "overview", label: "概览", content: "概览内容" },
  { id: "disabled", label: "禁用", content: "禁用内容", disabled: true },
  { id: "details", label: "详情", content: "详情内容" },
];
const options = items.map((item) => ({ value: item.id, label: item.label, disabled: item.disabled }));
let styles: HTMLStyleElement;
let reduced = false;
let liveOffset = 0;
let controlWidth = 90;
let ancestorScale = 1;
let resizeCallbacks: Array<() => void>;
let animations: Array<{ frames: Keyframe[]; cancel: ReturnType<typeof vi.fn>; finish: () => void }>;
let originalAnimate: PropertyDescriptor | undefined;
let motionListeners: Set<(event: MediaQueryListEvent) => void>;

beforeEach(() => {
  reduced = false;
  liveOffset = 0;
  controlWidth = 90;
  ancestorScale = 1;
  animations = [];
  resizeCallbacks = [];
  motionListeners = new Set();
  styles = document.createElement("style");
  styles.textContent = ".ui-tabs__indicator, .ui-segmented__indicator { --ui-motion-standard-enter: 180ms; --ui-motion-ease-enter: ease; }";
  document.head.append(styles);
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    get matches() { return reduced; }, media: query, onchange: null,
    addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => { motionListeners.add(listener); },
    removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => { motionListeners.delete(listener); },
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: () => false,
  } as unknown as MediaQueryList));
  vi.stubGlobal("ResizeObserver", class {
    constructor(callback: () => void) { resizeCallbacks.push(callback); }
    observe() {}
    disconnect() {}
  });
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    if (this.className.includes("__indicator")) {
      return new DOMRect((Number.parseFloat(this.style.left || "0") + liveOffset) * ancestorScale, Number.parseFloat(this.style.top || "0") * ancestorScale, Number.parseFloat(this.style.width || "0") * ancestorScale, Number.parseFloat(this.style.height || "0") * ancestorScale);
    }
    if (this.tagName === "BUTTON") {
      const buttons = Array.from(this.parentElement!.querySelectorAll(":scope > button"));
      return new DOMRect(buttons.indexOf(this) * 100 * ancestorScale, 0, controlWidth * ancestorScale, 40 * ancestorScale);
    }
    return new DOMRect(0, 0, 300 * ancestorScale, 40 * ancestorScale);
  });
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(300);
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(40);
  originalAnimate = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "animate");
  Object.defineProperty(HTMLElement.prototype, "animate", {
    configurable: true,
    value: (frames: Keyframe[]) => {
      let finish!: () => void;
      let reject!: () => void;
      const finished = new Promise<void>((resolve, rejectPromise) => { finish = resolve; reject = () => rejectPromise(new Error("cancelled")); });
      const cancel = vi.fn(reject);
      animations.push({ frames, cancel, finish });
      return { finished, cancel } as unknown as Animation;
    },
  });
});

afterEach(() => {
  styles.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (originalAnimate) Object.defineProperty(HTMLElement.prototype, "animate", originalAnimate);
  else delete (HTMLElement.prototype as Partial<HTMLElement>).animate;
});

describe("selection indicator motion contracts", () => {
  it("hydrates server-selected controls without an entrance animation or markup mismatch", async () => {
    // React's jsdom server renderer warns about client layout effects; actual server imports useEffect.
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const view = <><Tabs items={items} defaultValue="details" ariaLabel="服务端页面" /><SegmentedControl value="details" onValueChange={() => undefined} options={options} ariaLabel="服务端视图" /></>;
    const host = document.createElement("div");
    host.innerHTML = renderToString(view);
    document.body.append(host);
    expect(host.querySelectorAll("[hidden][aria-hidden='true']")).toHaveLength(2);
    expect(host.querySelector("[data-ui-selection-ready]")).toBeNull();
    const onRecoverableError = vi.fn();
    let root: ReturnType<typeof hydrateRoot> | undefined;
    try {
      await act(async () => { root = hydrateRoot(host, view, { onRecoverableError }); });
      expect(onRecoverableError).not.toHaveBeenCalled();
      expect(host.querySelectorAll("[data-ui-selection-ready='true']")).toHaveLength(2);
      expect(animations).toHaveLength(0);
    } finally {
      act(() => root?.unmount());
      host.remove();
    }
  });

  it("keeps CSS geometry independent of an entering ancestor scale", () => {
    ancestorScale = 0.96;
    const { container, rerender } = render(<Tabs items={items} value="details" onValueChange={() => undefined} ariaLabel="页面" />);
    const indicator = container.querySelector<HTMLElement>(".ui-tabs__indicator")!;
    expect(Number.parseFloat(indicator.style.left)).toBeCloseTo(200);
    expect(Number.parseFloat(indicator.style.width)).toBeCloseTo(90);
    expect(Number.parseFloat(indicator.style.top)).toBeCloseTo(38);
    ancestorScale = 1;
    rerender(<Tabs items={items} value="details" onValueChange={() => undefined} ariaLabel="页面" />);
    expect(Number.parseFloat(indicator.style.width)).toBeCloseTo(90);
    expect(animations).toHaveLength(0);
  });

  it("positions once without animation and retains one underline through rapid keyboard reversal", async () => {
    function Harness() {
      const [value, setValue] = useState("overview");
      return <Tabs items={items} value={value} onValueChange={setValue} ariaLabel="页面" />;
    }
    const { container, unmount } = render(<StrictMode><Harness /></StrictMode>);
    const indicator = container.querySelector<HTMLElement>(".ui-tabs__indicator")!;
    expect(indicator).toHaveAttribute("aria-hidden", "true");
    expect(indicator.style.left).toBe("0px");
    expect(indicator.style.top).toBe("38px");
    expect(animations).toHaveLength(0);
    const overview = screen.getByRole("tab", { name: "概览" });
    act(() => overview.focus());
    fireEvent.keyDown(overview, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "详情" })).toHaveFocus();
    expect(indicator.style.left).toBe("200px");
    expect(animations).toHaveLength(1);
    liveOffset = -125; // The first animation is visually at x=75 when selection reverses.
    fireEvent.keyDown(screen.getByRole("tab", { name: "详情" }), { key: "Home" });
    expect(animations[0].cancel).toHaveBeenCalledOnce();
    expect(animations[1].frames[0].transform).toContain("translate(75px, 0px)");
    expect(container.querySelectorAll(".ui-tabs__indicator")).toHaveLength(1);
    await act(async () => animations[0].finish());
    expect(indicator).toHaveAttribute("data-ui-selection-motion", "moving");
    unmount();
    expect(animations[1].cancel).toHaveBeenCalledOnce();
  });

  it("lands immediately on resize/reorder and settles the same indicator when motion finishes", async () => {
    const { container, rerender } = render(<Tabs items={items} value="overview" onValueChange={() => undefined} ariaLabel="页面" />);
    const indicator = container.querySelector<HTMLElement>(".ui-tabs__indicator")!;
    rerender(<Tabs items={items} value="details" onValueChange={() => undefined} ariaLabel="页面" />);
    controlWidth = 75;
    act(() => resizeCallbacks.forEach((callback) => callback()));
    expect(animations[0].cancel).toHaveBeenCalledOnce();
    expect(indicator.style.width).toBe("75px");
    expect(indicator).toHaveAttribute("data-ui-selection-motion", "idle");
    rerender(<Tabs items={[items[2], items[0], items[1]]} value="details" onValueChange={() => undefined} ariaLabel="页面" />);
    expect(indicator.style.left).toBe("0px");
    expect(animations).toHaveLength(1);
    rerender(<Tabs items={items} value="overview" onValueChange={() => undefined} ariaLabel="页面" />);
    // Same physical location needs no visual transition even though the item identity changed.
    expect(animations).toHaveLength(1);
    rerender(<Tabs items={items} value="details" onValueChange={() => undefined} ariaLabel="页面" />);
    await act(async () => animations[1].finish());
    expect(indicator).toHaveAttribute("data-ui-selection-motion", "idle");
    expect(indicator.style.left).toBe("200px");
  });

  it("preserves RTL arrow semantics and excludes disabled tabs from selection", () => {
    const { container } = render(<div dir="rtl" style={{ direction: "rtl" }}><Tabs items={items} defaultValue="overview" ariaLabel="页面" /></div>);
    const list = screen.getByRole("tablist");
    list.style.direction = "rtl";
    const overview = screen.getByRole("tab", { name: "概览" });
    fireEvent.keyDown(overview, { key: "ArrowLeft" });
    expect(screen.getByRole("tab", { name: "详情" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "禁用" })).toHaveAttribute("aria-selected", "false");
    expect(container.querySelectorAll(".ui-tabs__indicator")).toHaveLength(1);
  });

  it("moves a single segmented surface without changing form submission or disabled behavior", () => {
    function Harness() {
      const [value, setValue] = useState("overview");
      return <form aria-label="设置"><SegmentedControl value={value} onValueChange={setValue} options={options} name="view" ariaLabel="视图" /></form>;
    }
    const { container } = render(<Harness />);
    expect(animations).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "禁用" }));
    expect(animations).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "详情" }));
    expect(animations).toHaveLength(1);
    expect(container.querySelectorAll(".ui-segmented__indicator")).toHaveLength(1);
    expect(container.querySelector<HTMLElement>(".ui-segmented__indicator")!.style.left).toBe("200px");
    expect(new FormData(screen.getByRole("form", { name: "设置" }) as HTMLFormElement).get("view")).toBe("details");
  });

  it("cancels live selection motion for reduced-motion and removes an absent selection", () => {
    const { container, rerender, unmount } = render(<SegmentedControl value="overview" onValueChange={() => undefined} options={options} ariaLabel="视图" />);
    rerender(<SegmentedControl value="details" onValueChange={() => undefined} options={options} ariaLabel="视图" />);
    expect(animations).toHaveLength(1);
    act(() => {
      reduced = true;
      motionListeners.forEach((listener) => listener({ matches: true } as MediaQueryListEvent));
    });
    expect(animations[0].cancel).toHaveBeenCalledOnce();
    expect(container.querySelector(".ui-segmented__indicator")).toHaveAttribute("data-ui-selection-motion", "idle");
    rerender(<SegmentedControl value="overview" onValueChange={() => undefined} options={options} ariaLabel="视图" />);
    expect(animations[0].cancel).toHaveBeenCalledOnce();
    expect(animations).toHaveLength(1);
    expect(container.querySelector(".ui-segmented__indicator")).toHaveAttribute("data-ui-selection-motion", "idle");
    rerender(<SegmentedControl value="" onValueChange={() => undefined} options={[]} ariaLabel="视图" />);
    expect(container.querySelector(".ui-segmented__indicator")).toHaveAttribute("hidden");
    expect(screen.getByRole("group", { name: "视图" })).not.toHaveAttribute("data-ui-selection-ready");
    unmount();
    expect(motionListeners.size).toBe(0);
  });
});
