// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"date-time/overview","exports":["DateField","DateRangeField","TimezoneSelect","DEFAULT_TIMEZONE_OPTIONS"]}
import { StatePreview } from "../state-preview";
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

function DisabledDateTimeExample() {
  return <div className="demo-number-case__grid">
    <Field label="禁用日期" htmlFor="explorer-date-disabled"><DateField id="explorer-date-disabled" precision="day" defaultValue="2026-10-09" disabled /></Field>
    <Field label="禁用日期范围" group><DateRangeField defaultValue={{ start: "2026-10-01", end: "2026-10-09" }} disabled /></Field>
    <Field label="禁用时区" htmlFor="explorer-timezone-disabled"><TimezoneSelect id="explorer-timezone-disabled" defaultValue="Asia/Shanghai" options={DEFAULT_TIMEZONE_OPTIONS} disabled /></Field>
  </div>;
}

function InvalidDateTimeExample() {
  return <div className="demo-number-case__grid">
    <Field label="截止日期" htmlFor="explorer-date-invalid" error="截止日期不能晚于 2026 年 10 月 1 日。"><DateField id="explorer-date-invalid" precision="day" defaultValue="2026-10-09" max="2026-10-01" aria-invalid /></Field>
    <Field label="日期范围" group error="结束日期不能早于开始日期。"><DateRangeField defaultValue={{ start: "2026-10-09", end: "2026-10-01" }} invalid rangeError="结束日期不能早于开始日期。" /></Field>
    <Field label="必选时区" htmlFor="explorer-timezone-invalid" error="请选择工作区时区。"><TimezoneSelect id="explorer-timezone-invalid" defaultValue="" options={DEFAULT_TIMEZONE_OPTIONS} required /></Field>
  </div>;
}

function LongDateTimeExample() {
  return <div className="demo-number-case__grid">
    <Field label="国际订阅平台跨区域结算工作区的账单统计截止日期，需要在完整业务名称之后保持日期输入控件的位置和标签关联" htmlFor="explorer-date-long"><DateField id="explorer-date-long" precision="day" defaultValue="2026-10-09" /></Field>
    <Field label="为国际订阅平台生成跨区域账单、安全审计报告和成员访问记录所使用的完整日期统计范围，请按照实际业务周期填写" group><DateRangeField defaultValue={{ start: "2026-10-01", end: "2026-10-09" }} /></Field>
    <Field label="国际订阅平台跨区域工作区的默认结算时区，应与账单统计日期、业务日切换时间和审计记录显示规则保持一致" htmlFor="explorer-timezone-long"><TimezoneSelect id="explorer-timezone-long" defaultValue="Asia/Shanghai" options={DEFAULT_TIMEZONE_OPTIONS} /></Field>
  </div>;
}

const explorerCase = {
  id: "date-time/overview",
  label: "日期、范围与时区",
  summary: "覆盖年、年月日时分秒、日期范围、只读时间以及默认时区数据。",
  states: ["default", "disabled", "readOnly", "controlled", "uncontrolled", "validation", "longContent", "keyboard", "overlay", "dark", "locale", "usage"] as const,
  stateExamples: [
    { state: "disabled", exports: ["DateField", "DateRangeField", "TimezoneSelect"], content: <DisabledDateTimeExample /> },
    { state: "readOnly", exports: ["DateRangeField"], content: <Field label="只读日期范围" group><DateRangeField defaultValue={{ start: "2026-10-01", end: "2026-10-09" }} readOnly /></Field> },
    { state: "uncontrolled", exports: ["DateRangeField", "TimezoneSelect"], content: <div className="demo-number-case__grid"><Field label="内部管理日期范围" group><DateRangeField defaultValue={{ start: "2026-10-01", end: "2026-10-09" }} /></Field><Field label="内部管理时区" htmlFor="explorer-timezone-default"><TimezoneSelect id="explorer-timezone-default" defaultValue="Asia/Shanghai" options={DEFAULT_TIMEZONE_OPTIONS} /></Field></div> },
    { state: "validation", exports: ["DateField", "DateRangeField", "TimezoneSelect"], content: <InvalidDateTimeExample /> },
    { state: "longContent", exports: ["DateField", "DateRangeField", "TimezoneSelect"], content: <LongDateTimeExample /> },
    { state: "default", exports: ["DateField","DateRangeField","TimezoneSelect"], content: <DateTimeExample /> },
    { state: "readOnly", exports: ["DateField"], content: <DateTimeExample /> },
    { state: "controlled", exports: ["DateField","DateRangeField","TimezoneSelect"], content: <DateTimeExample /> },
    { state: "uncontrolled", exports: ["DateField"], content: <DateTimeExample /> },
    { state: "keyboard", exports: ["DateField","DateRangeField","TimezoneSelect"], content: <DateTimeExample />, instructions: "用 Tab 访问本例可用控件，使用 Enter、Space 和组件文档中的方向键操作。此项为人工操作案例，不是自动行为验收证书。" },
    { state: "overlay", exports: ["DateField","DateRangeField","TimezoneSelect"], content: <StatePreview state="overlay">{<DateTimeExample />}</StatePreview> },
    { state: "dark", exports: ["DateField","DateRangeField","TimezoneSelect"], content: <StatePreview state="dark">{<DateTimeExample />}</StatePreview> },
    { state: "locale", exports: ["DateField","DateRangeField","TimezoneSelect"], content: <StatePreview state="locale">{<DateTimeExample />}</StatePreview> },
    { state: "usage", exports: ["DEFAULT_TIMEZONE_OPTIONS"], content: <DateTimeExample /> },
  ],
  content: <DateTimeExample />,
  code: `<DateField precision="second" value={dateTime} onChange={handleChange} />\n<DateRangeField precision="day" value={range} onValueChange={setRange} />\n<TimezoneSelect value={timezone} onValueChange={setTimezone} options={DEFAULT_TIMEZONE_OPTIONS} />`,
} satisfies ExplorerCase;

export default explorerCase;
