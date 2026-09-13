import {
  Children,
  Fragment,
  cloneElement,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown, X } from "lucide-react";
import { floatingPortalTarget, usePopoverPosition } from "./floating-position";
import { observeComputedStyleChanges, usePersonalUiPortalTokens } from "./portal-tokens";
import { Button, IconButton } from "./primitives";
import { assertUniqueIdentities, cx, getTabStops, isVisibleElement } from "./utils";

const useClientLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

interface ModalEntry {
  id: symbol;
  parentId: symbol | null;
  panel: HTMLElement;
  restoreFocusTo: HTMLElement | null;
}

const ModalParentContext = createContext<symbol | null>(null);
const modalStack: ModalEntry[] = [];
let bodyLockSnapshot: { overflow: string; paddingRight: string } | null = null;

const subscribeToClient = () => () => undefined;

function usePortalReady(): boolean {
  return useSyncExternalStore(subscribeToClient, () => true, () => false);
}

function modalContainers(panel: HTMLElement): HTMLElement[] {
  const containers: HTMLElement[] = [panel];
  const discovered = new Set(containers);
  for (let index = 0; index < containers.length; index += 1) {
    containers[index].querySelectorAll<HTMLElement>("[aria-controls]").forEach((controller) => {
      controller.getAttribute("aria-controls")?.trim().split(/\s+/).forEach((controlledId) => {
        const floatingRoot = document.getElementById(controlledId)?.closest<HTMLElement>("[data-pui-floating-root='true']");
        if (!floatingRoot || discovered.has(floatingRoot)) return;
        discovered.add(floatingRoot);
        containers.push(floatingRoot);
      });
    });
  }
  document.querySelectorAll<HTMLElement>(".pui-toast-viewport").forEach((viewport) => {
    if (!containers.includes(viewport)) containers.push(viewport);
  });
  return containers;
}

function modalContains(panel: HTMLElement, element: HTMLElement): boolean {
  return modalContainers(panel).some((container) => container.contains(element));
}

function modalFocusables(panel: HTMLElement): HTMLElement[] {
  const containers = modalContainers(panel);
  return getTabStops(document, (element) => (
    containers.some((container) => container.contains(element))
  ));
}

function canRestoreFocus(element: HTMLElement | null): element is HTMLElement {
  return Boolean(
    element?.isConnected
    && !element.matches(":disabled")
    && !element.closest("[inert], [aria-hidden='true']")
    && isVisibleElement(element),
  );
}

function focusAndConfirm(element: HTMLElement | null): boolean {
  if (!canRestoreFocus(element)) return false;
  element.focus();
  return document.activeElement === element;
}

function restorePageFocus(preferred: HTMLElement | null, closedPanel: HTMLElement): void {
  if (focusAndConfirm(preferred)) return;
  const candidates = getTabStops(document)
    .filter((element) => (
      !closedPanel.contains(element)
      && canRestoreFocus(element)
    ));
  const following = preferred?.isConnected
    ? candidates.find((candidate) => Boolean(preferred.compareDocumentPosition(candidate) & Node.DOCUMENT_POSITION_FOLLOWING))
    : undefined;
  const precedingCandidates = preferred?.isConnected
    ? candidates.filter((candidate) => Boolean(preferred.compareDocumentPosition(candidate) & Node.DOCUMENT_POSITION_PRECEDING))
    : [];
  const preceding = precedingCandidates[precedingCandidates.length - 1];
  focusAndConfirm(following ?? preceding ?? candidates[0] ?? null);
}

function updateModalStack(): void {
  const top = modalStack[modalStack.length - 1];
  modalStack.forEach((entry) => {
    const active = entry === top;
    (entry.panel as HTMLElement & { inert: boolean }).inert = !active;
    entry.panel.setAttribute("aria-modal", active ? "true" : "false");
    if (active) entry.panel.removeAttribute("aria-hidden");
    else entry.panel.setAttribute("aria-hidden", "true");
  });
}

function isModalDescendant(entry: ModalEntry, ancestorId: symbol): boolean {
  const visited = new Set<symbol>();
  let parentId = entry.parentId;
  while (parentId && !visited.has(parentId)) {
    if (parentId === ancestorId) return true;
    visited.add(parentId);
    parentId = modalStack.find((candidate) => candidate.id === parentId)?.parentId ?? null;
  }
  return false;
}

