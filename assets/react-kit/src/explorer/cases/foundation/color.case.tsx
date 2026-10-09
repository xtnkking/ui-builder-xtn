// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"color/overview","exports":["ThemeProvider"]}
import { StatePreview } from "../state-preview";
import { Stack, Tag, ThemeProvider } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const explorerCase = {
  id: "color/overview",
  label: "主题与语义色",
  summary: "主题容器统一承接浅色、深色和品牌 token，不让业务页面绕过公共主题入口。",
  states: ["default", "dark", "locale"],
  stateExamples: [
    { state: "default", exports: ["ThemeProvider"], content: <ThemeProvider mode="light"><Stack gap="small"><Tag tone="blue">品牌色</Tag><Tag tone="success">成功</Tag><Tag tone="danger">危险</Tag></Stack></ThemeProvider> },
    { state: "dark", exports: ["ThemeProvider"], content: <StatePreview state="dark"><ThemeProvider mode="dark"><Stack gap="small"><Tag tone="blue">品牌色</Tag><Tag tone="success">成功</Tag><Tag tone="danger">危险</Tag></Stack></ThemeProvider></StatePreview> },
    { state: "locale", exports: ["ThemeProvider"], content: <StatePreview state="locale"><ThemeProvider mode="light"><Stack gap="small"><Tag tone="blue">Brand</Tag><Tag tone="success">Success</Tag><Tag tone="danger">Danger</Tag></Stack></ThemeProvider></StatePreview> },
  ],
  content: <ThemeProvider mode="light"><Stack gap="small"><Tag tone="blue">品牌色</Tag><Tag tone="success">成功</Tag><Tag tone="danger">危险</Tag></Stack></ThemeProvider>,
  code: `<ThemeProvider mode="light">{children}</ThemeProvider>`,
} satisfies ExplorerCase;

export default explorerCase;
