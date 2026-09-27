// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"combobox/overview","exports":["Combobox","Autocomplete"]}
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

const explorerCase = {
  id: "combobox/overview",
  label: "组合输入与自动完成",
  summary: "展示列表选择、输入过滤、自定义值与禁用状态。",
  states: ["default", "disabled", "readOnly", "controlled", "uncontrolled", "validation", "longContent", "keyboard", "overlay", "dark", "locale"] as const,
  content: <ComboboxExample />,
  code: `<Combobox ariaLabel="团队" value={team} onValueChange={setTeam} options={teams} />\n<Autocomplete ariaLabel="团队或自定义值" value={value} onValueChange={setValue} query={query} onQueryChange={setQuery} options={teams} allowCustomValue />`,
} satisfies ExplorerCase;

export default explorerCase;
