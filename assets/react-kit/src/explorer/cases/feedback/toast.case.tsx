// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"toast/overview","exports":["ToastProvider","useToast"]}
import { useState } from "react";
import { Button, Inline, ToastProvider, useToast } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

function ToastCommands() {
  const { toast, dismiss } = useToast();
  const [lastId, setLastId] = useState<string | null>(null);
  const show = (variant: "saved" | "sync" | "offline") => {
    const id = variant === "saved"
      ? toast({ title: "已保存", description: "成员权限已更新。", tone: "success", position: "top-center", shape: "rounded", duration: 4000, closable: true })
      : variant === "sync"
        ? toast({ title: "正在同步", description: "完成后会自动关闭。", tone: "info", position: "top-right", shape: "pill", duration: 6000, countdown: true, closable: false })
        : toast({ title: "连接中断", description: "请检查网络后重试。", tone: "danger", position: "bottom-right", shape: "rounded", duration: null, closable: true });
    setLastId(id);
  };
  return (
    <Inline gap="small" wrap>
      <Button onClick={() => show("saved")}>居中成功提示</Button>
      <Button variant="secondary" onClick={() => show("sync")}>右上胶囊倒计时</Button>
      <Button variant="danger" onClick={() => show("offline")}>右下持续错误</Button>
      <Button variant="ghost" disabled={!lastId} onClick={() => {
        if (lastId) dismiss(lastId);
        setLastId(null);
      }}>关闭最近提示</Button>
    </Inline>
  );
}

function ToastExample() {
  return <ToastProvider defaultPosition="top-right" defaultShape="rounded"><ToastCommands /></ToastProvider>;
}

const explorerCase = {
  id: "toast/overview",
  label: "Toast / Snackbar",
  summary: "同一 Provider 支持位置、圆角/胶囊、倒计时和关闭按钮开关；hook 返回的 id 可被精确关闭。",
  states: ["default", "loading", "error", "keyboard", "overlay", "dark", "locale", "usage"],
  content: <ToastExample />,
  code: `function Commands() {\n  const { toast, dismiss } = useToast();\n  const id = toast({ description: "已保存", position: "top-center", countdown: false });\n  dismiss(id);\n}\n<ToastProvider><Commands /></ToastProvider>`,
} satisfies ExplorerCase;

export default explorerCase;
