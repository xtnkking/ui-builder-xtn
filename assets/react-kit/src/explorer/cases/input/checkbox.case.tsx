// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"checkbox/overview","exports":["Checkbox"]}
import { useState } from "react";
import { Checkbox, Field } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

function CheckboxExample() {
  const [checked, setChecked] = useState(true);
  return (
    <Field label="通知渠道" group>
      <Checkbox label="产品更新" checked={checked} onChange={(event) => setChecked(event.currentTarget.checked)} />
      <Checkbox label="安全告警（不可关闭）" defaultChecked disabled />
    </Field>
  );
}

const explorerCase = {
  id: "checkbox/overview",
  label: "复选项",
  summary: "同时展示受控、非受控与禁用选择状态。",
  states: ["default", "disabled", "readOnly", "controlled", "uncontrolled", "validation", "longContent", "keyboard", "overlay", "dark", "locale"] as const,
  content: <CheckboxExample />,
  code: `<Checkbox label="产品更新" checked={checked} onChange={handleChange} />`,
} satisfies ExplorerCase;

export default explorerCase;
