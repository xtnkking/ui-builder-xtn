interface LayerActivation {
  target: HTMLElement;
  capturedAt: number;
}

interface PendingLayerActivation extends LayerActivation {
  existingDialogs: Set<Element>;
  event?: Event;
  dispose: () => void;
}

export const LAYER_ACTIVATION_WINDOW_MS = 1_000;

const latestActivations = new WeakMap<Document, PendingLayerActivation>();
const consumedEvents = new WeakSet<Event>();

function clearLayerActivation(ownerDocument: Document): void {
  latestActivations.get(ownerDocument)?.dispose();
  latestActivations.delete(ownerDocument);
}

export function recordLayerActivation(ownerDocument: Document, target: HTMLElement | null, event?: Event): void {
  if (event && consumedEvents.has(event)) return;
  if (!target) {
    clearLayerActivation(ownerDocument);
    return;
  }
  const previous = latestActivations.get(ownerDocument);
  if (event && previous?.event === event && previous.target === target) return;
  const existingDialogs = previous?.target === target
    ? previous.existingDialogs
    : new Set(ownerDocument.querySelectorAll("[role='dialog'][aria-modal='true']"));
  clearLayerActivation(ownerDocument);

  const invalidateOnKeyDown = () => clearLayerActivation(ownerDocument);
  const invalidateOnPointerDown = (event: PointerEvent) => {
    if (!target.contains(event.target as Node)) clearLayerActivation(ownerDocument);
  };
  const invalidateOnFocusIn = (event: FocusEvent) => {
    const next = event.target as Node | null;
    if (!next || !("nodeType" in next) || target.contains(next)) return;
    const focusedElement = next.nodeType === 1 ? next as Element : next.parentElement;
    const focusedDialog = focusedElement?.closest("[role='dialog'][aria-modal='true']");
    if (focusedDialog && !existingDialogs.has(focusedDialog)) return;
    clearLayerActivation(ownerDocument);
  };
  ownerDocument.addEventListener("keydown", invalidateOnKeyDown, true);
  ownerDocument.addEventListener("pointerdown", invalidateOnPointerDown, true);
  ownerDocument.addEventListener("focusin", invalidateOnFocusIn, true);
  const timer = setTimeout(() => clearLayerActivation(ownerDocument), LAYER_ACTIVATION_WINDOW_MS);
  latestActivations.set(ownerDocument, {
    target,
    capturedAt: Date.now(),
    existingDialogs,
    event,
    dispose: () => {
      ownerDocument.removeEventListener("keydown", invalidateOnKeyDown, true);
      ownerDocument.removeEventListener("pointerdown", invalidateOnPointerDown, true);
      ownerDocument.removeEventListener("focusin", invalidateOnFocusIn, true);
      clearTimeout(timer);
    },
  });
}

export function consumeLayerActivation(ownerDocument: Document): LayerActivation | null {
  const activation = latestActivations.get(ownerDocument) ?? null;
  if (activation?.event) consumedEvents.add(activation.event);
  clearLayerActivation(ownerDocument);
  return activation && Date.now() - activation.capturedAt < LAYER_ACTIVATION_WINDOW_MS
    ? { target: activation.target, capturedAt: activation.capturedAt }
    : null;
}
