// @ui-coverage {"kind":"example","runner":"explorer","caseId":"icon-button/variants-and-states","exports":["IconButton","Tooltip","ToastProvider","useToast"]}
import { useEffect, useRef, useState } from "react";
import { Activity, Eye, Pencil, RefreshCw, Trash2, X } from "lucide-react";
import { IconButton, Inline, Stack, ToastProvider, Tooltip, useToast } from "../../../ui";
import { StatePreview } from "../state-preview";
import type { ExplorerCase } from "../types";
import sourceCode from "./icon-button-states.example.tsx?raw";

function IconButtonVariants() {
  const [selected, setSelected] = useState("");
  return <Stack gap="medium">
    <Inline gap="large">
      <div style={{ display: "grid", justifyItems: "center", gap: 8 }}>
        <Tooltip content="查看默认无底色的按钮"><IconButton aria-label="查看 ghost 样式" variant="ghost" icon={<Eye />} onClick={() => setSelected("无底色 ghost")} /></Tooltip>
        <span>无底色 · ghost</span>
      </div>
      <div style={{ display: "grid", justifyItems: "center", gap: 8 }}>
        <Tooltip content="查看次要按钮样式"><IconButton aria-label="查看 secondary 样式" variant="secondary" icon={<Pencil />} onClick={() => setSelected("次要 secondary")} /></Tooltip>
        <span>次要 · secondary</span>
      </div>
      <div style={{ display: "grid", justifyItems: "center", gap: 8 }}>
        <Tooltip content="查看危险按钮样式，此处不执行删除"><IconButton aria-label="查看 danger 样式" variant="danger" icon={<Trash2 />} onClick={() => setSelected("危险 danger，此处未执行删除")} /></Tooltip>
        <span>危险 · danger</span>
      </div>
    </Inline>
    {selected ? <p role="status">当前查看：{selected}。</p> : null}
  </Stack>;
}

function DisabledIconButtons() {
  return <Inline>
    <Tooltip content="当前没有编辑权限"><IconButton aria-label="编辑不可用：没有编辑权限" icon={<Pencil />} disabled /></Tooltip>
    <Tooltip content="检测服务暂不可用"><IconButton aria-label="检测不可用：服务暂停" icon={<Activity />} variant="secondary" disabled /></Tooltip>
    <Tooltip content="系统记录不可删除"><IconButton aria-label="删除不可用：系统记录" icon={<Trash2 />} variant="danger" disabled /></Tooltip>
  </Inline>;
}

function AsyncRefreshIconButtons() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(0);
  const pending = useRef(false);
  const revision = useRef(0);
  const timer = useRef<number | null>(null);

  useEffect(() => () => {
    revision.current += 1;
    pending.current = false;
    if (timer.current !== null) window.clearTimeout(timer.current);
  }, []);

  const refresh = () => {
    if (pending.current) return;
    pending.current = true;
    setLoading(true);
    const request = ++revision.current;
    timer.current = window.setTimeout(() => {
      if (request !== revision.current || !pending.current) return;
      timer.current = null;
      pending.current = false;
      setLoading(false);
      setCompleted((count) => count + 1);
      toast({ tone: "success", description: "刷新演示完成，按钮已恢复可用。", duration: 2200, dedupeKey: "icon-button-refresh-demo" });
    }, 900);
  };

  const cancel = () => {
    if (!pending.current) return;
    revision.current += 1;
    pending.current = false;
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    setLoading(false);
  };

  return <Stack gap="small">
    <Inline wrap={false}>
      <Tooltip content={loading ? "正在刷新，请稍候或取消" : "开始一次 900ms 刷新演示"}>
        <IconButton aria-label="演示刷新数据" icon={<RefreshCw />} variant="secondary" loading={loading} onClick={refresh} />
      </Tooltip>
      <Tooltip content={loading ? "取消本次刷新，取消后不会出现成功提示" : "当前没有进行中的刷新"}>
        <IconButton aria-label="取消本次刷新" icon={<X />} disabled={!loading} onClick={cancel} />
      </Tooltip>
    </Inline>
    <p role="status">{loading ? "刷新进行中，重复点击不会启动第二次请求。" : `已完成 ${completed} 次刷新演示。`}</p>
  </Stack>;
}

function RefreshExample() {
  return <ToastProvider maxVisible={1} maxQueue={0}><AsyncRefreshIconButtons /></ToastProvider>;
}

function IconButtonStatesExample() {
  return <Stack gap="large">
    <section style={{ display: "grid", gap: 12 }}><h3>全部样式</h3><IconButtonVariants /></section>
    <section style={{ display: "grid", gap: 12 }}><h3>禁用与原因</h3><DisabledIconButtons /></section>
    <section style={{ display: "grid", gap: 12 }}><h3>真实加载与取消</h3><RefreshExample /></section>
  </Stack>;
}

const explorerCase = {
  id: "icon-button/variants-and-states",
  label: "样式与交互状态",
  summary: "完整展示 ghost、secondary、danger，禁用原因、可取消的真实 loading，以及键盘提示、窄屏和深色环境。",
  states: ["default", "disabled", "loading", "keyboard", "mobile", "dark"],
  content: <IconButtonStatesExample />,
  stateExamples: [
    { state: "default", exports: ["IconButton", "Tooltip"], content: <IconButtonVariants /> },
    { state: "disabled", exports: ["IconButton", "Tooltip"], content: <DisabledIconButtons />, instructions: "禁用按钮不能触发动作；Tooltip 说明不可用原因。" },
    { state: "loading", exports: ["IconButton", "Tooltip", "ToastProvider", "useToast"], content: <RefreshExample />, instructions: "启动刷新后按钮显示加载并阻止重复请求；完成才提示成功。再次刷新并立即取消，不增加完成次数、不出现成功提示。" },
    { state: "keyboard", exports: ["IconButton", "Tooltip"], content: <IconButtonVariants />, instructions: "Tab 聚焦三个按钮时显示对应 Tooltip，Esc 可关闭；Enter 和空格查看样式说明。" },
    { state: "mobile", exports: ["IconButton", "Tooltip"], content: <StatePreview state="mobile"><IconButtonStatesExample /></StatePreview> },
    { state: "dark", exports: ["IconButton", "Tooltip"], content: <StatePreview state="dark"><IconButtonStatesExample /></StatePreview> },
  ],
  code: sourceCode,
} satisfies ExplorerCase;

export default explorerCase;
