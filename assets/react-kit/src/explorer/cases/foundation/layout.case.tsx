// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"layout/overview","exports":["Box","Stack","Inline"]}
import { StatePreview } from "../state-preview";
import { Box, Button, Inline, Stack, Tag } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const explorerCase = {
  id: "layout/overview",
  label: "布局原语",
  summary: "Box、Stack 和 Inline 共同表达表面、垂直节奏与横向操作，不依赖页面私有间距。",
  states: ["default", "longContent", "mobile", "dark", "locale"],
  stateExamples: [
    { state: "longContent", exports: ["Box", "Stack", "Inline"], content: <Box padding="large" surface="subtle"><Stack gap="medium"><Inline wrap>跨区域成员权限审核、账户安全策略和通知偏好设置需要使用完整可读的标题与描述，长内容应自然换行并保留清晰的操作间距。</Inline><Inline wrap><Button>保存</Button><Button>取消</Button></Inline></Stack></Box> },
    { state: "default", exports: ["Box","Stack","Inline"], content: <Box padding="large" surface="subtle"><Stack gap="medium"><strong>团队权限</strong><Inline gap="small"><Tag tone="blue">12 名成员</Tag><Tag>3 个角色</Tag></Inline><Inline justify="end"><Button>取消</Button><Button variant="primary">保存</Button></Inline></Stack></Box> },
    { state: "mobile", exports: ["Box","Stack","Inline"], content: <StatePreview state="mobile">{<Box padding="large" surface="subtle"><Stack gap="medium"><strong>团队权限</strong><Inline gap="small"><Tag tone="blue">12 名成员</Tag><Tag>3 个角色</Tag></Inline><Inline justify="end"><Button>取消</Button><Button variant="primary">保存</Button></Inline></Stack></Box>}</StatePreview> },
    { state: "dark", exports: ["Box","Stack","Inline"], content: <StatePreview state="dark">{<Box padding="large" surface="subtle"><Stack gap="medium"><strong>团队权限</strong><Inline gap="small"><Tag tone="blue">12 名成员</Tag><Tag>3 个角色</Tag></Inline><Inline justify="end"><Button>取消</Button><Button variant="primary">保存</Button></Inline></Stack></Box>}</StatePreview> },
    { state: "locale", exports: ["Box","Stack","Inline"], content: <StatePreview state="locale">{<Box padding="large" surface="subtle"><Stack gap="medium"><strong>团队权限</strong><Inline gap="small"><Tag tone="blue">12 名成员</Tag><Tag>3 个角色</Tag></Inline><Inline justify="end"><Button>取消</Button><Button variant="primary">保存</Button></Inline></Stack></Box>}</StatePreview> },
  ],
  content: <Box padding="large" surface="subtle"><Stack gap="medium"><strong>团队权限</strong><Inline gap="small"><Tag tone="blue">12 名成员</Tag><Tag>3 个角色</Tag></Inline><Inline justify="end"><Button>取消</Button><Button variant="primary">保存</Button></Inline></Stack></Box>,
  code: `<Box padding="large"><Stack><Inline>{actions}</Inline></Stack></Box>`,
} satisfies ExplorerCase;

export default explorerCase;
