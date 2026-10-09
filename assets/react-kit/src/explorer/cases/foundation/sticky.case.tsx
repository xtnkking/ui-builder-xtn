// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"sticky/overview","exports":["StickyHeaderActionBar"]}
import { StatePreview } from "../state-preview";
import { Button, StickyHeaderActionBar } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const explorerCase = {
  id: "sticky/overview",
  label: "粘性操作栏",
  summary: "标题、说明和主要动作保持清晰分区，适合长表单顶部或底部。",
  states: ["default", "longContent", "mobile", "dark", "locale"],
  stateExamples: [
    { state: "longContent", exports: ["StickyHeaderActionBar"], content: <StickyHeaderActionBar heading="编辑跨区域成员权限" actions={<Button variant="primary">保存</Button>}>修改所有产品中的角色、数据访问范围和通知偏好后，请确认每项变更的责任人、审批记录与回滚条件，长说明应保留完整的可读内容。</StickyHeaderActionBar> },
    { state: "default", exports: ["StickyHeaderActionBar"], content: <StickyHeaderActionBar heading="编辑成员" description="尚有 2 项未保存" actions={<Button variant="primary">保存</Button>} /> },
    { state: "mobile", exports: ["StickyHeaderActionBar"], content: <StatePreview state="mobile">{<StickyHeaderActionBar heading="编辑成员" description="尚有 2 项未保存" actions={<Button variant="primary">保存</Button>} />}</StatePreview> },
    { state: "dark", exports: ["StickyHeaderActionBar"], content: <StatePreview state="dark">{<StickyHeaderActionBar heading="编辑成员" description="尚有 2 项未保存" actions={<Button variant="primary">保存</Button>} />}</StatePreview> },
    { state: "locale", exports: ["StickyHeaderActionBar"], content: <StatePreview state="locale">{<StickyHeaderActionBar heading="编辑成员" description="尚有 2 项未保存" actions={<Button variant="primary">保存</Button>} />}</StatePreview> },
  ],
  content: <StickyHeaderActionBar heading="编辑成员" description="尚有 2 项未保存" actions={<Button variant="primary">保存</Button>} />,
  code: `<StickyHeaderActionBar heading="编辑成员" actions={<Button>保存</Button>} />`,
} satisfies ExplorerCase;

export default explorerCase;
