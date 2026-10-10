// @personal-ui-coverage {"kind":"unit","runner":"components","exports":["InfiniteScroll","LoadMore"]}
import { useState } from "react";
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InfiniteScroll, LoadMore } from "../../src/personal-ui";
import { InfiniteScrollExample, type InfinitePageExample } from "../../src/explorer/cases/navigation/infinite-scroll.case";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((accept, decline) => { resolve = accept; reject = decline; });
  return { promise, resolve, reject };
}

function controlledObserver() {
  const entries: Array<{ callback: IntersectionObserverCallback; target?: Element }> = [];
  class Observer {
    private entry: (typeof entries)[number];
    constructor(callback: IntersectionObserverCallback) {
      this.entry = { callback };
      entries.push(this.entry);
    }
    observe(target: Element) { this.entry.target = target; }
    disconnect() { this.entry.target = undefined; }
  }
  vi.stubGlobal("IntersectionObserver", Observer);
  return () => {
    entries.forEach(({ callback, target }) => {
      if (target) callback([{ isIntersecting: true, target } as IntersectionObserverEntry], {} as IntersectionObserver);
    });
  };
}

describe("InfiniteScroll and LoadMore request composition", () => {
  it("reproduces two same-window requests when only React loading guards the official pair", async () => {
    const pending = deferred<void>();
    const request = vi.fn(() => pending.promise);
    const intersect = controlledObserver();
    function ReactLoadingOnlyExample() {
      const [page, setPage] = useState(1);
      const [loading, setLoading] = useState(false);
      const [hasMore, setHasMore] = useState(true);
      const load = async () => {
        if (loading || !hasMore) return;
        setLoading(true);
        await request();
        setPage((current) => current + 1);
        setLoading(false);
        setHasMore(false);
      };
      return <><InfiniteScroll showLoadMoreButton={false} hasMore={hasMore} loadKey={page} loading={loading} onLoadMore={load}><p>Existing records</p></InfiniteScroll><LoadMore hasMore={hasMore} loading={loading} onLoadMore={load} label="Load next page" /></>;
    }
    try {
      render(<ReactLoadingOnlyExample />);
      const manual = screen.getByRole("button", { name: "Load next page" });
      await act(async () => {
        intersect();
        manual.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        await Promise.resolve();
      });
      expect(request).toHaveBeenCalledTimes(2);
      expect(screen.getByText("Existing records")).toBeVisible();
      await act(async () => { pending.resolve(); });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it.each(["observer-first", "manual-first"])("fixed composition coalesces %s overlap into one pending request", async (order) => {
    const first = deferred<InfinitePageExample>();
    const request = vi.fn(() => first.promise);
    const intersect = controlledObserver();
    try {
      render(<InfiniteScrollExample fetchPage={request} />);
      const manual = screen.getByRole("button", { name: "手动加载下一页" });
      const click = () => manual.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await act(async () => {
        if (order === "observer-first") { intersect(); click(); } else { click(); intersect(); }
        intersect(); click();
        await Promise.resolve();
      });
      expect(request).toHaveBeenCalledTimes(1);
      expect(request).toHaveBeenCalledWith(2);
      expect(manual).toHaveAttribute("aria-disabled", "true");
      expect(screen.getByRole("status", { name: "加载状态" })).toHaveTextContent("已加载 2 条记录，cursor 2");
      expect(screen.getAllByRole("listitem")).toHaveLength(2);
      await act(async () => { intersect(); click(); });
      expect(request).toHaveBeenCalledTimes(1);
      await act(async () => { first.resolve({ records: [{ id: "record-3", label: "审核记录 3" }, { id: "record-4", label: "审核记录 4" }], cursor: 4, hasMore: true }); });
      expect(screen.getAllByRole("listitem")).toHaveLength(4);
      expect(screen.getByRole("status", { name: "加载状态" })).toHaveTextContent("cursor 4");
      expect(screen.getByRole("button", { name: "手动加载下一页" })).toBeEnabled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("fixed composition retains records and cursor after observer rejection and retries that cursor manually once", async () => {
    const failed = deferred<InfinitePageExample>();
    const retry = deferred<InfinitePageExample>();
    const request = vi.fn().mockImplementationOnce(() => failed.promise).mockImplementationOnce(() => retry.promise);
    const intersect = controlledObserver();
    try {
      render(<InfiniteScrollExample fetchPage={request} />);
      await act(async () => { intersect(); });
      expect(request).toHaveBeenCalledTimes(1);
      expect(request).toHaveBeenLastCalledWith(2);
      await act(async () => { failed.reject(new Error("服务器暂不可用")); });
      expect(screen.getByRole("alert")).toHaveTextContent("服务器暂不可用");
      expect(screen.getByRole("alert")).toHaveAttribute("data-pui-owner", "Alert");
      expect(screen.getAllByRole("listitem")).toHaveLength(2);
      expect(screen.getByRole("status", { name: "加载状态" })).toHaveTextContent("cursor 2");
      const manual = screen.getByRole("button", { name: "手动加载下一页" });
      expect(manual).toBeEnabled();
      await act(async () => {
        intersect();
        manual.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        manual.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
      expect(request.mock.calls).toEqual([[2], [2]]);
      expect(screen.getAllByRole("listitem")).toHaveLength(2);
      await act(async () => { retry.resolve({ records: [{ id: "record-3", label: "审核记录 3" }], cursor: 3, hasMore: true }); });
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(screen.getAllByRole("listitem")).toHaveLength(3);
      expect(screen.getByText("审核记录 3")).toBeVisible();
      expect(screen.getByRole("status", { name: "加载状态" })).toHaveTextContent("cursor 3");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("fixed composition blocks both disabled entrances, retains pending data, and stops both entrances at the end", async () => {
    const pending = deferred<InfinitePageExample>();
    const request = vi.fn(() => pending.promise);
    const intersect = controlledObserver();
    try {
      const view = render(<InfiniteScrollExample fetchPage={request} disabled />);
      const manual = screen.getByRole("button", { name: "手动加载下一页" });
      expect(manual).toBeDisabled();
      await act(async () => { intersect(); manual.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
      expect(request).not.toHaveBeenCalled();
      view.rerender(<InfiniteScrollExample fetchPage={request} />);
      await act(async () => { intersect(); });
      expect(request).toHaveBeenCalledTimes(1);
      view.rerender(<InfiniteScrollExample fetchPage={request} disabled />);
      await act(async () => { intersect(); manual.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
      expect(request).toHaveBeenCalledTimes(1);
      expect(screen.getAllByRole("listitem")).toHaveLength(2);
      await act(async () => { pending.resolve({ records: [{ id: "record-3", label: "审核记录 3" }], cursor: 3, hasMore: false }); });
      view.rerender(<InfiniteScrollExample fetchPage={request} />);
      await act(async () => { intersect(); });
      expect(request).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("button", { name: "手动加载下一页" })).not.toBeInTheDocument();
      expect(screen.getByText("已经到底了")).toBeVisible();
      expect(screen.getByText("没有更多内容")).toBeVisible();
      expect(screen.getAllByRole("listitem")).toHaveLength(3);
      expect(screen.getByRole("status", { name: "加载状态" })).toHaveTextContent("cursor 3");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
