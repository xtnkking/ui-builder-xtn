import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";

const useClientLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;
const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

export type MotionState = "entering" | "open" | "exiting" | "closed";
export type MotionProfile = "standard" | "drawer" | "menu" | "collapse";

interface PresenceSnapshot {
  requestedOpen: boolean;
  state: MotionState;
  generation: number;
}

interface ActiveTransition {
  node: HTMLElement;
  generation: number;
  finish: () => void;
  cancel: () => void;
}

interface FocusTarget {
  focus: (options?: FocusOptions) => void;
}

function motionDocument(ref?: RefObject<HTMLElement | null>): Document | null {
  return ref?.current?.ownerDocument ?? (typeof document === "undefined" ? null : document);
}

function mediaQuery(ownerDocument: Document | null): MediaQueryList | null {
  const view = ownerDocument?.defaultView;
  return typeof view?.matchMedia === "function" ? view.matchMedia(reducedMotionQuery) : null;
}

function milliseconds(value: string): number {
  const normalized = value.trim();
  const amount = Number.parseFloat(normalized);
  if (!Number.isFinite(amount) || amount < 0) return 0;
  if (normalized.endsWith("ms")) return amount;
  if (normalized.endsWith("s")) return amount * 1000;
  return 0;
}

/** Uses the node's browsing context, including when the node lives in a Portal/iframe. */
export function usePrefersReducedMotion(ref?: RefObject<HTMLElement | null>): boolean {
  const [reduced, setReduced] = useState(false);
  const subscription = useRef<{ document: Document | null; release: () => void } | null>(null);

  // Re-check after each commit: a Portal's ref can become available without its identity changing.
  useClientLayoutEffect(() => {
    const ownerDocument = motionDocument(ref);
    if (subscription.current?.document === ownerDocument) return;
    subscription.current?.release();
    const query = mediaQuery(ownerDocument);
    const update = () => setReduced(query?.matches ?? false);
    update();
    if (query?.addEventListener) query.addEventListener("change", update);
    else query?.addListener(update);
    subscription.current = {
      document: ownerDocument,
      release: () => {
        if (query?.removeEventListener) query.removeEventListener("change", update);
        else query?.removeListener(update);
      },
    };
  });

  useClientLayoutEffect(() => () => {
    subscription.current?.release();
    subscription.current = null;
  }, []);

  return reduced;
}

/**
 * Keeps an owned DOM node mounted through its exit. CSS owns timing; absent CSS means no wait.
 * The caller puts data-ui-motion/state and data-ui-motion-profile/profile on the animated node.
 */