function resolveRestoreFocus(entry: ModalEntry, candidate: HTMLElement | null): HTMLElement | null {
  if (!candidate) return null;
  const activeDescendant = [...modalStack].reverse().find((registered) => (
    isModalDescendant(registered, entry.id) && registered.panel.contains(candidate)
  ));
  return activeDescendant?.restoreFocusTo ?? candidate;
}

function registerModal(entry: ModalEntry): void {
  if (!modalStack.length) {
    const body = document.body;
    bodyLockSnapshot = { overflow: body.style.overflow, paddingRight: body.style.paddingRight };
    const scrollbarWidth = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
    const currentPadding = Number.parseFloat(window.getComputedStyle(body).paddingRight) || 0;
    body.style.overflow = "hidden";
    if (scrollbarWidth > 0) body.style.paddingRight = `${currentPadding + scrollbarWidth}px`;
  }
  const firstDescendantIndex = modalStack.findIndex((registered) => isModalDescendant(registered, entry.id));
  if (firstDescendantIndex >= 0) modalStack.splice(firstDescendantIndex, 0, entry);
  else modalStack.push(entry);
  updateModalStack();
}

function unregisterModal(id: symbol): { wasTop: boolean; top?: ModalEntry; restoreFocusTo: HTMLElement | null } {
  const wasTop = modalStack[modalStack.length - 1]?.id === id;
  const index = modalStack.findIndex((entry) => entry.id === id);
  const removed = index >= 0 ? modalStack[index] : undefined;
  if (removed) {
    modalStack.splice(index, 1);
    modalStack.forEach((entry) => {
      if (entry.restoreFocusTo && removed.panel.contains(entry.restoreFocusTo)) {
        entry.restoreFocusTo = removed.restoreFocusTo;
      }
    });
  }
  updateModalStack();
  if (!modalStack.length && bodyLockSnapshot) {
    document.body.style.overflow = bodyLockSnapshot.overflow;
    document.body.style.paddingRight = bodyLockSnapshot.paddingRight;
    bodyLockSnapshot = null;
  }
  return {
    wasTop,
    top: modalStack[modalStack.length - 1],
    restoreFocusTo: removed?.restoreFocusTo ?? null,
  };
}

function isTopModal(id: symbol): boolean {
  return modalStack[modalStack.length - 1]?.id === id;
}

interface ModalBehavior {
  id: symbol;
  captureRestoreFocus: (event: ReactFocusEvent<HTMLElement>) => void;
}

