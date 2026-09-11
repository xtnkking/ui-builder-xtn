import {
  useEffect,
  useLayoutEffect,
  type RefObject,
} from "react";

const useClientLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

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
    if (!copied.has(property) && target.style.getPropertyValue(property)) target.style.removeProperty(property);
  });
  return copied;
}

const computedStyleMediaFallbacks = [
  "(prefers-color-scheme: dark)",
  "(prefers-contrast: more)",
  "(prefers-reduced-motion: reduce)",
  "(forced-colors: active)",
  "(hover: hover)",
  "(pointer: coarse)",
  "print",
];

function collectDocumentMediaConditions(): Set<string> {
  const conditions = new Set(computedStyleMediaFallbacks);
  const visited = new Set<CSSStyleSheet>();
  const visitRules = (rules: CSSRuleList) => {
    Array.from(rules).forEach((rule) => {
      const mediaRule = rule as CSSRule & { conditionText?: string };
      if (rule.type === CSSRule.MEDIA_RULE && mediaRule.conditionText) conditions.add(mediaRule.conditionText);
      const nestedRules = (rule as CSSRule & { cssRules?: CSSRuleList }).cssRules;
      if (nestedRules) visitRules(nestedRules);
      const importedSheet = (rule as CSSRule & { styleSheet?: CSSStyleSheet | null }).styleSheet;
      if (importedSheet) visitSheet(importedSheet);
    });
  };
  const visitSheet = (sheet: CSSStyleSheet | null) => {
    if (!sheet || visited.has(sheet)) return;
    visited.add(sheet);
    if (sheet.media.mediaText) conditions.add(sheet.media.mediaText);
    try {
      visitRules(sheet.cssRules);
    } catch {
      // Cross-origin stylesheets can affect inherited tokens but do not expose rules.
    }
  };
  Array.from(document.styleSheets).forEach(visitSheet);
  return conditions;
}

interface ComputedStyleSubscriber {
  source: HTMLElement;
  onChange: () => void;
  ignoredMutationRoot?: HTMLElement;
  mutationTargets: Set<Node>;
  resizeTargets: HTMLElement[];
  observeAncestors: boolean;
}

interface ComputedStyleObserverOptions {
  ignoredMutationRoot?: HTMLElement;
  observeAncestors?: boolean;
}

const computedStyleSubscribers = new Set<ComputedStyleSubscriber>();
const resizeTargetSubscribers = new Map<HTMLElement, Set<ComputedStyleSubscriber>>();
const mediaQueries = new Map<string, MediaQueryList>();
const pendingSubscribers = new Set<ComputedStyleSubscriber>();
let sharedMutationObserver: MutationObserver | null = null;
let sharedResizeObserver: ResizeObserver | null = null;
let sharedAnimationFrame = 0;
let observerGeneration = 0;

function scheduleSubscribers(subscribers: Iterable<ComputedStyleSubscriber>): void {
  for (const subscriber of subscribers) {
    if (computedStyleSubscribers.has(subscriber)) pendingSubscribers.add(subscriber);
  }
  if (!pendingSubscribers.size || sharedAnimationFrame) return;
  sharedAnimationFrame = window.requestAnimationFrame(() => {
    sharedAnimationFrame = 0;
    const scheduled = Array.from(pendingSubscribers);
    pendingSubscribers.clear();
    scheduled.forEach((subscriber) => {
      if (!computedStyleSubscribers.has(subscriber)) return;
      refreshSubscriberTargets(subscriber);
      subscriber.onChange();
    });
  });
}

const scheduleAllSubscribers = () => scheduleSubscribers(computedStyleSubscribers);

function refreshMediaQueries(): void {
  const conditions = collectDocumentMediaConditions();
  mediaQueries.forEach((query, condition) => {
    if (conditions.has(condition)) return;
    query.removeEventListener("change", scheduleAllSubscribers);
    mediaQueries.delete(condition);
  });
  conditions.forEach((condition) => {
    if (mediaQueries.has(condition)) return;
    try {
      const query = window.matchMedia(condition);
      query.addEventListener("change", scheduleAllSubscribers);
      mediaQueries.set(condition, query);
    } catch {
      // Ignore media syntax unsupported by the current browser.
    }
  });
}

function nodeIsWithin(root: HTMLElement, node: Node): boolean {
  return node === root || root.contains(node);
}

