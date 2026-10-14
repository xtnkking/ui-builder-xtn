// @ui-coverage {"kind":"example","runner":"explorer","caseId":"color/overview","exports":["ThemeProvider"]}
import { StatePreview } from "../state-preview";
import { Box, Button, Inline, Stack, Tag, ThemeProvider } from "../../../ui";
import type { ExplorerCase } from "../types";

const explorerCase = {
  id: "color/overview",
  label: "主题与语义色",
  summary: "主题容器统一承接品牌色、默认／苹果／Material 风格与实底／磨砂材质；打开主题工作台可交互对比并查看弹层。",
  states: ["default", "dark", "locale"],
  stateExamples: [
    { state: "default", exports: ["ThemeProvider"], content: <ThemeProvider mode="light"><Stack gap="small"><Tag tone="blue">品牌色</Tag><Tag tone="success">成功</Tag><Tag tone="danger">危险</Tag></Stack></ThemeProvider> },
    { state: "dark", exports: ["ThemeProvider"], content: <StatePreview state="dark"><ThemeProvider mode="dark"><Stack gap="small"><Tag tone="blue">品牌色</Tag><Tag tone="success">成功</Tag><Tag tone="danger">危险</Tag></Stack></ThemeProvider></StatePreview> },
    { state: "locale", exports: ["ThemeProvider"], content: <StatePreview state="locale"><ThemeProvider mode="light"><Stack gap="small"><Tag tone="blue">Brand</Tag><Tag tone="success">Success</Tag><Tag tone="danger">Danger</Tag></Stack></ThemeProvider></StatePreview> },
  ],
  content: <Inline gap="large" align="stretch">
    <ThemeProvider mode="light" preset="default" material="solid"><Box padding="medium" surface="raised"><Stack gap="small"><Tag tone="blue">默认 Default</Tag><Button variant="primary">保存设置</Button></Stack></Box></ThemeProvider>
    <ThemeProvider mode="light" preset="apple" material="glass"><Box padding="medium" surface="raised"><Stack gap="small"><Tag tone="blue">苹果风格 Apple-inspired</Tag><Button variant="primary">保存设置</Button></Stack></Box></ThemeProvider>
    <ThemeProvider mode="light" preset="material" material="solid"><Box padding="medium" surface="raised"><Stack gap="small"><Tag tone="blue">Material 风格</Tag><Button variant="primary">保存设置</Button></Stack></Box></ThemeProvider>
  </Inline>,
  code: `<ThemeProvider mode="light" preset="apple" material="glass">\n  <Button variant="primary">保存设置</Button>\n</ThemeProvider>`,
} satisfies ExplorerCase;

export default explorerCase;
