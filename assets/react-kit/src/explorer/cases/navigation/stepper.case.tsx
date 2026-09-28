// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"stepper/overview","exports":["Stepper"]}
import { useState } from "react";
import { Stepper } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const steps = [
  { id: "account", label: "账号信息", description: "邮箱和密码" },
  { id: "profile", label: "个人资料", description: "名称和头像" },
  { id: "review", label: "确认提交", description: "检查全部设置" },
  { id: "done", label: "完成", disabled: true },
];

function StepperExample() {
  const [currentId, setCurrentId] = useState("review");
  return <Stepper ariaLabel="开户步骤" steps={steps} currentId={currentId} onStepChange={setCurrentId} orientation="responsive" />;
}

const explorerCase = {
  id: "stepper/overview",
  label: "步骤导航",
  summary: "展示线性进度、已完成/当前/待处理/禁用步骤和响应式方向。",
  states: ["default", "disabled", "readOnly", "controlled", "validation", "keyboard", "overlay", "dark", "locale"] as const,
  content: <StepperExample />,
  code: `<Stepper ariaLabel="开户步骤" steps={steps} currentId={currentId} onStepChange={setCurrentId} orientation="responsive" />`,
} satisfies ExplorerCase;

export default explorerCase;
