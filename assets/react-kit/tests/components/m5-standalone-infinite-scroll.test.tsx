// @personal-ui-coverage {"kind":"unit","runner":"components","exports":["InfiniteScroll"]}
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InfiniteScroll } from "../../src/personal-ui";

function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((accept, decline) => { resolve = accept; reject = decline; });
  return { promise, resolve, reject };
}

function controlledObserver() {
  const observers: Array<{ callback: IntersectionObserverCallback; target?: Element }> = [];
  class Observer {
    private entry: (typeof observers)[number];
    constructor(callback: IntersectionObserverCallback) { this.entry = { callback }; observers.push(this.entry); }
    observe(target: Element) { this.entry.target = target; }
    disconnect() { this.entry.target = undefined; }
  }
  vi.stubGlobal("IntersectionObserver", Observer);
  return () => observers.forEach(({ callback, target }) => {
    if (target) callback([{ target, isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
  });
}

describe("InfiniteScroll standalone keyboard commands", () => {
  it.each(["observer-first", "manual-first"])("deduplicates %s activation synchronously and keeps the button mounted during pending and end states", async (order) => {
    const pending = deferred();
    const onLoadMore = vi.fn(() => pending.promise);
    const intersect = controlledObserver();
    try {
      const view = render(<InfiniteScroll hasMore loadKey="one" onLoadMore={onLoadMore}>Existing records</InfiniteScroll>);
      const button = screen.getByRole("button", { name: "加载更多" });
      button.focus();
      const click = () => fireEvent.click(button);
      await act(async () => {
        if (order === "observer-first") { intersect(); click(); } else { click(); intersect(); }
        click(); intersect();
      });
      expect(onLoadMore).toHaveBeenCalledTimes(1);
      expect(button).toHaveFocus();
      expect(button).toHaveAttribute("aria-busy", "true");
      expect(screen.getByText("Existing records")).toBeVisible();
      await act(async () => { pending.resolve(); });
      fireEvent.click(button);
      act(intersect);
      expect(onLoadMore).toHaveBeenCalledTimes(1);
      view.rerender(<InfiniteScroll hasMore={false} loadKey="done" onLoadMore={onLoadMore}>Existing records</InfiniteScroll>);
      expect(screen.getByRole("button", { name: "加载更多" })).toBe(button);
      expect(button).toHaveFocus();
      expect(button).toHaveAttribute("aria-disabled", "true");
      expect(button).toHaveAttribute("tabindex", "-1");
      expect(screen.getByText("已经到底了")).toBeVisible();
      fireEvent.click(button);
      expect(onLoadMore).toHaveBeenCalledTimes(1);
    } finally { vi.unstubAllGlobals(); }
  });

  it("retains records on rejection, reports one error, blocks observer retry and retries the same key manually", async () => {
    const failed = deferred();
    const retry = deferred();
    const onLoadMore = vi.fn().mockImplementationOnce(() => failed.promise).mockImplementationOnce(() => retry.promise);
    const onLoadError = vi.fn(() => { throw new Error("consumer error observer failed"); });
    const intersect = controlledObserver();
    try {
      render(<InfiniteScroll hasMore loadKey={4} onLoadMore={onLoadMore} onLoadError={onLoadError}>Saved records</InfiniteScroll>);
      const button = screen.getByRole("button", { name: "加载更多" });
      button.focus();
      await act(async () => { intersect(); });
      const failure = new Error("offline");
      await act(async () => { failed.reject(failure); });
      expect(onLoadError).toHaveBeenCalledExactlyOnceWith(failure);
      expect(screen.getByRole("alert")).toHaveTextContent("加载更多失败，请重试");
      expect(screen.getByText("Saved records")).toBeVisible();
      expect(screen.getByRole("button", { name: "重试" })).toBe(button);
      expect(button).toHaveFocus();
      await act(async () => { intersect(); intersect(); });
      expect(onLoadMore).toHaveBeenCalledTimes(1);
      await act(async () => { fireEvent.click(button); fireEvent.click(button); intersect(); });
      expect(onLoadMore).toHaveBeenCalledTimes(2);
      await act(async () => { retry.resolve(); });
      expect(screen.queryByRole("alert")).toBeNull();
      expect(button).toHaveFocus();
    } finally { vi.unstubAllGlobals(); }
  });

  it("loads manually without IntersectionObserver, blocks disabled/loading and explicitly delegates when requested", async () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const onLoadMore = vi.fn().mockResolvedValue(undefined);
    try {
      const view = render(<InfiniteScroll disabled hasMore loadKey={0} onLoadMore={onLoadMore}>Records</InfiniteScroll>);
      const button = screen.getByRole("button", { name: "加载更多" });
      expect(button).toBeDisabled();
      fireEvent.click(button);
      view.rerender(<InfiniteScroll loading hasMore loadKey={0} onLoadMore={onLoadMore}>Records</InfiniteScroll>);
      fireEvent.click(button);
      expect(onLoadMore).not.toHaveBeenCalled();
      view.rerender(<InfiniteScroll hasMore loadKey={0} onLoadMore={onLoadMore}>Records</InfiniteScroll>);
      await act(async () => { fireEvent.click(button); });
      expect(onLoadMore).toHaveBeenCalledTimes(1);
      view.rerender(<InfiniteScroll showLoadMoreButton={false} hasMore loadKey={1} onLoadMore={onLoadMore}>Records</InfiniteScroll>);
      expect(screen.queryByRole("button")).toBeNull();
    } finally { vi.unstubAllGlobals(); }
  });
});
