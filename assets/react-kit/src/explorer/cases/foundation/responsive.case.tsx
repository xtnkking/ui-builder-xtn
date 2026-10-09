// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"responsive/overview","exports":["Grid"]}
import { StatePreview } from "../state-preview";
import { Box, Grid } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const explorerCase = {
  id: "responsive/overview",
  label: "响应式网格",
  summary: "网格使用稳定的最小列宽，在窄屏自然换行而不改变内容层级。",
  states: ["default", "longContent", "mobile", "dark", "locale"],
  stateExamples: [
    { state: "longContent", exports: ["Grid"], content: <Grid minItemWidth="150px"><Box padding="medium" surface="subtle">查看所有区域的团队成员访问权限、账户安全策略和待处理的批量审批记录，验证网格内长文本自然换行。</Box><Box padding="medium" surface="subtle">当前任务</Box></Grid> },
    { state: "default", exports: ["Grid"], content: <Grid minItemWidth="150px"><Box padding="medium" surface="subtle">概览</Box><Box padding="medium" surface="subtle">最近活动</Box><Box padding="medium" surface="subtle">待处理事项</Box></Grid> },
    { state: "mobile", exports: ["Grid"], content: <StatePreview state="mobile">{<Grid minItemWidth="150px"><Box padding="medium" surface="subtle">概览</Box><Box padding="medium" surface="subtle">最近活动</Box><Box padding="medium" surface="subtle">待处理事项</Box></Grid>}</StatePreview> },
    { state: "dark", exports: ["Grid"], content: <StatePreview state="dark">{<Grid minItemWidth="150px"><Box padding="medium" surface="subtle">概览</Box><Box padding="medium" surface="subtle">最近活动</Box><Box padding="medium" surface="subtle">待处理事项</Box></Grid>}</StatePreview> },
    { state: "locale", exports: ["Grid"], content: <StatePreview state="locale">{<Grid minItemWidth="150px"><Box padding="medium" surface="subtle">概览</Box><Box padding="medium" surface="subtle">最近活动</Box><Box padding="medium" surface="subtle">待处理事项</Box></Grid>}</StatePreview> },
  ],
  content: <Grid minItemWidth="150px"><Box padding="medium" surface="subtle">概览</Box><Box padding="medium" surface="subtle">最近活动</Box><Box padding="medium" surface="subtle">待处理事项</Box></Grid>,
  code: `<Grid minItemWidth="150px">{items}</Grid>`,
} satisfies ExplorerCase;

export default explorerCase;
