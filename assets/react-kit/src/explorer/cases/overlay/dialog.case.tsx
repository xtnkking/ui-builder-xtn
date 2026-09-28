// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"dialog/overview","exports":["Dialog","ConfirmDialog"]}
import { useState } from "react";
import { Button, ConfirmDialog, Dialog, Field, Input, Inline, Stack } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

function DialogExample() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [name, setName] = useState("Northstar 项目");
  return (
    <>
      <Inline gap="medium" wrap>
        <Button variant="primary" onClick={() => setDialogOpen(true)}>编辑项目</Button>
        <Button variant="danger" onClick={() => setConfirmOpen(true)}>删除项目</Button>
      </Inline>
      <Dialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        closeOnBackdropClick={false}
        title="编辑项目"
        description="点击遮罩不会关闭；关闭按钮和 Escape 保持可用。"
        footer={<Inline justify="end"><Button onClick={() => setDialogOpen(false)}>取消</Button><Button variant="primary" onClick={() => setDialogOpen(false)}>保存</Button></Inline>}
      >
        <Stack gap="medium">
          <Field label="项目名称" htmlFor="explorer-dialog-name">
            <Input id="explorer-dialog-name" value={name} onChange={(event) => setName(event.currentTarget.value)} />
          </Field>
        </Stack>
      </Dialog>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="删除项目"
        description="删除后无法恢复。"
        confirmLabel="删除"
        tone="danger"
        onConfirm={async () => setConfirmOpen(false)}
      />
    </>
  );
}

const explorerCase: ExplorerCase = {
  id: "dialog/overview",
  label: "Dialog 与 ConfirmDialog",
  summary: "覆盖受控开关、不可点击遮罩关闭、表单编辑、危险确认和异步提交边界。",
  states: ["default", "disabled", "readOnly", "controlled", "uncontrolled", "validation", "longContent", "keyboard", "overlay", "dark", "locale"],
  content: <DialogExample />,
  code: `import { ConfirmDialog, Dialog } from "./personal-ui";

<Dialog open={open} onOpenChange={setOpen} closeOnBackdropClick={false} title="编辑项目">
  {form}
</Dialog>
<ConfirmDialog open={confirming} onOpenChange={setConfirming} title="删除项目" onConfirm={remove} />`,
};

export default explorerCase;
