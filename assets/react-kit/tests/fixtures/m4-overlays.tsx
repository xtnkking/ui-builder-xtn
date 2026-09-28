import { useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Button,
  GuidedTour,
  HoverCard,
  Lightbox,
  Popconfirm,
  Popover,
} from "../../src/personal-ui";
import "./m4-overlays.css";

const fixtureImage = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="#eaf2ff"/></svg>',
)}`;
const lightboxItems = [
  { id: "first", src: fixtureImage, alt: "第一张", caption: "第一张图片" },
  { id: "second", src: fixtureImage, alt: "第二张", caption: "第二张图片" },
  { id: "third", src: fixtureImage, alt: "第三张", caption: "第三张图片" },
];

function OverlayFixture() {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxValue, setLightboxValue] = useState("first");
  const [tourMode, setTourMode] = useState<"target" | "missing" | null>(null);
  const tourSteps = tourMode === "missing"
    ? [{ id: "missing", title: "缺失目标", description: "目标不存在时居中显示。", target: "#missing-tour-target" }]
    : [{ id: "target", title: "有效目标", description: "卡片定位在目标附近。", target: "#tour-target" }];

  return (
    <main className="fixture">
      <h1>M4 浮层合同</h1>
      <div className="fixture__actions">
        <Button onClick={() => { setLightboxValue("first"); setLightboxOpen(true); }}>打开图片预览</Button>
        <Button onClick={() => setTourMode("target")}>打开目标引导</Button>
        <Button onClick={() => setTourMode("missing")}>打开缺失引导</Button>
      </div>
      <div id="tour-target" className="fixture__target">引导定位目标</div>
      <div className="fixture__actions" aria-label="非模态触发器">
        <Popover triggerLabel="打开说明" ariaLabel="说明弹层">Popover 内容</Popover>
        <HoverCard triggerLabel="预览资料" ariaLabel="资料预览">HoverCard 内容</HoverCard>
        <Popconfirm triggerLabel="删除记录" ariaLabel="删除记录确认" title="确认删除？" onConfirm={() => undefined} />
      </div>

      <Lightbox
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
        items={lightboxItems}
        value={lightboxValue}
        onValueChange={setLightboxValue}
      />
      <GuidedTour
        open={tourMode !== null}
        onOpenChange={(open) => { if (!open) setTourMode(null); }}
        steps={tourSteps}
        currentId={tourSteps[0].id}
        onCurrentChange={() => undefined}
      />
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<OverlayFixture />);