function subscriberAncestors(source: HTMLElement): HTMLElement[] {
  const targets: HTMLElement[] = [];
  for (let target: HTMLElement | null = source; target; target = target.parentElement) targets.push(target);
  return targets;
}

function addResizeTarget(subscriber: ComputedStyleSubscriber, target: HTMLElement): void {
  const subscribers = resizeTargetSubscribers.get(target) ?? new Set<ComputedStyleSubscriber>();
  subscribers.add(subscriber);
  resizeTargetSubscribers.set(target, subscribers);
  sharedResizeObserver?.observe(target);
}

function removeResizeTarget(subscriber: ComputedStyleSubscriber, target: HTMLElement): void {
  const subscribers = resizeTargetSubscribers.get(target);
  subscribers?.delete(subscriber);
  if (subscribers?.size) return;
  resizeTargetSubscribers.delete(target);
  sharedResizeObserver?.unobserve(target);
}

function detachComputedStyleSubscriber(subscriber: ComputedStyleSubscriber): void {
  computedStyleSubscribers.delete(subscriber);
  pendingSubscribers.delete(subscriber);
  subscriber.resizeTargets.forEach((target) => removeResizeTarget(subscriber, target));
  subscriber.resizeTargets = [];
  subscriber.mutationTargets.clear();
}

function pruneDisconnectedSubscribers(): void {
  computedStyleSubscribers.forEach((subscriber) => {
    if (!subscriber.source.isConnected) detachComputedStyleSubscriber(subscriber);
  });
}

function refreshSubscriberTargets(subscriber: ComputedStyleSubscriber): void {
  const ancestors = subscriberAncestors(subscriber.source);
  const nextResizeTargets = subscriber.observeAncestors ? ancestors : [subscriber.source];
  const nextResizeSet = new Set(nextResizeTargets);
  subscriber.resizeTargets.forEach((target) => {
    if (!nextResizeSet.has(target)) removeResizeTarget(subscriber, target);
  });
  const previousResizeSet = new Set(subscriber.resizeTargets);
  nextResizeTargets.forEach((target) => {
    if (!previousResizeSet.has(target)) addResizeTarget(subscriber, target);
  });
  subscriber.mutationTargets = new Set(ancestors);
  subscriber.resizeTargets = nextResizeTargets;
}

function mutationContainsStylesheet(record: MutationRecord): boolean {
  const targetElement = record.target instanceof Element ? record.target : record.target.parentElement;
  if (document.head.contains(record.target) || targetElement?.closest("style")) return true;
  if (record.type !== "childList") return false;
  return [...Array.from(record.addedNodes), ...Array.from(record.removedNodes)].some((node) => (
    node instanceof HTMLStyleElement || node instanceof HTMLLinkElement
  ));
}

function mutationAffectsSubscriber(record: MutationRecord, subscriber: ComputedStyleSubscriber): boolean {
  if (subscriber.ignoredMutationRoot && nodeIsWithin(subscriber.ignoredMutationRoot, record.target)) return false;
  if (mutationContainsStylesheet(record)) return true;
  if (record.type === "attributes") return subscriber.mutationTargets.has(record.target);
  if (record.type !== "childList") return false;
  return [...Array.from(record.addedNodes), ...Array.from(record.removedNodes)].some((node) => (
    nodeIsWithin(subscriber.source, node) || (node instanceof Element && node.contains(subscriber.source))
  ));
}

function scheduleForEventTarget(event: Event): void {
  const target = event.target;
  if (!(target instanceof Node)) return;
  scheduleSubscribers(Array.from(computedStyleSubscribers).filter((subscriber) => (
    subscriber.mutationTargets.has(target)
  )));
}

function handleResourceLoad(event: Event): void {
  if (!(event.target instanceof HTMLLinkElement || event.target instanceof HTMLStyleElement)) return;
  refreshMediaQueries();
  scheduleAllSubscribers();
}

