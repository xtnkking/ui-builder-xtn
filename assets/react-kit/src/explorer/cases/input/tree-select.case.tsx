// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"tree-select/overview","exports":["TreeSelect"]}
import { useState } from "react";
import { Field, TreeSelect } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const organizations = [
  { value: "hq", label: "总部", children: [{ value: "product", label: "产品中心" }, { value: "platform", label: "平台工程" }] },
  { value: "regions", label: "区域团队", children: [{ value: "east", label: "华东" }, { value: "south", label: "华南", disabled: true }] },
];

function TreeSelectExample() {
  const [value, setValue] = useState("platform");
  return (
    <div className="demo-number-case__grid">
      <Field label="组织节点" htmlFor="explorer-tree-select"><TreeSelect id="explorer-tree-select" ariaLabel="组织节点" value={value} onValueChange={setValue} options={organizations} /></Field>
      <Field label="默认组织" htmlFor="explorer-tree-default"><TreeSelect id="explorer-tree-default" ariaLabel="默认组织" defaultValue="east" options={organizations} /></Field>
    </div>
  );
}

const explorerCase = {
  id: "tree-select/overview",
  label: "树形选择",
  summary: "展示层级展开、roving focus、受控和非受控选择，以及禁用节点。",
  states: ["default", "disabled", "readOnly", "controlled", "uncontrolled", "validation", "longContent", "keyboard", "overlay", "dark", "locale"] as const,
  content: <TreeSelectExample />,
  code: `<TreeSelect ariaLabel="组织节点" value={value} onValueChange={setValue} options={organizations} />`,
} satisfies ExplorerCase;

export default explorerCase;
