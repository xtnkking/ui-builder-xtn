// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"attachment/overview","exports":["Attachment"]}
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
  states: ["default", "empty", "error", "longContent", "dark", "locale"],
  content: <AttachmentExample />,
  code: `<Attachment name={file.name} size="2.8 MB" downloading={downloading} onDownload={download} onRemove={remove} />`,
} satisfies ExplorerCase;

export default explorerCase;
