// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"import-export/overview","exports":["ImportExportPage"]}
import { StatePreview } from "../state-preview";
import { Attachment, ImportExportPage } from "../../../personal-ui";
import { useState } from "react";
import type { ExplorerCase } from "../types";

function ImportExportExample() {
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [feedback, setFeedback] = useState("导出当前筛选下的成员与角色数据。");
  return (
    <ImportExportPage
      title="数据迁移"
      description="导入前验证文件，导出任务保持防重复提交。"
      importContent={<Attachment name="members.csv" description="CSV" size="24 KB" />}
      exportContent={<p role="status">{feedback}</p>}
      importing={importing}
      exporting={exporting}
      onImport={async () => { setImporting(true); await new Promise<void>((resolve) => setTimeout(resolve, 1800)); setImporting(false); setFeedback("本地示例导入已完成。"); }}
      onExport={async () => { setExporting(true); await new Promise<void>((resolve) => setTimeout(resolve, 1800)); setExporting(false); setFeedback("本地示例导出已完成。"); }}
    />
  );
}

const explorerCase: ExplorerCase = {
  id: "import-export/overview",
  label: "导入与导出页面",
  summary: "成对任务、文件状态、异步按钮和长内容在同一页面模式中协调。",
  states: ["default", "loading", "longContent", "keyboard", "mobile", "overlay", "dark", "locale"],
  stateExamples: [
    { state: "loading", exports: ["ImportExportPage"], content: <ImportExportPage title="数据迁移" importing exporting importContent={<Attachment name="members.csv" />} exportContent={<p>当前成员记录</p>} onImport={() => undefined} onExport={() => undefined} /> },
    { state: "longContent", exports: ["ImportExportPage"], content: <ImportExportPage title="完整配置迁移" description="此任务迁移全部产品中的角色配置、数据访问权限、通知偏好和账户安全设置，请确认所有关联配置均符合团队的实际使用要求。" importContent={<Attachment name="members.csv" />} exportContent={<p>当前成员记录</p>} onImport={() => undefined} onExport={() => undefined} /> },
    { state: "default", exports: ["ImportExportPage"], content: <ImportExportExample /> },
    { state: "keyboard", exports: ["ImportExportPage"], content: <ImportExportExample />, instructions: "用 Tab 访问本例可用控件，使用 Enter、Space 和组件文档中的方向键操作。此项为人工操作案例，不是自动行为验收证书。" },
    { state: "mobile", exports: ["ImportExportPage"], content: <StatePreview state="mobile">{<ImportExportExample />}</StatePreview> },
    { state: "overlay", exports: ["ImportExportPage"], content: <StatePreview state="overlay">{<ImportExportExample />}</StatePreview> },
    { state: "dark", exports: ["ImportExportPage"], content: <StatePreview state="dark">{<ImportExportExample />}</StatePreview> },
    { state: "locale", exports: ["ImportExportPage"], content: <StatePreview state="locale">{<ImportExportExample />}</StatePreview> },
  ],
  content: <ImportExportExample />,
  code: `import { ImportExportPage } from "./personal-ui";

<ImportExportPage title="数据迁移" importContent={upload} exportContent={summary} onImport={runImport} onExport={runExport} />`,
};

export default explorerCase;
