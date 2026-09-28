// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"scheduler/overview","exports":["Scheduler"]}
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

const explorerCase = {
  id: "scheduler/overview",
  label: "日程视图",
  summary: "日期切换和日程选择均保持真实回调，时间按指定 locale 与时区格式化。",
  states: ["default", "disabled", "readOnly", "controlled", "validation", "keyboard", "overlay", "dark", "locale"],
  content: <SchedulerExample />,
  code: `<Scheduler date={date} onDateChange={setDate} events={events} onEventPress={openEvent} timeZone="Asia/Shanghai" />`,
} satisfies ExplorerCase;

export default explorerCase;
