// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"chart/overview","exports":["BarChart"]}
import { StatePreview } from "../state-preview";
import { BarChart } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const explorerCase = {
  id: "chart/overview",
  label: "条形图",
  summary: "图形同时提供可访问名称和文本数值，不依赖颜色单独传递信息。",
  states: ["default", "empty", "longContent", "dark", "locale"],
  stateExamples: [
    { state: "empty", exports: ["BarChart"], content: <><BarChart ariaLabel="当前没有请求记录" data={[]} /><p>没有图表数据；页面提供空态文案。</p></> },
    { state: "longContent", exports: ["BarChart"], content: <BarChart ariaLabel="详细请求类别" data={[{ id: "all", label: "此统计类别包含全部产品中的角色配置、数据访问权限、通知偏好和账户安全设置相关请求，请确认所有配置均符合团队的实际使用要求。", value: 82 }]} /> },
    { state: "default", exports: ["BarChart"], content: (
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
  ) },
    { state: "dark", exports: ["BarChart"], content: <StatePreview state="dark">{(
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
  )}</StatePreview> },
    { state: "locale", exports: ["BarChart"], content: <StatePreview state="locale">{(
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
  )}</StatePreview> },
  ],
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
