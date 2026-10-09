// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"tree-select/overview","exports":["TreeSelect"]}
import { StatePreview } from "../state-preview";
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
  states: ["default", "disabled", "controlled", "uncontrolled", "validation", "longContent", "keyboard", "overlay", "dark", "locale"] as const,
  stateExamples: [
    { state: "validation", exports: ["TreeSelect"], content: <Field label="必选组织" htmlFor="explorer-tree-invalid" error="请选择组织节点。"><TreeSelect id="explorer-tree-invalid" ariaLabel="必选组织" defaultValue="" options={organizations} required /></Field> },
    { state: "longContent", exports: ["TreeSelect"], content: <TreeSelect ariaLabel="长组织名称" defaultValue="settlement" options={[{ value: "international", label: "International subscription platform operations and enterprise security engineering organization", children: [{ value: "settlement", label: "Cross-region settlement engineering and global enterprise account support operations team" }] }]} /> },
    { state: "default", exports: ["TreeSelect"], content: <TreeSelectExample /> },
    { state: "disabled", exports: ["TreeSelect"], content: <TreeSelectExample /> },
    { state: "controlled", exports: ["TreeSelect"], content: <TreeSelectExample /> },
    { state: "uncontrolled", exports: ["TreeSelect"], content: <TreeSelectExample /> },
    { state: "keyboard", exports: ["TreeSelect"], content: <TreeSelectExample />, instructions: "用 Tab 访问本例可用控件，使用 Enter、Space 和组件文档中的方向键操作。此项为人工操作案例，不是自动行为验收证书。" },
    { state: "overlay", exports: ["TreeSelect"], content: <StatePreview state="overlay">{<TreeSelectExample />}</StatePreview> },
    { state: "dark", exports: ["TreeSelect"], content: <StatePreview state="dark">{<TreeSelectExample />}</StatePreview> },
    { state: "locale", exports: ["TreeSelect"], content: <StatePreview state="locale">{<TreeSelectExample />}</StatePreview> },
  ],
  content: <TreeSelectExample />,
  code: `<TreeSelect ariaLabel="组织节点" value={value} onValueChange={setValue} options={organizations} />`,
} satisfies ExplorerCase;

export default explorerCase;
