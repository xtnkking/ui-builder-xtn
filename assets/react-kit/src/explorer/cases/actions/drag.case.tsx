// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"drag/overview","exports":["DragDrop"]}
import { DragDrop, FileUpload, Stack, Tag } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const explorerCase = {
  id: "drag/overview",
  label: "文件拖放",
  summary: "拖放区明确接受类型、禁用语义与拒绝回调，不依赖只有鼠标可见的反馈。",
  states: ["default", "disabled", "longContent", "keyboard", "dark", "locale"],
  content: (
    <Stack gap="medium">
      <DragDrop accept=".csv,text/csv" ariaLabel="上传 CSV 文件" onFiles={() => undefined}>
        <Stack gap="small" align="center"><strong>拖放 CSV 到这里</strong><Tag>.csv · 最大 10 MB</Tag></Stack>
      </DragDrop>
      <FileUpload
        items={[]}
        onFiles={() => undefined}
        accept=".csv,text/csv"
        label="也可以从设备选择 CSV"
        browseLabel="选择 CSV 文件"
      />
    </Stack>
  ),
  code: `<DragDrop accept=".csv" onFiles={handleFiles}>拖放 CSV 到这里</DragDrop>\n<FileUpload items={items} accept=".csv" onFiles={handleFiles} />`,
} satisfies ExplorerCase;

export default explorerCase;
