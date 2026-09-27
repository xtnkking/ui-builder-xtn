// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"spinner/overview","exports":["Spinner"]}
import { Inline, Spinner } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const explorerCase = {
  id: "spinner/overview",
  label: "加载指示",
  summary: "Spinner 始终携带状态文本，适合局部等待而不改变周围布局。",
  states: ["default", "empty", "error", "longContent", "dark", "locale"],
  content: <Inline gap="large" wrap><Spinner label="正在读取数据" /><Spinner label="正在验证访问权限，请稍候" /></Inline>,
  code: `<Spinner label="正在读取数据" />`,
} satisfies ExplorerCase;

export default explorerCase;
