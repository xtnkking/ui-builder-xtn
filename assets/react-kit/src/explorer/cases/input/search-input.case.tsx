// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"search-input/overview","exports":["SearchInput"]}
import { useState } from "react";
import { Field, SearchInput } from "../../../personal-ui";
import { StatePreview } from "../state-preview";
import type { ExplorerCase } from "../types";

function SearchInputExample() {
  const [query, setQuery] = useState("平台");
  return (
    <div className="demo-number-case__grid">
      <Field label="搜索团队" htmlFor="explorer-search">
        <SearchInput id="explorer-search" value={query} placeholder="名称、负责人或标签" onChange={(event) => setQuery(event.currentTarget.value)} onClear={() => setQuery("")} />
      </Field>
      <Field label="只读搜索条件" htmlFor="explorer-search-readonly">
        <SearchInput id="explorer-search-readonly" value="生产环境" readOnly onChange={() => undefined} onClear={() => undefined} />
      </Field>
    </div>
  );
}

function SearchState({ disabled = false, readOnly = false, invalid = false, long = false, english = false }: {
  disabled?: boolean; readOnly?: boolean; invalid?: boolean; long?: boolean; english?: boolean;
}) {
  const [query, setQuery] = useState(long ? "跨区域平台成员权限审核记录与生产环境通知偏好搜索条件" : "平台");
  return <Field label={english ? "Search teams" : "搜索团队"} htmlFor="explorer-search-state" error={invalid ? "搜索条件包含不支持的字符。" : undefined}>
    <SearchInput id="explorer-search-state" aria-label={english ? "Search teams" : "搜索团队"} value={query} onChange={(event) => setQuery(event.currentTarget.value)} onClear={() => setQuery("")} disabled={disabled} readOnly={readOnly} invalid={invalid} />
  </Field>;
}

const explorerCase = {
  id: "search-input/overview",
  label: "搜索与清除",
  summary: "搜索图标和清除动作由 SearchInput 独占，输入与按钮保持同轴。",
  states: ["default", "disabled", "readOnly", "controlled", "validation", "longContent", "keyboard", "overlay", "dark", "locale"] as const,
  content: <SearchInputExample />,
  stateExamples: [
    { state: "default", exports: ["SearchInput"], content: <SearchState /> },
    { state: "disabled", exports: ["SearchInput"], content: <SearchInput aria-label="禁用搜索" value="平台" onChange={() => undefined} disabled /> },
    { state: "readOnly", exports: ["SearchInput"], content: <SearchInput aria-label="只读搜索" value="平台" onChange={() => undefined} readOnly /> },
    { state: "controlled", exports: ["SearchInput"], content: <SearchState /> },
    { state: "validation", exports: ["SearchInput"], content: <Field label="校验失败的搜索" htmlFor="explorer-invalid-search" error="搜索条件包含不支持的字符。"><SearchInput id="explorer-invalid-search" aria-label="校验失败的搜索" value="@@" onChange={() => undefined} invalid /></Field> },
    { state: "longContent", exports: ["SearchInput"], content: <SearchInput aria-label="长搜索条件" value="跨区域平台成员权限审核记录与生产环境通知偏好搜索条件需要完整展示并测试编辑和清除动作" onChange={() => undefined} readOnly /> },
    { state: "keyboard", exports: ["SearchInput"], instructions: "Tab 聚焦输入并输入查询；再按 Tab 到清除按钮，按 Enter 清除后焦点返回输入。", content: <SearchState /> },
    { state: "overlay", exports: ["SearchInput"], content: <StatePreview state="overlay">{<SearchState />}</StatePreview> },
    { state: "dark", exports: ["SearchInput"], content: <StatePreview state="dark">{<SearchState />}</StatePreview> },
    { state: "locale", exports: ["SearchInput"], content: <StatePreview state="locale">{<SearchState english />}</StatePreview> },
  ],
  code: `<SearchInput value={query} onChange={handleQueryChange} onClear={() => setQuery("")} />`,
} satisfies ExplorerCase;

export default explorerCase;
