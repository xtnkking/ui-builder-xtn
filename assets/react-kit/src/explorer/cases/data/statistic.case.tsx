// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"statistic/overview","exports":["Statistic"]}
import { StatePreview } from "../state-preview";
import { Statistic } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const explorerCase = {
  id: "statistic/overview",
  label: "关键指标",
  summary: "数值、单位、趋势和补充说明保持独立层级，适合仪表盘中的单项指标。",
  states: ["default", "longContent", "dark", "locale"],
  stateExamples: [
    { state: "longContent", exports: ["Statistic"], content: <Statistic label="本月成功请求" value="128,460" suffix="次" description="此统计包含全部产品中的角色配置、数据访问权限、通知偏好和账户安全设置相关请求，请确认所有配置均符合团队的实际使用要求。" /> },
    { state: "default", exports: ["Statistic"], content: (
    <Statistic
      label="本月成功请求"
      value={new Intl.NumberFormat("zh-CN").format(128460)}
      suffix="次"
      trend={{ direction: "up", value: "+8.4%", label: "较上月", tone: "positive" }}
      description="统计周期：2026 年 9 月"
    />
  ) },
    { state: "dark", exports: ["Statistic"], content: <StatePreview state="dark">{(
    <Statistic
      label="本月成功请求"
      value={new Intl.NumberFormat("zh-CN").format(128460)}
      suffix="次"
      trend={{ direction: "up", value: "+8.4%", label: "较上月", tone: "positive" }}
      description="统计周期：2026 年 9 月"
    />
  )}</StatePreview> },
    { state: "locale", exports: ["Statistic"], content: <StatePreview state="locale">{(
    <Statistic
      label="本月成功请求"
      value={new Intl.NumberFormat("zh-CN").format(128460)}
      suffix="次"
      trend={{ direction: "up", value: "+8.4%", label: "较上月", tone: "positive" }}
      description="统计周期：2026 年 9 月"
    />
  )}</StatePreview> },
  ],
  content: (
    <Statistic
      label="本月成功请求"
      value={new Intl.NumberFormat("zh-CN").format(128460)}
      suffix="次"
      trend={{ direction: "up", value: "+8.4%", label: "较上月", tone: "positive" }}
      description="统计周期：2026 年 9 月"
    />
  ),
  code: `<Statistic label="本月成功请求" value="128,460" suffix="次" trend={{ direction: "up", value: "+8.4%" }} />`,
} satisfies ExplorerCase;

export default explorerCase;
