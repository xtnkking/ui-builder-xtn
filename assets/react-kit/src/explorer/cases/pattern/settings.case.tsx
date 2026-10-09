// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"settings/overview","exports":["SettingsPage"]}
import { StatePreview } from "../state-preview";
import { useState } from "react";
import { Field, Input, SettingsPage, Switch } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

function SettingsExample() {
  const [section, setSection] = useState("profile");
  const [notices, setNotices] = useState(true);
  const [name, setName] = useState("Northstar");
  return (
    <SettingsPage
      title="工作区设置"
      currentId={section}
      onCurrentChange={setSection}
      sections={[
        { id: "profile", label: "基本信息", title: "基本信息", content: <Field label="工作区名称" htmlFor="explorer-workspace-name"><Input id="explorer-workspace-name" value={name} onChange={(event) => setName(event.currentTarget.value)} /></Field> },
        { id: "notices", label: "通知", title: "通知", content: <Switch label="接收每周摘要" checked={notices} onChange={(event) => setNotices(event.currentTarget.checked)} /> },
        { id: "billing", label: "账单", title: "账单", content: <p>由组织管理员管理。</p>, disabled: true },
      ]}
    />
  );
}

const explorerCase: ExplorerCase = {
  id: "settings/overview",
  label: "设置页面",
  summary: "分类导航、禁用项和当前设置区保持一致的键盘与响应式布局。",
  states: ["default", "disabled", "controlled", "empty", "longContent", "keyboard", "mobile", "overlay", "dark", "locale"],
  stateExamples: [
    { state: "disabled", exports: ["SettingsPage"], instructions: "账单导航项由 section.disabled 禁用；其他设置分类仍可切换。", content: <SettingsExample /> },
    { state: "controlled", exports: ["SettingsPage"], content: <SettingsExample /> },
    { state: "empty", exports: ["SettingsPage"], content: <SettingsPage title="没有设置分类" sections={[]} currentId="" onCurrentChange={() => undefined} /> },
    { state: "longContent", exports: ["SettingsPage"], content: <SettingsPage title="完整设置" description="此页面修改全部产品中的角色配置、数据访问权限、通知偏好和账户安全设置，请确认所有关联配置均符合团队的实际使用要求。" sections={[{ id: "details", label: "完整说明", content: <p>配置详情由页面提供。</p> }]} currentId="details" onCurrentChange={() => undefined} /> },
    { state: "default", exports: ["SettingsPage"], content: <SettingsExample /> },
    { state: "keyboard", exports: ["SettingsPage"], content: <SettingsExample />, instructions: "用 Tab 访问本例可用控件，使用 Enter、Space 和组件文档中的方向键操作。此项为人工操作案例，不是自动行为验收证书。" },
    { state: "mobile", exports: ["SettingsPage"], content: <StatePreview state="mobile">{<SettingsExample />}</StatePreview> },
    { state: "overlay", exports: ["SettingsPage"], content: <StatePreview state="overlay">{<SettingsExample />}</StatePreview> },
    { state: "dark", exports: ["SettingsPage"], content: <StatePreview state="dark">{<SettingsExample />}</StatePreview> },
    { state: "locale", exports: ["SettingsPage"], content: <StatePreview state="locale">{<SettingsExample />}</StatePreview> },
  ],
  content: <SettingsExample />,
  code: `import { SettingsPage } from "./personal-ui";

<SettingsPage title="工作区设置" sections={sections} currentId={section} onCurrentChange={setSection} />`,
};

export default explorerCase;
