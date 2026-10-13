// @ui-coverage {"kind":"example","runner":"explorer","caseId":"toast/overview","exports":["ToastProvider","useToast"]}
import { useId, useState } from "react";
import { StatePreview } from "../state-preview";
import { Button, Field, Grid, Inline, NumberInput, Select, Stack, Switch, ToastProvider, useToast, type ToastOptions, type ToastPosition, type ToastShape } from "../../../ui";
import type { ExplorerCase } from "../types";

interface ToastCommandsProps {
  maxVisible: number | "";
  maxQueue: number | "";
  onMaxVisibleChange: (value: number | "") => void;
  onMaxQueueChange: (value: number | "") => void;
}

function ToastCommands({ maxVisible, maxQueue, onMaxVisibleChange, onMaxQueueChange }: ToastCommandsProps) {
  const { toast, dismiss, dismissAll } = useToast();
  const durationId = useId();
  const [lastId, setLastId] = useState<string | null>(null);
  const [autoClose, setAutoClose] = useState(true);
  const [durationSeconds, setDurationSeconds] = useState<number | "">(5);
  const [countdown, setCountdown] = useState(false);
  const [showSeconds, setShowSeconds] = useState(false);
  const [closable, setClosable] = useState(true);
  const [position, setPosition] = useState<ToastPosition>("top-right");
  const [shape, setShape] = useState<ToastShape>("rounded");
  const [tone, setTone] = useState<NonNullable<ToastOptions["tone"]>>("info");

  function sendConfiguredToast() {
    setLastId(toast({
      description: "设置已保存，相关成员将在下次登录时看到更新。",
      position, shape, tone, closable, countdown, showSeconds,
      duration: autoClose ? (durationSeconds || 5) * 1000 : null,
    }));
  }

  function sendBurst() {
    let newestId = "";
    for (let index = 1; index <= 10; index += 1) {
      newestId = toast({
        title: `排队提示 ${index}/10`,
        description: "默认同时显示 3 条，其余依次等待；显示后才开始计时。",
        duration: 4000, showSeconds: true, closable: true,
      });
    }
    setLastId(newestId);
  }

  return <Stack gap="large">
    <Stack gap="small">
      <h3>自定义提示</h3>
      <Grid minItemWidth={180} gap="medium">
        <Field label="弹出位置" group><Select ariaLabel="弹出位置" value={position} onValueChange={(value) => setPosition(value as ToastPosition)} options={[
          { value: "top-center", label: "顶部居中" }, { value: "top-right", label: "右上角" }, { value: "bottom-right", label: "右下角" },
        ]} /></Field>
        <Field label="提示形状" group><Select ariaLabel="提示形状" value={shape} onValueChange={(value) => setShape(value as ToastShape)} options={[
          { value: "rounded", label: "圆角" }, { value: "pill", label: "胶囊" },
        ]} /></Field>
        <Field label="消息类型" group><Select ariaLabel="消息类型" value={tone} onValueChange={(value) => setTone(value as NonNullable<ToastOptions["tone"]>)} options={[
          { value: "info", label: "信息" }, { value: "success", label: "成功" }, { value: "warning", label: "警告" }, { value: "danger", label: "错误" },
        ]} /></Field>
        <Field label="持续时间（秒）" htmlFor={durationId}><NumberInput id={durationId} ariaLabel="持续时间（秒）" value={durationSeconds} onValueChange={setDurationSeconds} min={1} max={60} disabled={!autoClose} /></Field>
      </Grid>
      <Inline gap="medium" wrap>
        <Switch label="自动关闭" checked={autoClose} onChange={(event) => setAutoClose(event.currentTarget.checked)} />
        <Switch label="显示进度条" checked={countdown} onChange={(event) => setCountdown(event.currentTarget.checked)} disabled={!autoClose} />
        <Switch label="显示读秒" checked={showSeconds} onChange={(event) => setShowSeconds(event.currentTarget.checked)} disabled={!autoClose} />
        <Switch label="显示关闭按钮" checked={closable} onChange={(event) => setClosable(event.currentTarget.checked)} />
      </Inline>
      <p>进度条、读秒和关闭按钮可分别设置。悬停、聚焦或页面切到后台时暂停计时；持续显示且没有操作入口的提示会保留关闭按钮。</p>
      <Inline><Button variant="primary" onClick={sendConfiguredToast}>发送自定义提示</Button></Inline>
    </Stack>
    <Stack gap="small">
      <h3>常见组合</h3>
      <Inline gap="small" wrap>
    <Button onClick={() => setLastId(toast({ description: "成员权限已保存。", tone: "success", position: "top-center", shape: "rounded", duration: 4000, countdown: false, closable: true }))}>居中成功提示</Button>
    <Button onClick={() => setLastId(toast({ title: "连接中断", description: "请检查网络后重试。", tone: "danger", position: "bottom-right", shape: "pill", duration: null, closable: true }))}>右下错误胶囊</Button>
    <Button onClick={() => setLastId(toast({ title: "长内容通知", description: Array.from({ length: 8 }, (_, index) => `${index + 1}. 组织全部成员的权限同步已经结束，请确认这些变更是否与本次申请一致。如果发现权限范围有误，可以立即撤销本次调整，然后查看完整的审计记录和成员活动日志。`).join("\n"), position: "top-right", duration: null, closable: true }))}>长内容提示</Button>
    <Button onClick={() => setLastId(toast({
      title: "文件已移至回收站",
      description: "点击撤销观察异步操作的加载状态。",
      shape: "rounded", countdown: false, duration: null, closable: true,
      action: { label: "撤销", loadingLabel: "正在撤销", onClick: async () => { await new Promise<void>((resolve) => setTimeout(resolve, 1200)); } },
    }))}>异步操作提示</Button>
    <Button onClick={() => setLastId(toast({
      title: "撤销操作失败案例",
      description: "点击撤销模拟失败；原提示保留，可重试或手动关闭。",
      duration: null,
      action: {
        label: "撤销", loadingLabel: "正在撤销",
        onClick: async () => { await new Promise<void>((resolve) => setTimeout(resolve, 1200)); throw new Error("模拟撤销失败"); },
        onError: () => { toast({ description: "撤销失败，请检查网络后重试。", tone: "danger", dedupeKey: "explorer-undo-failure" }); },
      },
    }))}>操作失败提示</Button>
    <Button onClick={() => setLastId(toast({ description: "此提示自动关闭，悬停或聚焦可暂停倒计时。", shape: "pill", position: "top-right", countdown: true, duration: 6000, closable: false }))}>胶囊倒计时</Button>
    <Button onClick={() => setLastId(toast({ description: "仅显示剩余秒数，不显示进度条。", duration: 6000, showSeconds: true, countdown: false, closable: true }))}>仅读秒（6 秒）</Button>
    <Button onClick={() => setLastId(toast({ description: "进度条与读秒同步暂停，也可以提前关闭。", duration: 8000, showSeconds: true, countdown: true, closable: true }))}>进度与读秒（8 秒）</Button>
    <Button onClick={() => setLastId(toast({ description: "此提示持续显示，点击关闭按钮后结束。", duration: null, closable: true }))}>手动关闭提示</Button>
    <Button onClick={() => {
      dismissAll();
      toast({ description: "成员权限已保存。", tone: "success", position: "top-center", duration: null });
      toast({ title: "右上消息", description: "三个位置共用数量上限，但独立排列。宽屏各自贴边；窄屏保留间距，关闭其他位置的提示不会改变这条消息的位置。", position: "top-right", duration: null });
      setLastId(toast({ title: "连接中断", description: "请检查网络后重试。", tone: "danger", position: "bottom-right", shape: "pill", duration: null }));
    }}>多位置同时显示</Button>
      </Inline>
      <p>多位置演示会先清空已有提示，再同时显示顶部居中、右上和右下各一条。</p>
    </Stack>
    <Stack gap="small">
      <h3>连续触发与数量管理</h3>
      <Grid minItemWidth={180} gap="medium">
        <Field label="最多显示" group><NumberInput ariaLabel="最多显示" value={maxVisible} onValueChange={onMaxVisibleChange} min={1} max={8} /></Field>
        <Field label="最多排队" group><NumberInput ariaLabel="最多排队" value={maxQueue} onValueChange={onMaxQueueChange} min={0} max={100} /></Field>
      </Grid>
      <p>当前页面共用一个 ToastProvider：默认最多显示 3 条、等待 20 条。调低显示上限不会强行移除已有提示，后续补位遵守新上限。等待队列满后忽略新提示，保留正在阅读或操作的提示；同一去重键只保留一条，重复触发不会重置计时。</p>
      <Inline gap="small" wrap>
    <Button onClick={sendBurst}>连续触发 10 条</Button>
    <Button onClick={() => setLastId(toast({ description: "同一操作重复点击只显示这条提示。", dedupeKey: "explorer-repeated-operation", duration: null, closable: true }))}>重复触发同一提示</Button>
    <Button variant="ghost" disabled={!lastId} onClick={() => { if (lastId) dismiss(lastId); setLastId(null); }}>关闭最近提示</Button>
    <Button variant="ghost" onClick={() => { dismissAll(); setLastId(null); }}>清空全部提示</Button>
      </Inline>
    </Stack>
  </Stack>;
}
function ToastExample() {
  const [maxVisible, setMaxVisible] = useState<number | "">(3);
  const [maxQueue, setMaxQueue] = useState<number | "">(20);
  return <ToastProvider maxVisible={maxVisible === "" ? 3 : maxVisible} maxQueue={maxQueue === "" ? 20 : maxQueue}>
    <ToastCommands maxVisible={maxVisible} maxQueue={maxQueue} onMaxVisibleChange={setMaxVisible} onMaxQueueChange={setMaxQueue} />
  </ToastProvider>;
}

