// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"lightbox/overview","exports":["Lightbox"]}
import { useState } from "react";
import { Button, Lightbox } from "../../../personal-ui";
import { StatePreview } from "../state-preview";
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

function FailedLightboxExample() {
  const [open, setOpen] = useState(false);
  return <><Button onClick={() => setOpen(true)}>预览损坏的图片</Button><Lightbox open={open} onOpenChange={setOpen} value="broken" onValueChange={() => undefined} items={[{ id: "broken", src: "data:image/png;base64,aW52YWxpZA==", alt: "不能解码的图片", caption: "损坏图片" }]} /></>;
}

function LongLightboxExample() {
  const [open, setOpen] = useState(false);
  return <><Button onClick={() => setOpen(true)}>预览长说明图片</Button><Lightbox open={open} onOpenChange={setOpen} value="details" onValueChange={() => undefined} items={[{ id: "details", src: image, alt: "产品配置预览图", caption: "此图片用于展示全部产品中的角色配置、数据访问权限、通知偏好和账户安全设置，请在保存前确认所有关联配置均符合团队的实际使用要求。" }]} /></>;
}

function EnglishLightboxExample() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("one");
  return <><Button onClick={() => setOpen(true)}>Preview images</Button><Lightbox open={open} onOpenChange={setOpen} value={value} onValueChange={setValue} items={[{ id: "one", src: image, alt: "Product configuration preview", caption: "First image" }, { id: "two", src: image, alt: "Another product preview", caption: "Second image" }]} /></>;
}

const explorerCase: ExplorerCase = {
  id: "lightbox/overview",
  label: "图片浏览",
  summary: "展示受控当前项、方向键/Home/End 导航、加载失败回退和关闭后的焦点恢复。",
  states: ["default", "controlled", "empty", "error", "longContent", "keyboard", "overlay", "dark", "locale"],
  content: <LightboxExample />,
  stateExamples: [
    { state: "default", exports: ["Lightbox"], content: <LightboxExample /> },
    { state: "controlled", exports: ["Lightbox"], instructions: "打开查看器并切换图片；当前项和打开状态均由示例状态回调管理。", content: <LightboxExample /> },
    { state: "empty", exports: ["Lightbox"], instructions: "items 为空时不会显示查看器面板，页面应自行显示没有图片的说明。", content: <><Lightbox open onOpenChange={() => undefined} value="" onValueChange={() => undefined} items={[]} /><p>当前没有可预览的图片，查看器保持不可见。</p></> },
    { state: "error", exports: ["Lightbox"], instructions: "打开查看器；无效的内联 PNG 无法解码，将触发组件的图片错误回退。", content: <FailedLightboxExample /> },
    { state: "longContent", exports: ["Lightbox"], content: <LongLightboxExample /> },
    { state: "keyboard", exports: ["Lightbox"], instructions: "用 Enter 打开查看器；左右方向键切换图片，Home/End 跳转首尾，Esc 关闭并返回预览按钮。", content: <LightboxExample /> },
    { state: "overlay", exports: ["Lightbox"], instructions: "在外层弹窗内打开图片查看器；Esc 先关闭查看器并返回预览按钮。", content: <StatePreview state="overlay"><LightboxExample /></StatePreview> },
    { state: "dark", exports: ["Lightbox"], content: <StatePreview state="dark"><LightboxExample /></StatePreview> },
    { state: "locale", exports: ["Lightbox"], content: <StatePreview state="locale"><EnglishLightboxExample /></StatePreview> },
  ],
  code: `import { Lightbox } from "./personal-ui";

<Lightbox open={open} onOpenChange={setOpen} value={currentId} onValueChange={setCurrentId} items={images} />`,
};

export default explorerCase;
