// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"button/overview","exports":["Button"]}
import { useState } from "react";
import { Button, Inline } from "../../../personal-ui";
import { StatePreview } from "../state-preview";
import type { ExplorerCase } from "../types";

function KeyboardButtonExample() {
  const [count, setCount] = useState(0);
  return <Inline wrap><Button onClick={() => setCount((value) => value + 1)}>测试键盘操作</Button><output aria-live="polite">操作次数：{count}</output></Inline>;
}

const explorerCase = {
  id: "button/overview",
  label: "按钮",
  summary: "主要、次要、危险、禁用和加载按钮共享稳定高度与内容布局。",
  states: ["default", "disabled", "loading", "longContent", "keyboard", "dark", "locale"],
  content: <Inline wrap><Button variant="primary">保存更改</Button><Button>取消</Button><Button variant="danger">删除</Button><Button disabled>不可用</Button><Button loading loadingLabel="保存中">保存</Button></Inline>,
  stateExamples: [
    { state: "default", exports: ["Button"], content: <Button variant="primary">保存更改</Button> },
    { state: "disabled", exports: ["Button"], content: <Button disabled>不可用</Button> },
    { state: "loading", exports: ["Button"], content: <Button loading loadingLabel="保存中">保存</Button> },
    { state: "longContent", exports: ["Button"], content: <Button>保存所有区域的访问权限与通知偏好设置并返回成员列表</Button> },
    { state: "keyboard", exports: ["Button"], instructions: "用 Tab 聚焦按钮，再用 Enter 或空格激活；禁用和加载按钮不接受重复操作。", content: <KeyboardButtonExample /> },
    { state: "dark", exports: ["Button"], content: <StatePreview state="dark">{<Button variant="primary">保存更改</Button>}</StatePreview> },
    { state: "locale", exports: ["Button"], content: <StatePreview state="locale">{<Button loading>Save preferences</Button>}</StatePreview> },
  ],
  code: `<Button variant="primary" loading={saving}>保存更改</Button>`,
} satisfies ExplorerCase;

export default explorerCase;
