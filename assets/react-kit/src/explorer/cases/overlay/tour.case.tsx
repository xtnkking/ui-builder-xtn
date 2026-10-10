// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"tour/overview","exports":["GuidedTour"]}
import { useState } from "react";
import { Button, GuidedTour, Inline } from "../../../personal-ui";
import { StatePreview } from "../state-preview";
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

function LongGuidedTourExample() {
  const [open, setOpen] = useState(false);
  const [currentId, setCurrentId] = useState("details");
  return <><Button onClick={() => { setCurrentId("details"); setOpen(true); }}>查看详细引导</Button><GuidedTour open={open} onOpenChange={setOpen} currentId={currentId} onCurrentChange={setCurrentId} steps={[{ id: "details", title: "配置说明", description: "此引导用于介绍全部产品中的角色配置、数据访问权限、通知偏好和账户安全设置，请在保存前确认所有关联配置均符合团队的实际使用要求。" }, { id: "finish", title: "完成", description: "所有步骤均已查看，可以返回页面。" }]} /></>;
}

function EnglishGuidedTourExample() {
  const [open, setOpen] = useState(false);
  const [currentId, setCurrentId] = useState("intro");
  return <><Button onClick={() => { setCurrentId("intro"); setOpen(true); }}>Start tour</Button><GuidedTour open={open} onOpenChange={setOpen} currentId={currentId} onCurrentChange={setCurrentId} steps={[{ id: "intro", title: "Find components", description: "Search components by name or purpose." }, { id: "finish", title: "Finish", description: "Continue working on your project." }]} /></>;
}

const explorerCase: ExplorerCase = {
  id: "tour/overview",
  label: "引导目标与回退",
  summary: "覆盖真实目标定位、目标缺失回退、受控步骤与 Escape 退出。",
  states: ["default", "controlled", "empty", "longContent", "keyboard", "overlay", "dark", "locale"],
  content: <GuidedTourExample />,
  stateExamples: [
    { state: "default", exports: ["GuidedTour"], content: <GuidedTourExample /> },
    { state: "controlled", exports: ["GuidedTour"], instructions: "打开引导，下一步改变受控 currentId；没有目标的第二步使用居中回退。", content: <GuidedTourExample /> },
    { state: "empty", exports: ["GuidedTour"], instructions: "steps 为空时没有活动步骤，组件不显示引导面板；页面自行提供说明。", content: <><GuidedTour open onOpenChange={() => undefined} currentId="" onCurrentChange={() => undefined} steps={[]} /><p>当前没有引导步骤，引导面板保持不可见。</p></> },
    { state: "longContent", exports: ["GuidedTour"], content: <LongGuidedTourExample /> },
    { state: "keyboard", exports: ["GuidedTour"], instructions: "用 Tab 和 Enter 开始引导；在当前卡片内用 Tab 切换上一页、下一页或完成，Esc 退出并返回开始按钮。", content: <GuidedTourExample /> },
    { state: "overlay", exports: ["GuidedTour"], instructions: "在外层弹窗内开始引导；Esc 先退出引导，外层弹窗保持打开。", content: <StatePreview state="overlay"><GuidedTourExample /></StatePreview> },
    { state: "dark", exports: ["GuidedTour"], content: <StatePreview state="dark"><GuidedTourExample /></StatePreview> },
    { state: "locale", exports: ["GuidedTour"], content: <StatePreview state="locale"><EnglishGuidedTourExample /></StatePreview> },
  ],
  code: `import { GuidedTour } from "./personal-ui";

<GuidedTour open={open} onOpenChange={setOpen} currentId={step} onCurrentChange={setStep} steps={steps} />`,
};

export default explorerCase;
