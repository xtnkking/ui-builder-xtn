import { useEffect, useLayoutEffect, type RefObject } from "react";
import { observeComputedStyleChanges, syncPersonalUiPortalTheme } from "./portal-tokens";

const useClientLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;
const FLOATING_GUTTER = 12;
const FLOATING_GAP = 6;

export function floatingPortalTarget(root: HTMLElement | null): HTMLElement {
  return root?.closest<HTMLElement>(".pui-overlay") ?? document.body;
}

export function floatingViewportBounds(ownerDocument: Document = document) {
  const viewport = ownerDocument.defaultView?.visualViewport;
  const viewportWidth = viewport?.width || ownerDocument.documentElement.clientWidth;
  const viewportHeight = viewport?.height || ownerDocument.documentElement.clientHeight;
  const offsetLeft = viewport?.offsetLeft ?? 0;
  const offsetTop = viewport?.offsetTop ?? 0;
  const left = offsetLeft + FLOATING_GUTTER;
  const top = offsetTop + FLOATING_GUTTER;
  return {
    left,
    right: Math.max(left + 1, offsetLeft + viewportWidth - FLOATING_GUTTER),
    top,
    bottom: Math.max(top + 1, offsetTop + viewportHeight - FLOATING_GUTTER),
  };
}

export function usePopoverPosition(
  open: boolean,
  placement: "bottom" | "top",
  rootRef: RefObject<HTMLElement | null>,
  popoverRef: RefObject<HTMLElement | null>,
  align: "start" | "end" = "start",
) {
  useClientLayoutEffect(() => {
    const root = rootRef.current;
    const popover = popoverRef.current;
    if (!open || !root || !popover) return;
    const ownerWindow = root.ownerDocument.defaultView ?? window;
    const visualViewport = ownerWindow.visualViewport;

    let animationFrame = 0;
    let copiedTokens = new Set<string>();
    const update = () => {
      const { left, right, top, bottom } = floatingViewportBounds(root.ownerDocument);
      const availableWidth = Math.max(1, Math.floor(right - left));
      const availableHeight = Math.max(1, Math.floor(bottom - top));
      copiedTokens = syncPersonalUiPortalTheme(root, popover, copiedTokens);
      popover.removeAttribute("data-positioned");
      popover.style.setProperty("--pui-floating-anchor-width", `${Math.max(1, root.getBoundingClientRect().width)}px`);
      popover.style.setProperty("--pui-floating-max-width", `${availableWidth}px`);
      popover.style.setProperty("--pui-floating-max-height", `${availableHeight}px`);
      popover.style.left = `${left}px`;
      popover.style.top = `${top}px`;

      const rootRect = root.getBoundingClientRect();
      const initialRect = popover.getBoundingClientRect();
      const roomBelow = Math.max(1, bottom - rootRect.bottom - FLOATING_GAP);
      const roomAbove = Math.max(1, rootRect.top - FLOATING_GAP - top);
      const preferredRoom = placement === "bottom" ? roomBelow : roomAbove;
      const alternateRoom = placement === "bottom" ? roomAbove : roomBelow;
      const resolvedPlacement = initialRect.height - preferredRoom > 24 && alternateRoom - preferredRoom > 24
        ? placement === "bottom" ? "top" : "bottom"
        : placement;
      const resolvedRoom = Math.min(availableHeight, resolvedPlacement === "bottom" ? roomBelow : roomAbove);
      popover.style.setProperty("--pui-floating-max-height", `${Math.max(1, Math.floor(resolvedRoom))}px`);

      const renderedRect = popover.getBoundingClientRect();
      const unclampedLeft = align === "end" ? rootRect.right - renderedRect.width : rootRect.left;
      const maxLeft = Math.max(left, right - renderedRect.width);
      const resolvedLeft = Math.min(Math.max(unclampedLeft, left), maxLeft);
      const unclampedTop = resolvedPlacement === "bottom"
        ? rootRect.bottom + FLOATING_GAP
        : rootRect.top - FLOATING_GAP - renderedRect.height;
      const maxTop = Math.max(top, bottom - renderedRect.height);
      const resolvedTop = Math.min(Math.max(unclampedTop, top), maxTop);
      const alignedToEnd = Math.abs(resolvedLeft + renderedRect.width - rootRect.right) <= 1;
      const horizontalAlign = Math.abs(resolvedLeft - rootRect.left) <= 1
        ? "start"
        : alignedToEnd ? "end" : "clamped";

      popover.style.left = `${Math.round(resolvedLeft * 100) / 100}px`;
      popover.style.top = `${Math.round(resolvedTop * 100) / 100}px`;
      popover.dataset.horizontalAlign = horizontalAlign;
      popover.dataset.verticalAlign = resolvedPlacement;
      popover.dataset.positioned = "true";
    };
    const scheduleUpdate = () => {
      ownerWindow.cancelAnimationFrame(animationFrame);
      animationFrame = ownerWindow.requestAnimationFrame(update);
    };

    update();
    ownerWindow.addEventListener("resize", scheduleUpdate);
    ownerWindow.addEventListener("scroll", scheduleUpdate, true);
    visualViewport?.addEventListener("resize", scheduleUpdate);
    visualViewport?.addEventListener("scroll", scheduleUpdate);

    const resizeObserver = typeof ResizeObserver === "function" ? new ResizeObserver(scheduleUpdate) : null;
    resizeObserver?.observe(popover);

    const mutationObserver = typeof MutationObserver === "function" ? new MutationObserver(scheduleUpdate) : null;
    mutationObserver?.observe(popover, { childList: true, characterData: true, subtree: true });
    const stopObservingComputedStyles = observeComputedStyleChanges(root, scheduleUpdate, {
      ignoredMutationRoot: popover,
    });

    return () => {
      ownerWindow.cancelAnimationFrame(animationFrame);
      ownerWindow.removeEventListener("resize", scheduleUpdate);
      ownerWindow.removeEventListener("scroll", scheduleUpdate, true);
      visualViewport?.removeEventListener("resize", scheduleUpdate);
      visualViewport?.removeEventListener("scroll", scheduleUpdate);
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      stopObservingComputedStyles();
      popover.removeAttribute("data-positioned");
    };
  }, [align, open, placement, popoverRef, rootRef]);
}
