// @ui-coverage {"kind":"unit","runner":"components","exports":["Carousel","Lightbox"]}
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Carousel, Lightbox } from "../../src/ui";

interface RecordedAnimation {
  target: HTMLElement;
  frames: Keyframe[];
  cancel: ReturnType<typeof vi.fn>;
  finish: () => void;
}

let styles: HTMLStyleElement;
let restoreAnimation: () => void;
let animations: RecordedAnimation[];
let opacity: WeakMap<Element, number>;
let changeReducedMotion: (reduced: boolean) => void;
let mediaListeners: Set<(event: MediaQueryListEvent) => void>;

beforeEach(() => {
  styles = document.createElement("style");
  styles.textContent = ".ui-carousel__stage, .ui-lightbox > figure { --ui-motion-standard-enter: 180ms; --ui-motion-ease-enter: linear; }";
  document.head.append(styles);
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  opacity = new WeakMap();
  const computedStyle = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation((node, pseudo) => {
    const computed = computedStyle(node, pseudo);
    if (opacity.has(node)) Object.defineProperty(computed, "opacity", { value: String(opacity.get(node)), configurable: true });
    return computed;
  });
  let reduced = false;
  mediaListeners = new Set();
  const query = {
    get matches() { return reduced; },
    media: "(prefers-reduced-motion: reduce)",
    onchange: null,
    addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => mediaListeners.add(listener),
    removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => mediaListeners.delete(listener),
    addListener: (listener: (event: MediaQueryListEvent) => void) => mediaListeners.add(listener),
    removeListener: (listener: (event: MediaQueryListEvent) => void) => mediaListeners.delete(listener),
    dispatchEvent: () => true,
  };
  vi.spyOn(window, "matchMedia").mockReturnValue(query as unknown as MediaQueryList);
  changeReducedMotion = (next) => {
    reduced = next;
    act(() => { for (const listener of [...mediaListeners]) listener({ matches: next } as MediaQueryListEvent); });
  };
  animations = [];
  const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "animate");
  Object.defineProperty(HTMLElement.prototype, "animate", {
    configurable: true,
    value: function animate(this: HTMLElement, frames: Keyframe[]) {
      const animation = {
        onfinish: null as ((event: AnimationPlaybackEvent) => void) | null,
        oncancel: null as ((event: AnimationPlaybackEvent) => void) | null,
        cancel: vi.fn(() => animation.oncancel?.(new Event("cancel") as AnimationPlaybackEvent)),
      };
      animations.push({ target: this, frames, cancel: animation.cancel, finish: () => animation.onfinish?.(new Event("finish") as AnimationPlaybackEvent) });
      return animation as unknown as Animation;
    },
  });
  restoreAnimation = () => {
    if (original) Object.defineProperty(HTMLElement.prototype, "animate", original);
    else Reflect.deleteProperty(HTMLElement.prototype, "animate");
  };
});

afterEach(() => {
  cleanup();
  styles.remove();
  restoreAnimation();
  vi.restoreAllMocks();
});

const slides = [
  { id: "first", label: "第一项", content: <button type="button">第一项操作</button> },
  { id: "second", label: "第二项", content: <button type="button">第二项操作</button> },
  { id: "third", label: "第三项", content: <button type="button">第三项操作</button> },
];
const images = [
  { id: "first", src: "/first.png", alt: "第一张", caption: "第一张说明" },
  { id: "second", src: "/second.png", alt: "第二张", caption: "第二张说明" },
  { id: "third", src: "/third.png", alt: "第三张", caption: "第三张说明" },
];

