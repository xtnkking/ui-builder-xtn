// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"select/overview","exports":["Select","SearchableSelect","AsyncSelect"]}
import { useState } from "react";
import { AsyncSelect, Field, SearchableSelect, Select } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const countries = [
  { value: "cn", label: "CN · China", description: "+86" },
  { value: "us", label: "US · United States", description: "+1" },
  { value: "gb", label: "GB · United Kingdom", description: "+44" },
  { value: "sg", label: "SG · Singapore", description: "+65" },
];

function SelectExample() {
  const [role, setRole] = useState("editor");
  const [country, setCountry] = useState("cn");
  const [asyncCountry, setAsyncCountry] = useState("us");
  const [query, setQuery] = useState("");
  return (
    <div className="demo-number-case__grid">
      <Field label="角色" htmlFor="explorer-select"><Select id="explorer-select" ariaLabel="角色" value={role} onValueChange={setRole} options={[{ value: "admin", label: "管理员" }, { value: "editor", label: "编辑者" }, { value: "viewer", label: "查看者", disabled: true }]} /></Field>
      <Field label="国家或地区（可搜索）" htmlFor="explorer-searchable-select"><SearchableSelect id="explorer-searchable-select" ariaLabel="国家或地区" value={country} onValueChange={setCountry} options={countries} searchPlaceholder="搜索国家英文名或区号" /></Field>
      <Field label="远程国家数据" htmlFor="explorer-async-select"><AsyncSelect id="explorer-async-select" ariaLabel="远程国家数据" value={asyncCountry} onValueChange={setAsyncCountry} query={query} onQueryChange={setQuery} options={countries} loading={query === "loading"} emptyText="没有匹配国家" /></Field>
      <Field label="加载中的选项" htmlFor="explorer-loading-select"><Select id="explorer-loading-select" ariaLabel="加载中的选项" value="" onValueChange={() => undefined} options={[]} loading /></Field>
    </div>
  );
}

const explorerCase = {
  id: "select/overview",
  label: "紧凑、搜索与异步选择",
  summary: "按数据规模选择 Select、SearchableSelect 或 AsyncSelect，并展示加载、空结果和禁用选项。",
  states: ["default", "disabled", "readOnly", "controlled", "uncontrolled", "loading", "empty", "error", "validation", "longContent", "keyboard", "overlay", "dark", "locale"] as const,
  content: <SelectExample />,
  code: `<Select ariaLabel="角色" value={role} onValueChange={setRole} options={roles} />\n<SearchableSelect ariaLabel="国家" value={country} onValueChange={setCountry} options={countries} />\n<AsyncSelect ariaLabel="远程国家" value={value} onValueChange={setValue} loadOptions={loadCountries} />`,
} satisfies ExplorerCase;

export default explorerCase;
