// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"slider/overview","exports":["Slider"]}
import { useState } from "react";
import { Field, Slider, type SliderValue } from "../../../personal-ui";
import type { ExplorerCase } from "../types";
import { StatePreview } from "../state-preview";

function SliderExample() {
  const [single, setSingle] = useState<SliderValue>(35);
  const [range, setRange] = useState<SliderValue>([20, 80]);
  return (
    <div className="demo-number-case__grid">
      <Field label="完成度" group><Slider ariaLabel="完成度" value={single} onValueChange={setSingle} /></Field>
      <Field label="价格范围" group><Slider ariaLabel="价格范围" value={range} onValueChange={setRange} step={5} /></Field>
      <Field label="锁定范围" group><Slider ariaLabel="锁定范围" defaultValue={[30, 60]} disabled /></Field>
    </div>
  );
}

const explorerCase = {
  id: "slider/overview",
  label: "单值与范围滑块",
  summary: "展示受控单值、受控范围、非受控和禁用状态。",
  states: ["default", "disabled", "controlled", "uncontrolled", "validation", "longContent", "keyboard", "overlay", "dark", "locale"] as const,
  content: <SliderExample />,
  stateExamples: [
    { state: "default", exports: ["Slider"], content: <SliderExample /> },
    { state: "disabled", exports: ["Slider"], content: <SliderExample /> },
    { state: "controlled", exports: ["Slider"], content: <SliderExample /> },
    { state: "uncontrolled", exports: ["Slider"], content: <Field label="内部管理完成度" group><Slider ariaLabel="内部管理完成度" defaultValue={40} /></Field> },
    { state: "validation", exports: ["Slider"], content: <Field label="价格范围" group error="业务规则要求起始价格至少为 30。"><Slider ariaLabel="价格范围" defaultValue={[20, 80]} aria-invalid /></Field> },
    { state: "longContent", exports: ["Slider"], content: <Field label="为跨区域批量结算任务预留的服务资源配额百分比，应根据高峰期请求量与后台任务并发规模调整预留容量" group><Slider ariaLabel="服务资源配额" defaultValue={35} /></Field> },
    { state: "keyboard", exports: ["Slider"], content: <SliderExample />, instructions: "Tab 聚焦滑块，用方向键、Home/End 调整数值；范围模式分别聚焦两个滑块。" },
    { state: "overlay", exports: ["Slider"], content: <StatePreview state="overlay"><SliderExample /></StatePreview> },
    { state: "dark", exports: ["Slider"], content: <StatePreview state="dark"><SliderExample /></StatePreview> },
    { state: "locale", exports: ["Slider"], content: <StatePreview state="locale"><SliderExample /></StatePreview> },
  ],
  code: `<Slider ariaLabel="价格范围" value={range} onValueChange={setRange} step={5} />`,
} satisfies ExplorerCase;

export default explorerCase;