function useModalBehavior(open: boolean, onClose: () => void, panelRef: RefObject<HTMLElement>, dismissible = true): ModalBehavior {
  const modalId = useRef(Symbol("pui-modal"));
  const parentId = useContext(ModalParentContext);
  const onCloseRef = useRef(onClose);
  const dismissibleRef = useRef(dismissible);
  const restoreFocusToRef = useRef<HTMLElement | null>(null);
  const preRegistrationFocusRef = useRef<HTMLElement | null>(null);
  const registeredRef = useRef(false);
  useClientLayoutEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useClientLayoutEffect(() => {
    dismissibleRef.current = dismissible;
  }, [dismissible]);
  useClientLayoutEffect(() => {
    if (!open) {
      restoreFocusToRef.current = null;
      preRegistrationFocusRef.current = null;
      return;
    }
    const panel = panelRef.current;
    if (!panel) return;
    const activeElement = document.activeElement as HTMLElement | null;
    const capturedRestoreFocus = restoreFocusToRef.current;
    const restoreCandidate = capturedRestoreFocus?.isConnected
      ? capturedRestoreFocus
      : activeElement && !panel.contains(activeElement)
        ? activeElement
        : null;
    const entry: ModalEntry = {
      id: modalId.current,
      parentId,
      panel,
      restoreFocusTo: null,
    };
    entry.restoreFocusTo = resolveRestoreFocus(entry, restoreCandidate);
    registerModal(entry);
    registeredRef.current = true;
    const currentActive = document.activeElement as HTMLElement | null;
    if (isTopModal(modalId.current) && (!currentActive || !panel.contains(currentActive) || !isVisibleElement(currentActive))) {
      const preRegistrationFocus = preRegistrationFocusRef.current;
      const autofocus = preRegistrationFocus?.isConnected
        && panel.contains(preRegistrationFocus)
        && !preRegistrationFocus.matches(":disabled")
        && isVisibleElement(preRegistrationFocus)
        ? preRegistrationFocus
        : Array.from(panel.querySelectorAll<HTMLElement>("[autofocus]"))
          .find((element) => !element.matches(":disabled") && isVisibleElement(element));
      (autofocus ?? panel).focus();
    }
    preRegistrationFocusRef.current = null;
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (!isTopModal(modalId.current)) return;
      if (event.key === "Escape" && dismissibleRef.current) {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = modalFocusables(panel);
      if (!focusable.length) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeIndex = focusable.indexOf(document.activeElement as HTMLElement);
      if (event.shiftKey && activeIndex <= 0) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (activeIndex === -1 || document.activeElement === last)) {
        event.preventDefault();
        first.focus();
      }
    };
    const handleFocusIn = (event: FocusEvent) => {
      if (!isTopModal(modalId.current)) return;
      const target = event.target;
      if (target instanceof HTMLElement && modalContains(panel, target)) return;
      (modalFocusables(panel)[0] ?? panel).focus();
    };
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("focusin", handleFocusIn);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("focusin", handleFocusIn);
      registeredRef.current = false;
      const { wasTop, top, restoreFocusTo } = unregisterModal(modalId.current);
      if (!wasTop) return;
      const currentTop = modalStack[modalStack.length - 1];
      if (currentTop) {
        if (!top || currentTop.id !== top.id) return;
        const target = restoreFocusTo?.isConnected && currentTop.panel.contains(restoreFocusTo)
          ? restoreFocusTo
          : modalFocusables(top.panel)[0] ?? top.panel;
        if (!focusAndConfirm(target)) {
          focusAndConfirm(modalFocusables(top.panel)[0] ?? top.panel);
        }
      } else {
        restorePageFocus(restoreFocusTo, panel);
      }
    };
  }, [open, panelRef, parentId]);
  return {
    id: modalId.current,
    captureRestoreFocus: (event) => {
      const focusedTarget = event.target;
      if (!registeredRef.current && focusedTarget instanceof HTMLElement && event.currentTarget.contains(focusedTarget)) {
        preRegistrationFocusRef.current = focusedTarget;
      }
      if (registeredRef.current || restoreFocusToRef.current) return;
      const previousTarget = event.relatedTarget;
      if (previousTarget instanceof HTMLElement && previousTarget.isConnected && !event.currentTarget.contains(previousTarget)) {
        restoreFocusToRef.current = previousTarget;
      }
    },
  };
}

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  closable?: boolean;
  width?: "small" | "medium" | "large";
}

export function Dialog({ open, onClose, title, description, children, footer, closable = true, width = "medium" }: DialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const hasBody = Children.toArray(children).length > 0;
  const sourceRef = useRef<HTMLSpanElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const portalReady = usePortalReady() && typeof document !== "undefined";
  usePersonalUiPortalTokens(open && portalReady, sourceRef, portalRef);
  const modal = useModalBehavior(open && portalReady, onClose, panelRef, closable);
  if (!open || !portalReady) return null;
  return (
    <ModalParentContext.Provider value={modal.id}>
      <span ref={sourceRef} hidden aria-hidden="true" data-pui-portal-source="dialog" />
      {createPortal(
        <div ref={portalRef} className="pui-overlay pui-portal" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && isTopModal(modal.id)) {
            event.preventDefault();
            if (closable) onClose();
          }
        }}>
          <div
            ref={panelRef}
            className={cx("pui-dialog", `pui-dialog--${width}`, !hasBody && "pui-dialog--no-body")}
            role="dialog"
            tabIndex={-1}
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description != null ? descriptionId : undefined}
            data-pui-owner="Dialog"
            onFocusCapture={modal.captureRestoreFocus}
          >
            <header className="pui-dialog__header">
              <div>
                <h2 id={titleId} title={typeof title === "string" || typeof title === "number" ? String(title) : undefined}>{title}</h2>
                {description != null ? <p id={descriptionId}>{description}</p> : null}
              </div>
              {closable ? <IconButton aria-label="关闭对话框" icon={<X aria-hidden="true" />} onClick={onClose} /> : null}
            </header>
            {hasBody ? <div className="pui-dialog__body">{children}</div> : null}
            {footer != null ? <footer className="pui-dialog__footer">{footer}</footer> : null}
          </div>
        </div>,
        document.body,
      )}
    </ModalParentContext.Provider>
  );
}

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  closable?: boolean;
  width?: "medium" | "large";
  variant?: "inset" | "edge";
}

