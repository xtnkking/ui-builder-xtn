// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"drag/overview","exports":["DragDrop"]}
import { StatePreview } from "../state-preview";
import { useRef, useState } from "react";
import { DragDrop, FileUpload, InlineMessage, Stack, Switch } from "../../../personal-ui";
import type { FileUploadItem } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

/** The Explorer and D2 fixture consume this exact business composition. No upload transport is provided. */
export function DragExample() {
  const [items, setItems] = useState<FileUploadItem[]>([]);
  const [disabled, setDisabled] = useState(false);
  const [rejectedNames, setRejectedNames] = useState<string[]>([]);
  const disabledRef = useRef(false);
  const sequence = useRef(0);
  const accept = ".csv,text/csv";
  const receive = (files: File[]) => {
    if (disabledRef.current) return;
    // Allocate identities once per event, outside the replayable state updater.
    const additions = files.map((file): FileUploadItem => ({
      id: `file-${++sequence.current}`, name: file.name, size: file.size, status: "queued",
    }));
    setItems((current) => [...current, ...additions]);
    setRejectedNames([]);
  };
  const reject = (files: File[]) => {
    if (disabledRef.current) return;
    setRejectedNames((current) => [...current, ...files.map((file) => file.name)]);
  };
  const remove = (removed: FileUploadItem) => {
    if (disabledRef.current) return;
    setItems((current) => current.filter((item) => item.id !== removed.id));
  };
  return <Stack gap="medium">
    <Switch label="锁定文件操作" checked={disabled} onChange={(event) => {
      disabledRef.current = event.currentTarget.checked;
      setDisabled(event.currentTarget.checked);
    }} />
    <DragDrop accept={accept} disabled={disabled} ariaLabel="接收CSV文件" onFiles={receive} onRejected={reject}>
      <p>将组织全部成员的跨区域结算记录文件拖放至此处，文件必须包含完整的组织标识、统计日期和访问范围。你也可以使用下面的选择文件按钮，两种入口共享同一个本地待处理清单，不执行网络上传；CSV扩展名或text/csv MIME任一匹配即可。</p>
    </DragDrop>
    <FileUpload items={items} accept={accept} disabled={disabled} onFiles={receive}
      onRejected={(rejections) => reject(rejections.map((rejection) => rejection.file))}
      onRemove={remove} label="本地文件清单" browseLabel="选择CSV文件"
      description="文件保持待处理状态。相同名称可以重复选入，移除只针对当前一项。" />
    <InlineMessage aria-label="文件选择结果">已选入 {items.length} 个本地待处理文件</InlineMessage>
    {rejectedNames.length ? <InlineMessage tone="danger" aria-label="文件拒绝反馈">
      {rejectedNames.join("、")}：未匹配任何CSV扩展名或MIME规则，未加入清单。
    </InlineMessage> : null}
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
  code: `// 完整共享队列、拒绝反馈和禁用逻辑见本案例的 DragExample。\n<DragDrop accept={accept} disabled={disabled} onFiles={receive} onRejected={reject}>拖放CSV到这里</DragDrop>\n<FileUpload items={items} accept={accept} disabled={disabled} onFiles={receive} onRejected={(rejections) => reject(rejections.map((entry) => entry.file))} onRemove={remove} />`,
} satisfies ExplorerCase;
export default explorerCase;