export function useMotionPresence<T extends HTMLElement>(
  open: boolean,
  ref: RefObject<T | null>,
  profile: MotionProfile = "standard",
  onExited?: () => void,
): { present: boolean; state: MotionState } {
  const [snapshot, setSnapshot] = useState<PresenceSnapshot>(() => ({
    requestedOpen: open,
    state: open ? "entering" : "closed",
    generation: 0,
  }));
  let current = snapshot;
  // A render-time adjustment prevents a closed commit or an actionable open commit on reversal.
  if (snapshot.requestedOpen !== open) {
    current = {
      requestedOpen: open,
      state: open ? "entering" : snapshot.state === "closed" ? "closed" : "exiting",
      generation: snapshot.generation + 1,
    };
    setSnapshot(current);
  }
  const latest = useRef(current);
  const callback = useRef(onExited);
  const active = useRef<ActiveTransition | null>(null);
  const completedExit = useRef(-1);
  const reduced = usePrefersReducedMotion(ref);

  useClientLayoutEffect(() => {
    latest.current = current;
    callback.current = onExited;
    const transitioning = current.state === "entering" || current.state === "exiting";
    if (!transitioning) {
      active.current?.cancel();
      return;
    }
    const node = ref.current;
    // Initial Portal-ready rendering must not consume the entrance before its node exists.
    if (!node && current.state === "entering") return;
    const ownerDocument = node?.ownerDocument ?? motionDocument(ref);
    const view = ownerDocument?.defaultView;
    const immediate = !node || !view || ownerDocument?.hidden || reduced || mediaQuery(ownerDocument)?.matches;
    if (active.current?.node === node && active.current.generation === current.generation) {
      if (immediate) active.current.finish();
      return;
    }
    // A script animation survives the DOM's new data state until it is canceled. Sample its
    // current visual values first so a reversed Drawer never jumps back to a keyframe endpoint.
    const interrupted = active.current?.node === node;
    const beforeCancel = node && view?.getComputedStyle(node);
    const ownClosedTransform = beforeCancel?.getPropertyValue("--_ui-motion-closed-transform").trim();
    const transformNode = ownClosedTransform ? node : node?.querySelector<HTMLElement>(":scope > .ui-dialog, :scope > .ui-drawer");
    const beforeTransformCancel = transformNode && view?.getComputedStyle(transformNode);
    const opacityFrom = interrupted ? beforeCancel?.opacity || "1" : current.requestedOpen ? "0" : "1";
    const transformFrom = interrupted ? beforeTransformCancel?.transform || "none" : undefined;
    active.current?.cancel();

    let timer: number | undefined;
    let released = false;
    let completed = false;
    let started = false;
    let manualAnimations: Animation[] = [];
    const suppressedCssAnimations: { element: HTMLElement; declarations: { property: string; value: string; priority: string }[] }[] = [];
    const suppressCssAnimation = (element: HTMLElement) => {
      const declarations = Array.from(element.style)
        .filter((property) => property === "animation" || property.startsWith("animation-"))
        .map((property) => ({ property, value: element.style.getPropertyValue(property), priority: element.style.getPropertyPriority(property) }));
      suppressedCssAnimations.push({ element, declarations });
      element.style.setProperty("animation", "none", "important");
    };
    const restoreCssAnimations = () => {
      suppressedCssAnimations.splice(0).forEach(({ element, declarations }) => {
        element.style.removeProperty("animation");
        declarations.forEach(({ property, value, priority }) => element.style.setProperty(property, value, priority));
      });
    };
    let transition: ActiveTransition;
    const isCurrent = () => !released && !completed
      && active.current === transition
      && latest.current.generation === current.generation;
    const stopWaiting = () => {
      if (timer !== undefined) {
        view?.clearTimeout(timer);
        timer = undefined;
      }
      node?.removeEventListener("animationstart", animationStart);
      node?.removeEventListener("animationend", animationComplete);
      node?.removeEventListener("animationcancel", animationComplete);
      node?.removeEventListener("transitionend", transitionComplete);
      node?.removeEventListener("transitioncancel", transitionComplete);
      ownerDocument?.removeEventListener("visibilitychange", visibilityChange);
    };
    const release = () => {
      if (released) return;
      released = true;
      stopWaiting();
      manualAnimations.forEach((animation) => animation.cancel());
      restoreCssAnimations();
      if (active.current === transition) active.current = null;
    };
    const finish = () => {
      if (!isCurrent()) return;
      completed = true;
      stopWaiting();
      // Keep the filled endpoint and CSS suppression until the final-state commit (or
      // unmount) releases them. Restoring CSS while still entering/exiting restarts its
      // keyframe for a frame before React commits, producing a visible endpoint jump.
      setSnapshot((previous) => previous.generation === current.generation
        ? { ...previous, state: current.requestedOpen ? "open" : "closed" }
        : previous);
      if (!current.requestedOpen && completedExit.current !== current.generation) {
        completedExit.current = current.generation;
        callback.current?.();
      }
    };
    transition = { node: node!, generation: current.generation, finish, cancel: release };
    active.current = transition;
    const computed = node && view?.getComputedStyle(node);
    const duration = computed
      ? milliseconds(computed.getPropertyValue(current.state === "entering" ? "--ui-motion-enter" : "--ui-motion-exit"))
      : 0;
    const names = new Set((computed?.animationName ?? "").split(",").map((name) => name.trim()).filter((name) => name && name !== "none"));
    const nativeAnimations = node && typeof node.getAnimations === "function" ? node.getAnimations() : [];
    const tracksAnimation = (animation: Animation) => {
      const name = (animation as Animation & { animationName?: string }).animationName;
      const property = (animation as Animation & { transitionProperty?: string }).transitionProperty;
      return name ? names.has(name) : profile === "collapse" && property === "grid-template-rows";
    };
    let trackedAnimations = nativeAnimations.filter(tracksAnimation);
    const startedAt = view?.performance.now() ?? 0;
    const isOwnEvent = (event: Event) => event.target === node && isCurrent();
    const nativeFinished = () => trackedAnimations.length > 0
      && trackedAnimations.every((animation) => animation.playState === "finished" || animation.playState === "idle");
    function animationStart(event: AnimationEvent) {
      if (isOwnEvent(event) && names.has(event.animationName) && !event.pseudoElement) started = true;
    }
    function animationComplete(event: AnimationEvent) {
      if (!isOwnEvent(event) || !names.has(event.animationName) || event.pseudoElement) return;
      if (manualAnimations.length > 0) {
        if (manualAnimations.every((animation) => animation.playState === "finished")) finish();
        return;
      }
      // A queued cancellation from an interrupted generation must not finish its replacement.
      if (trackedAnimations.length > 0) {
        if (!nativeFinished()) return;
      } else if (event.type === "animationcancel") {
        if (!started) return;
      } else if ((view?.performance.now() ?? 0) - startedAt + 16 < duration) {
        return;
      }
      finish();
    }
    function transitionComplete(event: TransitionEvent) {
      if (profile !== "collapse" || !isOwnEvent(event) || event.propertyName !== "grid-template-rows" || event.pseudoElement) return;
      if (trackedAnimations.length > 0) {
        if (!nativeFinished()) return;
      } else if (event.type === "transitioncancel" || (view?.performance.now() ?? 0) - startedAt + 16 < duration) {
        return;
      }
      finish();
    }
    function visibilityChange() {
      if (ownerDocument?.hidden) finish();
    }

    if (immediate || duration === 0) {
      finish();
      return;
    }
    node!.addEventListener("animationstart", animationStart);
    node!.addEventListener("animationend", animationComplete);
    node!.addEventListener("animationcancel", animationComplete);
    if (profile === "collapse") {
      node!.addEventListener("transitionend", transitionComplete);
      node!.addEventListener("transitioncancel", transitionComplete);
    }
    ownerDocument?.addEventListener("visibilitychange", visibilityChange);
    timer = view!.setTimeout(finish, Math.min(400, duration + 50));
    if (profile !== "collapse" && typeof node!.animate === "function") {
      const easing = computed!.getPropertyValue(current.requestedOpen ? "--ui-motion-ease-enter" : "--ui-motion-ease-exit").trim() || "linear";
      const timing: KeyframeAnimationOptions = { duration, easing, fill: "both" };
      const from: Keyframe = { opacity: opacityFrom };
      const to: Keyframe = { opacity: current.requestedOpen ? "1" : "0" };
      const closedTransform = transformNode && view!.getComputedStyle(transformNode).getPropertyValue("--_ui-motion-closed-transform").trim();
      const transformFrames: Keyframe[] | null = closedTransform ? [
        { transform: transformFrom ?? (current.requestedOpen ? closedTransform : "none") },
        { transform: current.requestedOpen ? "none" : closedTransform },
      ] : null;
      if (transformNode === node && transformFrames) {
        from.transform = transformFrames[0].transform;
        to.transform = transformFrames[1].transform;
      }
      try {
        // Keep one animation owner across data-state changes. A freshly restarted CSS
        // keyframe otherwise hides the script animation's current value before reversal.
        suppressCssAnimation(node!);
        manualAnimations.push(node!.animate([from, to], timing));
        if (transformNode && transformNode !== node && transformFrames && typeof transformNode.animate === "function") {
          suppressCssAnimation(transformNode);
          manualAnimations.push(transformNode.animate(transformFrames, timing));
        }
        void Promise.all(manualAnimations.map((animation) => animation.finished)).then(finish, () => undefined);
      } catch {
        // Unsupported native animation options retain the CSS path and its bounded cleanup.
        manualAnimations.forEach((animation) => {
          void animation.finished.catch(() => undefined);
          animation.cancel();
        });
        manualAnimations = [];
        restoreCssAnimations();
        trackedAnimations = typeof node!.getAnimations === "function" ? node!.getAnimations().filter(tracksAnimation) : [];
      }
    }
  });

  useClientLayoutEffect(() => () => active.current?.cancel(), []);

  return { present: open || current.state !== "closed", state: current.state };
}

