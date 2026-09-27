// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"media/overview","exports":["Media"]}
import { Media } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const dashboardPreview = new URL("../../assets/dashboard-preview.svg", import.meta.url).href;

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
