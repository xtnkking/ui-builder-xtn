import type { PublicControlProps } from "../foundation/contracts";
import { sanitizeFixedControlProps } from "../internal/fixed-control-props";
import { cx } from "../internal/utils";

export type TableCellTextProps = PublicControlProps<{
  children: string | number;
  secondary?: string | number;
  numeric?: boolean;
  emphasis?: boolean;
  wrap?: boolean;
}>;

/** Consistent primary and optional supporting text for DataTable and TreeTable cells. */
export function TableCellText(rawProps: TableCellTextProps) {
  const {
    children,
    secondary,
    numeric = false,
    emphasis = false,
    wrap = false,
  } = sanitizeFixedControlProps(rawProps);

  return (
    <span
      className={cx(
        "ui-table-cell-text",
        numeric && "ui-table-cell-text--numeric",
        emphasis && "ui-table-cell-text--emphasis",
        wrap && "ui-table-cell-text--wrap",
      )}
      data-ui-owner="TableCellText"
    >
      <span className="ui-table-cell-text__primary" title={String(children)}>{children}</span>
      {secondary !== undefined ? (
        <span className="ui-table-cell-text__secondary" title={String(secondary)}>{secondary}</span>
      ) : null}
    </span>
  );
}