export function Drawer({ open, onClose, title, description, children, footer, closable = true, width = "medium", variant = "inset" }: DrawerProps) {
  const titleId = useId();
  const descriptionId = useId();
  const sourceRef = useRef<HTMLSpanElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const portalReady = usePortalReady() && typeof document !== "undefined";
  usePersonalUiPortalTokens(open && portalReady, sourceRef, portalRef);
  const modal = useModalBehavior(open && portalReady, onClose, panelRef, closable);
  if (!open || !portalReady) return null;
  return (
    <ModalParentContext.Provider value={modal.id}>
      <span ref={sourceRef} hidden aria-hidden="true" data-pui-portal-source="drawer" />
      {createPortal(
        <div ref={portalRef} className={cx("pui-overlay", "pui-overlay--drawer", `pui-overlay--drawer-${variant}`, "pui-portal")} role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && isTopModal(modal.id)) {
            event.preventDefault();
            if (closable) onClose();
          }
        }}>
          <aside
            ref={panelRef}
            className={cx("pui-drawer", `pui-drawer--${width}`, `pui-drawer--${variant}`)}
            role="dialog"
            tabIndex={-1}
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description != null ? descriptionId : undefined}
            data-pui-owner="Drawer"
            onFocusCapture={modal.captureRestoreFocus}
          >
            <header className="pui-drawer__header">
              <div>
                <h2 id={titleId} title={typeof title === "string" || typeof title === "number" ? String(title) : undefined}>{title}</h2>
                {description != null ? <p id={descriptionId}>{description}</p> : null}
              </div>
              {closable ? <IconButton aria-label="关闭抽屉" icon={<X aria-hidden="true" />} onClick={onClose} /> : null}
            </header>
            <div className="pui-drawer__body">{children}</div>
            {footer != null ? <footer className="pui-drawer__footer">{footer}</footer> : null}
          </aside>
        </div>,
        document.body,
      )}
    </ModalParentContext.Provider>
  );
}

export interface MenuItem {
  id: string;
  label: ReactNode;
  icon?: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  danger?: boolean;
}

export interface DropdownMenuProps {
  label: ReactNode;
  ariaLabel: string;
  items: MenuItem[];
  icon?: ReactNode;
  align?: "start" | "end";
  className?: string;
}

