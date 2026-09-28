// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"create-edit/overview","exports":["CreateEditPage"]}
import { useState } from "react";
import { CreateEditPage, Field, Input, Select, Stack } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

function CreateEditExample() {
  const [name, setName] = useState("Northstar API");
  const [status, setStatus] = useState("active");
  return (
    <CreateEditPage title="编辑项目" description="字段与操作遵循统一表单节奏。" onSubmit={(event) => event.preventDefault()} onCancel={() => undefined}>
      <Stack gap="medium">
        <Field label="项目名称" htmlFor="explorer-project-name" required>
          <Input id="explorer-project-name" value={name} onChange={(event) => setName(event.currentTarget.value)} required />
        </Field>
        <Field label="状态" htmlFor="explorer-project-status">
          <Select id="explorer-project-status" ariaLabel="状态" value={status} onValueChange={setStatus} options={[{ value: "active", label: "启用" }, { value: "paused", label: "暂停" }]} />
        </Field>
      </Stack>
    </CreateEditPage>
  );
}

const explorerCase: ExplorerCase = {
  id: "create-edit/overview",
  label: "创建与编辑页面",
  summary: "统一标题、字段分组、验证、取消和异步保存操作区。",
  states: ["default", "loading", "empty", "error", "validation", "longContent", "keyboard", "mobile", "overlay", "dark", "locale"],
  content: <CreateEditExample />,
  code: `import { CreateEditPage } from "./personal-ui";

<CreateEditPage title="编辑项目" onSubmit={save} onCancel={cancel}>{fields}</CreateEditPage>`,
};

export default explorerCase;