/** Retains a nonmodal visual exit without leaving a focusable or selectable ghost menu. */
export function useNonModalMotion<T extends HTMLElement>(
  open: boolean,
  panelRef: RefObject<T | null>,
  triggerRef: RefObject<FocusTarget | null>,
  profile: MotionProfile = "menu",
): { present: boolean; state: MotionState } {
  const presence = useMotionPresence(open, panelRef, profile);
  useClientLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    if (open) {
      panel.removeAttribute("inert");
      panel.removeAttribute("aria-hidden");
      return;
    }
    const ownerDocument = panel.ownerDocument;
    const focused = ownerDocument.activeElement;
    if (focused && panel.contains(focused)) {
      const trigger = triggerRef.current;
      const nativeTrigger = trigger && "nodeType" in trigger ? trigger as HTMLElement : null;
      if (trigger && (!nativeTrigger || (nativeTrigger.isConnected && !nativeTrigger.matches(":disabled, [inert]")))) {
        trigger.focus({ preventScroll: true });
      }
      if (ownerDocument.activeElement && panel.contains(ownerDocument.activeElement)) {
        (ownerDocument.activeElement as HTMLElement).blur?.();
      }
    }
    panel.setAttribute("inert", "");
    panel.setAttribute("aria-hidden", "true");
  });
  return presence;
}
