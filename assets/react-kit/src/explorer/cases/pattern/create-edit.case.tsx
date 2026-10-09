// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"create-edit/overview","exports":["CreateEditPage"]}
import { StatePreview } from "../state-preview";
import { useState } from "react";
import { CreateEditPage, Field, Input, Select, Stack } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

function CreateEditExample() {
  const [name, setName] = useState("Northstar API");
  const [status, setStatus] = useState("active");
  const [feedback, setFeedback] = useState("尚未保存");
  return (
    <CreateEditPage title="编辑项目" description="字段与操作遵循统一表单节奏。" onSubmit={(event) => { event.preventDefault(); setFeedback(`已保存：${name}，状态 ${status}`); }} onCancel={() => { setName("Northstar API"); setStatus("active"); setFeedback("已取消修改"); }}>
      <Stack gap="medium">
        <Field label="项目名称" htmlFor="explorer-project-name" required>
          <Input id="explorer-project-name" value={name} onChange={(event) => setName(event.currentTarget.value)} required />
        </Field>
        <Field label="状态" htmlFor="explorer-project-status">
          <Select id="explorer-project-status" ariaLabel="状态" value={status} onValueChange={setStatus} options={[{ value: "active", label: "启用" }, { value: "paused", label: "暂停" }]} />
        </Field>
        <p role="status">{feedback}</p>
      </Stack>
    </CreateEditPage>
  );
}

const explorerCase: ExplorerCase = {
  id: "create-edit/overview",
  label: "创建与编辑页面",
  summary: "统一标题、字段分组、验证、取消和异步保存操作区。",
  states: ["default", "disabled", "loading", "longContent", "keyboard", "mobile", "overlay", "dark", "locale"],
  stateExamples: [
    { state: "disabled", exports: ["CreateEditPage"], content: <CreateEditPage title="权限不足" submitDisabled onSubmit={(event) => event.preventDefault()}><p>当前账户不能保存此项目。</p></CreateEditPage> },
    { state: "loading", exports: ["CreateEditPage"], content: <CreateEditPage title="保存项目" submitting onSubmit={(event) => event.preventDefault()} onCancel={() => undefined}><p>正在保存；操作区显示加载并禁止取消。</p></CreateEditPage> },
    { state: "longContent", exports: ["CreateEditPage"], content: <CreateEditPage title="编辑完整配置" description="此页面用于修改全部产品中的角色配置、数据访问权限、通知偏好和账户安全设置，请确认所有关联配置均符合团队的实际使用要求。" onSubmit={(event) => event.preventDefault()}><p>字段由页面组合提供。</p></CreateEditPage> },
    { state: "default", exports: ["CreateEditPage"], content: <CreateEditExample /> },
    { state: "keyboard", exports: ["CreateEditPage"], content: <CreateEditExample />, instructions: "用 Tab 访问本例可用控件，使用 Enter、Space 和组件文档中的方向键操作。此项为人工操作案例，不是自动行为验收证书。" },
    { state: "mobile", exports: ["CreateEditPage"], content: <StatePreview state="mobile">{<CreateEditExample />}</StatePreview> },
    { state: "overlay", exports: ["CreateEditPage"], content: <StatePreview state="overlay">{<CreateEditExample />}</StatePreview> },
    { state: "dark", exports: ["CreateEditPage"], content: <StatePreview state="dark">{<CreateEditExample />}</StatePreview> },
    { state: "locale", exports: ["CreateEditPage"], content: <StatePreview state="locale">{<CreateEditExample />}</StatePreview> },
  ],
  content: <CreateEditExample />,
  code: `import { CreateEditPage } from "./personal-ui";

<CreateEditPage title="编辑项目" onSubmit={save} onCancel={cancel}>{fields}</CreateEditPage>`,
};

export default explorerCase;
