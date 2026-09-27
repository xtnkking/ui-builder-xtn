// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"portal/overview","exports":["Portal"]}
import { Box, Portal } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const explorerCase = {
  id: "portal/overview",
  label: "Portal 容器",
  summary: "浮层内容可移入目标容器并同步主题 token；案例以内联模式保持预览稳定。",
  states: ["default", "longContent", "mobile", "dark", "locale"],
  content: <Portal disabled><Box padding="medium" surface="raised">Portal 内容</Box></Portal>,
  code: `<Portal container={overlayRoot}>{overlay}</Portal>`,
} satisfies ExplorerCase;

export default explorerCase;
