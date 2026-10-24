import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { CollapseProps } from "../foundation/layout";
import { useControllableState } from "./controllable-state";
import { useMotionPresence } from "./motion";
import { cx } from "./utils";

const useClientLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export type InternalCollapseProps = CollapseProps & {
  internalClassName?: string;
};

export function InternalCollapse({
  title,
  open,
  defaultOpen,
  onOpenChange,
  bordered = true,
  disabled = false,
  headingLevel = 3,
  unmountOnExit = false,
  internalClassName,
  children,
  ...props
}: InternalCollapseProps) {
  const generatedId = useId();
  const controlled = open !== undefined;
  const [expanded, setExpanded] = useControllableState({
    componentName: "Collapse",
    controlled,
    value: open,
    defaultValue: defaultOpen ?? false,
    defaultValueProvided: defaultOpen !== undefined,
    onChange: onOpenChange,
    valuePropName: "open",
    defaultValuePropName: "defaultOpen",
    changePropName: "onOpenChange",
  });
  const triggerId = `${generatedId}-trigger`;
  const panelId = `${generatedId}-panel`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const initiallyExpanded = useRef(expanded);
  const [interactive, setInteractive] = useState(expanded);
  const [visualExpanded, setVisualExpanded] = useState(expanded);
  const presence = useMotionPresence(expanded, panelRef, "collapse");
  useClientLayoutEffect(() => {
    const panel = panelRef.current;
    if (!expanded) {
      initiallyExpanded.current = false;
      // Handoff must happen before the retained exit content becomes inert/hidden.
      if (panel?.contains(panel.ownerDocument.activeElement)) {
        triggerRef.current?.focus({ preventScroll: true });
        if (panel.contains(panel.ownerDocument.activeElement)) (panel.ownerDocument.activeElement as HTMLElement)?.blur();
      }
      setInteractive(false);
      setVisualExpanded(false);
      panel?.setAttribute("inert", "");
      return;
    }
    setInteractive(true);
    panel?.removeAttribute("inert");
    if (initiallyExpanded.current) return;
    const view = panel?.ownerDocument.defaultView;
    if (!view || panel?.ownerDocument.hidden || view.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setVisualExpanded(true);
      return;
    }
    // One layout boundary establishes0fr before opening. Transitions interpolate
    // from the current row size when reversed; no fixed content height is stored.
    const frame = view.requestAnimationFrame(() => {
      if (panelRef.current) void panelRef.current.offsetHeight;
      setVisualExpanded(true);
    });
    return () => view.cancelAnimationFrame(frame);
  }, [expanded, presence.present]);
  const Heading = `h${headingLevel}` as "h2" | "h3" | "h4" | "h5" | "h6";
  const toggle = () => {
    if (!disabled) setExpanded((current) => !current);
  };

  return (
    <div {...props} data-ui-owner="Collapse" className={cx("ui-collapse", internalClassName)} data-open={expanded || undefined} data-bordered={bordered}>
      <Heading className="ui-collapse__heading">
        <button
          ref={triggerRef}
          id={triggerId}
          type="button"
          className="ui-collapse__trigger"
          aria-expanded={expanded}
          aria-controls={panelId}
          disabled={disabled}
          onClick={toggle}
        >
          <span>{title}</span>
          <ChevronDown aria-hidden="true" />
        </button>
      </Heading>
      {!unmountOnExit || presence.present || interactive ? (
        <div
          ref={panelRef}
          id={panelId}
          className="ui-collapse__panel"
          role="region"
          aria-labelledby={triggerId}
          aria-hidden={!interactive || undefined}
          hidden={!presence.present && !interactive}
          data-ui-motion={initiallyExpanded.current && expanded ? "open" : presence.state}
          data-ui-motion-profile="collapse"
          data-ui-collapse-expanded={expanded && visualExpanded || undefined}
        >
          <div className="ui-collapse__content"><div className="ui-collapse__body">{children}</div></div>
        </div>
      ) : null}
    </div>
  );
}
