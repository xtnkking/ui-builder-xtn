// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"color-picker/overview","exports":["ColorPicker"]}
import { useState } from "react";
import { ColorPicker, Field } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

function ColorPickerExample() {
  const [color, setColor] = useState("#2563eb");
  return (
    <div className="demo-number-case__grid">
      <Field label="品牌强调色" group><ColorPicker ariaLabel="品牌强调色" value={color} onValueChange={setColor} swatches={["#2563eb", "#059669", "#dc2626", "#7c3aed"]} /></Field>
      <Field label="锁定颜色" group><ColorPicker ariaLabel="锁定颜色" defaultValue="#64748b" disabled /></Field>
    </div>
  );
}

const explorerCase = {
  id: "color-picker/overview",
  label: "颜色选择",
  summary: "展示受控颜色、预设色板、文本校验和禁用状态。",
  states: ["default", "disabled", "readOnly", "controlled", "uncontrolled", "validation", "longContent", "keyboard", "overlay", "dark", "locale"] as const,
  content: <ColorPickerExample />,
  code: `<ColorPicker ariaLabel="品牌强调色" value={color} onValueChange={setColor} swatches={swatches} />`,
} satisfies ExplorerCase;

export default explorerCase;
