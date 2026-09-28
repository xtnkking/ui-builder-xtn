import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});

Object.defineProperty(window, "matchMedia", {
  configurable: true,
  value: (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }),
});

class TestResizeObserver implements ResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

globalThis.ResizeObserver = TestResizeObserver;

const nativeGetClientRects = HTMLElement.prototype.getClientRects;
HTMLElement.prototype.getClientRects = function getClientRects(): DOMRectList {
  const rects = nativeGetClientRects.call(this);
  if (rects.length > 0) return rects;

  const bounds = this.getBoundingClientRect();
  const fallback = new DOMRect(bounds.x, bounds.y, bounds.width || 1, bounds.height || 1);
  const list = [fallback] as unknown as DOMRectList;
  Object.defineProperty(list, "item", {
    value: (index: number) => list[index] ?? null,
  });
  return list;
};

HTMLElement.prototype.scrollIntoView = () => undefined;
