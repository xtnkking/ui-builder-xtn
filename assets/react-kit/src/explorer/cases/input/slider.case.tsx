// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"slider/overview","exports":["Slider"]}
import { useState } from "react";
import { Field, Slider, type SliderValue } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

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
  states: ["default", "disabled", "readOnly", "controlled", "uncontrolled", "validation", "longContent", "keyboard", "overlay", "dark", "locale"] as const,
  content: <SliderExample />,
  code: `<Slider ariaLabel="价格范围" value={range} onValueChange={setRange} step={5} />`,
} satisfies ExplorerCase;

export default explorerCase;
