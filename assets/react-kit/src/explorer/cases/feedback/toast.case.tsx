// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"toast/overview","exports":["ToastProvider","useToast"]}
import { useState } from "react";
import { StatePreview } from "../state-preview";
import { Button, Inline, ToastProvider, useToast } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

function ToastCommands() {
  const { toast, dismiss } = useToast();
  const [lastId, setLastId] = useState<string | null>(null);
  return <Inline gap="small" wrap>
    <Button onClick={() => setLastId(toast({ description: "成员权限已保存。", tone: "success", position: "top-center", shape: "rounded", duration: 4000, countdown: false, closable: true }))}>居中成功提示</Button>
    <Button onClick={() => setLastId(toast({ title: "连接中断", description: "请检查网络后重试。", tone: "danger", position: "bottom-right", shape: "pill", duration: null, closable: true }))}>右下错误胶囊</Button>
    <Button onClick={() => setLastId(toast({ description: "组织全部成员的权限同步已经结束，请确认这些变更是否与本次申请一致。如果发现权限范围有误，可以立即撤销本次调整，然后查看完整的审计记录和成员活动日志。", position: "top-right", duration: null, closable: true }))}>长内容提示</Button>
    <Button onClick={() => setLastId(toast({
      title: "文件已移至回收站",
      description: "点击撤销观察异步操作的加载状态。",
      shape: "rounded", countdown: false, duration: null, closable: true,
      action: { label: "撤销", loadingLabel: "正在撤销", onClick: async () => { await new Promise<void>((resolve) => setTimeout(resolve, 1200)); } },
    }))}>异步操作提示</Button>
    <Button onClick={() => setLastId(toast({ description: "此提示自动关闭，悬停或聚焦可暂停倒计时。", shape: "pill", position: "top-right", countdown: true, duration: 6000, closable: false }))}>胶囊倒计时</Button>
    <Button variant="ghost" disabled={!lastId} onClick={() => { if (lastId) dismiss(lastId); setLastId(null); }}>关闭最近提示</Button>
  </Inline>;
}
function ToastExample() { return <ToastProvider><ToastCommands /></ToastProvider>; }

const explorerCase = {
  id: "toast/overview",
  label: "Toast / Snackbar",
  summary: "真正发送提示，展示位置、形状、可选关闭与倒计时，以及实际异步操作。状态按钮提供人工触发入口。",
  states: ["default", "loading", "error", "longContent", "keyboard", "overlay", "dark", "locale", "usage"],
  stateExamples: [
    { state: "default", exports: ["ToastProvider"], content: <ToastExample /> },
    { state: "loading", exports: ["ToastProvider"], content: <ToastExample />, instructions: "点击异步操作提示，再点击提示内的撤销，观察1200ms加载状态。" },
    { state: "error", exports: ["ToastProvider"], content: <ToastExample />, instructions: "点击右下错误胶囊，查看实际danger消息。" },
    { state: "longContent", exports: ["ToastProvider"], content: <ToastExample />, instructions: "点击长内容提示，查看换行、宽度与关闭按钮。" },
    { state: "keyboard", exports: ["ToastProvider"], content: <ToastExample />, instructions: "用Tab和Enter发送提示，聚焦关闭或撤销按钮操作；此项为人工操作入口，不是浏览器自动验收。" },
    { state: "overlay", exports: ["ToastProvider"], content: <StatePreview state="overlay"><ToastExample /></StatePreview> },
    { state: "dark", exports: ["ToastProvider"], content: <StatePreview state="dark"><ToastExample /></StatePreview> },
    { state: "locale", exports: ["ToastProvider"], content: <StatePreview state="locale"><ToastExample /></StatePreview> },
    { state: "usage", exports: ["useToast"], content: <ToastExample /> },
  ],
  content: <ToastExample />,
  code: `const { toast, dismiss } = useToast();\nconst id = toast({ description: "已保存", position: "top-center", countdown: false });\ndismiss(id);`,
} satisfies ExplorerCase;
export default explorerCase;
