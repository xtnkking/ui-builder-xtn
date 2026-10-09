// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"color-picker/overview","exports":["ColorPicker"]}
import { useState } from "react";
import { ColorPicker, Field } from "../../../personal-ui";
import type { ExplorerCase } from "../types";
import { StatePreview } from "../state-preview";

function ColorPickerExample() {
  const [color, setColor] = useState("#2563eb");
  return (
    <div className="demo-number-case__grid">
      <Field label="品牌强调色" group><ColorPicker ariaLabel="品牌强调色" value={color} onValueChange={setColor} swatches={["#2563eb", "#059669", "#dc2626", "#7c3aed"]} /></Field>
      <Field label="锁定颜色" group><ColorPicker ariaLabel="锁定颜色" defaultValue="#64748b" disabled /></Field>
    </div>
  );
}

const explorerCase = {
  id: "color-picker/overview",
  label: "颜色选择",
  summary: "展示受控颜色、预设色板、文本校验和禁用状态。",
  states: ["default", "disabled", "controlled", "uncontrolled", "validation", "longContent", "keyboard", "overlay", "dark", "locale"] as const,
  content: <ColorPickerExample />,
  stateExamples: [
    { state: "default", exports: ["ColorPicker"], content: <ColorPickerExample /> },
    { state: "disabled", exports: ["ColorPicker"], content: <ColorPickerExample /> },
    { state: "controlled", exports: ["ColorPicker"], content: <ColorPickerExample /> },
    { state: "uncontrolled", exports: ["ColorPicker"], content: <ColorPicker ariaLabel="内部管理品牌色" defaultValue="#2563eb" /> },
    { state: "validation", exports: ["ColorPicker"], content: <Field label="品牌色" group error="颜色格式应为六位十六进制值，例如 #2563eb。"><ColorPicker ariaLabel="品牌色" defaultValue="invalid-color" aria-invalid /></Field> },
    { state: "longContent", exports: ["ColorPicker"], content: <Field label="用于跨区域企业门户、账单通知和协作工作区的品牌强调色，请选择在浅色与深色背景下均具有足够区分度的颜色" group><ColorPicker ariaLabel="品牌强调色" defaultValue="#2563eb" /></Field> },
    { state: "keyboard", exports: ["ColorPicker"], content: <ColorPickerExample />, instructions: "Tab 聚焦颜色输入、文本输入和预设色板；Enter/Space 选择色板，也可直接编辑颜色文本。" },
    { state: "overlay", exports: ["ColorPicker"], content: <StatePreview state="overlay"><ColorPickerExample /></StatePreview> },
    { state: "dark", exports: ["ColorPicker"], content: <StatePreview state="dark"><ColorPickerExample /></StatePreview> },
    { state: "locale", exports: ["ColorPicker"], content: <StatePreview state="locale"><ColorPickerExample /></StatePreview> },
  ],
  code: `<ColorPicker ariaLabel="品牌强调色" value={color} onValueChange={setColor} swatches={swatches} />`,
} satisfies ExplorerCase;

export default explorerCase;
