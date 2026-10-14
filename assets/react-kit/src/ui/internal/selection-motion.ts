import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { usePrefersReducedMotion } from "./motion";

const useClientLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

interface IndicatorGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

function sameGeometry(left: IndicatorGeometry, right: IndicatorGeometry) {
  return (Object.keys(left) as Array<keyof IndicatorGeometry>)
    .every((key) => Math.abs(left[key] - right[key]) < 0.1);
}

function durationInMilliseconds(value: string) {
  const amount = Number.parseFloat(value);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return value.trim().endsWith("ms") ? amount : value.trim().endsWith("s") ? amount * 1000 : 0;
}

/** One decorative highlight; geometry changes never animate the controls or their content. */
export function useSelectionIndicator(
  containerRef: RefObject<HTMLElement | null>,
  indicatorRef: RefObject<HTMLSpanElement | null>,
  selectedSelector: string,
  kind: "underline" | "surface",
) {
  const reduced = usePrefersReducedMotion(containerRef);
  const updateRef = useRef<(allowMotion: boolean) => void>(() => undefined);
  const previous = useRef<{ selected: HTMLButtonElement; geometry: IndicatorGeometry } | null>(null);
  const activeAnimation = useRef<Animation | null>(null);

  useClientLayoutEffect(() => {
    const container = containerRef.current;
    const indicator = indicatorRef.current;
    const view = container?.ownerDocument.defaultView;
    if (!container || !indicator || !view) return;

    const cancel = () => {
      const animation = activeAnimation.current;
      activeAnimation.current = null;
      animation?.cancel();
      indicator.dataset.uiSelectionMotion = "idle";
    };
    const relativeGeometry = (node: HTMLElement): IndicatorGeometry => {
      const rect = node.getBoundingClientRect();
      const parentRect = container.getBoundingClientRect();
      // Normalize shared ancestor transforms (for example an entering Dialog's scale).
      // Otherwise its transient visual scale would be baked into the final CSS dimensions.
      const scaleX = container.offsetWidth > 0 ? parentRect.width / container.offsetWidth : 1;
      const scaleY = container.offsetHeight > 0 ? parentRect.height / container.offsetHeight : 1;
      // Physical scroll coordinates also work with RTL's negative scrollLeft.
      return {
        x: (rect.left - parentRect.left) / (scaleX || 1) - container.clientLeft + container.scrollLeft,
        y: (rect.top - parentRect.top) / (scaleY || 1) - container.clientTop + container.scrollTop,
        width: rect.width / (scaleX || 1),
        height: rect.height / (scaleY || 1),
      };
    };
    const update = (allowMotion: boolean) => {
      const selected = container.querySelector<HTMLButtonElement>(selectedSelector);
      const target = selected ? relativeGeometry(selected) : null;
      if (!selected || !target || target.width <= 0 || target.height <= 0) {
        cancel();
        previous.current = null;
        indicator.hidden = true;
        delete container.dataset.uiSelectionReady;
        return;
      }
      if (kind === "underline") {
        target.y += target.height - 2;
        target.height = 2;
      }
      indicator.dataset.uiSelectionDisabled = String(selected.disabled);
      const prior = previous.current;
      const shouldReduce = view.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
      const hidden = container.ownerDocument.visibilityState === "hidden";
      const changed = !prior || !sameGeometry(prior.geometry, target);
      if (!changed && prior?.selected === selected && !shouldReduce && !hidden) return;

      // Capture an interrupted animation before cancellation so a rapid switch remains continuous.
      const from = prior && !indicator.hidden ? relativeGeometry(indicator) : null;
      cancel();
      indicator.style.left = `${target.x}px`;
      indicator.style.top = `${target.y}px`;
      indicator.style.width = `${target.width}px`;
      indicator.style.height = `${target.height}px`;
      indicator.hidden = false;
      container.dataset.uiSelectionReady = "true";
      previous.current = { selected, geometry: target };

      // First paint, resize/reorder, reduced motion and hidden documents always land immediately.
      if (!allowMotion || !prior || prior.selected === selected || !from || shouldReduce || hidden || !indicator.animate) return;
      const style = view.getComputedStyle(indicator);
      const duration = durationInMilliseconds(style.getPropertyValue("--ui-motion-standard-enter"));
      if (!duration || sameGeometry(from, target)) return;
      const transform = `translate(${from.x - target.x}px, ${from.y - target.y}px) scale(${from.width / target.width}, ${from.height / target.height})`;
      try {
        const animation = indicator.animate(
          [{ transform }, { transform: "none" }],
          { duration, easing: style.getPropertyValue("--ui-motion-ease-enter").trim() || "ease", fill: "none" },
        );
        activeAnimation.current = animation;
        indicator.dataset.uiSelectionMotion = "moving";
        void animation.finished.then(() => {
          if (activeAnimation.current !== animation) return;
          activeAnimation.current = null;
          indicator.dataset.uiSelectionMotion = "idle";
        }, () => undefined);
      } catch {
        // A missing/unsupported animation implementation leaves the selected state intact.
        cancel();
      }
    };
    updateRef.current = update;
    update(false);

    const observer = typeof view.ResizeObserver === "function"
      ? new view.ResizeObserver(() => update(false)) : null;
    const observeControls = () => {
      observer?.disconnect();
      observer?.observe(container);
      container.querySelectorAll<HTMLButtonElement>(":scope > button").forEach((button) => observer?.observe(button));
    };
    observeControls();
    const mutations = typeof view.MutationObserver === "function" ? new view.MutationObserver((records) => {
      if (records.some((record) => record.type === "childList")) observeControls();
      update(false);
    }) : null;
    const geometryAttributes = ["dir", "class", "style", "data-theme", "data-theme-preset", "data-theme-material"];
    mutations?.observe(container, { childList: true, attributes: true, attributeFilter: geometryAttributes });
    // A direction/theme change can move controls without changing their measured sizes.
    for (let ancestor = container.parentElement; ancestor; ancestor = ancestor.parentElement) {
      mutations?.observe(ancestor, { attributes: true, attributeFilter: geometryAttributes });
    }
    const refresh = () => update(false);
    view.addEventListener("resize", refresh);
    container.ownerDocument.addEventListener("visibilitychange", refresh);
    return () => {
      updateRef.current = () => undefined;
      observer?.disconnect();
      mutations?.disconnect();
      view.removeEventListener("resize", refresh);
      container.ownerDocument.removeEventListener("visibilitychange", refresh);
      cancel();
      previous.current = null;
      delete container.dataset.uiSelectionReady;
    };
  }, [containerRef, indicatorRef, selectedSelector, kind]);

  // Measure after every React commit, including changed labels/order/disabled fallback selection.
  useClientLayoutEffect(() => updateRef.current(!reduced));
}
