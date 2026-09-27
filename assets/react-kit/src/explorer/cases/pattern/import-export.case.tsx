// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"import-export/overview","exports":["ImportExportPage"]}
import { Attachment, ImportExportPage } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

function ImportExportExample() {
  return (
    <ImportExportPage
      title="数据迁移"
      description="导入前验证文件，导出任务保持防重复提交。"
      importContent={<Attachment name="members.csv" description="CSV" size="24 KB" />}
      exportContent={<p>导出当前筛选下的成员与角色数据。</p>}
      onImport={async () => undefined}
      onExport={async () => undefined}
    />
  );
}

const explorerCase: ExplorerCase = {
  id: "import-export/overview",
  label: "导入与导出页面",
  summary: "成对任务、文件状态、异步按钮和长内容在同一页面模式中协调。",
  states: ["default", "loading", "empty", "error", "validation", "longContent", "keyboard", "mobile", "overlay", "dark", "locale"],
  content: <ImportExportExample />,
  code: `import { ImportExportPage } from "./personal-ui";

<ImportExportPage title="数据迁移" importContent={upload} exportContent={summary} onImport={runImport} onExport={runExport} />`,
};

export default explorerCase;
