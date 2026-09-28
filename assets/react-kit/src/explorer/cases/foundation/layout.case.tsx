// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"layout/overview","exports":["Box","Stack","Inline"]}
import { Box, Button, Inline, Stack, Tag } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const explorerCase = {
  id: "layout/overview",
  label: "布局原语",
  summary: "Box、Stack 和 Inline 共同表达表面、垂直节奏与横向操作，不依赖页面私有间距。",
  states: ["default", "longContent", "mobile", "dark", "locale"],
  content: <Box padding="large" surface="subtle"><Stack gap="medium"><strong>团队权限</strong><Inline gap="small"><Tag tone="blue">12 名成员</Tag><Tag>3 个角色</Tag></Inline><Inline justify="end"><Button>取消</Button><Button variant="primary">保存</Button></Inline></Stack></Box>,
  code: `<Box padding="large"><Stack><Inline>{actions}</Inline></Stack></Box>`,
} satisfies ExplorerCase;

export default explorerCase;
