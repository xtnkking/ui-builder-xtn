// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"scroll/overview","exports":["ScrollArea"]}
import { ScrollArea, Stack, Tag } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const explorerCase = {
  id: "scroll/overview",
  label: "滚动区域",
  summary: "长内容拥有明确的区域名称和高度约束，键盘用户可直接进入滚动容器。",
  states: ["default", "longContent", "mobile", "dark", "locale"],
  content: <ScrollArea ariaLabel="审计记录" maxHeight={150}><Stack gap="small">{["登录成功", "权限更新", "导出完成", "成员停用", "密钥轮换"].map((item) => <Tag key={item}>{item}</Tag>)}</Stack></ScrollArea>,
  code: `<ScrollArea ariaLabel="审计记录" maxHeight={150}>{rows}</ScrollArea>`,
} satisfies ExplorerCase;

export default explorerCase;
