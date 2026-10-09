import { createRoot } from "react-dom/client";
import { Button } from "../../src/personal-ui";
import { DragExample } from "../../src/explorer/cases/actions/drag.case";
import "../../src/personal-ui/styles.css";

function DragUploadFixture() {
  return <main style={{ maxWidth: 620, margin: "32px auto", padding: 16 }}>
    <h1>文件接收</h1>
    <DragExample />
    <Button>离开文件清单</Button>
  </main>;
}

createRoot(document.getElementById("root")!).render(<DragUploadFixture />);