function startSharedComputedStyleObservers(): void {
  observerGeneration += 1;
  const generation = observerGeneration;
  sharedMutationObserver = typeof MutationObserver === "function"
    ? new MutationObserver((records) => {
        pruneDisconnectedSubscribers();
        if (!computedStyleSubscribers.size) {
          stopSharedComputedStyleObservers();
          return;
        }
        if (records.some(mutationContainsStylesheet)) refreshMediaQueries();
        computedStyleSubscribers.forEach((subscriber) => {
          if (records.some((record) => mutationAffectsSubscriber(record, subscriber))) {
            pendingSubscribers.add(subscriber);
          }
        });
        scheduleSubscribers(pendingSubscribers);
      })
    : null;
  sharedMutationObserver?.observe(document.documentElement, {
    attributes: true,
    childList: true,
    characterData: true,
    subtree: true,
  });
  sharedResizeObserver = typeof ResizeObserver === "function"
    ? new ResizeObserver((entries) => {
        entries.forEach((entry) => {
          const subscribers = resizeTargetSubscribers.get(entry.target as HTMLElement);
          if (subscribers) scheduleSubscribers(subscribers);
        });
      })
    : null;
  resizeTargetSubscribers.forEach((_subscribers, target) => sharedResizeObserver?.observe(target));
  refreshMediaQueries();

  window.addEventListener("resize", scheduleAllSubscribers);
  window.addEventListener("orientationchange", scheduleAllSubscribers);
  window.addEventListener("pageshow", scheduleAllSubscribers);
  window.visualViewport?.addEventListener("resize", scheduleAllSubscribers);
  document.addEventListener("load", handleResourceLoad, true);
  document.addEventListener("transitionend", scheduleForEventTarget, true);
  document.addEventListener("transitioncancel", scheduleForEventTarget, true);
  document.addEventListener("animationiteration", scheduleForEventTarget, true);
  document.addEventListener("animationend", scheduleForEventTarget, true);
  document.fonts?.addEventListener("loadingdone", scheduleAllSubscribers);
  document.fonts?.addEventListener("loadingerror", scheduleAllSubscribers);
  void document.fonts?.ready.then(() => {
    if (generation === observerGeneration && computedStyleSubscribers.size) scheduleAllSubscribers();
  });
}

function stopSharedComputedStyleObservers(): void {
  observerGeneration += 1;
  sharedMutationObserver?.disconnect();
  sharedMutationObserver = null;
  sharedResizeObserver?.disconnect();
  sharedResizeObserver = null;
  mediaQueries.forEach((query) => query.removeEventListener("change", scheduleAllSubscribers));
  mediaQueries.clear();
  pendingSubscribers.clear();
  if (sharedAnimationFrame) window.cancelAnimationFrame(sharedAnimationFrame);
  sharedAnimationFrame = 0;
  window.removeEventListener("resize", scheduleAllSubscribers);
  window.removeEventListener("orientationchange", scheduleAllSubscribers);
  window.removeEventListener("pageshow", scheduleAllSubscribers);
  window.visualViewport?.removeEventListener("resize", scheduleAllSubscribers);
  document.removeEventListener("load", handleResourceLoad, true);
  document.removeEventListener("transitionend", scheduleForEventTarget, true);
  document.removeEventListener("transitioncancel", scheduleForEventTarget, true);
  document.removeEventListener("animationiteration", scheduleForEventTarget, true);
  document.removeEventListener("animationend", scheduleForEventTarget, true);
  document.fonts?.removeEventListener("loadingdone", scheduleAllSubscribers);
  document.fonts?.removeEventListener("loadingerror", scheduleAllSubscribers);
}

export function observeComputedStyleChanges(
  source: HTMLElement,
  onChange: () => void,
  { ignoredMutationRoot, observeAncestors = true }: ComputedStyleObserverOptions = {},
): () => void {
  const subscriber: ComputedStyleSubscriber = {
    source,
    onChange,
    ignoredMutationRoot,
    mutationTargets: new Set(),
    resizeTargets: [],
    observeAncestors,
  };
  computedStyleSubscribers.add(subscriber);
  refreshSubscriberTargets(subscriber);
  if (computedStyleSubscribers.size === 1) startSharedComputedStyleObservers();

  return () => {
    detachComputedStyleSubscriber(subscriber);
    if (!computedStyleSubscribers.size) stopSharedComputedStyleObservers();
  };
}

export function usePersonalUiPortalTokens(
  active: boolean,
  sourceRef: RefObject<HTMLElement>,
  portalRef: RefObject<HTMLElement>,
): void {
  useClientLayoutEffect(() => {
    const source = sourceRef.current;
    const portal = portalRef.current;
    if (!active || !source || !portal) return;
    let copied = new Set<string>();
    const sync = () => {
      copied = copyPersonalUiTokens(source, portal, copied);
    };
    sync();
    return observeComputedStyleChanges(source, sync, { ignoredMutationRoot: portal });
  }, [active, portalRef, sourceRef]);
}
