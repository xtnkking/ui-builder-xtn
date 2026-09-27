// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"sticky/overview","exports":["StickyHeaderActionBar"]}
import { Button, StickyHeaderActionBar } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const explorerCase = {
  id: "sticky/overview",
  label: "粘性操作栏",
  summary: "标题、说明和主要动作保持清晰分区，适合长表单顶部或底部。",
  states: ["default", "longContent", "mobile", "dark", "locale"],
  content: <StickyHeaderActionBar heading="编辑成员" description="尚有 2 项未保存" actions={<Button variant="primary">保存</Button>} />,
  code: `<StickyHeaderActionBar heading="编辑成员" actions={<Button>保存</Button>} />`,
} satisfies ExplorerCase;

export default explorerCase;
