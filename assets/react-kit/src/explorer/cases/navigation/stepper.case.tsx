// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"stepper/overview","exports":["Stepper"]}
import { useState } from "react";
import { Stepper } from "../../../personal-ui";
import { StatePreview } from "../state-preview";
import type { ExplorerCase } from "../types";

const steps = [{ id: "account", label: "账号信息" }, { id: "profile", label: "个人资料" }, { id: "review", label: "确认提交" }, { id: "done", label: "完成", disabled: true }];
function StepperExample() {
  const [currentId, setCurrentId] = useState("review");
  return <Stepper ariaLabel="开户步骤" steps={steps} currentId={currentId} onStepChange={setCurrentId} orientation="responsive" />;
}
const explorerCase = {
  id: "stepper/overview", label: "步骤导航", summary: "currentId 由调用方维护；省略 onStepChange 时仅展示进度。错误步骤、空数据和长说明使用真实数据接口。",
  states: ["default", "disabled", "readOnly", "controlled", "empty", "error", "longContent", "keyboard", "mobile", "overlay", "dark", "locale"],
  content: <StepperExample />,
  stateExamples: [
    { state: "default", exports: ["Stepper"], content: <StepperExample /> },
    { state: "disabled", exports: ["Stepper"], instructions: "最后一步禁用；线性模式也会限制跳转到尚未完成的后续步骤。", content: <StepperExample /> },
    { state: "readOnly", exports: ["Stepper"], instructions: "省略 onStepChange 只展示进度，没有步骤按钮；不传不存在的 readOnly 属性。", content: <Stepper ariaLabel="只读进度" steps={steps} currentId="review" /> },
    { state: "controlled", exports: ["Stepper"], content: <StepperExample /> },
    { state: "empty", exports: ["Stepper"], content: <Stepper ariaLabel="空步骤" steps={[]} currentId="" /> },
    { state: "error", exports: ["Stepper"], content: <Stepper ariaLabel="错误步骤" steps={[{ id: "account", label: "账号信息", status: "error", description: "该步骤未通过审核" }, { id: "review", label: "确认提交" }]} currentId="review" /> },
    { state: "longContent", exports: ["Stepper"], content: <Stepper ariaLabel="长步骤说明" steps={[{ id: "details", label: "权限审核", description: "检查跨区域基础设施迁移项目的全部成员权限、数据访问范围与安全策略配置" }]} currentId="details" /> },
    { state: "keyboard", exports: ["Stepper"], instructions: "Tab 访问可选择的已完成/当前步骤，Enter/Space 切换；禁用和未开放的线性步骤为非交互文本。", content: <StepperExample /> },
    { state: "mobile", exports: ["Stepper"], content: <StatePreview state="mobile"><StepperExample /></StatePreview> },
    { state: "overlay", exports: ["Stepper"], content: <StatePreview state="overlay"><StepperExample /></StatePreview> },
    { state: "dark", exports: ["Stepper"], content: <StatePreview state="dark"><StepperExample /></StatePreview> },
    { state: "locale", exports: ["Stepper"], content: <StatePreview state="locale"><Stepper ariaLabel="Progress" steps={[{ id: "account", label: "Account" }, { id: "review", label: "Review" }]} currentId="review" /></StatePreview> },
  ],
  code: '<Stepper steps={steps} currentId={currentId} onStepChange={setCurrentId} ariaLabel="步骤" />\n<Stepper steps={steps} currentId={currentId} ariaLabel="进度展示" />',
} satisfies ExplorerCase;
export default explorerCase;
