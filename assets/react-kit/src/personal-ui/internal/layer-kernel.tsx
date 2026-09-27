import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FocusEvent as ReactFocusEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { usePersonalUiPortalTokens } from "./portal-tokens";
import { getTabStops, isVisibleElement } from "./utils";

const useClientLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;
const subscribeToClient = () => () => undefined;

export type LayerDismissReason = "backdrop" | "close-control" | "escape";
export type LayerMode = "modal" | "nonmodal";

export interface LayerDismissPolicy {
  backdrop: boolean;
  closeControl: boolean;
  escape: boolean;
}

export type LayerInitialFocus = "first-tabbable" | "panel" | ((panel: HTMLElement) => HTMLElement | null);

interface LayerEntry {
  id: symbol;
  parentId: symbol | null;
  panel: HTMLElement;
  mode: LayerMode;
  restoreFocusTo: HTMLElement | null;
  panelSnapshot: ElementStateSnapshot;
}

interface ElementStateSnapshot {
  hadAriaHidden: boolean;
  ariaHidden: string | null;
  hadAriaModal: boolean;
  ariaModal: string | null;
  hadInert: boolean;
}

interface BodyLockSnapshot {
  overflow: string;
  paddingRight: string;
}

interface LayerActivation {
  target: HTMLElement;
  capturedAt: number;
}

interface LayerDocumentState {
  document: Document;
  entries: LayerEntry[];
  backgroundSnapshots: Map<HTMLElement, boolean>;
  bodyLockCount: number;
  bodyLockSnapshot: BodyLockSnapshot | null;
  mutationObserver: MutationObserver | null;
  latestActivation: LayerActivation | null;
  activationSubscribers: number;
  captureActivation: (event: Event) => void;
}

