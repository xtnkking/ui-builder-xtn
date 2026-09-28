// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"calendar/overview","exports":["Calendar"]}
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

const explorerCase = {
  id: "calendar/overview",
  label: "受控日期网格",
  summary: "月份与日期分别受控，方向键、月份翻页和禁用日期均由 Calendar 管理。",
  states: ["default", "disabled", "readOnly", "controlled", "validation", "keyboard", "overlay", "dark", "locale"],
  content: <CalendarExample />,
  code: `<Calendar month={month} onMonthChange={setMonth} value={value} onValueChange={setValue} locale="zh-CN" />`,
} satisfies ExplorerCase;

export default explorerCase;
