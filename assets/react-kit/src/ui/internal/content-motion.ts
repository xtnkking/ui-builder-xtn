import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";

const useClientLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

function milliseconds(value: string): number {
  const amount = Number.parseFloat(value);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return value.trim().endsWith("ms") ? amount : value.trim().endsWith("s") ? amount * 1000 : 0;
}

interface ContentAnimation {
  node: HTMLElement;
  identity: string;
  release: () => void;
}

/** Fades the sole current content, never clones controls or replays its first display. */
export function useContentMotion(
  identity: string | null,
  ref: RefObject<HTMLElement | null>,
  enabled = true,
  ready = true,
) {
  const previousIdentity = useRef(identity);
  const active = useRef<ContentAnimation | null>(null);

  // Portal nodes can become available without a dependency identity changing.
  useClientLayoutEffect(() => {
    const node = ref.current;
    const current = active.current;
    let interruptedOpacity: number | null = null;
    if (current && (current.node !== node || current.identity !== identity || !enabled || !ready)) {
      if (current.node === node && enabled && ready) {
        const opacity = Number.parseFloat(node.ownerDocument.defaultView?.getComputedStyle(node).opacity ?? "");
        if (Number.isFinite(opacity)) interruptedOpacity = Math.max(0.62, Math.min(1, opacity));
      }
      current.release();
    }
    if (!enabled) {
      previousIdentity.current = identity;
      return;
    }
    if (!node || !ready || identity === null || previousIdentity.current === identity) return;
    previousIdentity.current = identity;
    active.current?.release();

    const ownerDocument = node.ownerDocument;
    const view = ownerDocument.defaultView;
    const query = view?.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!view || ownerDocument.hidden || query?.matches || typeof node.animate !== "function") return;
    const style = view.getComputedStyle(node);
    const duration = milliseconds(style.getPropertyValue("--ui-motion-standard-enter"));
    if (!duration) return;

    let animation: Animation | null = null;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      query?.removeEventListener?.("change", preferenceChanged);
      query?.removeListener?.(preferenceChanged);
      ownerDocument.removeEventListener("visibilitychange", visibilityChanged);
      if (animation) {
        animation.onfinish = null;
        animation.oncancel = null;
        animation.cancel();
      }
      if (active.current?.release === release) active.current = null;
      delete node.dataset.uiContentMotion;
    };
    const preferenceChanged = () => { if (query?.matches) release(); };
    const visibilityChanged = () => { if (ownerDocument.hidden) release(); };
    try {
      // Keep content readable throughout; no opacity-zero frame or outgoing interactive copy.
      animation = node.animate(
        [{ opacity: interruptedOpacity ?? 0.62 }, { opacity: 1 }],
        { duration, easing: style.getPropertyValue("--ui-motion-ease-enter").trim() || "ease-out", fill: "none" },
      );
      active.current = { node, identity, release };
      node.dataset.uiContentMotion = "switching";
      animation.onfinish = release;
      animation.oncancel = release;
      if (query?.addEventListener) query.addEventListener("change", preferenceChanged);
      else query?.addListener?.(preferenceChanged);
      ownerDocument.addEventListener("visibilitychange", visibilityChanged);
    } catch {
      release();
    }
  });

  useClientLayoutEffect(() => () => {
    active.current?.release();
  }, []);
}
