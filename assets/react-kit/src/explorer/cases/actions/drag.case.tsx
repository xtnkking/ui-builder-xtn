// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"drag/overview","exports":["DragDrop"]}
import { StatePreview } from "../state-preview";
import { useRef, useState } from "react";
import { DragDrop, FileUpload, Stack } from "../../../personal-ui";
import type { FileUploadItem } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

function DragExample() {
  const [items, setItems] = useState<FileUploadItem[]>([]);
  const sequence = useRef(0);
  const receive = (files: File[]) => setItems((current) => [...current, ...files.map((file): FileUploadItem => ({
    id: `file-${++sequence.current}`, name: file.name, size: file.size, status: "success",
  }))]);
  return <Stack gap="medium">
    <DragDrop accept=".csv,text/csv" ariaLabel="接收CSV文件" onFiles={receive}>
      <p>将组织全部成员的跨区域结算记录文件拖放至此处，文件必须包含完整的组织标识、统计日期和访问范围。你也可以使用下面的选择文件按钮，两种入口共享同一个文件清单。</p>
    </DragDrop>
    <FileUpload items={items} accept=".csv,text/csv" onFiles={receive} onRemove={(removed) => setItems((current) => current.filter((item) => item.id !== removed.id))} label="本地文件清单" browseLabel="选择CSV文件" />
  </Stack>;
}
const explorerCase = {
  id: "drag/overview",
  label: "文件拖放",
  summary: "拖放与既有官方FileUpload键盘入口共享本地清单；此案例不提供网络上传，也不改变组件自身的键盘能力。",
  states: ["default", "disabled", "longContent", "keyboard", "dark", "locale"],
  stateExamples: [
    { state: "default", exports: ["DragDrop"], content: <DragExample /> },
    { state: "disabled", exports: ["DragDrop"], content: <DragDrop ariaLabel="禁用文件拖放" disabled onFiles={() => undefined}><p>上传策略已锁定。</p></DragDrop> },
    { state: "longContent", exports: ["DragDrop"], content: <DragExample /> },
    { state: "keyboard", exports: ["DragDrop"], content: <DragExample />, instructions: "用Tab聚焦FileUpload的选择CSV文件按钮，按Enter打开文件选择器；通过这个既有官方组合提供替代操作。此项是人工入口，不是DragDrop独立键盘能力的声明。" },
    { state: "dark", exports: ["DragDrop"], content: <StatePreview state="dark"><DragExample /></StatePreview> },
    { state: "locale", exports: ["DragDrop"], content: <StatePreview state="locale"><DragExample /></StatePreview> },
  ],
  content: <DragExample />,
  code: `<DragDrop accept=".csv" onFiles={handleFiles}>拖放CSV到这里</DragDrop>\n<FileUpload items={items} accept=".csv" onFiles={handleFiles} />`,
} satisfies ExplorerCase;
export default explorerCase;
