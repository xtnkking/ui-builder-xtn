import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Collapse } from "../../src/ui";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance", "requestAnimationFrame", "cancelAnimationFrame"] });
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  const nativeStyle = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation((element, pseudo) => {
    const style = nativeStyle(element, pseudo);
    if (!element.matches(".ui-collapse__panel")) return style;
    return {
      animationName: "none",
      getPropertyValue: (name: string) => name === "--ui-motion-enter" ? "220ms" : name === "--ui-motion-exit" ? "180ms" : style.getPropertyValue(name),
    } as CSSStyleDeclaration;
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Collapse owned motion", () => {
  it("renders initially expanded content without a zero-height entry frame", () => {
    render(<Collapse title="详细信息" defaultOpen><p>初始内容</p></Collapse>);
    const panel = screen.getByRole("region", { name: "详细信息" });
    expect(panel).toHaveAttribute("data-ui-motion", "open");
    expect(panel).toHaveAttribute("data-ui-collapse-expanded", "true");
    expect(panel).not.toHaveAttribute("hidden");
    expect(panel).not.toHaveAttribute("inert");
  });

  it("hands internal focus to the trigger before making retained exit content inaccessible", () => {
    const { rerender } = render(<Collapse title="详细信息" open onOpenChange={() => undefined}><button type="button">内部操作</button></Collapse>);
    const panel = screen.getByRole("region", { name: "详细信息" });
    screen.getByRole("button", { name: "内部操作" }).focus();
    rerender(<Collapse title="详细信息" open={false} onOpenChange={() => undefined}><button type="button">内部操作</button></Collapse>);
    expect(screen.getByRole("button", { name: "详细信息" })).toHaveFocus();
    expect(panel).toHaveAttribute("aria-hidden", "true");
    expect(panel).toHaveAttribute("inert");
    expect(panel).not.toHaveAttribute("hidden");
    act(() => vi.advanceTimersByTime(230));
    expect(panel).toHaveAttribute("hidden");
    expect(screen.getByText("内部操作")).toBeInTheDocument();
  });

  it("retains the same node when an exit is reversed and only unmounts after a completed close", () => {
    const content = <p>动态子内容</p>;
    const { rerender } = render(<Collapse title="详情" open onOpenChange={() => undefined} unmountOnExit>{content}</Collapse>);
    const panel = screen.getByRole("region", { name: "详情" });
    rerender(<Collapse title="详情" open={false} onOpenChange={() => undefined} unmountOnExit>{content}</Collapse>);
    act(() => vi.advanceTimersByTime(90));
    rerender(<Collapse title="详情" open onOpenChange={() => undefined} unmountOnExit>{content}</Collapse>);
    act(() => vi.advanceTimersByTime(270));
    expect(screen.getByRole("region", { name: "详情" })).toBe(panel);
    expect(panel).not.toHaveAttribute("inert");
    expect(panel).toHaveAttribute("data-ui-collapse-expanded", "true");
    rerender(<Collapse title="详情" open={false} onOpenChange={() => undefined} unmountOnExit>{content}</Collapse>);
    expect(panel).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(230));
    expect(panel).not.toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(0);
  });
});
