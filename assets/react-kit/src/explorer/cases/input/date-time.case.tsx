// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"date-time/overview","exports":["DateField","DateRangeField","TimezoneSelect","DEFAULT_TIMEZONE_OPTIONS"]}
import { useState } from "react";
import { DEFAULT_TIMEZONE_OPTIONS, DateField, DateRangeField, Field, TimezoneSelect, type DateRangeValue } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

function DateTimeExample() {
  const [year, setYear] = useState("2026");
  const [dateTime, setDateTime] = useState("2026-09-22T10:30:00");
  const [range, setRange] = useState<DateRangeValue>({ start: "2026-09-22", end: "2026-09-30" });
  const [timezone, setTimezone] = useState("Asia/Shanghai");
  return (
    <div className="demo-number-case__grid">
      <Field label="年份" htmlFor="explorer-year"><DateField id="explorer-year" precision="year" value={year} onChange={(event) => setYear(event.currentTarget.value)} min="2020" max="2030" /></Field>
      <Field label="日期与时间（秒）" htmlFor="explorer-datetime"><DateField id="explorer-datetime" precision="second" value={dateTime} onChange={(event) => setDateTime(event.currentTarget.value)} /></Field>
      <Field label="统计周期" group><DateRangeField precision="day" value={range} onValueChange={setRange} required /></Field>
      <Field label="时区" htmlFor="explorer-timezone"><TimezoneSelect id="explorer-timezone" value={timezone} onValueChange={setTimezone} options={DEFAULT_TIMEZONE_OPTIONS} ariaLabel="时区" /></Field>
      <Field label="只读时间" htmlFor="explorer-time-readonly"><DateField id="explorer-time-readonly" precision="time" defaultValue="09:30" readOnly /></Field>
    </div>
  );
}

const explorerCase = {
  id: "date-time/overview",
  label: "日期、范围与时区",
  summary: "覆盖年、年月日时分秒、日期范围、只读时间以及默认时区数据。",
  states: ["default", "disabled", "readOnly", "controlled", "uncontrolled", "validation", "longContent", "keyboard", "overlay", "dark", "locale", "usage"] as const,
  content: <DateTimeExample />,
  code: `<DateField precision="second" value={dateTime} onChange={handleChange} />\n<DateRangeField precision="day" value={range} onValueChange={setRange} />\n<TimezoneSelect value={timezone} onValueChange={setTimezone} options={DEFAULT_TIMEZONE_OPTIONS} />`,
} satisfies ExplorerCase;

export default explorerCase;