export function DropdownMenu({ label, ariaLabel, items, icon, align = "end", className }: DropdownMenuProps) {
  assertUniqueIdentities("DropdownMenu", "item.id", items.map((item) => item.id));
  const id = useId();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const typeaheadRef = useRef("");
  const typeaheadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openingEdgeRef = useRef<"first" | "last">("first");
  const hasItemIcons = items.some((item) => item.icon != null);
  const hasEnabledItems = items.some((item) => !item.disabled);
  usePopoverPosition(open, "bottom", rootRef, menuRef, align);

  useEffect(() => { setPortalTarget(floatingPortalTarget(rootRef.current)); }, []);

  const enabledItems = () => Array.from(
    menuRef.current?.querySelectorAll<HTMLButtonElement>(".pui-dropdown__item:not(:disabled)") ?? [],
  );

  const resetTypeahead = () => {
    typeaheadRef.current = "";
    if (typeaheadTimerRef.current) {
      clearTimeout(typeaheadTimerRef.current);
      typeaheadTimerRef.current = null;
    }
  };

  const openMenu = (edge: "first" | "last" = "first") => {
    if (!hasEnabledItems) return;
    resetTypeahead();
    openingEdgeRef.current = edge;
    setOpen(true);
  };

  const closeMenu = (restoreFocus = false) => {
    resetTypeahead();
    if (restoreFocus) triggerRef.current?.focus({ preventScroll: true });
    setOpen(false);
  };

  useEffect(() => {
    if (!hasEnabledItems) setOpen(false);
  }, [hasEnabledItems]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | FocusEvent) => {
      if (!rootRef.current?.contains(event.target as Node) && !menuRef.current?.contains(event.target as Node)) closeMenu();
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("focusin", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("focusin", close);
    };
  }, [open]);

  useClientLayoutEffect(() => {
    if (!open) return;
    const available = enabledItems();
    if (!available.length) {
      triggerRef.current?.focus({ preventScroll: true });
      return;
    }
    if (available.includes(document.activeElement as HTMLButtonElement)) return;
    available[openingEdgeRef.current === "first" ? 0 : available.length - 1]?.focus({ preventScroll: true });
  }, [items, open]);

  useEffect(() => () => {
    if (typeaheadTimerRef.current) clearTimeout(typeaheadTimerRef.current);
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      if (!open) return;
      event.preventDefault();
      closeMenu(true);
      return;
    }
    const target = event.target as HTMLElement;
    if (target === triggerRef.current && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault();
      openMenu(event.key === "ArrowDown" ? "first" : "last");
      return;
    }
    if (!open) return;
    if (event.key === "Tab") {
      // Menu items use roving focus and are intentionally absent from the
      // document tab order. Re-anchor focus before the browser resolves the
      // next sequential target, including inside a modal focus trap.
      closeMenu(true);
      return;
    }
    const available = enabledItems();
    if (!available.length) return;
    const currentIndex = available.indexOf(target as HTMLButtonElement);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      const next = currentIndex < 0 ? (direction === 1 ? 0 : available.length - 1) : (currentIndex + direction + available.length) % available.length;
      available[next]?.focus({ preventScroll: true });
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      available[event.key === "Home" ? 0 : available.length - 1]?.focus({ preventScroll: true });
      return;
    }
    if (event.nativeEvent.isComposing || event.key.length !== 1 || event.altKey || event.ctrlKey || event.metaKey) return;
    typeaheadRef.current += event.key.toLocaleLowerCase();
    if (typeaheadTimerRef.current) clearTimeout(typeaheadTimerRef.current);
    typeaheadTimerRef.current = setTimeout(() => { typeaheadRef.current = ""; }, 500);
    const match = available.find((item) => item.textContent?.trim().toLocaleLowerCase().startsWith(typeaheadRef.current));
    if (match) {
      event.preventDefault();
      match.focus({ preventScroll: true });
    }
  };

  return (
    <div ref={rootRef} className={cx("pui-dropdown", className)} data-pui-owner="DropdownMenu" onKeyDown={handleKeyDown}>
      <Button
        ref={triggerRef}
        icon={icon}
        trailingIcon={<ChevronDown aria-hidden="true" />}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        disabled={!hasEnabledItems}
        onClick={() => open ? closeMenu() : openMenu()}
      >
        <span
          className="pui-dropdown__trigger-label"
          title={typeof label === "string" || typeof label === "number" ? String(label) : undefined}
        >
          {label}
        </span>
      </Button>
      {open && portalTarget ? createPortal(
        <div
          ref={menuRef}
          id={id}
          className={cx("pui-dropdown__menu", `pui-dropdown__menu--${align}`, "pui-portal")}
          role="menu"
          aria-label={ariaLabel}
          data-pui-floating-root="true"
        >
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              tabIndex={-1}
              className={cx("pui-dropdown__item", item.danger && "is-danger")}
              disabled={item.disabled}
              onClick={() => {
                closeMenu(true);
                item.onSelect();
              }}
            >
              {hasItemIcons ? <span className="pui-dropdown__item-icon" aria-hidden="true">{item.icon}</span> : null}
              <span
                className="pui-dropdown__item-label"
                title={typeof item.label === "string" || typeof item.label === "number" ? String(item.label) : undefined}
              >
                {item.label}
              </span>
            </button>
          ))}
        </div>, portalTarget) : null}
    </div>
  );
}

export interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  placement?: "top" | "right" | "bottom" | "left";
  disabled?: boolean;
  ariaLabel?: string;
  fill?: boolean;
  "data-pui-owner"?: string;
}

interface TooltipChildProps {
  "aria-describedby"?: string;
  contentEditable?: boolean | "true" | "false" | "plaintext-only";
  controls?: boolean;
  disabled?: boolean;
  href?: string;
  tabIndex?: number;
  type?: string;
}

const tooltipFocusTargetSelector = [
  "a[href]",
  "area[href]",
  "button:not(:disabled)",
  "input:not(:disabled):not([type='hidden'])",
  "select:not(:disabled)",
  "textarea:not(:disabled)",
  "summary",
  "iframe",
  "object",
  "embed",
  "audio[controls]",
  "video[controls]",
  "[contenteditable='true']",
  "[contenteditable='plaintext-only']",
  "[tabindex]",
].join(",");

function tooltipDescriptionTargets(trigger: HTMLElement): HTMLElement[] {
  return Array.from(trigger.querySelectorAll<HTMLElement>(tooltipFocusTargetSelector)).filter((element) => (
    !element.matches(":disabled")
    && !element.closest("[inert], [aria-hidden='true']")
    && isVisibleElement(element)
  ));
}

function tooltipNativeChildIsKeyboardReachable(child: ReactNode): child is ReactElement<TooltipChildProps> {
  if (!isValidElement<TooltipChildProps>(child) || child.type === Fragment || child.props.disabled) return false;
  // Custom components may ignore aria-describedby or render a completely
  // different focus target. Their actual DOM is inspected after mount.
  if (typeof child.type !== "string") return false;
  if (typeof child.props.tabIndex === "number") return child.props.tabIndex >= 0;
  if (
    child.props.contentEditable === true
    || child.props.contentEditable === "true"
    || child.props.contentEditable === "plaintext-only"
  ) return true;
  const elementName = child.type.toLocaleLowerCase();
  if (["button", "select", "textarea", "summary", "iframe", "object", "embed"].includes(elementName)) return true;
  if (elementName === "input") return child.props.type?.toLocaleLowerCase() !== "hidden";
  if (elementName === "a" || elementName === "area") return Boolean(child.props.href);
  if (elementName === "audio" || elementName === "video") return Boolean(child.props.controls);
  return false;
}

