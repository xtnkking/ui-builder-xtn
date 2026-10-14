import { StrictMode, useRef, type CSSProperties } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMotionPresence, useNonModalMotion, type MotionProfile } from "../../src/ui/internal/motion";

interface HarnessProps {
  open: boolean;
  enter?: string;
  exit?: string;
  profile?: MotionProfile;
  attached?: boolean;
  onExited?: () => void;
}

function Harness({ open, enter = "180ms", exit = "140ms", profile = "standard", attached = true, onExited }: HarnessProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { present, state } = useMotionPresence(open, ref, profile, onExited);
  const styles = {
    "--ui-motion-enter": enter,
    "--ui-motion-exit": exit,
    animationName: state === "entering" ? "test-enter" : state === "exiting" ? "test-exit" : "none",
  } as CSSProperties;
  return <>
    <output data-testid="state">{state}</output>
    {present && attached ? <div ref={ref} data-testid="panel" data-ui-motion={state} style={styles}><span data-testid="child">内容</span></div> : null}
  </>;
}

function animationEvent(target: Element, type: string, name: string) {
  const event = new Event(type, { bubbles: true });
  Object.defineProperties(event, {
    animationName: { value: name },
    pseudoElement: { value: "" },
  });
  fireEvent(target, event);
}

function transitionEvent(target: Element, type: string, property: string) {
  const event = new Event(type, { bubbles: true });
  Object.defineProperties(event, {
    propertyName: { value: property },
    pseudoElement: { value: "" },
  });
  fireEvent(target, event);
}

function recordNativeMotionCleanup() {
  const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "animate");
  const animations: { target: HTMLElement; finish: () => void; cancel: ReturnType<typeof vi.fn> }[] = [];
  const cancellations: { target: HTMLElement; connected: boolean; state: string | null }[] = [];
  Object.defineProperty(HTMLElement.prototype, "animate", {
    configurable: true,
    value: function animate(this: HTMLElement) {
      let resolve!: () => void;
      const finished = new Promise<void>((complete) => { resolve = complete; });
      const cancel = vi.fn(() => {
        cancellations.push({
          target: this,
          connected: this.isConnected,
          state: this.closest("[data-ui-motion]")?.getAttribute("data-ui-motion") ?? null,
        });
        animation.playState = "idle";
      });
      const animation = { playState: "running", finished, cancel };
      animations.push({ target: this, cancel, finish: () => { animation.playState = "finished"; resolve(); } });
      return animation as unknown as Animation;
    },
  });
  return {
    animations,
    cancellations,
    restore: () => {
      if (original) Object.defineProperty(HTMLElement.prototype, "animate", original);
      else Reflect.deleteProperty(HTMLElement.prototype, "animate");
    },
  };
}

