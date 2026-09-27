// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"inline-edit/overview","exports":["InlineEdit"]}
import { useState } from "react";
import { Field, InlineEdit } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

function InlineEditExample() {
  const [name, setName] = useState("平台工程组");
  return (
    <div className="demo-number-case__grid">
      <Field label="团队名称" group required><InlineEdit value={name} onCommit={async (nextValue) => setName(nextValue)} validate={(value) => value.trim().length < 2 ? "至少输入两个字符" : undefined} required /></Field>
      <Field label="锁定标识" group><InlineEdit value="TEAM-PLATFORM" onCommit={() => undefined} disabled /></Field>
    </div>
  );
}

const explorerCase = {
  id: "inline-edit/overview",
  label: "行内编辑",
  summary: "展示只在保存后更新的受控值、异步保存、校验、取消和禁用状态。",
  states: ["default", "disabled", "readOnly", "controlled", "uncontrolled", "validation", "longContent", "keyboard", "overlay", "dark", "locale"] as const,
  content: <InlineEditExample />,
  code: `<InlineEdit value={name} onCommit={saveName} validate={(value) => value.trim() ? undefined : "请输入名称"} />`,
} satisfies ExplorerCase;

export default explorerCase;
