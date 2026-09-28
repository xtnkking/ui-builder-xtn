// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"chart/overview","exports":["BarChart"]}
import { BarChart } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const explorerCase = {
  id: "chart/overview",
  label: "条形图",
  summary: "图形同时提供可访问名称和文本数值，不依赖颜色单独传递信息。",
  states: ["default", "empty", "error", "longContent", "dark", "locale"],
  content: (
    <BarChart
      ariaLabel="最近四周成功请求量"
      data={[
        { id: "w1", label: "第 1 周", value: 82 },
        { id: "w2", label: "第 2 周", value: 116 },
        { id: "w3", label: "第 3 周", value: 97 },
        { id: "w4", label: "第 4 周", value: 134 },
      ]}
      formatValue={(value) => `${value} 万次`}
    />
  ),
  code: `<BarChart ariaLabel="每周请求量" data={weeklyData} formatValue={(value) => \`\${value} 万次\`} />`,
} satisfies ExplorerCase;

export default explorerCase;
