// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"settings/overview","exports":["SettingsPage"]}
import { useState } from "react";
import { Field, Input, SettingsPage, Switch } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

function SettingsExample() {
  const [section, setSection] = useState("profile");
  const [notices, setNotices] = useState(true);
  return (
    <SettingsPage
      title="工作区设置"
      currentId={section}
      onCurrentChange={setSection}
      sections={[
        { id: "profile", label: "基本信息", title: "基本信息", content: <Field label="工作区名称" htmlFor="explorer-workspace-name"><Input id="explorer-workspace-name" value="Northstar" onChange={() => undefined} /></Field> },
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
  states: ["default", "loading", "empty", "error", "validation", "longContent", "keyboard", "mobile", "overlay", "dark", "locale"],
  content: <SettingsExample />,
  code: `import { SettingsPage } from "./personal-ui";

<SettingsPage title="工作区设置" sections={sections} currentId={section} onCurrentChange={setSection} />`,
};

export default explorerCase;
