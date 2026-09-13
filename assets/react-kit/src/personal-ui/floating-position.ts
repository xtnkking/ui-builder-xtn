import { useEffect, useLayoutEffect, type RefObject } from "react";
import { observeComputedStyleChanges } from "./portal-tokens";

const useClientLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;
const FLOATING_GUTTER = 12;
const FLOATING_GAP = 6;

export function floatingPortalTarget(root: HTMLElement | null): HTMLElement {
  return root?.closest<HTMLElement>(".pui-overlay") ?? document.body;
}

function copyPersonalUiTokens(source: HTMLElement, target: HTMLElement, previous: Set<string>): Set<string> {
  const computed = window.getComputedStyle(source);
  const copied = new Set<string>();
  for (let index = 0; index < computed.length; index += 1) {
    const property = computed.item(index);
    if (!property.startsWith("--pui-")) continue;
    copied.add(property);
    const value = computed.getPropertyValue(property);
    if (target.style.getPropertyValue(property) !== value) target.style.setProperty(property, value);
  }
  previous.forEach((property) => {
    if (!copied.has(property)) target.style.removeProperty(property);
  });
  return copied;
}

function floatingViewportBounds() {
  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = document.documentElement.clientHeight;
  return {
    left: FLOATING_GUTTER,
    right: Math.max(FLOATING_GUTTER + 1, viewportWidth - FLOATING_GUTTER),
    top: FLOATING_GUTTER,
    bottom: Math.max(FLOATING_GUTTER + 1, viewportHeight - FLOATING_GUTTER),
  };
}

export function usePopoverPosition(
  open: boolean,
  placement: "bottom" | "top",
  rootRef: RefObject<HTMLElement>,
  popoverRef: RefObject<HTMLElement>,
  align: "start" | "end" = "start",
) {
  useClientLayoutEffect(() => {
    const root = rootRef.current;
    const popover = popoverRef.current;
    if (!open || !root || !popover) return;

    let animationFrame = 0;
    let copiedTokens = new Set<string>();
    const update = () => {
      const { left, right, top, bottom } = floatingViewportBounds();
      const availableWidth = Math.max(1, Math.floor(right - left));
      const availableHeight = Math.max(1, Math.floor(bottom - top));
      copiedTokens = copyPersonalUiTokens(root, popover, copiedTokens);
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
      const resolvedRoom = resolvedPlacement === "bottom" ? roomBelow : roomAbove;
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
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("scroll", scheduleUpdate, true);

    const resizeObserver = typeof ResizeObserver === "function" ? new ResizeObserver(scheduleUpdate) : null;
    resizeObserver?.observe(popover);

    const mutationObserver = typeof MutationObserver === "function" ? new MutationObserver(scheduleUpdate) : null;
    mutationObserver?.observe(popover, { childList: true, characterData: true, subtree: true });
    const stopObservingComputedStyles = observeComputedStyleChanges(root, scheduleUpdate, {
      ignoredMutationRoot: popover,
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("scroll", scheduleUpdate, true);
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      stopObservingComputedStyles();
      popover.removeAttribute("data-positioned");
    };
  }, [align, open, placement, popoverRef, rootRef]);
}
