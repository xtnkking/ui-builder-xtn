// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"scheduler/overview","exports":["Scheduler"]}
import { StatePreview } from "../state-preview";
import { useState } from "react";
import { Scheduler } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

function SchedulerExample() {
  const [date, setDate] = useState(() => new Date(2026, 8, 22));
  const [message, setMessage] = useState("选择日程查看详情");
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <Scheduler
        date={date}
        onDateChange={setDate}
        locale="zh-CN"
        timeZone="Asia/Shanghai"
        onEventPress={(event) => setMessage(`已选择：${event.textValue}`)}
        events={[
          { id: "review", title: "发布复核", textValue: "发布复核", start: new Date(2026, 8, 22, 9), end: new Date(2026, 8, 22, 10), meta: "会议室 A" },
          { id: "handoff", title: "交接会议", textValue: "交接会议", start: new Date(2026, 8, 22, 14), end: new Date(2026, 8, 22, 15, 30), meta: "线上" },
        ]}
      />
      <span role="status">{message}</span>
    </div>
  );
}

function EnglishSchedulerExample() {
  const [date, setDate] = useState(() => new Date(2026, 8, 22));
  const [selected, setSelected] = useState("No event selected");
  return <><Scheduler date={date} onDateChange={setDate} locale="en-US" timeZone="Asia/Shanghai" events={[{ id: "review", title: "Release review", textValue: "Release review", start: new Date(2026, 8, 22, 9), end: new Date(2026, 8, 22, 10) }]} onEventPress={(event) => setSelected(event.textValue)} /><p role="status">{selected}</p></>;
}

const explorerCase = {
  id: "scheduler/overview",
  label: "日程视图",
  summary: "日期切换和日程选择均保持真实回调，时间按指定 locale 与时区格式化。",
  states: ["default", "controlled", "empty", "longContent", "keyboard", "overlay", "dark", "locale"],
  stateExamples: [
    { state: "controlled", exports: ["Scheduler"], content: <SchedulerExample /> },
    { state: "empty", exports: ["Scheduler"], content: <Scheduler date={new Date(2026, 8, 22)} events={[]} locale="zh-CN" timeZone="Asia/Shanghai" /> },
    { state: "longContent", exports: ["Scheduler"], content: <Scheduler date={new Date(2026, 8, 22)} timeZone="Asia/Shanghai" events={[{ id: "review", title: "此日程用于复核全部产品中的角色配置、数据访问权限、通知偏好和账户安全设置，请确认所有关联配置均符合团队的实际使用要求。", textValue: "完整配置复核", start: new Date(2026, 8, 22, 9), end: new Date(2026, 8, 22, 11) }]} /> },
    { state: "default", exports: ["Scheduler"], content: <SchedulerExample /> },
    { state: "keyboard", exports: ["Scheduler"], content: <SchedulerExample />, instructions: "用 Tab 访问本例可用控件，使用 Enter、Space 和组件文档中的方向键操作。此项为人工操作案例，不是自动行为验收证书。" },
    { state: "overlay", exports: ["Scheduler"], content: <StatePreview state="overlay">{<SchedulerExample />}</StatePreview> },
    { state: "dark", exports: ["Scheduler"], content: <StatePreview state="dark">{<SchedulerExample />}</StatePreview> },
    { state: "locale", exports: ["Scheduler"], content: <StatePreview state="locale"><EnglishSchedulerExample /></StatePreview> },
  ],
  content: <SchedulerExample />,
  code: `<Scheduler date={date} onDateChange={setDate} events={events} onEventPress={openEvent} timeZone="Asia/Shanghai" />`,
} satisfies ExplorerCase;

export default explorerCase;
