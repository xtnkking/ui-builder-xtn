import { createRef } from "react";
import { TableCellText, type TableCellTextProps } from "../../src/ui";

const scalarText: TableCellTextProps = { children: 0, secondary: 0, numeric: true, emphasis: false, wrap: true };
const supported = <TableCellText secondary="辅助说明" numeric emphasis wrap>00001001</TableCellText>;
// @ts-expect-error cell text owns its font and geometry
const className = <TableCellText className="foreign">文本</TableCellText>;
// @ts-expect-error cell text does not accept application inline styles
const style = <TableCellText style={{ fontSize: 40 }}>文本</TableCellText>;
// @ts-expect-error CSS-in-JS cannot override canonical typography
const css = <TableCellText css={{ color: "red" }}>文本</TableCellText>;
// @ts-expect-error sx cannot override canonical typography
const sx = <TableCellText sx={{ fontSize: 40 }}>文本</TableCellText>;
// @ts-expect-error utility classes cannot override canonical typography
const tw = <TableCellText tw="font-mono">文本</TableCellText>;
// @ts-expect-error no mutable DOM styling handle is exposed
const ref = <TableCellText ref={createRef<HTMLSpanElement>()}>文本</TableCellText>;
// @ts-expect-error no raw HTML injection is exposed
const html = <TableCellText dangerouslySetInnerHTML={{ __html: "unsafe" }}>文本</TableCellText>;
// @ts-expect-error ownership is component-owned
const owner = <TableCellText data-ui-owner="Consumer">文本</TableCellText>;
// @ts-expect-error private slots are never public
const slot = <TableCellText data-ui-slot="foreign">文本</TableCellText>;
// @ts-expect-error primary content is scalar, compose buttons/tags in the cell instead
const node = <TableCellText><strong>文本</strong></TableCellText>;
// @ts-expect-error supporting text has the same scalar boundary
const secondaryNode = <TableCellText secondary={<small>辅助</small>}>文本</TableCellText>;
// @ts-expect-error numeric is an explicit boolean option, not a formatting pattern
const numeric = <TableCellText numeric="currency">12</TableCellText>;
// @ts-expect-error the primary value is required
const missing = <TableCellText secondary="辅助" />;

void scalarText;
void supported;
void className;
void style;
void css;
void sx;
void tw;
void ref;
void html;
void owner;
void slot;
void node;
void secondaryNode;
void numeric;
void missing;
