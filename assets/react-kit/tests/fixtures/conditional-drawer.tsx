import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Eye } from "lucide-react";
import { Button, Drawer, IconButton, Input } from "../../src/personal-ui";
import "../../src/personal-ui/styles.css";

function ConditionalDrawerFixture() {
  const [source, setSource] = useState<"button" | "icon" | "shortcut" | null>(null);

  useEffect(() => {
    const openWithShortcut = (event: KeyboardEvent) => {
      if (event.key === "F2") setSource("shortcut");
    };
    document.addEventListener("keydown", openWithShortcut);
    return () => document.removeEventListener("keydown", openWithShortcut);
  }, []);

  return (
    <main>
      <Button onClick={() => setSource("button")}>打开条件抽屉</Button>
      <IconButton aria-label="图标打开条件抽屉" icon={<Eye aria-hidden="true" />} onClick={() => setSource("icon")} />
      <Button>无关操作</Button>
      <Input aria-label="快捷键前的焦点" />
      {source ? (
        <Drawer open onOpenChange={(open) => { if (!open) setSource(null); }} title="条件抽屉">
          <p>仅在点击触发器后挂载。</p>
        </Drawer>
      ) : null}
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<ConditionalDrawerFixture />);