const LayerParentContext = createContext<symbol | null>(null);
const documentStates = new WeakMap<Document, LayerDocumentState>();
const activationTargetSelector = [
  "a[href]",
  "button:not(:disabled)",
  "input:not(:disabled):not([type='hidden'])",
  "select:not(:disabled)",
  "textarea:not(:disabled)",
  "[contenteditable='true']",
  "[contenteditable='plaintext-only']",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function ownerWindow(ownerDocument: Document): (Window & typeof globalThis) | null {
  return ownerDocument.defaultView;
}

function isOwnerElement(ownerDocument: Document, candidate: EventTarget | null): candidate is HTMLElement {
  const ElementConstructor = ownerWindow(ownerDocument)?.HTMLElement;
  return Boolean(ElementConstructor && candidate instanceof ElementConstructor);
}

function createDocumentState(ownerDocument: Document): LayerDocumentState {
  const state: LayerDocumentState = {
    document: ownerDocument,
    entries: [],
    backgroundSnapshots: new Map(),
    bodyLockCount: 0,
    bodyLockSnapshot: null,
    mutationObserver: null,
    latestActivation: null,
    activationSubscribers: 0,
    captureActivation: () => undefined,
  };
  state.captureActivation = (event) => {
    const target = event.composedPath().find((candidate) => (
      isOwnerElement(ownerDocument, candidate)
      && candidate.matches(activationTargetSelector)
      && !candidate.closest("[inert], [aria-hidden='true']")
    ));
    state.latestActivation = target && isOwnerElement(ownerDocument, target)
      ? { target, capturedAt: Date.now() }
      : null;
  };
  return state;
}

function documentState(ownerDocument: Document): LayerDocumentState {
  const existing = documentStates.get(ownerDocument);
  if (existing) return existing;
  const state = createDocumentState(ownerDocument);
  documentStates.set(ownerDocument, state);
  return state;
}

function subscribeToActivation(ownerDocument: Document): () => void {
  const state = documentState(ownerDocument);
  if (state.activationSubscribers === 0) {
    ownerDocument.addEventListener("pointerdown", state.captureActivation, true);
    ownerDocument.addEventListener("click", state.captureActivation, true);
  }
  state.activationSubscribers += 1;
  return () => {
    state.activationSubscribers = Math.max(0, state.activationSubscribers - 1);
    if (state.activationSubscribers > 0) return;
    ownerDocument.removeEventListener("pointerdown", state.captureActivation, true);
    ownerDocument.removeEventListener("click", state.captureActivation, true);
    state.latestActivation = null;
  };
}

function isLayerDescendant(state: LayerDocumentState, entry: LayerEntry, ancestorId: symbol): boolean {
  const visited = new Set<symbol>();
  let parentId = entry.parentId;
  while (parentId && !visited.has(parentId)) {
    if (parentId === ancestorId) return true;
    visited.add(parentId);
    parentId = state.entries.find((candidate) => candidate.id === parentId)?.parentId ?? null;
  }
  return false;
}

function layerContainers(state: LayerDocumentState, entry: LayerEntry): HTMLElement[] {
  const containers: HTMLElement[] = [entry.panel];
  const discovered = new Set(containers);
  state.entries.forEach((candidate) => {
    if (!isLayerDescendant(state, candidate, entry.id) || discovered.has(candidate.panel)) return;
    discovered.add(candidate.panel);
    containers.push(candidate.panel);
  });
  for (let index = 0; index < containers.length; index += 1) {
    containers[index].querySelectorAll<HTMLElement>("[aria-controls]").forEach((controller) => {
      controller.getAttribute("aria-controls")?.trim().split(/\s+/).forEach((controlledId) => {
        const floatingRoot = state.document.getElementById(controlledId)?.closest<HTMLElement>("[data-pui-floating-root='true']");
        if (!floatingRoot || discovered.has(floatingRoot)) return;
        discovered.add(floatingRoot);
        containers.push(floatingRoot);
      });
    });
  }
  state.document.querySelectorAll<HTMLElement>(".pui-toast-viewport").forEach((viewport) => {
    if (!discovered.has(viewport)) containers.push(viewport);
  });
  return containers;
}

function layerContains(state: LayerDocumentState, entry: LayerEntry, element: HTMLElement): boolean {
  return layerContainers(state, entry).some((container) => container.contains(element));
}

function layerTabStops(state: LayerDocumentState, entry: LayerEntry): HTMLElement[] {
  const containers = layerContainers(state, entry);
  return getTabStops(state.document, (element) => containers.some((container) => container.contains(element)));
}

function canReceiveFocus(element: HTMLElement | null): element is HTMLElement {
  return Boolean(
    element?.isConnected
    && !element.matches(":disabled")
    && !element.closest("[inert], [aria-hidden='true']")
    && isVisibleElement(element),
  );
}

function focusAndConfirm(element: HTMLElement | null): boolean {
  if (!canReceiveFocus(element)) return false;
  element.focus({ preventScroll: true });
  return element.ownerDocument.activeElement === element;
}

function initialFocusTarget(entry: LayerEntry, initialFocus: LayerInitialFocus): HTMLElement {
  const autofocus = Array.from(entry.panel.querySelectorAll<HTMLElement>("[autofocus]"))
    .find((element) => canReceiveFocus(element));
  if (autofocus) return autofocus;
  if (typeof initialFocus === "function") return initialFocus(entry.panel) ?? entry.panel;
  if (initialFocus === "first-tabbable") return layerTabStops(documentState(entry.panel.ownerDocument), entry)[0] ?? entry.panel;
  return entry.panel;
}

function snapshotPanel(panel: HTMLElement): ElementStateSnapshot {
  return {
    hadAriaHidden: panel.hasAttribute("aria-hidden"),
    ariaHidden: panel.getAttribute("aria-hidden"),
    hadAriaModal: panel.hasAttribute("aria-modal"),
    ariaModal: panel.getAttribute("aria-modal"),
    hadInert: panel.hasAttribute("inert"),
  };
}

function restoreAttribute(element: HTMLElement, name: string, hadAttribute: boolean, value: string | null): void {
  if (!hadAttribute) {
    element.removeAttribute(name);
    return;
  }
  element.setAttribute(name, value ?? "");
}

function restorePanel(entry: LayerEntry): void {
  restoreAttribute(entry.panel, "aria-hidden", entry.panelSnapshot.hadAriaHidden, entry.panelSnapshot.ariaHidden);
  restoreAttribute(entry.panel, "aria-modal", entry.panelSnapshot.hadAriaModal, entry.panelSnapshot.ariaModal);
  if (entry.panelSnapshot.hadInert) entry.panel.setAttribute("inert", "");
  else entry.panel.removeAttribute("inert");
}

function topLayer(state: LayerDocumentState): LayerEntry | undefined {
  return state.entries[state.entries.length - 1];
}

function topModal(state: LayerDocumentState): LayerEntry | undefined {
  return [...state.entries].reverse().find((entry) => entry.mode === "modal");
}

function bodyChildFor(element: HTMLElement): HTMLElement | null {
  const body = element.ownerDocument.body;
  let current: HTMLElement | null = element;
  while (current?.parentElement && current.parentElement !== body) current = current.parentElement;
  return current?.parentElement === body ? current : null;
}

function rememberBackground(state: LayerDocumentState, element: HTMLElement): boolean {
  const remembered = state.backgroundSnapshots.get(element);
  if (remembered !== undefined) return remembered;
  const hadInert = element.hasAttribute("inert");
  state.backgroundSnapshots.set(element, hadInert);
  return hadInert;
}

function setManagedInert(state: LayerDocumentState, element: HTMLElement, inert: boolean): void {
  const originallyInert = rememberBackground(state, element);
  if (inert || originallyInert) element.setAttribute("inert", "");
  else element.removeAttribute("inert");
}

function restoreBackground(state: LayerDocumentState): void {
  state.backgroundSnapshots.forEach((hadInert, element) => {
    if (hadInert) element.setAttribute("inert", "");
    else element.removeAttribute("inert");
  });
  state.backgroundSnapshots.clear();
  state.mutationObserver?.disconnect();
  state.mutationObserver = null;
}

function updateBackground(state: LayerDocumentState): void {
  const activeModal = topModal(state);
  const body = state.document.body;
  if (!body || !activeModal) {
    restoreBackground(state);
    return;
  }
  const allowedBodyChildren = new Set(
    layerContainers(state, activeModal)
      .map(bodyChildFor)
      .filter((element): element is HTMLElement => element !== null),
  );
  Array.from(body.children).forEach((child) => {
    if (!isOwnerElement(state.document, child)) return;
    setManagedInert(state, child, !allowedBodyChildren.has(child));
  });
  if (!state.mutationObserver) {
    const Observer = ownerWindow(state.document)?.MutationObserver;
    if (Observer) {
      const observer = new Observer(() => updateBackground(state));
      observer.observe(body, { childList: true });
      state.mutationObserver = observer;
    }
  }
}

function updateLayerState(state: LayerDocumentState): void {
  const activeModal = topModal(state);
  state.entries.forEach((entry) => {
    if (entry.mode !== "modal") return;
    const active = entry === activeModal;
    if (active) entry.panel.removeAttribute("inert");
    else entry.panel.setAttribute("inert", "");
    entry.panel.setAttribute("aria-modal", active ? "true" : "false");
    if (active) entry.panel.removeAttribute("aria-hidden");
    else entry.panel.setAttribute("aria-hidden", "true");
  });
  updateBackground(state);
}

function lockBody(state: LayerDocumentState): void {
  state.bodyLockCount += 1;
  if (state.bodyLockCount !== 1) return;
  const body = state.document.body;
  if (!body) return;
  state.bodyLockSnapshot = { overflow: body.style.overflow, paddingRight: body.style.paddingRight };
  const view = ownerWindow(state.document);
  const scrollbarWidth = Math.max(0, (view?.innerWidth ?? 0) - state.document.documentElement.clientWidth);
  const currentPadding = Number.parseFloat(view?.getComputedStyle(body).paddingRight ?? "") || 0;
  body.style.overflow = "hidden";
  if (scrollbarWidth > 0) body.style.paddingRight = `${currentPadding + scrollbarWidth}px`;
}

function unlockBody(state: LayerDocumentState): void {
  state.bodyLockCount = Math.max(0, state.bodyLockCount - 1);
  if (state.bodyLockCount !== 0 || !state.bodyLockSnapshot) return;
  const body = state.document.body;
  if (body) {
    body.style.overflow = state.bodyLockSnapshot.overflow;
    body.style.paddingRight = state.bodyLockSnapshot.paddingRight;
  }
  state.bodyLockSnapshot = null;
}

function resolveRestoreFocus(state: LayerDocumentState, entry: LayerEntry, candidate: HTMLElement | null): HTMLElement | null {
  if (!candidate) return null;
  const activeDescendant = [...state.entries].reverse().find((registered) => (
    isLayerDescendant(state, registered, entry.id) && registered.panel.contains(candidate)
  ));
  return activeDescendant?.restoreFocusTo ?? candidate;
}

function registerLayer(state: LayerDocumentState, entry: LayerEntry): void {
  if (state.entries.some((candidate) => candidate.id === entry.id)) return;
  const firstDescendantIndex = state.entries.findIndex((registered) => isLayerDescendant(state, registered, entry.id));
  if (firstDescendantIndex >= 0) state.entries.splice(firstDescendantIndex, 0, entry);
  else state.entries.push(entry);
  if (entry.mode === "modal") lockBody(state);
  updateLayerState(state);
}

interface UnregisteredLayer {
  removed?: LayerEntry;
  wasTop: boolean;
}

function unregisterLayer(state: LayerDocumentState, id: symbol): UnregisteredLayer {
  const wasTop = topLayer(state)?.id === id;
  const index = state.entries.findIndex((entry) => entry.id === id);
  const removed = index >= 0 ? state.entries[index] : undefined;
  if (!removed) return { wasTop, removed };
  state.entries.splice(index, 1);
  state.entries.forEach((entry) => {
    if (entry.parentId === removed.id) entry.parentId = removed.parentId;
    if (entry.restoreFocusTo && removed.panel.contains(entry.restoreFocusTo)) {
      entry.restoreFocusTo = removed.restoreFocusTo;
    }
  });
  restorePanel(removed);
  if (removed.mode === "modal") unlockBody(state);
  updateLayerState(state);
  return { wasTop, removed };
}

function restorePageFocus(preferred: HTMLElement | null, closedPanel: HTMLElement): void {
  if (focusAndConfirm(preferred)) return;
  const ownerDocument = closedPanel.ownerDocument;
  const candidates = getTabStops(ownerDocument).filter((element) => !closedPanel.contains(element) && canReceiveFocus(element));
  const NodeConstructor = ownerWindow(ownerDocument)?.Node;
  const following = preferred?.isConnected && NodeConstructor
    ? candidates.find((candidate) => Boolean(preferred.compareDocumentPosition(candidate) & NodeConstructor.DOCUMENT_POSITION_FOLLOWING))
    : undefined;
  const precedingCandidates = preferred?.isConnected && NodeConstructor
    ? candidates.filter((candidate) => Boolean(preferred.compareDocumentPosition(candidate) & NodeConstructor.DOCUMENT_POSITION_PRECEDING))
    : [];
  focusAndConfirm(following ?? precedingCandidates[precedingCandidates.length - 1] ?? candidates[0] ?? null);
}

function focusRemainingLayer(state: LayerDocumentState, preferred: HTMLElement | null): void {
  const remaining = topLayer(state);
  if (!remaining) return;
  const activeModal = topModal(state);
  const preferredAllowed = preferred && (
    remaining.panel.contains(preferred)
    || (activeModal && layerContains(state, activeModal, preferred))
  );
  if (preferredAllowed && focusAndConfirm(preferred)) return;
  const targetEntry = activeModal ?? remaining;
  focusAndConfirm(layerTabStops(state, targetEntry)[0] ?? targetEntry.panel);
}

export interface LayerKernelOptions {
  active: boolean;
  sourceRef: RefObject<HTMLElement>;
  portalRef: RefObject<HTMLElement>;
  panelRef: RefObject<HTMLElement>;
  mode?: LayerMode;
  dismissPolicy: LayerDismissPolicy;
  initialFocus?: LayerInitialFocus;
  onDismiss: (reason: LayerDismissReason) => void;
}

export interface LayerKernelHandle {
  id: symbol;
  captureRestoreFocus: (event: ReactFocusEvent<HTMLElement>) => void;
  dismiss: (reason: LayerDismissReason) => boolean;
  isTopLayer: () => boolean;
}

function dismissReasonAllowed(policy: LayerDismissPolicy, reason: LayerDismissReason): boolean {
  if (reason === "close-control") return policy.closeControl;
  return policy[reason];
}

export function useLayerPortalReady(): boolean {
  return useSyncExternalStore(subscribeToClient, () => true, () => false);
}

export function useLayerPortalTarget(ready: boolean, sourceRef: RefObject<HTMLElement>): HTMLElement | null {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  useClientLayoutEffect(() => {
    const nextTarget = ready ? sourceRef.current?.ownerDocument.body ?? null : null;
    setTarget((current) => current === nextTarget ? current : nextTarget);
  }, [ready, sourceRef]);
  return target;
}

export function LayerParentProvider({ id, children }: { id: symbol; children: ReactNode }) {
  return <LayerParentContext.Provider value={id}>{children}</LayerParentContext.Provider>;
}

export function useLayerKernel({
  active,
  sourceRef,
  portalRef,
  panelRef,
  mode = "modal",
  dismissPolicy,
  initialFocus = "panel",
  onDismiss,
}: LayerKernelOptions): LayerKernelHandle {
  const idRef = useRef(Symbol("pui-layer"));
  const parentId = useContext(LayerParentContext);
  const registeredRef = useRef(false);
  const restoreFocusToRef = useRef<HTMLElement | null>(null);
  const preRegistrationFocusRef = useRef<HTMLElement | null>(null);
  const ownerDocumentRef = useRef<Document | null>(null);
  const dismissPolicyRef = useRef(dismissPolicy);
  const initialFocusRef = useRef(initialFocus);
  const onDismissRef = useRef(onDismiss);
  dismissPolicyRef.current = dismissPolicy;
  initialFocusRef.current = initialFocus;
  onDismissRef.current = onDismiss;

  usePersonalUiPortalTokens(active, sourceRef, portalRef);

  useClientLayoutEffect(() => {
    const ownerDocument = sourceRef.current?.ownerDocument ?? panelRef.current?.ownerDocument;
    if (!ownerDocument) return;
    ownerDocumentRef.current = ownerDocument;
    return subscribeToActivation(ownerDocument);
  }, [panelRef, sourceRef]);

  const isTopLayer = () => {
    const ownerDocument = ownerDocumentRef.current ?? panelRef.current?.ownerDocument;
    return Boolean(ownerDocument && topLayer(documentState(ownerDocument))?.id === idRef.current);
  };
  const dismiss = (reason: LayerDismissReason) => {
    if (!isTopLayer() || !dismissReasonAllowed(dismissPolicyRef.current, reason)) return false;
    onDismissRef.current(reason);
    return true;
  };

  useClientLayoutEffect(() => {
    if (!active) {
      restoreFocusToRef.current = null;
      preRegistrationFocusRef.current = null;
      return;
    }
    const panel = panelRef.current;
    if (!panel) return;
    const ownerDocument = panel.ownerDocument;
    const state = documentState(ownerDocument);
    ownerDocumentRef.current = ownerDocument;
    const activeElement = isOwnerElement(ownerDocument, ownerDocument.activeElement) ? ownerDocument.activeElement : null;
    const activation = state.latestActivation;
    state.latestActivation = null;
    const activationTarget = activation
      && Date.now() - activation.capturedAt < 1_000
      && activation.target.isConnected
      && !panel.contains(activation.target)
      ? activation.target
      : null;
    const restoreCandidate = activationTarget
      ?? (restoreFocusToRef.current?.isConnected
        ? restoreFocusToRef.current
        : activeElement && !panel.contains(activeElement) ? activeElement : null);
    const entry: LayerEntry = {
      id: idRef.current,
      parentId,
      panel,
      mode,
      restoreFocusTo: null,
      panelSnapshot: snapshotPanel(panel),
    };
    entry.restoreFocusTo = resolveRestoreFocus(state, entry, restoreCandidate);
    registerLayer(state, entry);
    registeredRef.current = true;

    const currentActive = isOwnerElement(ownerDocument, ownerDocument.activeElement) ? ownerDocument.activeElement : null;
    if (topLayer(state)?.id === entry.id && (!currentActive || !layerContains(state, entry, currentActive) || !isVisibleElement(currentActive))) {
      const preRegistrationFocus = preRegistrationFocusRef.current;
      const target = preRegistrationFocus?.isConnected
        && panel.contains(preRegistrationFocus)
        && canReceiveFocus(preRegistrationFocus)
        ? preRegistrationFocus
        : initialFocusTarget(entry, initialFocusRef.current);
      focusAndConfirm(target) || focusAndConfirm(panel);
    }
    preRegistrationFocusRef.current = null;

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.defaultPrevented || topLayer(state)?.id !== entry.id) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        dismiss("escape");
        return;
      }
      if (entry.mode !== "modal" || event.key !== "Tab") return;
      const focusable = layerTabStops(state, entry);
      if (!focusable.length) {
        event.preventDefault();
        panel.focus({ preventScroll: true });
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeIndex = focusable.indexOf(ownerDocument.activeElement as HTMLElement);
      if (event.shiftKey && activeIndex <= 0) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!event.shiftKey && (activeIndex === -1 || ownerDocument.activeElement === last)) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    };
    const handleFocusIn = (event: FocusEvent) => {
      if (entry.mode !== "modal" || topModal(state)?.id !== entry.id) return;
      const target = event.target;
      if (isOwnerElement(ownerDocument, target) && layerContains(state, entry, target)) return;
      focusAndConfirm(initialFocusTarget(entry, initialFocusRef.current)) || focusAndConfirm(panel);
    };
    ownerDocument.addEventListener("keydown", handleKeyDown);
    ownerDocument.addEventListener("focusin", handleFocusIn);
    return () => {
      ownerDocument.removeEventListener("keydown", handleKeyDown);
      ownerDocument.removeEventListener("focusin", handleFocusIn);
      registeredRef.current = false;
      const { removed, wasTop } = unregisterLayer(state, entry.id);
      if (!removed || !wasTop) return;
      const restoreFocus = () => {
        if (state.entries.length) focusRemainingLayer(state, removed.restoreFocusTo);
        else restorePageFocus(removed.restoreFocusTo, removed.panel);
      };
      const view = ownerWindow(ownerDocument);
      if (view?.requestAnimationFrame) view.requestAnimationFrame(() => restoreFocus());
      else if (view?.queueMicrotask) view.queueMicrotask(restoreFocus);
      else queueMicrotask(restoreFocus);
    };
  }, [active, mode, panelRef, parentId]);

  return {
    id: idRef.current,
    captureRestoreFocus: (event) => {
      const focusedTarget = event.target;
      if (!registeredRef.current && isOwnerElement(event.currentTarget.ownerDocument, focusedTarget) && event.currentTarget.contains(focusedTarget)) {
        preRegistrationFocusRef.current = focusedTarget;
      }
      if (registeredRef.current || restoreFocusToRef.current) return;
      const previousTarget = event.relatedTarget;
      if (isOwnerElement(event.currentTarget.ownerDocument, previousTarget) && previousTarget.isConnected && !event.currentTarget.contains(previousTarget)) {
        restoreFocusToRef.current = previousTarget;
      }
    },
    dismiss,
    isTopLayer,
  };
}
