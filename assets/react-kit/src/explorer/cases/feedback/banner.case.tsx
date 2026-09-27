// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"banner/overview","exports":["Banner"]}
import { Banner, Button } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const explorerCase = {
  id: "banner/overview",
  label: "全局横幅",
  summary: "用于页面级持续通知，长说明与操作按钮保持清晰的左右布局。",
  states: ["default", "empty", "error", "longContent", "dark", "locale"],
  content: (
    <Banner tone="info" title="计划维护" action={<Button size="small" variant="secondary" onClick={() => undefined}>查看窗口</Button>}>
      服务将在周四 20:00 至 20:30 进行滚动升级，期间不会中断已建立的连接。
    </Banner>
  ),
  code: `<Banner tone="info" title="计划维护" action={<Button>查看窗口</Button>}>维护说明</Banner>`,
} satisfies ExplorerCase;

export default explorerCase;
