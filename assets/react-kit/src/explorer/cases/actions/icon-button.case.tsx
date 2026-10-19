// @ui-coverage {"kind":"example","runner":"explorer","caseId":"icon-button/overview","exports":["IconButton"]}
import { IconButton, Inline, Stack, Tooltip } from "../../../ui";
import { useState } from "react";
import { Activity, Copy, Eye, MoreHorizontal, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { StatePreview } from "../state-preview";
import type { ExplorerCase } from "../types";

function KeyboardIconButtonExample() {
  const [refreshCount, setRefreshCount] = useState(0);
  return <><Tooltip content="刷新数据"><IconButton aria-label="刷新数据" icon={<RefreshCw />} onClick={() => setRefreshCount((count) => count + 1)} /></Tooltip><p role="status">已刷新 {refreshCount} 次</p></>;
}

function CommonIconActionsExample() {
  const [selected, setSelected] = useState("");
  return <Stack gap="medium">
    <Inline gap="small">
      <Tooltip content="查看示例记录"><IconButton aria-label="演示查看记录" icon={<Eye />} onClick={() => setSelected("查看")} /></Tooltip>
      <Tooltip content="检测示例连接"><IconButton aria-label="演示检测连接" icon={<Activity />} onClick={() => setSelected("检测")} /></Tooltip>
      <Tooltip content="编辑示例记录"><IconButton aria-label="演示编辑记录" icon={<Pencil />} onClick={() => setSelected("编辑")} /></Tooltip>
      <Tooltip content="复制示例记录"><IconButton aria-label="演示复制记录" icon={<Copy />} onClick={() => setSelected("复制")} /></Tooltip>
      <Tooltip content="查看删除图标，此处不删除数据"><IconButton aria-label="演示删除图标" variant="danger" icon={<Trash2 />} onClick={() => setSelected("删除图标，此处未删除数据")} /></Tooltip>
    </Inline>
    <p>{selected ? `当前演示：${selected}。` : "同一操作区优先统一使用图标按钮；这里点击仅查看动作名称。"}</p>
  </Stack>;
}

const explorerCase = {
  id: "icon-button/overview",
  label: "图标按钮",
  summary: "同一行操作优先统一使用图标按钮。检测、查看、编辑、复制、删除均有对应图标，始终提供可访问名称与 Tooltip；下方目录提供 40 个常用选择。",
  states: ["default", "disabled", "loading", "keyboard", "dark", "locale"],
  content: <CommonIconActionsExample />,
  stateExamples: [
    { state: "default", exports: ["IconButton"], content: <CommonIconActionsExample /> },
    { state: "disabled", exports: ["IconButton"], content: <Tooltip content="刷新暂不可用"><IconButton aria-label="刷新不可用" disabled icon={<RefreshCw />} /></Tooltip> },
    { state: "loading", exports: ["IconButton"], content: <Tooltip content="正在刷新数据"><IconButton aria-label="刷新中" loading icon={<RefreshCw />} /></Tooltip> },
    { state: "keyboard", exports: ["IconButton"], instructions: "用 Tab 聚焦刷新按钮，应显示 Tooltip；按 Enter 或空格，下方计数应增加。", content: <KeyboardIconButtonExample /> },
    { state: "dark", exports: ["IconButton"], content: <StatePreview state="dark"><CommonIconActionsExample /></StatePreview> },
    { state: "locale", exports: ["IconButton"], content: <StatePreview state="locale"><Tooltip content="More actions"><IconButton aria-label="More actions" icon={<MoreHorizontal />} /></Tooltip></StatePreview> },
  ],
  code: `<Inline wrap={false}>
  <Tooltip content="检测此连接"><IconButton aria-label="检测代理 A" icon={<Activity />} onClick={checkConnection} /></Tooltip>
  <Tooltip content="编辑此记录"><IconButton aria-label="编辑代理 A" icon={<Pencil />} onClick={editRecord} /></Tooltip>
  <Tooltip content="删除此记录"><IconButton aria-label="删除代理 A" variant="danger" icon={<Trash2 />} onClick={requestConfirmation} /></Tooltip>
</Inline>`,
} satisfies ExplorerCase;

export default explorerCase;
