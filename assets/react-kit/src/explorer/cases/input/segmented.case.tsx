// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"segmented/overview","exports":["SegmentedControl"]}
import { useState } from "react";
import { SegmentedControl } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

function SegmentedExample() {
  const [view, setView] = useState<"list" | "board" | "map">("list");
  return <SegmentedControl ariaLabel="视图模式" value={view} fill="mobile" onValueChange={setView} options={[{ value: "list", label: "列表" }, { value: "board", label: "看板" }, { value: "map", label: "地图", disabled: true }]} />;
}

const explorerCase = {
  id: "segmented/overview",
  label: "分段选择",
  summary: "固定几何的受控模式选择，在移动端可填满可用宽度。",
  states: ["default", "disabled", "readOnly", "controlled", "uncontrolled", "validation", "longContent", "keyboard", "overlay", "dark", "locale"] as const,
  content: <SegmentedExample />,
  code: `<SegmentedControl ariaLabel="视图模式" value={view} onValueChange={setView} options={options} />`,
} satisfies ExplorerCase;

export default explorerCase;
