// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"tree/overview","exports":["Tree"]}
import { StatePreview } from "../state-preview";
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
  states: ["default", "disabled", "controlled", "uncontrolled", "empty", "longContent", "keyboard", "overlay", "dark", "locale"],
  stateExamples: [
    { state: "uncontrolled", exports: ["Tree"], content: <Tree ariaLabel="组件维护资源选择" defaultValue="members" defaultExpandedIds={["workspace"]} nodes={[{ id: "workspace", label: "工作区", children: [{ id: "members", label: "成员" }, { id: "permissions", label: "权限" }] }]} /> },
    { state: "empty", exports: ["Tree"], content: <><Tree ariaLabel="空资源树" nodes={[]} /><p>当前没有资源节点。</p></> },
    { state: "longContent", exports: ["Tree"], content: <Tree ariaLabel="详细资源名称" nodes={[{ id: "config", label: "此资源覆盖全部产品中的角色配置、数据访问权限、通知偏好和账户安全设置，请确认所有关联配置均符合团队的实际使用要求。" }]} /> },
    { state: "default", exports: ["Tree"], content: <TreeExample /> },
    { state: "disabled", exports: ["Tree"], content: <TreeExample /> },
    { state: "controlled", exports: ["Tree"], content: <TreeExample /> },
    { state: "keyboard", exports: ["Tree"], content: <TreeExample />, instructions: "用 Tab 访问本例可用控件，使用 Enter、Space 和组件文档中的方向键操作。此项为人工操作案例，不是自动行为验收证书。" },
    { state: "overlay", exports: ["Tree"], content: <StatePreview state="overlay">{<TreeExample />}</StatePreview> },
    { state: "dark", exports: ["Tree"], content: <StatePreview state="dark">{<TreeExample />}</StatePreview> },
    { state: "locale", exports: ["Tree"], content: <StatePreview state="locale">{<TreeExample />}</StatePreview> },
  ],
  content: <TreeExample />,
  code: `<Tree value={value} onValueChange={setValue} expandedIds={expanded} onExpandedChange={setExpanded} nodes={nodes} ariaLabel="工作区资源" />`,
} satisfies ExplorerCase;

export default explorerCase;
