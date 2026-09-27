// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"overflow/overview","exports":["OverflowText","ExpandableText"]}
import { ExpandableText, OverflowText } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const longText = "这是一段用于验证窄容器省略提示和长段落展开行为的内容，信息不会因为空间不足而失去访问入口。";

const explorerCase = {
  id: "overflow/overview",
  label: "长内容边界",
  summary: "单行溢出显示悬停提示，多行正文使用显式展开与收起操作。",
  states: ["default", "disabled", "readOnly", "controlled", "uncontrolled", "validation", "longContent", "keyboard", "overlay", "dark", "locale"],
  content: (
    <div style={{ display: "grid", gap: 16, maxWidth: 360 }}>
      <div style={{ width: 220 }}><OverflowText>{longText}</OverflowText></div>
      <ExpandableText collapsedLines={2}>{`${longText}${longText}`}</ExpandableText>
    </div>
  ),
  code: `<OverflowText>{longText}</OverflowText>\n<ExpandableText collapsedLines={2}>{longText}</ExpandableText>`,
} satisfies ExplorerCase;

export default explorerCase;
