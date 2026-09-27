// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"tree/overview","exports":["Tree"]}
import { useState } from "react";
import { Tree } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

function TreeExample() {
  const [value, setValue] = useState("permissions");
  const [expandedIds, setExpandedIds] = useState<string[]>(["workspace"]);
  return (
    <Tree
      ariaLabel="工作区资源"
      value={value}
      onValueChange={setValue}
      expandedIds={expandedIds}
      onExpandedChange={setExpandedIds}
      nodes={[
        { id: "workspace", label: "工作区", children: [
          { id: "members", label: "成员" },
          { id: "permissions", label: "权限" },
          { id: "archive", label: "已归档", disabled: true },
        ] },
        { id: "reports", label: "报表" },
      ]}
    />
  );
}

const explorerCase = {
  id: "tree/overview",
  label: "受控资源树",
  summary: "选择与展开分别受控，方向键、Home/End、Enter 和 Space 遵循树形控件合同。",
  states: ["default", "disabled", "readOnly", "controlled", "validation", "keyboard", "overlay", "dark", "locale"],
  content: <TreeExample />,
  code: `<Tree value={value} onValueChange={setValue} expandedIds={expanded} onExpandedChange={setExpanded} nodes={nodes} ariaLabel="工作区资源" />`,
} satisfies ExplorerCase;

export default explorerCase;