describe("owned content switching", () => {
  it("keeps one interactive Carousel slide, focused controls, and rapid-switch opacity continuity", () => {
    const changed = vi.fn();
    const view = render(<Carousel slides={slides} ariaLabel="内容轮播" loop onValueChange={changed} />);
    const carousel = screen.getByRole("region", { name: "内容轮播" });
    const stage = within(carousel).getByRole("group");
    expect(animations).toHaveLength(0);
    const next = within(carousel).getByRole("button", { name: "下一项" });
    next.focus();
    fireEvent.click(next);
    expect(within(stage).getAllByRole("button")).toHaveLength(1);
    expect(within(stage).getByRole("button", { name: "第二项操作" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "第一项操作" })).toBeNull();
    expect(next).toHaveFocus();
    expect(stage).toHaveAttribute("aria-live", "polite");
    expect(animations[0].frames[0]).toEqual({ opacity: 0.62 });

    opacity.set(stage, 0.86);
    fireEvent.click(next);
    expect(animations[0].cancel).toHaveBeenCalledTimes(1);
    expect(animations[1].frames[0]).toEqual({ opacity: 0.86 });
    expect(within(stage).getAllByRole("button")).toHaveLength(1);
    expect(next).toHaveFocus();
    expect(changed.mock.calls.map(([value]) => value)).toEqual(["second", "third"]);
    view.unmount();
    expect(animations[1].cancel).toHaveBeenCalledTimes(1);
    expect(mediaListeners.size).toBe(0);
  });

  it("retains the last loaded image, ignores obsolete loads, and switches once to load/error content", () => {
    const onOpenChange = vi.fn();
    const onValueChange = vi.fn();
    const view = render(<Lightbox open items={images} value="first" onOpenChange={onOpenChange} onValueChange={onValueChange} />);
    const first = screen.getByRole("img", { name: "第一张" });
    fireEvent.load(first);
    const figure = first.closest("figure")!;
    expect(animations).toHaveLength(0);

    view.rerender(<Lightbox open items={images} value="second" onOpenChange={onOpenChange} onValueChange={onValueChange} />);
    const second = screen.getByRole("img", { name: "第二张" });
    expect(second).toHaveAttribute("data-loading", "true");
    expect(figure.querySelector(".ui-lightbox__previous-image img")).toHaveAttribute("src", "/first.png");
    expect(screen.getAllByRole("img")).toHaveLength(1);
    expect(figure).toHaveAttribute("aria-busy", "true");
    expect(figure.querySelectorAll('[aria-live="polite"]')).toHaveLength(1);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "ArrowRight" });
    expect(onValueChange).toHaveBeenLastCalledWith("third");

    view.rerender(<Lightbox open items={images} value="third" onOpenChange={onOpenChange} onValueChange={onValueChange} />);
    fireEvent.load(second);
    expect(figure.querySelector(".ui-lightbox__previous-image img")).toHaveAttribute("src", "/first.png");
    const third = screen.getByRole("img", { name: "第三张" });
    fireEvent.error(third);
    expect(screen.getByRole("status")).toHaveTextContent("无法加载图片：第三张");
    expect(figure.querySelector(".ui-lightbox__previous-image")).toBeNull();
    expect(figure).toHaveAttribute("aria-busy", "false");
    expect(animations).toHaveLength(1);

    view.rerender(<Lightbox open items={images} value="second" onOpenChange={onOpenChange} onValueChange={onValueChange} />);
    fireEvent.load(screen.getByRole("img", { name: "第二张" }));
    fireEvent.error(third);
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getAllByRole("img")).toHaveLength(1);
    expect(screen.getByRole("img", { name: "第二张" })).not.toHaveAttribute("data-loading");
    expect(animations).toHaveLength(2);
    expect(animations[0].cancel).toHaveBeenCalledTimes(1);
    act(() => animations[1].finish());
    expect(figure).not.toHaveAttribute("data-ui-content-motion");
    expect(animations[1].cancel).toHaveBeenCalledTimes(1);
  });

  it("recognizes cached image completion and cancels on close without replaying content on reopen", () => {
    vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
    const naturalWidth = vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(960);
    const onOpenChange = vi.fn();
    const onValueChange = vi.fn();
    const view = render(<Lightbox open items={images} value="first" onOpenChange={onOpenChange} onValueChange={onValueChange} />);
    expect(screen.getByRole("img", { name: "第一张" }).closest("figure")).toHaveAttribute("aria-busy", "false");
    expect(animations).toHaveLength(0);
    view.rerender(<Lightbox open items={images} value="second" onOpenChange={onOpenChange} onValueChange={onValueChange} />);
    expect(screen.getByRole("img", { name: "第二张" })).not.toHaveAttribute("data-loading");
    expect(animations).toHaveLength(1);
    view.rerender(<Lightbox open={false} items={images} value="second" onOpenChange={onOpenChange} onValueChange={onValueChange} />);
    expect(animations[0].cancel).toHaveBeenCalledTimes(1);
    view.rerender(<Lightbox open items={images} value="second" onOpenChange={onOpenChange} onValueChange={onValueChange} />);
    expect(animations).toHaveLength(1);
    naturalWidth.mockReturnValue(0);
    view.rerender(<Lightbox open items={images} value="third" onOpenChange={onOpenChange} onValueChange={onValueChange} />);
    expect(screen.getByRole("status")).toHaveTextContent("无法加载图片：第三张");
    expect(screen.getByRole("status").closest("figure")).toHaveAttribute("aria-busy", "false");
    expect(animations).toHaveLength(2);
    view.unmount();
    expect(animations[1].cancel).toHaveBeenCalledTimes(1);
    expect(mediaListeners.size).toBe(0);
  });

  it("lands an active transition immediately on reduced motion and never replays a skipped switch", () => {
    const view = render(<Carousel slides={slides} ariaLabel="减少动效轮播" loop />);
    const next = screen.getByRole("button", { name: "下一项" });
    fireEvent.click(next);
    const stage = screen.getByRole("group");
    expect(stage).toHaveAttribute("data-ui-content-motion", "switching");
    changeReducedMotion(true);
    expect(animations[0].cancel).toHaveBeenCalledTimes(1);
    expect(stage).not.toHaveAttribute("data-ui-content-motion");
    fireEvent.click(next);
    expect(within(stage).getByRole("button", { name: "第三项操作" })).toBeInTheDocument();
    expect(animations).toHaveLength(1);
    changeReducedMotion(false);
    expect(animations).toHaveLength(1);
    fireEvent.click(next);
    expect(animations).toHaveLength(2);
    view.unmount();
    expect(animations[1].cancel).toHaveBeenCalledTimes(1);
    expect(mediaListeners.size).toBe(0);
  });
});
