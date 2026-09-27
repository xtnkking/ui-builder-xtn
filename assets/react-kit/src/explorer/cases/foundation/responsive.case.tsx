// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"responsive/overview","exports":["Grid"]}
import { Box, Grid } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const explorerCase = {
  id: "responsive/overview",
  label: "响应式网格",
  summary: "网格使用稳定的最小列宽，在窄屏自然换行而不改变内容层级。",
  states: ["default", "longContent", "mobile", "dark", "locale"],
  content: <Grid minItemWidth="150px"><Box padding="medium" surface="subtle">概览</Box><Box padding="medium" surface="subtle">最近活动</Box><Box padding="medium" surface="subtle">待处理事项</Box></Grid>,
  code: `<Grid minItemWidth="150px">{items}</Grid>`,
} satisfies ExplorerCase;

export default explorerCase;
