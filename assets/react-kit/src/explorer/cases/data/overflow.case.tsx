// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"overflow/overview","exports":["OverflowText","ExpandableText"]}
import { StatePreview } from "../state-preview";
import { ExpandableText, OverflowText } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const longText = "这是一段用于验证窄容器省略提示和长段落展开行为的完整内容，包含全部产品的角色配置、数据访问权限、通知偏好和账户安全设置，信息不会因为空间不足而失去访问入口。";

const explorerCase = {
  id: "overflow/overview",
  label: "长内容边界",
  summary: "单行溢出显示悬停提示，多行正文使用显式展开与收起操作。",
  states: ["default", "longContent", "keyboard", "overlay", "dark", "locale"],
  stateExamples: [
    { state: "longContent", exports: ["OverflowText", "ExpandableText"], content: <div style={{ maxWidth: 220 }}><OverflowText>{longText}</OverflowText><ExpandableText collapsedLines={2}>{longText}</ExpandableText></div> },
    { state: "default", exports: ["OverflowText","ExpandableText"], content: (
    <div style={{ display: "grid", gap: 16, maxWidth: 360 }}>
      <div style={{ width: 220 }}><OverflowText>{longText}</OverflowText></div>
      <ExpandableText collapsedLines={2}>{`${longText}${longText}`}</ExpandableText>
    </div>
  ) },
    { state: "keyboard", exports: ["OverflowText","ExpandableText"], content: (
    <div style={{ display: "grid", gap: 16, maxWidth: 360 }}>
      <div style={{ width: 220 }}><OverflowText>{longText}</OverflowText></div>
      <ExpandableText collapsedLines={2}>{`${longText}${longText}`}</ExpandableText>
    </div>
  ), instructions: "用 Tab 访问本例可用控件，使用 Enter、Space 和组件文档中的方向键操作。此项为人工操作案例，不是自动行为验收证书。" },
    { state: "overlay", exports: ["OverflowText","ExpandableText"], content: <StatePreview state="overlay">{(
    <div style={{ display: "grid", gap: 16, maxWidth: 360 }}>
      <div style={{ width: 220 }}><OverflowText>{longText}</OverflowText></div>
      <ExpandableText collapsedLines={2}>{`${longText}${longText}`}</ExpandableText>
    </div>
  )}</StatePreview> },
    { state: "dark", exports: ["OverflowText","ExpandableText"], content: <StatePreview state="dark">{(
    <div style={{ display: "grid", gap: 16, maxWidth: 360 }}>
      <div style={{ width: 220 }}><OverflowText>{longText}</OverflowText></div>
      <ExpandableText collapsedLines={2}>{`${longText}${longText}`}</ExpandableText>
    </div>
  )}</StatePreview> },
    { state: "locale", exports: ["OverflowText","ExpandableText"], content: <StatePreview state="locale">{(
    <div style={{ display: "grid", gap: 16, maxWidth: 360 }}>
      <div style={{ width: 220 }}><OverflowText>{longText}</OverflowText></div>
      <ExpandableText collapsedLines={2}>{`${longText}${longText}`}</ExpandableText>
    </div>
  )}</StatePreview> },
  ],
  content: (
    <div style={{ display: "grid", gap: 16, maxWidth: 360 }}>
      <div style={{ width: 220 }}><OverflowText>{longText}</OverflowText></div>
      <ExpandableText collapsedLines={2}>{`${longText}${longText}`}</ExpandableText>
    </div>
  ),
  code: `<OverflowText>{longText}</OverflowText>\n<ExpandableText collapsedLines={2}>{longText}</ExpandableText>`,
} satisfies ExplorerCase;

export default explorerCase;
