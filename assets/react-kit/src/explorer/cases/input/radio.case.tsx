// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"radio/overview","exports":["Radio"]}
import { useState } from "react";
import { Field, Radio } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

function RadioExample() {
  const [plan, setPlan] = useState("team");
  return (
    <Field label="套餐" group required>
      <Radio name="explorer-plan" label="个人版" checked={plan === "personal"} onChange={() => setPlan("personal")} />
      <Radio name="explorer-plan" label="团队版" checked={plan === "team"} onChange={() => setPlan("team")} />
      <Radio name="explorer-plan" label="企业版（暂不可用）" checked={false} disabled onChange={() => undefined} />
    </Field>
  );
}

const explorerCase = {
  id: "radio/overview",
  label: "单选组",
  summary: "用 Field 分组并展示受控选择、必填和禁用选项。",
  states: ["default", "disabled", "readOnly", "controlled", "uncontrolled", "validation", "longContent", "keyboard", "overlay", "dark", "locale"] as const,
  content: <RadioExample />,
  code: `<Field label="套餐" group required>\n  <Radio name="plan" label="团队版" checked={plan === "team"} onChange={() => setPlan("team")} />\n</Field>`,
} satisfies ExplorerCase;

export default explorerCase;
