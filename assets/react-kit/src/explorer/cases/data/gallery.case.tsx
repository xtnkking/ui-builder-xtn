// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"gallery/overview","exports":["Gallery"]}
import { StatePreview } from "../state-preview";
import { useState } from "react";
import { Gallery } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

function createPreviewImage(background: string, content: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 480"><rect width="640" height="480" fill="${background}"/>${content}</svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

const dashboardPreview = createPreviewImage("#eaf2ff", `
  <rect x="48" y="44" width="544" height="392" rx="28" fill="#ffffff"/>
  <rect x="78" y="78" width="118" height="18" rx="9" fill="#172033"/>
  <rect x="78" y="116" width="210" height="10" rx="5" fill="#b9c8df"/>
  <rect x="78" y="158" width="140" height="88" rx="14" fill="#dce9ff"/>
  <rect x="234" y="158" width="140" height="88" rx="14" fill="#eaf7f2"/>
  <rect x="390" y="158" width="140" height="88" rx="14" fill="#fff1dc"/>
  <rect x="78" y="276" width="452" height="118" rx="18" fill="#f5f7fb"/>
  <path d="M108 360 L178 326 L244 342 L316 294 L382 316 L500 286" fill="none" stroke="#1769d2" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>
`);

const workspacePreview = createPreviewImage("#eaf7f2", `
  <rect x="48" y="44" width="544" height="392" rx="28" fill="#ffffff"/>
  <rect x="78" y="78" width="136" height="18" rx="9" fill="#172033"/>
  <rect x="78" y="120" width="144" height="274" rx="16" fill="#f3f6fa"/>
  <rect x="248" y="120" width="144" height="274" rx="16" fill="#eef5ff"/>
  <rect x="418" y="120" width="114" height="274" rx="16" fill="#f3f6fa"/>
  <rect x="94" y="146" width="112" height="64" rx="12" fill="#ffffff"/>
  <rect x="94" y="226" width="112" height="92" rx="12" fill="#ffffff"/>
  <rect x="264" y="146" width="112" height="104" rx="12" fill="#ffffff"/>
  <rect x="264" y="266" width="112" height="72" rx="12" fill="#ffffff"/>
  <rect x="434" y="146" width="82" height="82" rx="12" fill="#ffffff"/>
  <circle cx="112" cy="174" r="8" fill="#1769d2"/>
  <circle cx="282" cy="174" r="8" fill="#20a475"/>
  <circle cx="452" cy="174" r="8" fill="#ef9f2f"/>
`);

const planningPreview = createPreviewImage("#fff4e5", `
  <rect x="48" y="44" width="544" height="392" rx="28" fill="#ffffff"/>
  <rect x="78" y="78" width="148" height="18" rx="9" fill="#172033"/>
  <rect x="78" y="116" width="236" height="10" rx="5" fill="#c5cfde"/>
  <path d="M116 166 V370" stroke="#d8e0eb" stroke-width="6" stroke-linecap="round"/>
  <circle cx="116" cy="180" r="18" fill="#1769d2"/>
  <circle cx="116" cy="260" r="18" fill="#20a475"/>
  <circle cx="116" cy="340" r="18" fill="#ef9f2f"/>
  <path d="M108 180 L114 186 L125 173" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="156" y="158" width="370" height="48" rx="12" fill="#edf4ff"/>
  <rect x="156" y="238" width="306" height="48" rx="12" fill="#eaf7f2"/>
  <rect x="156" y="318" width="338" height="48" rx="12" fill="#fff1dc"/>
`);

const items = [
  { id: "dashboard", src: dashboardPreview, alt: "数据看板界面", caption: "分析看板" },
  { id: "workspace", src: workspacePreview, alt: "明亮的协作工作区", caption: "协作空间" },
  { id: "planning", src: planningPreview, alt: "项目规划时间线", caption: "项目规划" },
];

function GalleryExample() {
  const [selectedId, setSelectedId] = useState(items[0].id);
  return <Gallery items={items} columns={3} selectedId={selectedId} onSelect={(item) => setSelectedId(item.id)} ariaLabel="产品场景图库" aspectRatio="4 / 3" />;
}

const explorerCase = {
  id: "gallery/overview",
  label: "可选择图库",
  summary: "图库提供稳定项目 ID、替代文本和受控选择状态，并在窄屏自动适配列数。",
  states: ["default", "controlled", "empty", "longContent", "keyboard", "overlay", "dark", "locale"],
  stateExamples: [
    { state: "controlled", exports: ["Gallery"], content: <GalleryExample /> },
    { state: "empty", exports: ["Gallery"], content: <Gallery items={[]} ariaLabel="空图库" empty="没有可预览的图片" /> },
    { state: "longContent", exports: ["Gallery"], content: <Gallery ariaLabel="完整配置预览" columns={2} items={[{ id: "details", src: dashboardPreview, alt: "配置看板", caption: "此图片展示全部产品中的角色配置、数据访问权限、通知偏好和账户安全设置，请在保存前确认所有关联配置均符合团队的实际使用要求。" }]} /> },
    { state: "default", exports: ["Gallery"], content: <GalleryExample /> },
    { state: "keyboard", exports: ["Gallery"], content: <GalleryExample />, instructions: "用 Tab 访问本例可用控件，使用 Enter、Space 和组件文档中的方向键操作。此项为人工操作案例，不是自动行为验收证书。" },
    { state: "overlay", exports: ["Gallery"], content: <StatePreview state="overlay">{<GalleryExample />}</StatePreview> },
    { state: "dark", exports: ["Gallery"], content: <StatePreview state="dark">{<GalleryExample />}</StatePreview> },
    { state: "locale", exports: ["Gallery"], content: <StatePreview state="locale">{<GalleryExample />}</StatePreview> },
  ],
  content: <GalleryExample />,
  code: `<Gallery items={items} selectedId={selectedId} onSelect={(item) => setSelectedId(item.id)} ariaLabel="产品场景图库" />`,
} satisfies ExplorerCase;

export default explorerCase;
