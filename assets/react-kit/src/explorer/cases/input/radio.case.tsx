// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"radio/overview","exports":["Radio"]}
import { useState } from "react";
import { Field, Radio } from "../../../personal-ui";
import type { ExplorerCase } from "../types";
import { StatePreview } from "../state-preview";

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
  states: ["default", "disabled", "controlled", "uncontrolled", "validation", "longContent", "keyboard", "overlay", "dark", "locale"] as const,
  content: <RadioExample />,
  stateExamples: [
    { state: "default", exports: ["Radio"], content: <RadioExample /> },
    { state: "disabled", exports: ["Radio"], content: <RadioExample /> },
    { state: "controlled", exports: ["Radio"], content: <RadioExample /> },
    { state: "uncontrolled", exports: ["Radio"], content: <Field label="内部管理套餐选择" group><Radio name="explorer-plan-default" label="个人版" value="personal" defaultChecked /><Radio name="explorer-plan-default" label="团队版" value="team" /></Field> },
    { state: "validation", exports: ["Radio"], content: <Field label="必选套餐" group error="请选择一个套餐。"><Radio name="explorer-plan-invalid" label="个人版" value="personal" required aria-invalid /><Radio name="explorer-plan-invalid" label="团队版" value="team" required aria-invalid /></Field> },
    { state: "longContent", exports: ["Radio"], content: <Field label="套餐" group><Radio name="explorer-plan-long" label="包含跨区域账单管理、高级安全策略、多语言操作界面和无限协作成员的企业套餐，请根据企业实际业务规模选择合适的计费方案" value="enterprise" defaultChecked /></Field> },
    { state: "keyboard", exports: ["Radio"], content: <RadioExample />, instructions: "Tab 进入单选组，用方向键切换可用套餐；Space 选择当前选项，跳过禁用套餐。" },
    { state: "overlay", exports: ["Radio"], content: <StatePreview state="overlay"><RadioExample /></StatePreview> },
    { state: "dark", exports: ["Radio"], content: <StatePreview state="dark"><RadioExample /></StatePreview> },
    { state: "locale", exports: ["Radio"], content: <StatePreview state="locale"><RadioExample /></StatePreview> },
  ],
  code: `<Field label="套餐" group required>\n  <Radio name="plan" label="团队版" checked={plan === "team"} onChange={() => setPlan("team")} />\n</Field>`,
} satisfies ExplorerCase;

export default explorerCase;
