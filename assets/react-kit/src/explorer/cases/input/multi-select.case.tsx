// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"multi-select/overview","exports":["MultiSelect"]}
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

const explorerCase = {
  id: "multi-select/overview",
  label: "多项搜索选择",
  summary: "展示受控和非受控多选、已选胶囊、搜索、禁用选项与必填校验。",
  states: ["default", "disabled", "readOnly", "controlled", "uncontrolled", "validation", "longContent", "keyboard", "overlay", "dark", "locale"] as const,
  content: <MultiSelectExample />,
  code: `<MultiSelect ariaLabel="权限" value={value} onValueChange={setValue} query={query} onQueryChange={setQuery} options={permissions} />`,
} satisfies ExplorerCase;

export default explorerCase;
