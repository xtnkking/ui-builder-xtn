// @ui-coverage {"kind":"example","runner":"explorer","caseId":"locale/overview","exports":["LocaleProvider","useUILocale"]}
import { StatePreview } from "../state-preview";
import { Field, Grid, Inline, LocaleProvider, Pagination, Stack, Tag, useUILocale } from "../../../ui";
import type { ExplorerCase } from "../types";

function LocaleSummary({ label }: { label: string }) {
  const { formatDate, formatNumber, locale, plural } = useUILocale();
  return (
    <Stack gap="small" data-locale-example={locale}>
      <Inline gap="small" align="center">
        <strong>{label}</strong>
        <Tag tone="blue">{locale}</Tag>
      </Inline>
      <span>{formatDate(Date.UTC(2026, 8, 22), { dateStyle: "long", timeZone: "UTC" })}</span>
      <span>{formatNumber(1234567.89, { maximumFractionDigits: 2 })}</span>
      <span>{plural("pagination.results", 12)}</span>
      <Pagination page={2} pageCount={8} total={154} pageSize={20} onPageChange={() => undefined} />
    </Stack>
  );
}

function LongLocaleContent() {
  const { formatDate, formatNumber } = useUILocale();
  return <Stack gap="medium"><span>{formatDate(Date.UTC(2026, 8, 22, 23, 59, 59), { dateStyle: "full", timeStyle: "long", timeZone: "UTC" })}</span><span>{formatNumber(1234567890123.89, { style: "currency", currency: "USD" })}</span></Stack>;
}

const explorerCase = {
  id: "locale/overview",
  label: "语言、数字与日期",
  summary: "LocaleProvider 独立管理语言与时区；组件文案、ARIA、数字、日期和复数从同一逻辑上下文读取。",
  states: ["usage", "locale", "longContent"],
  stateExamples: [
    { state: "longContent", exports: ["LocaleProvider", "useUILocale"], content: <Field group label="Long localized dates, large currency amounts, and complete accessible descriptions for cross-region financial reports"><LocaleProvider locale="en-US" timeZone="UTC"><LongLocaleContent /></LocaleProvider></Field> },
    { state: "usage", exports: ["LocaleProvider","useUILocale"], content: (
    <Grid minItemWidth={280} gap="large">
      <LocaleProvider locale="zh-CN" timeZone="Asia/Shanghai">
        <LocaleSummary label="默认中文" />
      </LocaleProvider>
      <LocaleProvider locale="en-US" timeZone="America/New_York">
        <LocaleSummary label="Long English labels" />
      </LocaleProvider>
    </Grid>
  ) },
    { state: "locale", exports: ["LocaleProvider","useUILocale"], content: <StatePreview state="locale">{(
    <Grid minItemWidth={280} gap="large">
      <LocaleProvider locale="zh-CN" timeZone="Asia/Shanghai">
        <LocaleSummary label="默认中文" />
      </LocaleProvider>
      <LocaleProvider locale="en-US" timeZone="America/New_York">
        <LocaleSummary label="Long English labels" />
      </LocaleProvider>
    </Grid>
  )}</StatePreview> },
  ],
  content: (
    <Grid minItemWidth={280} gap="large">
      <LocaleProvider locale="zh-CN" timeZone="Asia/Shanghai">
        <LocaleSummary label="默认中文" />
      </LocaleProvider>
      <LocaleProvider locale="en-US" timeZone="America/New_York">
        <LocaleSummary label="Long English labels" />
      </LocaleProvider>
    </Grid>
  ),
  code: `import { LocaleProvider, useUILocale } from "./ui";

function Price() {
  const { formatNumber } = useUILocale();
  return <span>{formatNumber(1288, { style: "currency", currency: "USD" })}</span>;
}

<LocaleProvider locale="en-US" timeZone="America/New_York">
  <Price />
</LocaleProvider>`,
} satisfies ExplorerCase;

export default explorerCase;
