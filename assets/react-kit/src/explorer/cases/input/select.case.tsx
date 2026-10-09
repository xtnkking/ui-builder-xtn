// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"select/overview","exports":["Select","SearchableSelect","AsyncSelect"]}
import { StatePreview } from "../state-preview";
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

function InvalidSelectExample() {
  const [role, setRole] = useState("");
  const [country, setCountry] = useState("");
  const [remote, setRemote] = useState("");
  return <div className="demo-number-case__grid">
    <Field label="必选角色" htmlFor="explorer-select-invalid" error="请选择角色。"><Select id="explorer-select-invalid" ariaLabel="角色" value={role} onValueChange={setRole} options={countries} required /></Field>
    <Field label="必选国家" htmlFor="explorer-searchable-invalid" error="请选择国家。"><SearchableSelect id="explorer-searchable-invalid" ariaLabel="国家" value={country} onValueChange={setCountry} options={countries} required /></Field>
    <Field label="必选远程国家" htmlFor="explorer-async-invalid" error="请选择国家。"><AsyncSelect id="explorer-async-invalid" ariaLabel="远程国家" value={remote} onValueChange={setRemote} options={countries} required /></Field>
  </div>;
}

const longCountries = [{ value: "international", label: "International subscription platform workspace for cross-region settlement and enterprise security operations", description: "+1 · International workspace" }, ...countries];
function LongSelectExample() {
  const [role, setRole] = useState("international");
  const [country, setCountry] = useState("international");
  const [remote, setRemote] = useState("international");
  return <div className="demo-number-case__grid">
    <Select ariaLabel="长选项" value={role} onValueChange={setRole} options={longCountries} />
    <SearchableSelect ariaLabel="可搜索长选项" value={country} onValueChange={setCountry} options={longCountries} />
    <AsyncSelect ariaLabel="远程长选项" value={remote} onValueChange={setRemote} options={longCountries} />
  </div>;
}

function EmptySelectExample() {
  const [role, setRole] = useState("");
  const [country, setCountry] = useState("");
  return <div className="demo-number-case__grid">
    <Select ariaLabel="没有选项的选择器" value={role} onValueChange={setRole} options={[]} />
    <SearchableSelect ariaLabel="没有选项的搜索选择器" value={country} onValueChange={setCountry} options={[]} />
    <AsyncSelect ariaLabel="空远程结果" options={[]} emptyText="没有匹配国家" />
  </div>;
}

function RetrySelectExample() {
  const [failed, setFailed] = useState(true);
  return failed
    ? <AsyncSelect ariaLabel="远程国家请求失败" options={[]} error="国家数据加载失败，请重试。" onRetry={async () => setFailed(false)} />
    : <AsyncSelect ariaLabel="重试后的国家" options={countries} defaultValue="us" />;
}

const explorerCase = {
  id: "select/overview",
  label: "紧凑、搜索与异步选择",
  summary: "按数据规模选择 Select、SearchableSelect 或 AsyncSelect，并展示加载、空结果和禁用选项。",
  states: ["default", "disabled", "controlled", "uncontrolled", "loading", "empty", "error", "validation", "longContent", "keyboard", "overlay", "dark", "locale"] as const,
  stateExamples: [
    { state: "disabled", exports: ["SearchableSelect", "AsyncSelect"], content: <div className="demo-number-case__grid"><SearchableSelect ariaLabel="禁用国家搜索" value="us" onValueChange={() => undefined} options={countries} disabled /><AsyncSelect ariaLabel="禁用远程国家" defaultValue="us" options={countries} disabled /></div> },
    { state: "uncontrolled", exports: ["AsyncSelect"], content: <AsyncSelect ariaLabel="内部管理远程国家选择" defaultValue="us" options={countries} /> },
    { state: "loading", exports: ["Select", "AsyncSelect"], content: <div className="demo-number-case__grid"><Select ariaLabel="加载中的角色" value="" onValueChange={() => undefined} options={[]} loading /><AsyncSelect ariaLabel="加载中的远程国家" options={[]} loading /></div> },
    { state: "empty", exports: ["Select", "SearchableSelect", "AsyncSelect"], content: <EmptySelectExample />, instructions: "打开各选择器，查看没有选项时的结果区域与占位内容。" },
    { state: "error", exports: ["AsyncSelect"], content: <RetrySelectExample />, instructions: "打开远程选择器，点击重试后加载示例国家数据。" },
    { state: "validation", exports: ["Select", "SearchableSelect", "AsyncSelect"], content: <InvalidSelectExample /> },
    { state: "longContent", exports: ["Select", "SearchableSelect", "AsyncSelect"], content: <LongSelectExample /> },
    { state: "default", exports: ["Select","SearchableSelect","AsyncSelect"], content: <SelectExample /> },
    { state: "disabled", exports: ["Select"], content: <SelectExample /> },
    { state: "controlled", exports: ["Select","SearchableSelect","AsyncSelect"], content: <SelectExample /> },
    { state: "keyboard", exports: ["Select","SearchableSelect","AsyncSelect"], content: <SelectExample />, instructions: "用 Tab 访问本例可用控件，使用 Enter、Space 和组件文档中的方向键操作。此项为人工操作案例，不是自动行为验收证书。" },
    { state: "overlay", exports: ["Select","SearchableSelect","AsyncSelect"], content: <StatePreview state="overlay">{<SelectExample />}</StatePreview> },
    { state: "dark", exports: ["Select","SearchableSelect","AsyncSelect"], content: <StatePreview state="dark">{<SelectExample />}</StatePreview> },
    { state: "locale", exports: ["Select","SearchableSelect","AsyncSelect"], content: <StatePreview state="locale">{<SelectExample />}</StatePreview> },
  ],
  content: <SelectExample />,
  code: `<Select ariaLabel="角色" value={role} onValueChange={setRole} options={roles} />\n<SearchableSelect ariaLabel="国家" value={country} onValueChange={setCountry} options={countries} />\n<AsyncSelect ariaLabel="远程国家" value={value} onValueChange={setValue} loadOptions={loadCountries} />`,
} satisfies ExplorerCase;

export default explorerCase;
