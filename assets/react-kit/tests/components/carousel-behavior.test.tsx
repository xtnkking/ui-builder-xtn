// @personal-ui-coverage {"kind":"unit","runner":"components","exports":["Carousel"]}
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Carousel } from "../../src/personal-ui";

const slides = [
  { id: "first", label: "First", content: <button type="button">First action</button> },
  { id: "second", label: "Second", content: <button type="button">Second action</button> },
  { id: "third", label: "Third", content: <button type="button">Third action</button> },
];

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Carousel behavior", () => {
  it("keeps manual, hover, focus, and live reduced-motion pauses independent", () => {
    const listeners = new Set<(event: MediaQueryListEvent) => void>();
    let reducedMotion = false;
    const media = {
      media: "(prefers-reduced-motion: reduce)",
      get matches() { return reducedMotion; },
      addEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => { listeners.add(listener); },
      removeEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => { listeners.delete(listener); },
    } as MediaQueryList;
    vi.stubGlobal("matchMedia", vi.fn(() => media));
    vi.useFakeTimers();
    const { unmount } = render(<Carousel ariaLabel="Highlights" slides={slides} autoplay loop interval={1500} />);
    const carousel = screen.getByRole("region", { name: "Highlights" });
    const stage = carousel.querySelector<HTMLElement>(".pui-carousel__stage")!;
    expect(stage).toHaveAttribute("aria-live", "off");
    expect(stage).toHaveAttribute("aria-label", "1 / 3: First");
    act(() => vi.advanceTimersByTime(1500));
    expect(stage).toHaveAttribute("aria-label", "2 / 3: Second");
    expect(within(carousel).queryByRole("button", { name: "First action" })).toBeNull();

    fireEvent.mouseEnter(carousel);
    expect(stage).toHaveAttribute("aria-live", "polite");
    fireEvent.click(within(carousel).getByRole("button", { name: "暂停自动播放" }));
    fireEvent.mouseLeave(carousel);
    act(() => vi.advanceTimersByTime(4500));
    expect(stage).toHaveAttribute("aria-label", "2 / 3: Second");
    expect(within(carousel).getByRole("button", { name: "继续自动播放" })).toBeEnabled();

    fireEvent.click(within(carousel).getByRole("button", { name: "继续自动播放" }));
    fireEvent.mouseEnter(carousel);
    fireEvent.pointerMove(document.body);
    expect(stage).toHaveAttribute("aria-live", "off");
    const next = within(carousel).getByRole("button", { name: "下一项" });
    fireEvent.focus(next);
    act(() => vi.advanceTimersByTime(3000));
    expect(stage).toHaveAttribute("aria-label", "2 / 3: Second");
    fireEvent.blur(next, { relatedTarget: document.body });
    act(() => vi.advanceTimersByTime(1500));
    expect(stage).toHaveAttribute("aria-label", "3 / 3: Third");

    reducedMotion = true;
    act(() => listeners.forEach((listener) => listener({ matches: true } as MediaQueryListEvent)));
    expect(stage).toHaveAttribute("aria-live", "polite");
    expect(within(carousel).getByRole("button", { name: "自动播放已根据减少动态效果设置暂停" })).toBeDisabled();
    act(() => vi.advanceTimersByTime(4500));
    expect(stage).toHaveAttribute("aria-label", "3 / 3: Third");
    reducedMotion = false;
    act(() => listeners.forEach((listener) => listener({ matches: false } as MediaQueryListEvent)));
    act(() => vi.advanceTimersByTime(1500));
    expect(stage).toHaveAttribute("aria-label", "1 / 3: First");
    unmount();
    expect(listeners.size).toBe(0);
  });

  it("disables empty controls and exposes only the selected slide at boundaries", () => {
    const { rerender } = render(<Carousel ariaLabel="Empty" slides={[]} autoplay loop />);
    const empty = screen.getByRole("region", { name: "Empty" });
    expect(within(empty).getByRole("button", { name: "上一项" })).toBeDisabled();
    expect(within(empty).getByRole("button", { name: "下一项" })).toBeDisabled();
    expect(within(empty).queryByRole("button", { name: /自动播放/ })).toBeNull();

    rerender(<Carousel ariaLabel="Empty" slides={slides} defaultValue="first" />);
    const first = screen.getByRole("region", { name: "Empty" });
    expect(within(first).getByRole("button", { name: "上一项" })).toBeDisabled();
    fireEvent.click(within(first).getByRole("button", { name: "显示 Third" }));
    expect(within(first).getByRole("button", { name: "下一项" })).toBeDisabled();
    expect(within(first).getByRole("button", { name: "Third action" })).toBeInTheDocument();
    expect(within(first).queryByRole("button", { name: "First action" })).toBeNull();
    expect(first.querySelector(".pui-carousel__stage")).toHaveAttribute("aria-label", "3 / 3: Third");
  });
});