const explorerCase = {
  id: "toast/overview",
  label: "轻提示与消息条",
  summary: "配置自动或手动关闭、持续时间、进度条、读秒、位置和形状；连续触发展示数量上限、排队与去重，并提供实际异步操作。",
  states: ["default", "loading", "error", "longContent", "keyboard", "overlay", "dark", "locale", "usage"],
  stateExamples: [
    { state: "default", exports: ["ToastProvider"], content: <ToastExample /> },
    { state: "loading", exports: ["ToastProvider"], content: <ToastExample />, instructions: "点击异步操作提示，再点击提示内的撤销，观察1200ms加载状态。" },
    { state: "error", exports: ["ToastProvider"], content: <ToastExample />, instructions: "点击右下错误胶囊查看错误消息；或点击操作失败提示，再点击撤销，观察加载、失败保留及重试入口。" },
    { state: "longContent", exports: ["ToastProvider"], content: <ToastExample />, instructions: "点击长内容提示，检查长正文的可读范围、局部滚动与关闭按钮；连续触发 10 条检查提示不会被挤压变形。" },
    { state: "keyboard", exports: ["ToastProvider"], content: <ToastExample />, instructions: "用Tab和Enter发送提示，聚焦关闭或撤销按钮操作；此项为人工操作入口，不是浏览器自动验收。" },
    { state: "overlay", exports: ["ToastProvider"], content: <StatePreview state="overlay"><ToastExample /></StatePreview> },
    { state: "dark", exports: ["ToastProvider"], content: <StatePreview state="dark"><ToastExample /></StatePreview> },
    { state: "locale", exports: ["ToastProvider"], content: <StatePreview state="locale"><ToastExample /></StatePreview> },
    { state: "usage", exports: ["useToast"], content: <ToastExample /> },
  ],
  content: <ToastExample />,
  code: `<ToastProvider maxVisible={3} maxQueue={20}><Page /></ToastProvider>\n\nconst { toast, dismiss, dismissAll } = useToast();\nconst id = toast({\n  description: "已保存", position: "top-center", shape: "rounded",\n  duration: 5000, countdown: false, showSeconds: true, closable: true,\n  dedupeKey: "save-settings",\n});\ndismiss(id);\n// 清空可见提示和等待队列\ndismissAll();`,
} satisfies ExplorerCase;
export default explorerCase;
