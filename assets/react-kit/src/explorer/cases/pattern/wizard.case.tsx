// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"wizard/overview","exports":["WizardFlow"]}
import { StatePreview } from "../state-preview";
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
  states: ["default", "disabled", "controlled", "loading", "longContent", "keyboard", "mobile", "overlay", "dark", "locale"],
  stateExamples: [
    { state: "disabled", exports: ["WizardFlow"], content: <WizardFlow title="下一步不可用" steps={steps} currentId="source" nextDisabled onNext={() => undefined}><p>请完成当前步骤所需信息。</p></WizardFlow> },
    { state: "controlled", exports: ["WizardFlow"], content: <WizardExample /> },
    { state: "loading", exports: ["WizardFlow"], content: <WizardFlow title="处理当前步骤" steps={steps} currentId="mapping" nextLoading onPrevious={() => undefined} onNext={() => undefined}><p>下一步显示加载，前一步暂不可用。</p></WizardFlow> },
    { state: "longContent", exports: ["WizardFlow"], content: <WizardFlow title="完整配置导入" description="此流程导入全部产品中的角色配置、数据访问权限、通知偏好和账户安全设置，请确认所有关联配置均符合团队的实际使用要求。" steps={steps} currentId="review"><p>步骤内容由页面提供。</p></WizardFlow> },
    { state: "default", exports: ["WizardFlow"], content: <WizardExample /> },
    { state: "keyboard", exports: ["WizardFlow"], content: <WizardExample />, instructions: "用 Tab 访问本例可用控件，使用 Enter、Space 和组件文档中的方向键操作。此项为人工操作案例，不是自动行为验收证书。" },
    { state: "mobile", exports: ["WizardFlow"], content: <StatePreview state="mobile">{<WizardExample />}</StatePreview> },
    { state: "overlay", exports: ["WizardFlow"], content: <StatePreview state="overlay">{<WizardExample />}</StatePreview> },
    { state: "dark", exports: ["WizardFlow"], content: <StatePreview state="dark">{<WizardExample />}</StatePreview> },
    { state: "locale", exports: ["WizardFlow"], content: <StatePreview state="locale">{<WizardExample />}</StatePreview> },
  ],
  content: <WizardExample />,
  code: `import { WizardFlow } from "./personal-ui";

<WizardFlow title="导入成员" steps={steps} currentId={step} onStepChange={setStep}>{content}</WizardFlow>`,
};

export default explorerCase;
