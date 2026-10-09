// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"meter/overview","exports":["Meter"]}
import { StatePreview } from "../state-preview";
import { Meter } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const explorerCase = {
  id: "meter/overview",
  label: "范围指标",
  summary: "Meter 表达有上下界与阈值的测量值，并同时显示格式化后的文本结果。",
  states: ["default", "longContent", "dark", "locale"],
  stateExamples: [
    { state: "longContent", exports: ["Meter"], content: <Meter label="此存储空间用于保存全部产品中的角色配置、数据访问权限、通知偏好和账户安全设置，请确认所有配置均符合团队的实际使用要求。" ariaLabel="存储空间使用率" value={68} showValue /> },
    { state: "default", exports: ["Meter"], content: <Meter label="存储空间" ariaLabel="存储空间已使用 68%" value={68} min={0} max={100} low={25} high={80} optimum={45} showValue formatValue={(value) => `${value}%`} /> },
    { state: "dark", exports: ["Meter"], content: <StatePreview state="dark">{<Meter label="存储空间" ariaLabel="存储空间已使用 68%" value={68} min={0} max={100} low={25} high={80} optimum={45} showValue formatValue={(value) => `${value}%`} />}</StatePreview> },
    { state: "locale", exports: ["Meter"], content: <StatePreview state="locale">{<Meter label="存储空间" ariaLabel="存储空间已使用 68%" value={68} min={0} max={100} low={25} high={80} optimum={45} showValue formatValue={(value) => `${value}%`} />}</StatePreview> },
  ],
  content: <Meter label="存储空间" ariaLabel="存储空间已使用 68%" value={68} min={0} max={100} low={25} high={80} optimum={45} showValue formatValue={(value) => `${value}%`} />,
  code: `<Meter label="存储空间" ariaLabel="存储空间已使用 68%" value={68} min={0} max={100} high={80} showValue />`,
} satisfies ExplorerCase;

export default explorerCase;
