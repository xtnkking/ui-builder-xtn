// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"calendar/overview","exports":["Calendar"]}
import { StatePreview } from "../state-preview";
import { useState } from "react";
import { Calendar } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

function CalendarExample() {
  const [month, setMonth] = useState(() => new Date(2026, 8, 1));
  const [value, setValue] = useState(() => new Date(2026, 8, 22));
  return (
    <Calendar
      ariaLabel="选择复核日期"
      locale="zh-CN"
      month={month}
      onMonthChange={setMonth}
      value={value}
      onValueChange={setValue}
      min={new Date(2026, 7, 1)}
      max={new Date(2026, 10, 30)}
      isDateDisabled={(date) => date.getDay() === 0}
    />
  );
}

function EnglishCalendarExample() {
  const [month, setMonth] = useState(() => new Date(2026, 8, 1));
  const [value, setValue] = useState(() => new Date(2026, 8, 22));
  return <Calendar ariaLabel="Select review date" locale="en-US" month={month} onMonthChange={setMonth} value={value} onValueChange={setValue} />;
}

const explorerCase = {
  id: "calendar/overview",
  label: "受控日期网格",
  summary: "月份与日期分别受控，方向键、月份翻页和禁用日期均由 Calendar 管理。",
  states: ["default", "disabled", "controlled", "uncontrolled", "keyboard", "overlay", "dark", "locale"],
  stateExamples: [
    { state: "disabled", exports: ["Calendar"], instructions: "本例所有日期禁用；没有月份变更回调，翻页按钮也不能操作。Calendar 不提供整体 disabled 参数。", content: <Calendar ariaLabel="全部日期不可用" month={new Date(2026, 8, 1)} isDateDisabled={() => true} /> },
    { state: "uncontrolled", exports: ["Calendar"], instructions: "初始日期由 defaultValue 提供；点击可用日期后组件维护选择，月份仍由页面给定。", content: <Calendar ariaLabel="非受控日期选择" month={new Date(2026, 8, 1)} defaultValue={new Date(2026, 8, 22)} /> },
    { state: "default", exports: ["Calendar"], content: <CalendarExample /> },
    { state: "controlled", exports: ["Calendar"], content: <CalendarExample /> },
    { state: "keyboard", exports: ["Calendar"], content: <CalendarExample />, instructions: "用 Tab 访问本例可用控件，使用 Enter、Space 和组件文档中的方向键操作。此项为人工操作案例，不是自动行为验收证书。" },
    { state: "overlay", exports: ["Calendar"], content: <StatePreview state="overlay">{<CalendarExample />}</StatePreview> },
    { state: "dark", exports: ["Calendar"], content: <StatePreview state="dark">{<CalendarExample />}</StatePreview> },
    { state: "locale", exports: ["Calendar"], content: <StatePreview state="locale"><EnglishCalendarExample /></StatePreview> },
  ],
  content: <CalendarExample />,
  code: `<Calendar month={month} onMonthChange={setMonth} value={value} onValueChange={setValue} locale="zh-CN" />`,
} satisfies ExplorerCase;

export default explorerCase;
