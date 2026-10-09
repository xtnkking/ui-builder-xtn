// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"status/overview","exports":["StatusIndicator"]}
import { StatePreview } from "../state-preview";
import { Inline, StatusIndicator } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const explorerCase = {
  id: "status/overview",
  label: "状态指示",
  summary: "颜色点、主要状态和补充信息作为一个稳定整体展示，不只依赖颜色判断状态。",
  states: ["default", "error", "longContent", "dark", "locale"],
  stateExamples: [
    { state: "longContent", exports: ["StatusIndicator"], content: <StatusIndicator tone="warning" label="此检查覆盖全部产品中的角色配置、数据访问权限、通知偏好和账户安全设置，请在保存前确认所有关联配置均符合团队的实际使用要求。" detail="等待管理员复核" /> },
    { state: "default", exports: ["StatusIndicator"], content: (
    <Inline gap="large" wrap>
      <StatusIndicator tone="success" label="运行中" detail="最后检查于 2 分钟前" />
      <StatusIndicator tone="warning" label="等待复核" detail="需要管理员确认" />
      <StatusIndicator tone="danger" label="同步失败" detail="将在 10 分钟后重试" />
    </Inline>
  ) },
    { state: "error", exports: ["StatusIndicator"], content: (
    <Inline gap="large" wrap>
      <StatusIndicator tone="success" label="运行中" detail="最后检查于 2 分钟前" />
      <StatusIndicator tone="warning" label="等待复核" detail="需要管理员确认" />
      <StatusIndicator tone="danger" label="同步失败" detail="将在 10 分钟后重试" />
    </Inline>
  ) },
    { state: "dark", exports: ["StatusIndicator"], content: <StatePreview state="dark">{(
    <Inline gap="large" wrap>
      <StatusIndicator tone="success" label="运行中" detail="最后检查于 2 分钟前" />
      <StatusIndicator tone="warning" label="等待复核" detail="需要管理员确认" />
      <StatusIndicator tone="danger" label="同步失败" detail="将在 10 分钟后重试" />
    </Inline>
  )}</StatePreview> },
    { state: "locale", exports: ["StatusIndicator"], content: <StatePreview state="locale">{(
    <Inline gap="large" wrap>
      <StatusIndicator tone="success" label="运行中" detail="最后检查于 2 分钟前" />
      <StatusIndicator tone="warning" label="等待复核" detail="需要管理员确认" />
      <StatusIndicator tone="danger" label="同步失败" detail="将在 10 分钟后重试" />
    </Inline>
  )}</StatePreview> },
  ],
  content: (
    <Inline gap="large" wrap>
      <StatusIndicator tone="success" label="运行中" detail="最后检查于 2 分钟前" />
      <StatusIndicator tone="warning" label="等待复核" detail="需要管理员确认" />
      <StatusIndicator tone="danger" label="同步失败" detail="将在 10 分钟后重试" />
    </Inline>
  ),
  code: `<StatusIndicator tone="success" label="运行中" detail="最后检查于 2 分钟前" />`,
} satisfies ExplorerCase;

export default explorerCase;
