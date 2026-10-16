// @ui-coverage {"kind":"example","runner":"explorer","caseId":"segmented/overview","exports":["SegmentedControl"]}
import { useState } from "react";
import { Field, SegmentedControl } from "../../../ui";
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

function SegmentedSizingExample() {
  const [view, setView] = useState("filter");
  const options = [{ value: "filter", label: "筛选队列" }, { value: "upload", label: "上传队列" }];
  return <div style={{ display: "grid", gap: 24, width: "100%", minWidth: 0 }}>
    {(["纵向布局", "栅格布局"] as const).map((layout) => <section key={layout} aria-label={layout}
      style={{ display: "grid", gap: 12, minWidth: 0 }}>
      <strong>{layout}</strong>
      <div style={{ display: layout === "纵向布局" ? "flex" : "grid", flexDirection: "column", gridTemplateColumns: "minmax(0, 1fr)", gap: 12, minWidth: 0 }}>
        <SegmentedControl ariaLabel={`${layout}默认宽度`} value={view} onValueChange={setView} options={options} />
        <SegmentedControl ariaLabel={`${layout}整行铺满`} value={view} onValueChange={setView} options={options} fill />
        <SegmentedControl ariaLabel={`${layout}手机铺满`} value={view} onValueChange={setView} options={options} fill="mobile" />
      </div>
    </section>)}
  </div>;
}

export const segmentedSizingCase = {
  id: "segmented/layout",
  label: "宽度与父布局",
  summary: "默认背景贴合按钮；纵向弹性与栅格布局不会将它拉满。整行铺满与手机铺满由 fill 明确控制。",
  states: ["default"] as const,
  content: <SegmentedSizingExample />,
  code: `<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
  <SegmentedControl ariaLabel="队列类型" value={queue} onValueChange={setQueue} options={options} />
  <SegmentedControl ariaLabel="整行队列类型" value={queue} onValueChange={setQueue} options={options} fill />
  <SegmentedControl ariaLabel="手机队列类型" value={queue} onValueChange={setQueue} options={options} fill="mobile" />
</div>`,
} satisfies ExplorerCase;

const explorerCase = {
  id: "segmented/overview",
  label: "分段选择",
  summary: "默认宽度贴合选项，fill 可显式铺满，fill=\"mobile\" 仅在移动端铺满。",
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
