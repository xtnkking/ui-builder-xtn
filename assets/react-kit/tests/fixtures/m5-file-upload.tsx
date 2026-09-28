import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Field, FileUpload, Form, type FileUploadItem, type FileUploadRejection } from "../../src/personal-ui";
import "../../src/personal-ui/styles.css";

const initialItems: FileUploadItem[] = [
  { id: "queued", name: "queued.txt", status: "queued" },
  { id: "uploading", name: "uploading.txt", status: "uploading", progress: 42 },
  { id: "failed", name: "failed.txt", status: "error", error: "Upload failed" },
  { id: "complete", name: "complete.txt", status: "success", value: "remote/complete" },
];

function Fixture() {
  const [items, setItems] = useState(initialItems);
  const [disabled, setDisabled] = useState(false);
  const [selectedNames, setSelectedNames] = useState<string[]>([]);
  const [rejectionReasons, setRejectionReasons] = useState<string[]>([]);
  const [retryCount, setRetryCount] = useState(0);
  const [startCount, setStartCount] = useState(0);
  const [removeCount, setRemoveCount] = useState(0);
  const receiveFiles = (files: File[]) => setSelectedNames(files.map((file) => file.name));
  const rejectFiles = (rejections: FileUploadRejection[]) => setRejectionReasons(rejections.map((item) => item.reason));

  return (
    <main className="pui-theme pui-root" style={{ maxWidth: 680, padding: 24 }} data-ready="true">
      <Form aria-label="Documents" id="upload-form" onSubmit={(event) => event.preventDefault()}>
        <Field label="Documents" htmlFor="documents" required>
          <FileUpload
            items={items}
            name="documents"
            accept="image/png"
            maxFiles={6}
            maxSize={3}
            disabled={disabled}
            onFiles={receiveFiles}
            onRejected={rejectFiles}
            onStart={() => setStartCount((count) => count + 1)}
            onRetry={() => setRetryCount((count) => count + 1)}
            onRemove={(item) => { setRemoveCount((count) => count + 1); setItems((current) => current.filter((entry) => entry.id !== item.id)); }}
            onReset={() => setItems(initialItems)}
          />
        </Field>
      </Form>
      <button type="button" onClick={() => setDisabled((value) => !value)}>Toggle disabled</button>
      <button type="button" onClick={() => setItems((current) => current.filter((item) => item.status !== "success"))}>Remove success</button>
      <output data-testid="selected-names">{selectedNames.join(",")}</output>
      <output data-testid="rejection-reasons">{rejectionReasons.join(",")}</output>
      <output data-testid="retry-count">{retryCount}</output>
      <output data-testid="start-count">{startCount}</output>
      <output data-testid="remove-count">{removeCount}</output>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<Fixture />);
