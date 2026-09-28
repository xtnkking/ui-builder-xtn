// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"alert/overview","exports":["Alert"]}
import { Alert, Button } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const explorerCase = {
  id: "alert/overview",
  label: "页面内提醒",
  summary: "图标与第一行标题对齐，正文可以换行，并保留独立操作区。",
  states: ["default", "empty", "error", "longContent", "dark", "locale"],
  content: (
    <Alert tone="warning" title="配置即将过期" action={<Button size="small" variant="secondary" onClick={() => undefined}>查看配置</Button>}>
      当前凭据将在 2026 年 9 月 25 日失效。更新前现有连接仍可使用。
    </Alert>
  ),
  code: `<Alert tone="warning" title="配置即将过期" action={<Button>查看配置</Button>}>到期说明</Alert>`,
} satisfies ExplorerCase;

export default explorerCase;
