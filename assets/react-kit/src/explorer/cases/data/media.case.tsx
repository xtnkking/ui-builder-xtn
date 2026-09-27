// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"media/overview","exports":["Media"]}
import { Media } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const dashboardPreview = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540">
    <rect width="960" height="540" fill="#eaf2ff"/>
    <rect x="68" y="58" width="824" height="424" rx="32" fill="#ffffff"/>
    <rect x="108" y="98" width="172" height="20" rx="10" fill="#172033"/>
    <rect x="108" y="140" width="268" height="12" rx="6" fill="#b9c8df"/>
    <rect x="108" y="194" width="214" height="212" rx="20" fill="#f5f7fb"/>
    <rect x="350" y="194" width="502" height="212" rx="20" fill="#f5f7fb"/>
    <rect x="138" y="330" width="34" height="44" rx="8" fill="#9ec1f6"/>
    <rect x="188" y="286" width="34" height="88" rx="8" fill="#5b98ed"/>
    <rect x="238" y="240" width="34" height="134" rx="8" fill="#1769d2"/>
    <path d="M394 350 L468 306 L538 326 L612 256 L686 284 L808 226" fill="none" stroke="#1769d2" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="612" cy="256" r="12" fill="#20a475"/>
    <circle cx="808" cy="226" r="12" fill="#ef9f2f"/>
  </svg>
`)}`;

const explorerCase = {
  id: "media/overview",
  label: "媒体内容",
  summary: "图片保持稳定比例、替代文本和说明文字，适应窄屏容器。",
  states: ["default", "empty", "error", "longContent", "dark", "locale"],
  content: (
    <div style={{ maxWidth: 520 }}>
      <Media
        src={dashboardPreview}
        alt="屏幕上展示数据分析图表"
        caption="运营数据看板预览"
        aspectRatio="16 / 9"
        objectFit="cover"
      />
    </div>
  ),
  code: `<Media src={previewUrl} alt="屏幕上展示数据分析图表" caption="运营数据看板预览" aspectRatio="16 / 9" />`,
} satisfies ExplorerCase;

export default explorerCase;
