// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"cascader/overview","exports":["Cascader"]}
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
  states: ["default", "disabled", "readOnly", "controlled", "uncontrolled", "validation", "longContent", "keyboard", "overlay", "dark", "locale"] as const,
  content: <CascaderExample />,
  code: `<Cascader ariaLabel="服务区域" value={path} onValueChange={setPath} options={regions} levelLabels={["国家", "省份", "城市"]} />`,
} satisfies ExplorerCase;

export default explorerCase;
