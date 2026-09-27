// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"tour/overview","exports":["GuidedTour"]}
import { useState } from "react";
import { Button, GuidedTour, Inline } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

function GuidedTourExample() {
  const [open, setOpen] = useState(false);
  const [currentId, setCurrentId] = useState("search");
  return (
    <>
      <Inline gap="medium" wrap>
        <Button id="explorer-tour-target" variant="primary" onClick={() => { setCurrentId("search"); setOpen(true); }}>开始引导</Button>
        <span>目标缺失时自动使用居中回退卡片。</span>
      </Inline>
      <GuidedTour
        open={open}
        onOpenChange={setOpen}
        currentId={currentId}
        onCurrentChange={setCurrentId}
        steps={[
          { id: "search", title: "查找组件", description: "从目录中按名称或用途搜索。", target: "#explorer-tour-target" },
          { id: "fallback", title: "稳定回退", description: "目标不存在时仍可继续或退出。", target: "#missing-tour-target" },
        ]}
      />
    </>
  );
}

const explorerCase: ExplorerCase = {
  id: "tour/overview",
  label: "GuidedTour 目标与回退",
  summary: "覆盖真实目标定位、目标缺失回退、受控步骤与 Escape 退出。",
  states: ["default", "disabled", "readOnly", "controlled", "uncontrolled", "validation", "longContent", "keyboard", "overlay", "dark", "locale"],
  content: <GuidedTourExample />,
  code: `import { GuidedTour } from "./personal-ui";

<GuidedTour open={open} onOpenChange={setOpen} currentId={step} onCurrentChange={setStep} steps={steps} />`,
};

export default explorerCase;
