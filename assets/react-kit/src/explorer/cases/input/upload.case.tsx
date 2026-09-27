// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"upload/overview","exports":["FileUpload"]}
import { useState } from "react";
import { FileUpload, type FileUploadItem } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const initialItems: FileUploadItem[] = [
  { id: "spec", name: "product-spec.pdf", size: 284000, value: "files/spec", status: "success" },
  { id: "data", name: "members.csv", size: 92000, status: "uploading", progress: 58 },
  { id: "bad", name: "archive.zip", size: 7200000, status: "error", error: "网络中断，请重试" },
];

function UploadExample() {
  const [items, setItems] = useState(initialItems);
  const handleFiles = (files: File[]) => {
    const queued = files.map((file, index): FileUploadItem => ({
      id: `${file.name}-${index}`,
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

const explorerCase = {
  id: "upload/overview",
  label: "文件选择与上传队列",
  summary: "调用方拥有传输过程，组件展示排队、上传、成功、错误、重试与类型限制。",
  states: ["default", "disabled", "controlled", "uncontrolled", "loading", "empty", "error", "validation", "longContent", "keyboard", "overlay", "dark", "locale"] as const,
  content: <UploadExample />,
  code: `<FileUpload items={items} accept=".pdf,.csv" onFiles={queueFiles} onStart={startUpload} onRetry={retryUpload} />`,
} satisfies ExplorerCase;

export default explorerCase;
