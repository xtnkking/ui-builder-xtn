// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"meter/overview","exports":["Meter"]}
import { Meter } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const explorerCase = {
  id: "meter/overview",
  label: "范围指标",
  summary: "Meter 表达有上下界与阈值的测量值，并同时显示格式化后的文本结果。",
  states: ["default", "empty", "error", "longContent", "dark", "locale"],
  content: <Meter label="存储空间" ariaLabel="存储空间已使用 68%" value={68} min={0} max={100} low={25} high={80} optimum={45} showValue formatValue={(value) => `${value}%`} />,
  code: `<Meter label="存储空间" ariaLabel="存储空间已使用 68%" value={68} min={0} max={100} high={80} showValue />`,
} satisfies ExplorerCase;

export default explorerCase;
