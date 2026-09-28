import { useId } from "react";
import { ChevronDown } from "lucide-react";
import type { CollapseProps } from "../foundation/layout";
import { useControllableState } from "./controllable-state";
import { cx } from "./utils";

export type InternalCollapseProps = CollapseProps & {
  internalClassName?: string;
};

export function InternalCollapse({
  title,
  open,
  defaultOpen,
  onOpenChange,
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
  const Heading = `h${headingLevel}` as "h2" | "h3" | "h4" | "h5" | "h6";
  const toggle = () => {
    if (!disabled) setExpanded((current) => !current);
  };

  return (
    <div {...props} data-pui-owner="Collapse" className={cx("pui-collapse", internalClassName)} data-open={expanded || undefined}>
      <Heading className="pui-collapse__heading">
        <button
          id={triggerId}
          type="button"
          className="pui-collapse__trigger"
          aria-expanded={expanded}
          aria-controls={panelId}
          disabled={disabled}
          onClick={toggle}
        >
          <span>{title}</span>
          <ChevronDown aria-hidden="true" />
        </button>
      </Heading>
      {!unmountOnExit || expanded ? (
        <div id={panelId} className="pui-collapse__panel" role="region" aria-labelledby={triggerId} hidden={!expanded}>
          <div className="pui-collapse__content">{children}</div>
        </div>
      ) : null}
    </div>
  );
}
