// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"rating/overview","exports":["Rating"]}
import { useState } from "react";
import { Field, Rating } from "../../../personal-ui";
import type { ExplorerCase } from "../types";
import { StatePreview } from "../state-preview";

function RatingExample() {
  const [value, setValue] = useState(4);
  return (
    <div className="demo-number-case__grid">
      <Rating ariaLabel="服务评分" value={value} onValueChange={setValue} allowClear />
      <Rating ariaLabel="只读评分" defaultValue={3} readOnly />
      <Rating ariaLabel="禁用评分" defaultValue={2} disabled />
    </div>
  );
}

const explorerCase = {
  id: "rating/overview",
  label: "评分",
  summary: "展示可清除评分、只读结果与禁用状态。",
  states: ["default", "disabled", "readOnly", "controlled", "uncontrolled", "validation", "longContent", "keyboard", "overlay", "dark", "locale"] as const,
  content: <RatingExample />,
  stateExamples: [
    { state: "default", exports: ["Rating"], content: <RatingExample /> },
    { state: "disabled", exports: ["Rating"], content: <RatingExample /> },
    { state: "readOnly", exports: ["Rating"], content: <RatingExample /> },
    { state: "controlled", exports: ["Rating"], content: <RatingExample /> },
    { state: "uncontrolled", exports: ["Rating"], content: <Rating ariaLabel="内部管理服务评分" defaultValue={3} allowClear /> },
    { state: "validation", exports: ["Rating"], content: <Field label="服务评分" group error="请为此次服务选择评分。"><Rating ariaLabel="服务评分" defaultValue={0} required aria-invalid /></Field> },
    { state: "longContent", exports: ["Rating"], content: <Field label="请根据此次跨区域结算服务的响应速度、问题处理效率、支持人员沟通情况和最终解决结果提供综合体验评分" group><Rating ariaLabel="综合体验评分" defaultValue={4} /></Field> },
    { state: "keyboard", exports: ["Rating"], content: <RatingExample />, instructions: "Tab 进入评分组，用方向键、Home/End 选择星级；Enter/Space 操作，检查只读评分不能更改。" },
    { state: "overlay", exports: ["Rating"], content: <StatePreview state="overlay"><RatingExample /></StatePreview> },
    { state: "dark", exports: ["Rating"], content: <StatePreview state="dark"><RatingExample /></StatePreview> },
    { state: "locale", exports: ["Rating"], content: <StatePreview state="locale"><RatingExample /></StatePreview> },
  ],
  code: `<Rating ariaLabel="服务评分" value={value} onValueChange={setValue} allowClear />`,
} satisfies ExplorerCase;

export default explorerCase;
