// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"divider/overview","exports":["Divider"]}
import { StatePreview } from "../state-preview";
import { Divider, Stack } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const explorerCase = {
  id: "divider/overview",
  label: "分隔线",
  summary: "分隔线区分内容组，装饰用途和有语义用途由属性明确选择。",
  states: ["default", "mobile", "dark", "locale"],
  stateExamples: [
    { state: "default", exports: ["Divider"], content: <Stack gap="medium"><span>账户信息</span><Divider /><span>安全设置</span></Stack> },
    { state: "mobile", exports: ["Divider"], content: <StatePreview state="mobile">{<Stack gap="medium"><span>账户信息</span><Divider /><span>安全设置</span></Stack>}</StatePreview> },
    { state: "dark", exports: ["Divider"], content: <StatePreview state="dark">{<Stack gap="medium"><span>账户信息</span><Divider /><span>安全设置</span></Stack>}</StatePreview> },
    { state: "locale", exports: ["Divider"], content: <StatePreview state="locale">{<Stack gap="medium"><span>账户信息</span><Divider /><span>安全设置</span></Stack>}</StatePreview> },
  ],
  content: <Stack gap="medium"><span>账户信息</span><Divider /><span>安全设置</span></Stack>,
  code: `<Divider />`,
} satisfies ExplorerCase;

export default explorerCase;