export function Tooltip({ content, children, placement = "top", disabled, ariaLabel, fill, "data-pui-owner": owner = "Tooltip" }: TooltipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const rootRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const bubbleRef = useRef<HTMLSpanElement>(null);
  usePersonalUiPortalTokens(!disabled && portalTarget !== null, rootRef, bubbleRef);
  const describedTargetsRef = useRef<Set<HTMLElement>>(new Set());
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nativeChildIsKeyboardReachable = tooltipNativeChildIsKeyboardReachable(children);
  const [hasFocusableDescendant, setHasFocusableDescendant] = useState(nativeChildIsKeyboardReachable);
  useEffect(() => {
    setPortalTarget(floatingPortalTarget(rootRef.current));
  }, []);
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);
  const cancelScheduledClose = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
  };
  const scheduleClose = () => {
    cancelScheduledClose();
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null;
      setOpen(false);
    }, 100);
  };
  useEffect(() => {
    if (!open) return;
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      cancelScheduledClose();
      setOpen(false);
    };
    document.addEventListener("keydown", handleEscape, true);
    return () => document.removeEventListener("keydown", handleEscape, true);
  }, [open]);
  useEffect(() => () => cancelScheduledClose(), []);
  useClientLayoutEffect(() => {
    const bubble = bubbleRef.current;
    const trigger = triggerRef.current;
    if (!open || disabled || !bubble || !trigger) return;
    let animationFrame = 0;
    const keepInsideViewport = () => {
      bubble.removeAttribute("data-positioned");
      const triggerRect = trigger.getBoundingClientRect();
      const bubbleRect = bubble.getBoundingClientRect();
      const viewportWidth = document.documentElement.clientWidth;
      const viewportHeight = document.documentElement.clientHeight;
      const margin = 12;
      const gap = 7;
      const opposite = { top: "bottom", right: "left", bottom: "top", left: "right" } as const;
      const calculate = (side: TooltipProps["placement"]) => {
        if (side === "right") {
          return { left: triggerRect.right + gap, top: triggerRect.top + (triggerRect.height - bubbleRect.height) / 2 };
        }
        if (side === "bottom") {
          return { left: triggerRect.left + (triggerRect.width - bubbleRect.width) / 2, top: triggerRect.bottom + gap };
        }
        if (side === "left") {
          return { left: triggerRect.left - gap - bubbleRect.width, top: triggerRect.top + (triggerRect.height - bubbleRect.height) / 2 };
        }
        return { left: triggerRect.left + (triggerRect.width - bubbleRect.width) / 2, top: triggerRect.top - gap - bubbleRect.height };
      };
      const fitsMainAxis = (side: TooltipProps["placement"], position: { left: number; top: number }) => (
        side === "top" ? position.top >= margin
          : side === "right" ? position.left + bubbleRect.width <= viewportWidth - margin
            : side === "bottom" ? position.top + bubbleRect.height <= viewportHeight - margin
              : position.left >= margin
      );
      let resolvedPlacement = placement;
      let position = calculate(resolvedPlacement);
      if (!fitsMainAxis(resolvedPlacement, position)) {
        const alternate = opposite[resolvedPlacement];
        const alternatePosition = calculate(alternate);
        if (fitsMainAxis(alternate, alternatePosition)) {
          resolvedPlacement = alternate;
          position = alternatePosition;
        }
      }
      const maxLeft = Math.max(margin, viewportWidth - margin - bubbleRect.width);
      const maxTop = Math.max(margin, viewportHeight - margin - bubbleRect.height);
      const left = Math.min(Math.max(position.left, margin), maxLeft);
      const top = Math.min(Math.max(position.top, margin), maxTop);
      bubble.style.left = `${Math.round(left * 100) / 100}px`;
      bubble.style.top = `${Math.round(top * 100) / 100}px`;
      bubble.dataset.placement = resolvedPlacement;
      bubble.dataset.positioned = "true";
    };
    const scheduleUpdate = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(keepInsideViewport);
    };
    keepInsideViewport();
    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("scroll", scheduleUpdate, true);
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(scheduleUpdate) : null;
    observer?.observe(bubble);
    observer?.observe(trigger);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("scroll", scheduleUpdate, true);
      observer?.disconnect();
      bubble.removeAttribute("data-positioned");
    };
  }, [content, disabled, open, placement, portalTarget]);
  useClientLayoutEffect(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const removeDescription = (element: HTMLElement) => {
      const remaining = (element.getAttribute("aria-describedby") ?? "")
        .trim()
        .split(/\s+/)
        .filter((token) => token && token !== id);
      if (remaining.length) element.setAttribute("aria-describedby", [...new Set(remaining)].join(" "));
      else element.removeAttribute("aria-describedby");
    };
    const syncTargets = () => {
      const currentTrigger = triggerRef.current;
      if (!currentTrigger) return;
      const nextTargets = new Set(tooltipDescriptionTargets(currentTrigger));
      const hasTabStop = getTabStops(currentTrigger).length > 0;
      setHasFocusableDescendant((current) => current === hasTabStop ? current : hasTabStop);
      describedTargetsRef.current.forEach((element) => {
        if (disabled || !nextTargets.has(element)) removeDescription(element);
      });
      if (!disabled) {
        nextTargets.forEach((element) => {
          const tokens = (element.getAttribute("aria-describedby") ?? "")
            .trim()
            .split(/\s+/)
            .filter(Boolean);
          element.setAttribute("aria-describedby", [...new Set([...tokens, id])].join(" "));
        });
      }
      describedTargetsRef.current = disabled ? new Set() : nextTargets;
    };
    syncTargets();

    const observer = typeof MutationObserver === "function"
      ? new MutationObserver(syncTargets)
      : null;
    observer?.observe(trigger, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: [
        "disabled",
        "hidden",
        "href",
        "tabindex",
        "contenteditable",
        "aria-hidden",
        "inert",
        "controls",
        "type",
        "class",
        "style",
      ],
    });
    return () => observer?.disconnect();
  }, [disabled, id, nativeChildIsKeyboardReachable]);
  useEffect(() => () => {
    describedTargetsRef.current.forEach((element) => {
      const remaining = (element.getAttribute("aria-describedby") ?? "")
        .trim()
        .split(/\s+/)
        .filter((token) => token && token !== id);
      if (remaining.length) element.setAttribute("aria-describedby", [...new Set(remaining)].join(" "));
      else element.removeAttribute("aria-describedby");
    });
    describedTargetsRef.current.clear();
  }, [id]);
  const childCanOwnDescription = isValidElement<TooltipChildProps>(children)
    && children.type !== Fragment
    && typeof children.type === "string";
  const existingDescription = childCanOwnDescription
    ? (children as ReactElement<{ "aria-describedby"?: string }>).props["aria-describedby"]
    : undefined;
  const describedBy = disabled
    ? existingDescription
    : [...new Set(
        [existingDescription, id]
          .filter((value): value is string => Boolean(value))
          .flatMap((value) => value.trim().split(/\s+/))
          .filter(Boolean),
      )].join(" ") || undefined;
  const fallbackTriggerLabel = ariaLabel ?? (
    typeof content === "string" || typeof content === "number"
      ? String(content)
      : "更多信息"
  );
  const child = nativeChildIsKeyboardReachable
    ? cloneElement(children as ReactElement<{ "aria-describedby"?: string }>, {
        "aria-describedby": describedBy,
      })
    : children;
  return (
    <span
      ref={rootRef}
      className={cx("pui-tooltip", fill && "pui-tooltip--fill")}
      data-placement={placement}
      data-open={!disabled && open || undefined}
      data-pui-owner={owner}
      onMouseEnter={() => {
        cancelScheduledClose();
        if (!disabled) setOpen(true);
      }}
      onMouseLeave={scheduleClose}
      onFocusCapture={() => {
        cancelScheduledClose();
        if (!disabled) setOpen(true);
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
      onKeyDownCapture={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          setOpen(false);
        }
      }}
    >
      <span
        ref={triggerRef}
        className="pui-tooltip__trigger"
        tabIndex={!hasFocusableDescendant && !disabled ? 0 : undefined}
        aria-describedby={!hasFocusableDescendant && !disabled ? describedBy : undefined}
        aria-label={!hasFocusableDescendant && !disabled ? fallbackTriggerLabel : undefined}
      >
        {child}
      </span>
      {!disabled ? (
        portalTarget
          ? createPortal(
              <span
                ref={bubbleRef}
                id={id}
                className="pui-tooltip__bubble pui-portal"
                role="tooltip"
                data-open={open || undefined}
                data-placement={placement}
                onMouseEnter={cancelScheduledClose}
                onMouseLeave={scheduleClose}
              >
                {content}
              </span>,
              portalTarget,
            )
          : (
              <span
                ref={bubbleRef}
                id={id}
                className="pui-tooltip__bubble pui-portal"
                role="tooltip"
                data-open={open || undefined}
                data-placement={placement}
                onMouseEnter={cancelScheduledClose}
                onMouseLeave={scheduleClose}
              >
                {content}
              </span>
            )
      ) : null}
    </span>
  );
}

export interface OverflowTextProps {
  children: string;
  className?: string;
  placement?: TooltipProps["placement"];
}

export function OverflowText({ children, className, placement }: OverflowTextProps) {
  const textRef = useRef<HTMLSpanElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  useClientLayoutEffect(() => {
    const element = textRef.current;
    if (!element) return;
    const measure = () => {
      const nextOverflowing = element.scrollWidth > element.clientWidth + 1;
      setOverflowing((current) => current === nextOverflowing ? current : nextOverflowing);
    };
    measure();
    return observeComputedStyleChanges(element, measure, { observeAncestors: false });
  }, [children]);
  return (
    <Tooltip content={children} placement={placement} disabled={!overflowing} data-pui-owner="OverflowText">
      <span ref={textRef} className={cx("pui-overflow-text", className)} tabIndex={overflowing ? 0 : undefined}>{children}</span>
    </Tooltip>
  );
}