function CompletionDrawer({ open, onExited }: { open: boolean; onExited: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const { present, state } = useMotionPresence(open, ref, "drawer", onExited);
  return present ? <div ref={ref} data-testid="completion-overlay" data-ui-motion={state} style={{ "--ui-motion-enter": "220ms", "--ui-motion-exit": "180ms" } as CSSProperties}>
    <div className="ui-drawer" data-testid="completion-panel" style={{ "--_ui-motion-closed-transform": "translateX(100%)" } as CSSProperties}>抽屉内容</div>
  </div> : null;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("owned motion presence", () => {
  it("renders an open node immediately and retains a close until its CSS duration plus the bounded fallback", () => {
    const onExited = vi.fn();
    const { rerender } = render(<Harness open onExited={onExited} />);
    expect(screen.getByTestId("state")).toHaveTextContent("entering");
    const node = screen.getByTestId("panel");
    act(() => vi.advanceTimersByTime(230));
    expect(screen.getByTestId("state")).toHaveTextContent("open");
    rerender(<Harness open={false} onExited={onExited} />);
    expect(screen.getByTestId("panel")).toBe(node);
    expect(node).toHaveAttribute("data-ui-motion", "exiting");
    act(() => vi.advanceTimersByTime(189));
    expect(onExited).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByTestId("panel")).toBeNull();
    expect(onExited).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(1000));
    expect(onExited).toHaveBeenCalledTimes(1);
  });

  it("does not wait when styles are absent/zero and caps malformed long timing at 400 ms", () => {
    const onExited = vi.fn();
    const { rerender } = render(<Harness open enter="" exit="" onExited={onExited} />);
    expect(screen.getByTestId("state")).toHaveTextContent("open");
    expect(vi.getTimerCount()).toBe(0);
    rerender(<Harness open={false} enter="" exit="" onExited={onExited} />);
    expect(screen.queryByTestId("panel")).toBeNull();
    expect(onExited).toHaveBeenCalledTimes(1);
    rerender(<Harness open enter="0ms" exit="10s" onExited={onExited} />);
    rerender(<Harness open={false} enter="0ms" exit="10s" onExited={onExited} />);
    act(() => vi.advanceTimersByTime(399));
    expect(screen.getByTestId("panel")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByTestId("panel")).toBeNull();
    expect(onExited).toHaveBeenCalledTimes(2);
  });

  it("ignores bubbled/unrelated events and cancels stale exit work when reopened", () => {
    const onExited = vi.fn();
    const { rerender } = render(<Harness open enter="0ms" onExited={onExited} />);
    const node = screen.getByTestId("panel");
    rerender(<Harness open={false} enter="0ms" onExited={onExited} />);
    animationEvent(screen.getByTestId("child"), "animationend", "test-exit");
    animationEvent(node, "animationend", "spinner");
    animationEvent(node, "animationcancel", "test-exit");
    expect(node).toHaveAttribute("data-ui-motion", "exiting");
    act(() => vi.advanceTimersByTime(100));
    rerender(<Harness open onExited={onExited} />);
    animationEvent(node, "animationend", "test-exit");
    act(() => vi.advanceTimersByTime(91));
    expect(screen.getByTestId("panel")).toBe(node);
    expect(onExited).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(139));
    expect(node).toHaveAttribute("data-ui-motion", "open");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("accepts the current native animation only after its own animation object finishes", () => {
    const onExited = vi.fn();
    let animation = { animationName: "test-enter", playState: "running" };
    const getAnimations = vi.fn(() => [animation as unknown as Animation]);
    const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "getAnimations");
    Object.defineProperty(HTMLElement.prototype, "getAnimations", { configurable: true, value: getAnimations });
    try {
      const { rerender } = render(<Harness open onExited={onExited} />);
      const node = screen.getByTestId("panel");
      animationEvent(node, "animationend", "test-enter");
      expect(node).toHaveAttribute("data-ui-motion", "entering");
      animation.playState = "finished";
      animationEvent(node, "animationend", "test-enter");
      expect(node).toHaveAttribute("data-ui-motion", "open");
      animation = { animationName: "test-exit", playState: "running" };
      rerender(<Harness open={false} onExited={onExited} />);
      animationEvent(node, "animationcancel", "test-exit");
      expect(onExited).not.toHaveBeenCalled();
      animation.playState = "idle";
      animationEvent(node, "animationcancel", "test-exit");
      expect(screen.queryByTestId("panel")).toBeNull();
      expect(onExited).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      if (original) Object.defineProperty(HTMLElement.prototype, "getAnimations", original);
      else delete (HTMLElement.prototype as HTMLElement & { getAnimations?: () => Animation[] }).getAnimations;
    }
  });

  it("filters collapse transition properties and completes on the owned grid transition", () => {
    const onExited = vi.fn();
    const { rerender } = render(<Harness open enter="0ms" exit="180ms" profile="collapse" onExited={onExited} />);
    rerender(<Harness open={false} enter="0ms" exit="180ms" profile="collapse" onExited={onExited} />);
    const node = screen.getByTestId("panel");
    act(() => vi.advanceTimersByTime(180));
    transitionEvent(screen.getByTestId("child"), "transitionend", "grid-template-rows");
    transitionEvent(node, "transitionend", "opacity");
    expect(onExited).not.toHaveBeenCalled();
    transitionEvent(node, "transitionend", "grid-template-rows");
    expect(screen.queryByTestId("panel")).toBeNull();
    expect(onExited).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("finishes a pending exit promptly when reduced motion changes without replaying entrance", () => {
    const listeners = new Set<() => void>();
    let reduced = false;
    const media = {
      get matches() { return reduced; },
      addEventListener: (_: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
    } as unknown as MediaQueryList;
    vi.stubGlobal("matchMedia", vi.fn(() => media));
    const onExited = vi.fn();
    const { rerender, unmount } = render(<Harness open enter="0ms" onExited={onExited} />);
    rerender(<Harness open={false} onExited={onExited} />);
    reduced = true;
    act(() => listeners.forEach((listener) => listener()));
    expect(screen.queryByTestId("panel")).toBeNull();
    expect(onExited).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    rerender(<Harness open onExited={onExited} />);
    expect(screen.getByTestId("panel")).toHaveAttribute("data-ui-motion", "open");
    reduced = false;
    act(() => listeners.forEach((listener) => listener()));
    expect(screen.getByTestId("panel")).toHaveAttribute("data-ui-motion", "open");
    expect(vi.getTimerCount()).toBe(0);
    unmount();
    expect(listeners.size).toBe(0);
  });

  it("finalizes hidden-document exits and cleans pending StrictMode work on unmount", () => {
    const onExited = vi.fn();
    const { rerender, unmount } = render(<StrictMode><Harness open onExited={onExited} /></StrictMode>);
    rerender(<StrictMode><Harness open={false} onExited={onExited} /></StrictMode>);
    vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    fireEvent(document, new Event("visibilitychange"));
    expect(onExited).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    vi.spyOn(document, "hidden", "get").mockReturnValue(false);
    rerender(<StrictMode><Harness open onExited={onExited} /></StrictMode>);
    rerender(<StrictMode><Harness open={false} onExited={onExited} /></StrictMode>);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    act(() => vi.advanceTimersByTime(1000));
    expect(onExited).toHaveBeenCalledTimes(1);
  });

  it("waits for a deferred Portal-ready node before timing its initial entrance", () => {
    const { rerender } = render(<Harness open attached={false} />);
    expect(screen.getByTestId("state")).toHaveTextContent("entering");
    expect(vi.getTimerCount()).toBe(0);
    rerender(<Harness open attached />);
    expect(screen.getByTestId("panel")).toHaveAttribute("data-ui-motion", "entering");
    act(() => vi.advanceTimersByTime(230));
    expect(screen.getByTestId("panel")).toHaveAttribute("data-ui-motion", "open");
  });

  it("continues Drawer reversals from the visible opacity/transform and ignores old native finish promises", async () => {
    const onExited = vi.fn();
    const visuals = new Map<Element, { opacity?: string; transform?: string }>();
    const animations: { target: Element; frames: Keyframe[]; finish: () => void; animation: Animation }[] = [];
    const nativeStyle = window.getComputedStyle.bind(window);
    vi.spyOn(window, "getComputedStyle").mockImplementation((element, pseudo) => {
      const style = nativeStyle(element, pseudo);
      return new Proxy(style, {
        get(target, property) {
          if ((property === "opacity" || property === "transform") && visuals.get(element)?.[property]) return visuals.get(element)![property];
          const value = Reflect.get(target, property, target) as unknown;
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
    });
    const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "animate");
    Object.defineProperty(HTMLElement.prototype, "animate", {
      configurable: true,
      value: function animate(this: HTMLElement, frames: Keyframe[]) {
        let finish!: () => void;
        const finished = new Promise<void>((resolve) => { finish = resolve; });
        const animation = {
          playState: "running",
          finished,
          cancel: vi.fn(() => { animation.playState = "idle"; visuals.delete(this); }),
        };
        animations.push({ target: this, frames, finish, animation: animation as unknown as Animation });
        return animation;
      },
    });
    function DrawerHarness({ open }: { open: boolean }) {
      const ref = useRef<HTMLDivElement>(null);
      const { present, state } = useMotionPresence(open, ref, "drawer", onExited);
      return present ? <div ref={ref} data-testid="drawer-overlay" data-ui-motion={state} style={{ "--ui-motion-enter": "220ms", "--ui-motion-exit": "180ms" } as CSSProperties}>
        <div className="ui-drawer" data-testid="drawer-panel" style={{ "--_ui-motion-closed-transform": "translateX(100%)" } as CSSProperties}>抽屉</div>
      </div> : null;
    }
    try {
      const { rerender } = render(<DrawerHarness open />);
      const root = screen.getByTestId("drawer-overlay");
      const drawer = screen.getByTestId("drawer-panel");
      expect(animations[0].frames[0]).toEqual({ opacity: "0" });
      expect(animations[1].frames[0]).toEqual({ transform: "translateX(100%)" });
      visuals.set(root, { opacity: "0.45" });
      visuals.set(drawer, { transform: "matrix(1, 0, 0, 1, 70, 0)" });
      rerender(<DrawerHarness open={false} />);
      expect(animations[2].frames).toEqual([{ opacity: "0.45" }, { opacity: "0" }]);
      expect(animations[3].frames).toEqual([{ transform: "matrix(1, 0, 0, 1, 70, 0)" }, { transform: "translateX(100%)" }]);
      visuals.set(root, { opacity: "0.3" });
      visuals.set(drawer, { transform: "matrix(1, 0, 0, 1, 95, 0)" });
      rerender(<DrawerHarness open />);
      expect(animations[4].frames).toEqual([{ opacity: "0.3" }, { opacity: "1" }]);
      expect(animations[5].frames).toEqual([{ transform: "matrix(1, 0, 0, 1, 95, 0)" }, { transform: "none" }]);
      expect(animations.slice(0, 4).every(({ animation }) => animation.playState === "idle")).toBe(true);
      await act(async () => { animations.slice(0, 4).forEach(({ finish }) => finish()); });
      expect(root).toHaveAttribute("data-ui-motion", "entering");
      expect(onExited).not.toHaveBeenCalled();
      await act(async () => { animations.slice(4, 6).forEach(({ finish }) => finish()); });
      expect(root).toHaveAttribute("data-ui-motion", "open");
      rerender(<DrawerHarness open={false} />);
      expect(animations[6].frames[0]).toEqual({ opacity: "1" });
      await act(async () => { animations.slice(6).forEach(({ finish }) => finish()); });
      expect(screen.queryByTestId("drawer-overlay")).toBeNull();
      expect(onExited).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      if (original) Object.defineProperty(HTMLElement.prototype, "animate", original);
      else Reflect.deleteProperty(HTMLElement.prototype, "animate");
    }
  });

  it("releases Drawer root and panel animations only after the open commit or exit detachment", async () => {
    const onExited = vi.fn();
    const native = recordNativeMotionCleanup();
    try {
      const { rerender } = render(<CompletionDrawer open onExited={onExited} />);
      const root = screen.getByTestId("completion-overlay");
      const panel = screen.getByTestId("completion-panel");
      expect(native.animations.map(({ target }) => target)).toEqual([root, panel]);

      await act(async () => { native.animations[0].finish(); });
      expect(root).toHaveAttribute("data-ui-motion", "entering");
      expect(native.cancellations).toEqual([]);
      await act(async () => { native.animations[1].finish(); });
      expect(root).toHaveAttribute("data-ui-motion", "open");
      expect(native.cancellations).toEqual([
        { target: root, connected: true, state: "open" },
        { target: panel, connected: true, state: "open" },
      ]);
      expect(root.style.animation).toBe("");
      expect(panel.style.animation).toBe("");

      rerender(<CompletionDrawer open={false} onExited={onExited} />);
      await act(async () => { native.animations[2].finish(); });
      expect(root).toBeInTheDocument();
      expect(onExited).not.toHaveBeenCalled();
      await act(async () => { native.animations[3].finish(); });
      expect(root.isConnected).toBe(false);
      expect(panel.isConnected).toBe(false);
      expect(native.cancellations.slice(2).map(({ target, connected }) => ({ target, connected }))).toEqual([
        { target: root, connected: false },
        { target: panel, connected: false },
      ]);
      expect(onExited).toHaveBeenCalledTimes(1);
      await act(async () => { native.animations.forEach(({ finish }) => finish()); });
      act(() => vi.advanceTimersByTime(1000));
      expect(onExited).toHaveBeenCalledTimes(1);
      expect(native.animations.every(({ cancel }) => cancel.mock.calls.length === 1)).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      native.restore();
    }
  });

  it("keeps a rapid reopen alive when the previous exit finishes before its promise is delivered", async () => {
    const onExited = vi.fn();
    const native = recordNativeMotionCleanup();
    try {
      const { rerender } = render(<CompletionDrawer open onExited={onExited} />);
      const root = screen.getByTestId("completion-overlay");
      await act(async () => { native.animations.slice(0, 2).forEach(({ finish }) => finish()); });
      expect(root).toHaveAttribute("data-ui-motion", "open");

      rerender(<CompletionDrawer open={false} onExited={onExited} />);
      // Resolve the old exit but reopen synchronously, before Promise.all can deliver it.
      native.animations.slice(2, 4).forEach(({ finish }) => finish());
      rerender(<CompletionDrawer open onExited={onExited} />);
      await act(async () => { await Promise.resolve(); });
      expect(screen.getByTestId("completion-overlay")).toBe(root);
      expect(root).toHaveAttribute("data-ui-motion", "entering");
      expect(onExited).not.toHaveBeenCalled();
      expect(native.animations.slice(4, 6).every(({ cancel }) => cancel.mock.calls.length === 0)).toBe(true);

      await act(async () => { native.animations.slice(4, 6).forEach(({ finish }) => finish()); });
      expect(root).toHaveAttribute("data-ui-motion", "open");
      expect(native.cancellations.slice(4, 6).every(({ connected, state }) => connected && state === "open")).toBe(true);
      rerender(<CompletionDrawer open={false} onExited={onExited} />);
      await act(async () => { native.animations.slice(0, 6).forEach(({ finish }) => finish()); });
      expect(root).toHaveAttribute("data-ui-motion", "exiting");
      expect(onExited).not.toHaveBeenCalled();
      await act(async () => { native.animations.slice(6, 8).forEach(({ finish }) => finish()); });
      expect(root.isConnected).toBe(false);
      expect(onExited).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      native.restore();
    }
  });
});

describe("nonmodal visual exits", () => {
  function NonModalHarness({ open }: { open: boolean }) {
    const trigger = useRef<HTMLButtonElement>(null);
    const panel = useRef<HTMLDivElement>(null);
    const presence = useNonModalMotion(open, panel, trigger);
    return <>
      <button ref={trigger} type="button">触发器</button>
      <button type="button">外部操作</button>
      {presence.present ? <div ref={panel} data-testid="menu" data-ui-motion={presence.state} style={{ "--ui-motion-enter": "0ms", "--ui-motion-exit": "100ms" } as CSSProperties}>
        <button type="button">菜单操作</button>
      </div> : null}
    </>;
  }

  it("hands internal focus back before hiding and restores semantics when reopened", () => {
    const { rerender } = render(<NonModalHarness open />);
    screen.getByRole("button", { name: "菜单操作" }).focus();
    rerender(<NonModalHarness open={false} />);
    expect(screen.getByRole("button", { name: "触发器" })).toHaveFocus();
    expect(screen.getByTestId("menu")).toHaveAttribute("inert");
    expect(screen.getByTestId("menu")).toHaveAttribute("aria-hidden", "true");
    rerender(<NonModalHarness open />);
    expect(screen.getByTestId("menu")).not.toHaveAttribute("inert");
    expect(screen.getByTestId("menu")).not.toHaveAttribute("aria-hidden");
    screen.getByRole("button", { name: "外部操作" }).focus();
    rerender(<NonModalHarness open={false} />);
    expect(screen.getByRole("button", { name: "外部操作" })).toHaveFocus();
  });
});
