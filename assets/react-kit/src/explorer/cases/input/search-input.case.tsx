// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"search-input/overview","exports":["SearchInput"]}
import { useState } from "react";
import { Field, SearchInput } from "../../../personal-ui";
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

const explorerCase = {
  id: "search-input/overview",
  label: "搜索与清除",
  summary: "搜索图标和清除动作由 SearchInput 独占，输入与按钮保持同轴。",
  states: ["default", "disabled", "readOnly", "controlled", "uncontrolled", "validation", "longContent", "keyboard", "overlay", "dark", "locale"] as const,
  content: <SearchInputExample />,
  code: `<SearchInput value={query} onChange={handleQueryChange} onClear={() => setQuery("")} />`,
} satisfies ExplorerCase;

export default explorerCase;
