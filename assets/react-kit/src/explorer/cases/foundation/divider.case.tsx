// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"divider/overview","exports":["Divider"]}
import { Divider, Stack } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const explorerCase = {
  id: "divider/overview",
  label: "分隔线",
  summary: "分隔线区分内容组，装饰用途和有语义用途由属性明确选择。",
  states: ["default", "longContent", "mobile", "dark", "locale"],
  content: <Stack gap="medium"><span>账户信息</span><Divider /><span>安全设置</span></Stack>,
  code: `<Divider />`,
} satisfies ExplorerCase;

export default explorerCase;
