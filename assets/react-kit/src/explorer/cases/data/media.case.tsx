// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"media/overview","exports":["Media"]}
import { StatePreview } from "../state-preview";
import { Media } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const dashboardPreview = new URL("../../assets/dashboard-preview.svg", import.meta.url).href;

const explorerCase = {
  id: "media/overview",
  label: "媒体内容",
  summary: "图片保持稳定比例、替代文本和说明文字，适应窄屏容器。",
  states: ["default", "longContent", "dark", "locale"],
  stateExamples: [
    { state: "longContent", exports: ["Media"], content: <Media src={dashboardPreview} alt="产品配置看板" caption="此图片用于展示全部产品中的角色配置、数据访问权限、通知偏好和账户安全设置，请在保存前确认所有关联配置均符合团队的实际使用要求。" /> },
    { state: "default", exports: ["Media"], content: (
    <div style={{ maxWidth: 520 }}>
      <Media
        src={dashboardPreview}
        alt="屏幕上展示数据分析图表"
        caption="运营数据看板预览"
        aspectRatio="16 / 9"
        objectFit="cover"
      />
    </div>
  ) },
    { state: "dark", exports: ["Media"], content: <StatePreview state="dark">{(
    <div style={{ maxWidth: 520 }}>
      <Media
        src={dashboardPreview}
        alt="屏幕上展示数据分析图表"
        caption="运营数据看板预览"
        aspectRatio="16 / 9"
        objectFit="cover"
      />
    </div>
  )}</StatePreview> },
    { state: "locale", exports: ["Media"], content: <StatePreview state="locale">{(
    <div style={{ maxWidth: 520 }}>
      <Media
        src={dashboardPreview}
        alt="屏幕上展示数据分析图表"
        caption="运营数据看板预览"
        aspectRatio="16 / 9"
        objectFit="cover"
      />
    </div>
  )}</StatePreview> },
  ],
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
