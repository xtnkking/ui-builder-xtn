// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"segmented/overview","exports":["SegmentedControl"]}
import { useState } from "react";
import { Field, SegmentedControl } from "../../../personal-ui";
import type { ExplorerCase } from "../types";
import { StatePreview } from "../state-preview";

function SegmentedExample() {
  const [view, setView] = useState<"list" | "board" | "map">("list");
  return <SegmentedControl ariaLabel="视图模式" value={view} fill="mobile" onValueChange={setView} options={[{ value: "list", label: "列表" }, { value: "board", label: "看板" }, { value: "map", label: "地图", disabled: true }]} />;
}

function InvalidSegmentedExample() {
  const [view, setView] = useState("");
  return <Field label="默认视图" group error="请选择默认视图。"><SegmentedControl ariaLabel="默认视图" value={view} onValueChange={setView} required aria-invalid options={[{ value: "list", label: "列表" }, { value: "board", label: "看板" }]} /></Field>;
}

function LongSegmentedExample() {
  const [view, setView] = useState("summary");
  return <SegmentedControl ariaLabel="工作区视图" value={view} onValueChange={setView} options={[{ value: "summary", label: "包含跨区域企业账单汇总、成员访问权限变更和近期安全告警记录的综合运营工作区视图" }, { value: "detail", label: "详细视图" }]} />;
}

const explorerCase = {
  id: "segmented/overview",
  label: "分段选择",
  summary: "固定几何的受控模式选择，在移动端可填满可用宽度。",
  states: ["default", "disabled", "controlled", "validation", "longContent", "keyboard", "overlay", "dark", "locale"] as const,
  content: <SegmentedExample />,
  stateExamples: [
    { state: "default", exports: ["SegmentedControl"], content: <SegmentedExample /> },
    { state: "disabled", exports: ["SegmentedControl"], content: <SegmentedExample /> },
    { state: "controlled", exports: ["SegmentedControl"], content: <SegmentedExample /> },
    { state: "validation", exports: ["SegmentedControl"], content: <InvalidSegmentedExample /> },
    { state: "longContent", exports: ["SegmentedControl"], content: <LongSegmentedExample /> },
    { state: "keyboard", exports: ["SegmentedControl"], content: <SegmentedExample />, instructions: "Tab 聚焦分段按钮，Enter/Space 选择；地图选项为禁用状态。" },
    { state: "overlay", exports: ["SegmentedControl"], content: <StatePreview state="overlay"><SegmentedExample /></StatePreview> },
    { state: "dark", exports: ["SegmentedControl"], content: <StatePreview state="dark"><SegmentedExample /></StatePreview> },
    { state: "locale", exports: ["SegmentedControl"], content: <StatePreview state="locale"><SegmentedExample /></StatePreview> },
  ],
  code: `<SegmentedControl ariaLabel="视图模式" value={view} onValueChange={setView} options={options} />`,
} satisfies ExplorerCase;

export default explorerCase;
