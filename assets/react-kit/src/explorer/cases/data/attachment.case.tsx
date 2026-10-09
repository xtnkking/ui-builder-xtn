// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"attachment/overview","exports":["Attachment"]}
import { StatePreview } from "../state-preview";
import { useState } from "react";
import { Attachment } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

function AttachmentExample() {
  const [downloading, setDownloading] = useState(false);
  const [removed, setRemoved] = useState(false);
  if (removed) return <span role="status">附件已从列表移除</span>;
  return (
    <Attachment
      name="2026-09 月度运营与异常情况复核报告.pdf"
      description="PDF 文档"
      size="2.8 MB"
      downloading={downloading}
      onDownload={() => {
        setDownloading(true);
        window.setTimeout(() => setDownloading(false), 500);
      }}
      onRemove={() => setRemoved(true)}
    />
  );
}

const explorerCase = {
  id: "attachment/overview",
  label: "附件操作",
  summary: "长文件名、文件元数据、下载加载态和移除操作由同一组件保持对齐。",
  states: ["default", "disabled", "loading", "longContent", "keyboard", "dark", "locale"],
  stateExamples: [
    { state: "disabled", exports: ["Attachment"], content: <Attachment name="运营报告.pdf" disabled onDownload={() => undefined} onRemove={() => undefined} /> },
    { state: "loading", exports: ["Attachment"], content: <Attachment name="运营报告.pdf" downloading onDownload={() => undefined} /> },
    { state: "longContent", exports: ["Attachment"], content: <Attachment name="全产品成员角色配置与数据访问权限、通知偏好、账户安全设置及操作审计记录的年度复核报告和后续修订说明（完整最终版）.pdf" size="2.8 MB" onDownload={() => undefined} /> },
    { state: "keyboard", exports: ["Attachment"], instructions: "用 Tab 聚焦下载或移除，按 Enter 或空格；下载时显示加载，移除后显示已移除反馈。", content: <AttachmentExample /> },
    { state: "default", exports: ["Attachment"], content: <AttachmentExample /> },
    { state: "dark", exports: ["Attachment"], content: <StatePreview state="dark">{<AttachmentExample />}</StatePreview> },
    { state: "locale", exports: ["Attachment"], content: <StatePreview state="locale">{<AttachmentExample />}</StatePreview> },
  ],
  content: <AttachmentExample />,
  code: `<Attachment name={file.name} size="2.8 MB" downloading={downloading} onDownload={download} onRemove={remove} />`,
} satisfies ExplorerCase;

export default explorerCase;
