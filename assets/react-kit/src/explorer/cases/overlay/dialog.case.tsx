// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"dialog/overview","exports":["Dialog","ConfirmDialog"]}
import { useState } from "react";
import { Button, ConfirmDialog, Dialog, Field, Input, Inline, Stack } from "../../../personal-ui";
import { StatePreview } from "../state-preview";
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

function PendingConfirmDialogExample() {
  const [open, setOpen] = useState(false);
  return <><Button onClick={() => setOpen(true)}>模拟异步确认</Button><ConfirmDialog open={open} onOpenChange={setOpen} title="保存项目？" onConfirm={async () => { await new Promise<void>((resolve) => setTimeout(resolve, 1800)); }} /></>;
}

function FailedConfirmDialogExample() {
  const [open, setOpen] = useState(false);
  return <><Button onClick={() => setOpen(true)}>模拟确认失败</Button><ConfirmDialog open={open} onOpenChange={setOpen} title="保存项目？" errorMessage="模拟服务器拒绝，项目尚未保存。" onConfirm={async () => { throw new Error("offline fixture rejection"); }} /></>;
}

function LongDialogs() {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  return <><Inline><Button onClick={() => setOpen(true)}>长内容弹窗</Button><Button onClick={() => setConfirming(true)}>长内容确认</Button></Inline><Dialog open={open} onOpenChange={setOpen} title="项目配置详情" description="此项目包含全部产品中的角色配置、数据访问权限、通知偏好和账户安全设置，请在保存前确认所有关联配置均符合团队的实际使用要求。"><p>成员、权限和审计策略等详细内容由页面提供。</p></Dialog><ConfirmDialog open={confirming} onOpenChange={setConfirming} title="确认修改项目？" description="此操作将同步更新全部产品中的角色配置、数据访问权限、通知偏好和账户安全设置，请确认所有配置均符合团队的实际使用要求后再继续。" onConfirm={() => undefined} /></>;
}

function EnglishDialogs() {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  return <><Inline><Button onClick={() => setOpen(true)}>Edit project</Button><Button onClick={() => setConfirming(true)}>Delete project</Button></Inline><Dialog open={open} onOpenChange={setOpen} title="Project settings" description="Close controls use the current locale."><p>Project details</p></Dialog><ConfirmDialog open={confirming} onOpenChange={setConfirming} title="Delete project?" description="This action cannot be undone." onConfirm={() => undefined} /></>;
}

const explorerCase: ExplorerCase = {
  id: "dialog/overview",
  label: "Dialog 与 ConfirmDialog",
  summary: "覆盖受控开关、不可点击遮罩关闭、表单编辑、危险确认和异步提交边界。",
  states: ["default", "controlled", "loading", "error", "longContent", "keyboard", "overlay", "dark", "locale"],
  content: <DialogExample />,
  stateExamples: [
    { state: "default", exports: ["Dialog", "ConfirmDialog"], content: <DialogExample /> },
    { state: "controlled", exports: ["Dialog", "ConfirmDialog"], content: <DialogExample /> },
    { state: "loading", exports: ["ConfirmDialog"], instructions: "打开确认弹窗并点击确认；异步操作持续 1.8 秒，确认按钮显示加载，取消与关闭在处理中不可用。", content: <PendingConfirmDialogExample /> },
    { state: "error", exports: ["ConfirmDialog"], instructions: "打开确认弹窗并点击确认；拒绝后保留弹窗并显示错误，允许重试或取消。", content: <FailedConfirmDialogExample /> },
    { state: "longContent", exports: ["Dialog", "ConfirmDialog"], content: <LongDialogs /> },
    { state: "keyboard", exports: ["Dialog", "ConfirmDialog"], instructions: "用 Tab 和 Enter 打开两种弹窗；Tab/Shift+Tab 在当前弹窗内移动，Esc 关闭并返回触发按钮。编辑弹窗禁止点击遮罩关闭。", content: <DialogExample /> },
    { state: "overlay", exports: ["Dialog", "ConfirmDialog"], instructions: "先打开外层弹窗，再打开编辑或确认弹窗；Esc 只关闭最上层。", content: <StatePreview state="overlay"><DialogExample /></StatePreview> },
    { state: "dark", exports: ["Dialog", "ConfirmDialog"], content: <StatePreview state="dark"><DialogExample /></StatePreview> },
    { state: "locale", exports: ["Dialog", "ConfirmDialog"], content: <StatePreview state="locale"><EnglishDialogs /></StatePreview> },
  ],
  code: `import { ConfirmDialog, Dialog } from "./personal-ui";

<Dialog open={open} onOpenChange={setOpen} closeOnBackdropClick={false} title="编辑项目">
  {form}
</Dialog>
<ConfirmDialog open={confirming} onOpenChange={setConfirming} title="删除项目" onConfirm={remove} />`,
};

export default explorerCase;
