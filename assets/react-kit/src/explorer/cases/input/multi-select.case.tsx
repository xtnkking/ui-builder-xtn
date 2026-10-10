// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"multi-select/overview","exports":["MultiSelect"]}
import { StatePreview } from "../state-preview";
import { useState } from "react";
import { Field, MultiSelect } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const permissions = [
  { value: "read", label: "查看数据", description: "查看所有项目数据" },
  { value: "write", label: "编辑数据", description: "新建和修改记录" },
  { value: "delete", label: "删除数据", description: "高风险权限", disabled: true },
  { value: "export", label: "导出报表", description: "生成 CSV 与 PDF" },
];

function MultiSelectExample() {
  const [value, setValue] = useState<string[]>(["read", "write"]);
  const [query, setQuery] = useState("");
  return (
    <div className="demo-number-case__grid">
      <Field label="权限" htmlFor="explorer-multi-select" required><MultiSelect id="explorer-multi-select" ariaLabel="权限" value={value} onValueChange={setValue} query={query} onQueryChange={setQuery} options={permissions} required /></Field>
      <Field label="默认通知" htmlFor="explorer-multi-default"><MultiSelect id="explorer-multi-default" ariaLabel="默认通知" defaultValue={["read"]} options={permissions} /></Field>
    </div>
  );
}

function ControlledMultiSelectExample() {
  const [value, setValue] = useState<string[]>(["read"]);
  const [query, setQuery] = useState("");
  return <Field label="受控权限" htmlFor="explorer-multi-controlled"><MultiSelect id="explorer-multi-controlled" ariaLabel="受控权限" value={value} onValueChange={setValue} query={query} onQueryChange={setQuery} options={permissions} /></Field>;
}

const explorerCase = {
  id: "multi-select/overview",
  label: "多项搜索选择",
  summary: "展示受控和非受控多选、已选胶囊、搜索、禁用选项与必填校验。",
  states: ["default", "disabled", "controlled", "uncontrolled", "validation", "longContent", "keyboard", "overlay", "dark", "locale"] as const,
  stateExamples: [
    { state: "validation", exports: ["MultiSelect"], content: <Field label="必选权限" htmlFor="explorer-multi-invalid" error="请至少选择一项权限。"><MultiSelect id="explorer-multi-invalid" ariaLabel="必选权限" defaultValue={[]} options={permissions} required /></Field> },
    { state: "longContent", exports: ["MultiSelect"], content: <MultiSelect ariaLabel="长权限名称" defaultValue={["international"]} options={[{ value: "international", label: "Manage international subscription platform security policies, cross-region settlement and enterprise member access" }, ...permissions]} /> },
    { state: "default", exports: ["MultiSelect"], content: <Field label="权限" htmlFor="explorer-multi-default-state"><MultiSelect id="explorer-multi-default-state" ariaLabel="权限" defaultValue={["read"]} options={permissions} /></Field> },
    { state: "disabled", exports: ["MultiSelect"], content: <Field label="禁用权限" htmlFor="explorer-multi-disabled"><MultiSelect id="explorer-multi-disabled" ariaLabel="禁用权限" defaultValue={["read", "write"]} options={permissions} disabled /></Field> },
    { state: "controlled", exports: ["MultiSelect"], content: <ControlledMultiSelectExample /> },
    { state: "uncontrolled", exports: ["MultiSelect"], content: <Field label="默认通知" htmlFor="explorer-multi-default"><MultiSelect id="explorer-multi-default" ariaLabel="默认通知" defaultValue={["read"]} options={permissions} /></Field> },
    { state: "keyboard", exports: ["MultiSelect"], content: <MultiSelectExample />, instructions: "用 Tab 访问本例可用控件，使用 Enter、Space 和组件文档中的方向键操作。此项为人工操作案例，不是自动行为验收证书。" },
    { state: "overlay", exports: ["MultiSelect"], content: <StatePreview state="overlay">{<MultiSelectExample />}</StatePreview> },
    { state: "dark", exports: ["MultiSelect"], content: <StatePreview state="dark">{<MultiSelectExample />}</StatePreview> },
    { state: "locale", exports: ["MultiSelect"], content: <StatePreview state="locale">{<MultiSelectExample />}</StatePreview> },
  ],
  content: <MultiSelectExample />,
  code: `<MultiSelect ariaLabel="权限" value={value} onValueChange={setValue} query={query} onQueryChange={setQuery} options={permissions} />`,
} satisfies ExplorerCase;

export default explorerCase;
