// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"cascader/overview","exports":["Cascader"]}
import { StatePreview } from "../state-preview";
import { useState } from "react";
import { Cascader, Field } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const regions = [
  { value: "china", label: "中国", children: [{ value: "guangdong", label: "广东", children: [{ value: "shenzhen", label: "深圳" }, { value: "guangzhou", label: "广州" }] }, { value: "beijing", label: "北京" }] },
  { value: "uk", label: "United Kingdom", children: [{ value: "london", label: "London" }] },
];

function CascaderExample() {
  const [path, setPath] = useState<string[]>(["china", "guangdong", "shenzhen"]);
  return (
    <div className="demo-number-case__grid">
      <Field label="服务区域" group required><Cascader ariaLabel="服务区域" value={path} onValueChange={setPath} options={regions} levelLabels={["国家", "省份", "城市"]} required submitValue="path" /></Field>
      <Field label="禁用区域" group><Cascader ariaLabel="禁用区域" defaultValue={["uk", "london"]} options={regions} disabled /></Field>
    </div>
  );
}

const explorerCase = {
  id: "cascader/overview",
  label: "级联选择",
  summary: "逐层选择层级路径，并展示必填、路径提交和禁用状态。",
  states: ["default", "disabled", "controlled", "uncontrolled", "validation", "longContent", "keyboard", "overlay", "dark", "locale"] as const,
  stateExamples: [
    { state: "validation", exports: ["Cascader"], content: <Field label="必选服务区域" group error="请选择完整的服务区域路径。"><Cascader ariaLabel="必选服务区域" defaultValue={[]} options={regions} required submitValue="path" /></Field> },
    { state: "longContent", exports: ["Cascader"], content: <Cascader ariaLabel="长区域名称" defaultValue={["international", "settlement"]} options={[{ value: "international", label: "International subscription platform operations across enterprise security and regional billing workspaces", children: [{ value: "settlement", label: "Cross-region settlement engineering and compliance operations team workspace" }] }]} /> },
    { state: "default", exports: ["Cascader"], content: <CascaderExample /> },
    { state: "disabled", exports: ["Cascader"], content: <CascaderExample /> },
    { state: "controlled", exports: ["Cascader"], content: <CascaderExample /> },
    { state: "uncontrolled", exports: ["Cascader"], content: <CascaderExample /> },
    { state: "keyboard", exports: ["Cascader"], content: <CascaderExample />, instructions: "用 Tab 访问本例可用控件，使用 Enter、Space 和组件文档中的方向键操作。此项为人工操作案例，不是自动行为验收证书。" },
    { state: "overlay", exports: ["Cascader"], content: <StatePreview state="overlay">{<CascaderExample />}</StatePreview> },
    { state: "dark", exports: ["Cascader"], content: <StatePreview state="dark">{<CascaderExample />}</StatePreview> },
    { state: "locale", exports: ["Cascader"], content: <StatePreview state="locale">{<CascaderExample />}</StatePreview> },
  ],
  content: <CascaderExample />,
  code: `<Cascader ariaLabel="服务区域" value={path} onValueChange={setPath} options={regions} levelLabels={["国家", "省份", "城市"]} />`,
} satisfies ExplorerCase;

export default explorerCase;
