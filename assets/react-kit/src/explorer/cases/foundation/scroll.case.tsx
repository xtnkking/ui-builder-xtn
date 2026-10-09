// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"scroll/overview","exports":["ScrollArea"]}
import { StatePreview } from "../state-preview";
import { ScrollArea, Stack, Tag } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const explorerCase = {
  id: "scroll/overview",
  label: "滚动区域",
  summary: "长内容拥有明确的区域名称和高度约束，键盘用户可直接进入滚动容器。",
  states: ["default", "longContent", "mobile", "dark", "locale"],
  stateExamples: [
    { state: "longContent", exports: ["ScrollArea"], content: <ScrollArea ariaLabel="完整审计说明" maxHeight={150}><p>成员访问权限已由原角色调整为跨区域审核角色；每次操作都记录操作者、时间、理由及受影响的产品。使用方向键或滚轮查看完整说明，并保留原始记录供后续审计与问题定位。</p><p>成员访问权限已由原角色调整为跨区域审核角色；每次操作都记录操作者、时间、理由及受影响的产品。使用方向键或滚轮查看完整说明，并保留原始记录供后续审计与问题定位。</p></ScrollArea> },
    { state: "default", exports: ["ScrollArea"], content: <ScrollArea ariaLabel="审计记录" maxHeight={150}><Stack gap="small">{["登录成功", "权限更新", "导出完成", "成员停用", "密钥轮换"].map((item) => <Tag key={item}>{item}</Tag>)}</Stack></ScrollArea> },
    { state: "mobile", exports: ["ScrollArea"], content: <StatePreview state="mobile">{<ScrollArea ariaLabel="审计记录" maxHeight={150}><Stack gap="small">{["登录成功", "权限更新", "导出完成", "成员停用", "密钥轮换"].map((item) => <Tag key={item}>{item}</Tag>)}</Stack></ScrollArea>}</StatePreview> },
    { state: "dark", exports: ["ScrollArea"], content: <StatePreview state="dark">{<ScrollArea ariaLabel="审计记录" maxHeight={150}><Stack gap="small">{["登录成功", "权限更新", "导出完成", "成员停用", "密钥轮换"].map((item) => <Tag key={item}>{item}</Tag>)}</Stack></ScrollArea>}</StatePreview> },
    { state: "locale", exports: ["ScrollArea"], content: <StatePreview state="locale">{<ScrollArea ariaLabel="审计记录" maxHeight={150}><Stack gap="small">{["登录成功", "权限更新", "导出完成", "成员停用", "密钥轮换"].map((item) => <Tag key={item}>{item}</Tag>)}</Stack></ScrollArea>}</StatePreview> },
  ],
  content: <ScrollArea ariaLabel="审计记录" maxHeight={150}><Stack gap="small">{["登录成功", "权限更新", "导出完成", "成员停用", "密钥轮换"].map((item) => <Tag key={item}>{item}</Tag>)}</Stack></ScrollArea>,
  code: `<ScrollArea ariaLabel="审计记录" maxHeight={150}>{rows}</ScrollArea>`,
} satisfies ExplorerCase;

export default explorerCase;
