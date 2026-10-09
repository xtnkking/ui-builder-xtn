// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"upload/overview","exports":["FileUpload"]}
import { StatePreview } from "../state-preview";
import { useRef, useState } from "react";
import { Field, FileUpload, type FileUploadItem } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const initialItems: FileUploadItem[] = [
  { id: "spec", name: "product-spec.pdf", size: 284000, value: "files/spec", status: "success" },
  { id: "data", name: "members.csv", size: 92000, status: "uploading", progress: 58 },
  { id: "bad", name: "archive.zip", size: 7200000, status: "error", error: "网络中断，请重试" },
];

function UploadExample() {
  const [items, setItems] = useState(initialItems);
  const nextFileId = useRef(0);
  const handleFiles = (files: File[]) => {
    const queued = files.map((file, index): FileUploadItem => ({
      id: `${file.name}-${nextFileId.current++}-${index}`,
      name: file.name,
      size: file.size,
      status: "queued",
    }));
    setItems((current) => current.concat(queued));
  };
  const handleRemove = (item: FileUploadItem) => {
    setItems((current) => current.filter((candidate) => candidate.id !== item.id));
  };
  const handleRetry = async (item: FileUploadItem) => {
    setItems((current) => current.map((candidate) => candidate.id === item.id
      ? { ...candidate, status: "queued", error: undefined }
      : candidate));
  };
  const handleStart = async () => {
    setItems((current) => current.map((item) => item.status === "queued"
      ? { ...item, status: "uploading", progress: 0 }
      : item));
  };
  return (
    <FileUpload
      items={items}
      accept=".pdf,.csv"
      maxSize={5 * 1024 * 1024}
      maxFiles={5}
      onFiles={handleFiles}
      onRemove={handleRemove}
      onRetry={handleRetry}
      onStart={handleStart}
      label="上传导入文件"
      description="PDF 或 CSV，单个文件不超过 5 MB。"
    />
  );
}

function useUploadQueue(initial: FileUploadItem[]) {
  const [items, setItems] = useState(initial);
  const serial = useRef(0);
  const onFiles = (files: File[]) => setItems((current) => current.concat(files.map((file): FileUploadItem => ({ id: `picked-${serial.current++}`, name: file.name, size: file.size, status: "queued" }))));
  return { items, setItems, onFiles };
}

const failedItems: FileUploadItem[] = [{ id: "failed-file", name: "members.csv", status: "error", error: "网络中断，请重试。" }];

function RetryUploadExample() {
  const { items, setItems, onFiles } = useUploadQueue(failedItems);
  const [initial, setInitial] = useState(true);
  const pickFiles = (files: File[]) => { onFiles(files); setInitial(false); };
  const retry = async (item: FileUploadItem) => { setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, status: "success", error: undefined, value: `files/${entry.name}` } : entry)); setInitial(false); };
  return initial
    ? <FileUpload label="上传失败的队列" items={failedItems} onFiles={pickFiles} onRetry={retry} />
    : <FileUpload label="更新后的队列" items={items} onFiles={pickFiles} onRetry={retry} />;
}

function EmptyUploadExample() {
  const { items, onFiles } = useUploadQueue([]);
  const [initial, setInitial] = useState(true);
  const pickFiles = (files: File[]) => { onFiles(files); setInitial(false); };
  return initial
    ? <FileUpload label="空上传队列" items={[]} onFiles={pickFiles} description="从设备选择文件后，文件会加入示例队列。" />
    : <FileUpload label="已选择的文件" items={items} onFiles={pickFiles} />;
}

function InvalidUploadExample() {
  const { items, onFiles } = useUploadQueue([]);
  return <Field label="导入文件" group error="请选择一个 CSV 文件，文件大小不能超过 5 MB。"><FileUpload items={items} onFiles={onFiles} accept=".csv" maxSize={5 * 1024 * 1024} required /></Field>;
}

function LongUploadExample() {
  const { items, onFiles } = useUploadQueue([{ id: "long-file", name: "international-subscription-platform-security-and-account-settlement-data-export-for-review.csv", status: "queued" }]);
  return <FileUpload label="跨区域结算数据导入" items={items} onFiles={onFiles} description="批量导入文件可能包含较长的业务标识和日期范围，文件名与说明应完整呈现并保留稳定的操作入口位置。" />;
}

const explorerCase = {
  id: "upload/overview",
  label: "文件选择与上传队列",
  summary: "调用方拥有传输过程，组件展示排队、上传、成功、错误、重试与类型限制。",
  states: ["default", "disabled", "controlled", "loading", "empty", "error", "validation", "longContent", "keyboard", "overlay", "dark", "locale"] as const,
  stateExamples: [
    { state: "disabled", exports: ["FileUpload"], content: <FileUpload label="由系统策略锁定的上传队列" items={[]} onFiles={() => undefined} disabled /> },
    { state: "controlled", exports: ["FileUpload"], content: <UploadExample /> },
    { state: "loading", exports: ["FileUpload"], content: <FileUpload label="正在上传（演示期间锁定选择入口）" items={[{ id: "uploading-file", name: "members.csv", status: "uploading", progress: 58 }]} onFiles={() => undefined} disabled /> },
    { state: "empty", exports: ["FileUpload"], content: <EmptyUploadExample /> },
    { state: "error", exports: ["FileUpload"], content: <RetryUploadExample />, instructions: "点击失败文件的重试按钮，示例队列将更新为上传成功。传输状态由调用方管理。" },
    { state: "validation", exports: ["FileUpload"], content: <InvalidUploadExample /> },
    { state: "longContent", exports: ["FileUpload"], content: <LongUploadExample /> },
    { state: "default", exports: ["FileUpload"], content: <UploadExample /> },
    { state: "keyboard", exports: ["FileUpload"], content: <UploadExample />, instructions: "用 Tab 访问本例可用控件，使用 Enter、Space 和组件文档中的方向键操作。此项为人工操作案例，不是自动行为验收证书。" },
    { state: "overlay", exports: ["FileUpload"], content: <StatePreview state="overlay">{<UploadExample />}</StatePreview> },
    { state: "dark", exports: ["FileUpload"], content: <StatePreview state="dark">{<UploadExample />}</StatePreview> },
    { state: "locale", exports: ["FileUpload"], content: <StatePreview state="locale">{<UploadExample />}</StatePreview> },
  ],
  content: <UploadExample />,
  code: `<FileUpload items={items} accept=".pdf,.csv" onFiles={queueFiles} onStart={startUpload} onRetry={retryUpload} />`,
} satisfies ExplorerCase;

export default explorerCase;
