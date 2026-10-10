// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"split-button/overview","exports":["SplitButton"]}
import { SplitButton } from "../../../personal-ui";
import { useState } from "react";
import { StatePreview } from "../state-preview";
import type { ExplorerCase } from "../types";

const menuItems = [{ id: "draft", label: "保存为草稿", onSelect: () => undefined }, { id: "template", label: "保存为模板", onSelect: () => undefined }];

function SplitButtonActions() {
  const [result, setResult] = useState("尚未执行操作");
  return <><SplitButton variant="primary" menuAriaLabel="更多保存方式" onClick={() => setResult("已保存并发布")} menuItems={[{ id: "draft", label: "保存为草稿", onSelect: () => setResult("已保存为草稿") }, { id: "template", label: "保存为模板", onSelect: () => setResult("已保存为模板") }]}>保存并发布</SplitButton><p role="status">{result}</p></>;
}

const explorerCase = {
  id: "split-button/overview",
  label: "拆分按钮",
  summary: "主要动作与次要菜单连续拼接，最长宽度为 360px，并随容器收缩；禁用和加载同步到两侧。",
  states: ["default", "disabled", "loading", "longContent", "keyboard", "overlay", "dark", "locale"],
  content: <SplitButtonActions />,
  stateExamples: [
    { state: "default", exports: ["SplitButton"], content: <SplitButtonActions /> },
    { state: "disabled", exports: ["SplitButton"], instructions: "主要操作和菜单选项均不可执行；菜单打开时所有选项为禁用。", content: <SplitButton disabled menuAriaLabel="更多保存方式" menuItems={menuItems}>保存不可用</SplitButton> },
    { state: "loading", exports: ["SplitButton"], content: <SplitButton loading loadingLabel="保存中" menuAriaLabel="更多保存方式" menuItems={menuItems}>保存并发布</SplitButton> },
    { state: "longContent", exports: ["SplitButton"], instructions: "长名称在主操作内省略，整组不超过 360px；缩小容器时主操作收缩，菜单侧保持 38px，连接处不产生内侧圆角。", content: <SplitButton menuAriaLabel="更多保存方式" menuItems={menuItems}>保存当前成员在全部产品中的角色配置、数据访问权限、通知偏好和账户安全设置，然后返回成员管理列表继续处理其他成员</SplitButton> },
    { state: "keyboard", exports: ["SplitButton"], instructions: "用 Tab 切换主要动作与菜单按钮；按 Enter 或空格打开菜单，用方向键选择、Enter 执行、Esc 关闭。下方显示所执行的动作。", content: <SplitButtonActions /> },
    { state: "overlay", exports: ["SplitButton"], instructions: "打开弹窗后再打开拆分按钮的菜单，确认浮层内仍可选择动作。", content: <StatePreview state="overlay">{<SplitButtonActions />}</StatePreview> },
    { state: "dark", exports: ["SplitButton"], content: <StatePreview state="dark">{<SplitButtonActions />}</StatePreview> },
    { state: "locale", exports: ["SplitButton"], content: <StatePreview state="locale">{<SplitButton menuAriaLabel="More save actions" menuItems={[{ id: "draft", label: "Save as draft", onSelect: () => undefined }, { id: "template", label: "Save as template", onSelect: () => undefined }]}>Save and publish</SplitButton>}</StatePreview> },
  ],
  code: `<SplitButton menuAriaLabel="更多保存方式" menuItems={items}>保存并发布</SplitButton>`,
} satisfies ExplorerCase;

export default explorerCase;
