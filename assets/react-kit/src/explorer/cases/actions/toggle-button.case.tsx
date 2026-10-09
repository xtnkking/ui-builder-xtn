// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"toggle-button/overview","exports":["ToggleButton"]}
import { Inline, ToggleButton } from "../../../personal-ui";
import { useState } from "react";
import { StatePreview } from "../state-preview";
import type { ExplorerCase } from "../types";

function ControlledToggleButtonExample() {
  const [pressed, setPressed] = useState(false);
  return <><ToggleButton pressed={pressed} onPressedChange={setPressed}>加粗</ToggleButton><p role="status">加粗：{pressed ? "开启" : "关闭"}</p></>;
}

const explorerCase = {
  id: "toggle-button/overview",
  label: "切换按钮",
  summary: "切换按钮通过 aria-pressed 表达状态，并同时支持受控与非受控使用方式。",
  states: ["default", "disabled", "controlled", "uncontrolled", "loading", "longContent", "keyboard", "overlay", "dark", "locale"],
  content: <Inline><ToggleButton defaultPressed>加粗</ToggleButton><ToggleButton>斜体</ToggleButton><ToggleButton disabled>删除线</ToggleButton></Inline>,
  stateExamples: [
    { state: "default", exports: ["ToggleButton"], content: <ToggleButton>加粗</ToggleButton> },
    { state: "disabled", exports: ["ToggleButton"], content: <ToggleButton disabled defaultPressed>加粗不可更改</ToggleButton> },
    { state: "controlled", exports: ["ToggleButton"], content: <ControlledToggleButtonExample /> },
    { state: "uncontrolled", exports: ["ToggleButton"], instructions: "初始选中；点击后由组件维护按下状态。", content: <ToggleButton defaultPressed>加粗</ToggleButton> },
    { state: "loading", exports: ["ToggleButton"], content: <ToggleButton loading loadingLabel="保存中">加粗</ToggleButton> },
    { state: "longContent", exports: ["ToggleButton"], content: <ToggleButton defaultPressed>启用全部产品的成员管理、账户安全、数据访问权限、通知偏好和操作审计设置的高级显示模式，以便管理员统一检查和修改配置</ToggleButton> },
    { state: "keyboard", exports: ["ToggleButton"], instructions: "用 Tab 聚焦按钮，按 Enter 或空格；查看按下状态和下方的开启／关闭反馈。", content: <ControlledToggleButtonExample /> },
    { state: "overlay", exports: ["ToggleButton"], content: <StatePreview state="overlay">{<ControlledToggleButtonExample />}</StatePreview> },
    { state: "dark", exports: ["ToggleButton"], content: <StatePreview state="dark">{<ToggleButton defaultPressed>加粗</ToggleButton>}</StatePreview> },
    { state: "locale", exports: ["ToggleButton"], content: <StatePreview state="locale">{<ToggleButton defaultPressed>Bold</ToggleButton>}</StatePreview> },
  ],
  code: `<ToggleButton pressed={bold} onPressedChange={setBold}>加粗</ToggleButton>`,
} satisfies ExplorerCase;

export default explorerCase;
