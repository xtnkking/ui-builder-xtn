// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"lightbox/overview","exports":["Lightbox"]}
import { useState } from "react";
import { Button, Lightbox } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const image = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="960" height="640"><rect width="960" height="640" fill="#1769d2"/><rect x="120" y="110" width="720" height="420" rx="24" fill="#ffffff"/><text x="480" y="335" text-anchor="middle" font-family="Arial" font-size="54" fill="#172033">Personal UI</text></svg>')}`;

function LightboxExample() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("one");
  return (
    <>
      <Button onClick={() => setOpen(true)}>预览图片</Button>
      <Lightbox
        open={open}
        onOpenChange={setOpen}
        value={value}
        onValueChange={setValue}
        items={[
          { id: "one", src: image, alt: "蓝色 Personal UI 示例图", caption: "第一张" },
          { id: "two", src: image, alt: "第二张 Personal UI 示例图", caption: "第二张" },
        ]}
      />
    </>
  );
}

const explorerCase: ExplorerCase = {
  id: "lightbox/overview",
  label: "Lightbox 图片浏览",
  summary: "展示受控当前项、方向键/Home/End 导航、加载失败回退和关闭后的焦点恢复。",
  states: ["default", "disabled", "readOnly", "controlled", "uncontrolled", "validation", "longContent", "keyboard", "overlay", "dark", "locale"],
  content: <LightboxExample />,
  code: `import { Lightbox } from "./personal-ui";

<Lightbox open={open} onOpenChange={setOpen} value={currentId} onValueChange={setCurrentId} items={images} />`,
};

export default explorerCase;
