// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"wizard/overview","exports":["WizardFlow"]}
import { useState } from "react";
import { Alert, WizardFlow } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const steps = [
  { id: "source", label: "选择来源" },
  { id: "mapping", label: "字段映射" },
  { id: "review", label: "确认导入" },
];

function WizardExample() {
  const [currentId, setCurrentId] = useState("mapping");
  const currentIndex = steps.findIndex((step) => step.id === currentId);
  return (
    <WizardFlow
      title="导入成员"
      steps={steps}
      currentId={currentId}
      onStepChange={setCurrentId}
      onPrevious={currentIndex > 0 ? () => setCurrentId(steps[currentIndex - 1].id) : undefined}
      onNext={currentIndex < 2 ? () => setCurrentId(steps[currentIndex + 1].id) : undefined}
    >
      <Alert tone="info" title={steps[currentIndex]?.label}>当前步骤内容会在这里显示。</Alert>
    </WizardFlow>
  );
}

const explorerCase: ExplorerCase = {
  id: "wizard/overview",
  label: "向导流程",
  summary: "受控步骤、禁用边界、前后操作与异步下一步共用稳定布局。",
  states: ["default", "loading", "empty", "error", "validation", "longContent", "keyboard", "mobile", "overlay", "dark", "locale"],
  content: <WizardExample />,
  code: `import { WizardFlow } from "./personal-ui";

<WizardFlow title="导入成员" steps={steps} currentId={step} onStepChange={setStep}>{content}</WizardFlow>`,
};

export default explorerCase;
