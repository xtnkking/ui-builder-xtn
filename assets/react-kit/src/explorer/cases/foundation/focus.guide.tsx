import { useId, useState } from "react";
import { Button, Checkbox, Field, Inline, Input, Select, Stack } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

function FocusExample({ invalid = false }: { invalid?: boolean }) {
  const id = useId();
  const [region, setRegion] = useState("cn");
  return (
    <Stack gap="large">
      <Field label={invalid ? "账户名称（校验错误）" : "账户名称"} htmlFor={`${id}-name`} error={invalid ? "请输入有效的账户名称" : undefined}>
        <Input id={`${id}-name`} placeholder="Tab 从这里开始" />
      </Field>
      <Select ariaLabel="账户地区" value={region} onValueChange={setRegion} options={[{ value: "cn", label: "中国大陆" }, { value: "gb", label: "英国" }, { value: "disabled", label: "不可选地区", disabled: true }]} />
      <Checkbox defaultChecked label="接收账户通知" />
      <Inline gap="medium" wrap><Button variant="primary">继续</Button><Button disabled>禁用操作</Button><Button>返回</Button></Inline>
      <p className="demo-foundation-note">Tab 按顺序进入可用控件，Shift+Tab 返回；禁用操作跳过。按钮使用规范的键盘焦点轮廓；编辑框由组件处理焦点和错误状态，不在业务页面补蓝色光圈或红色阴影。</p>
    </Stack>
  );
}

const explorerCase = {
  id: "focus/overview",
  label: "键盘焦点与错误状态",
  summary: "在真实输入框、选择器、复选框与按钮之间移动焦点，查看规范自有的焦点反馈以及错误状态。",
  states: ["default", "keyboard", "validation"],
  stateExamples: [
    { state: "default", exports: [], content: <FocusExample /> },
    { state: "keyboard", exports: [], content: <FocusExample />, instructions: "使用 Tab 和 Shift+Tab 移动焦点；在 Select 上用方向键与 Enter 选择，Space 切换复选框。注意禁用按钮不加入 Tab 顺序。" },
    { state: "validation", exports: [], content: <FocusExample invalid />, instructions: "聚焦带错误信息的输入框，观察组件自身处理的错误边界。这里展示校验外观，不模拟提交请求。" },
  ],
  content: <FocusExample />,
  code: `<Field label="账户名称" htmlFor="account" error={error}>\n  <Input id="account" placeholder="请输入账户名称" />\n</Field>\n<Button variant="primary">继续</Button>\n<Button disabled>禁用操作</Button>`,
} satisfies ExplorerCase;

export default explorerCase;
