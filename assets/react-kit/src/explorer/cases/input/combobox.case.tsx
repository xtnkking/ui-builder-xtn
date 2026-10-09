// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"combobox/overview","exports":["Combobox","Autocomplete"]}
import { StatePreview } from "../state-preview";
import { useState } from "react";
import { Autocomplete, Combobox, Field } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const teams = [
  { value: "platform", label: "平台工程", description: "基础设施与开发体验" },
  { value: "product", label: "产品研发", description: "Web 与移动端产品" },
  { value: "support", label: "客户支持", description: "全球客户服务" },
];

function ComboboxExample() {
  const [team, setTeam] = useState("platform");
  const [query, setQuery] = useState("平台");
  const [custom, setCustom] = useState("");
  return (
    <div className="demo-number-case__grid">
      <Field label="所属团队" htmlFor="explorer-combobox"><Combobox id="explorer-combobox" ariaLabel="所属团队" value={team} onValueChange={setTeam} options={teams} searchPlaceholder="搜索团队" /></Field>
      <Field label="团队或自定义值" htmlFor="explorer-autocomplete"><Autocomplete id="explorer-autocomplete" ariaLabel="团队或自定义值" value={custom} onValueChange={setCustom} query={query} onQueryChange={setQuery} options={teams} allowCustomValue emptyText="按 Enter 使用自定义团队" /></Field>
      <Field label="禁用组合框" htmlFor="explorer-combobox-disabled"><Combobox id="explorer-combobox-disabled" ariaLabel="禁用组合框" value="support" onValueChange={() => undefined} options={teams} disabled /></Field>
    </div>
  );
}

function InvalidComboboxExample() {
  const [team, setTeam] = useState("");
  const [custom, setCustom] = useState("");
  return <div className="demo-number-case__grid">
    <Field label="团队" htmlFor="explorer-combobox-invalid" error="请选择团队。"><Combobox id="explorer-combobox-invalid" ariaLabel="团队" value={team} onValueChange={setTeam} options={teams} required /></Field>
    <Field label="可输入团队" htmlFor="explorer-autocomplete-invalid" error="请填写团队。"><Autocomplete id="explorer-autocomplete-invalid" ariaLabel="可输入团队" value={custom} onValueChange={setCustom} options={teams} required /></Field>
  </div>;
}

const longTeams = [{ value: "international", label: "International subscription platform security and cross-region settlement engineering team", description: "Global service team" }, ...teams];
function LongComboboxExample() {
  const [team, setTeam] = useState("international");
  const [custom, setCustom] = useState("international");
  return <div className="demo-number-case__grid"><Combobox ariaLabel="长团队名" value={team} onValueChange={setTeam} options={longTeams} /><Autocomplete ariaLabel="长团队自动完成" value={custom} onValueChange={setCustom} options={longTeams} /></div>;
}

const explorerCase = {
  id: "combobox/overview",
  label: "组合输入与自动完成",
  summary: "展示列表选择、输入过滤、自定义值与禁用状态。",
  states: ["default", "disabled", "controlled", "uncontrolled", "loading", "validation", "longContent", "keyboard", "overlay", "dark", "locale"] as const,
  stateExamples: [
    { state: "disabled", exports: ["Autocomplete"], content: <Autocomplete ariaLabel="禁用团队输入" defaultValue="platform" options={teams} disabled /> },
    { state: "uncontrolled", exports: ["Autocomplete"], content: <Autocomplete ariaLabel="内部管理团队输入" defaultValue="platform" options={teams} allowCustomValue /> },
    { state: "loading", exports: ["Autocomplete"], content: <Autocomplete ariaLabel="加载中的自动完成" options={[]} loading /> },
    { state: "validation", exports: ["Combobox", "Autocomplete"], content: <InvalidComboboxExample /> },
    { state: "longContent", exports: ["Combobox", "Autocomplete"], content: <LongComboboxExample /> },
    { state: "default", exports: ["Combobox","Autocomplete"], content: <ComboboxExample /> },
    { state: "disabled", exports: ["Combobox"], content: <ComboboxExample /> },
    { state: "controlled", exports: ["Combobox","Autocomplete"], content: <ComboboxExample /> },
    { state: "keyboard", exports: ["Combobox","Autocomplete"], content: <ComboboxExample />, instructions: "用 Tab 访问本例可用控件，使用 Enter、Space 和组件文档中的方向键操作。此项为人工操作案例，不是自动行为验收证书。" },
    { state: "overlay", exports: ["Combobox","Autocomplete"], content: <StatePreview state="overlay">{<ComboboxExample />}</StatePreview> },
    { state: "dark", exports: ["Combobox","Autocomplete"], content: <StatePreview state="dark">{<ComboboxExample />}</StatePreview> },
    { state: "locale", exports: ["Combobox","Autocomplete"], content: <StatePreview state="locale">{<ComboboxExample />}</StatePreview> },
  ],
  content: <ComboboxExample />,
  code: `<Combobox ariaLabel="团队" value={team} onValueChange={setTeam} options={teams} />\n<Autocomplete ariaLabel="团队或自定义值" value={value} onValueChange={setValue} query={query} onQueryChange={setQuery} options={teams} allowCustomValue />`,
} satisfies ExplorerCase;

export default explorerCase;
