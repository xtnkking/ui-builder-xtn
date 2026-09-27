// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"statistic/overview","exports":["Statistic"]}
import { Statistic } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const explorerCase = {
  id: "statistic/overview",
  label: "关键指标",
  summary: "数值、单位、趋势和补充说明保持独立层级，适合仪表盘中的单项指标。",
  states: ["default", "empty", "error", "longContent", "dark", "locale"],
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
