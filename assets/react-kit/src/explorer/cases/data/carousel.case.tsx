// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"carousel/overview","exports":["Carousel"]}
import { StatePreview } from "../state-preview";
import { useState } from "react";
import { Carousel, Card } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const slides = [
  { id: "overview", label: "运营概览", content: <Card heading="运营概览">今日所有核心服务运行正常。</Card> },
  { id: "risk", label: "风险提醒", content: <Card heading="风险提醒">有 3 项配置将在本周过期。</Card> },
  { id: "plan", label: "后续计划", content: <Card heading="后续计划">下一次发布窗口为周四 20:00。</Card> },
];

function CarouselExample() {
  const [value, setValue] = useState(slides[0].id);
  return <Carousel slides={slides} ariaLabel="运营摘要" value={value} onValueChange={setValue} loop />;
}

const explorerCase = {
  id: "carousel/overview",
  label: "受控轮播",
  summary: "当前页由稳定 slide ID 受控，上一页、下一页和分页点均支持键盘操作。",
  states: ["default", "controlled", "uncontrolled", "empty", "longContent", "keyboard", "overlay", "dark", "locale"],
  stateExamples: [
    { state: "uncontrolled", exports: ["Carousel"], content: <Carousel slides={slides} ariaLabel="组件维护当前页" defaultValue="overview" loop /> },
    { state: "empty", exports: ["Carousel"], content: <Carousel slides={[]} ariaLabel="空运营摘要" /> },
    { state: "longContent", exports: ["Carousel"], content: <Carousel ariaLabel="详细配置说明" slides={[{ id: "details", label: "完整说明", content: "此摘要覆盖全部产品中的角色配置、数据访问权限、通知偏好和账户安全设置，请在保存前确认所有关联配置均符合团队的实际使用要求。" }]} /> },
    { state: "default", exports: ["Carousel"], content: <CarouselExample /> },
    { state: "controlled", exports: ["Carousel"], content: <CarouselExample /> },
    { state: "keyboard", exports: ["Carousel"], content: <CarouselExample />, instructions: "用 Tab 访问本例可用控件，使用 Enter、Space 和组件文档中的方向键操作。此项为人工操作案例，不是自动行为验收证书。" },
    { state: "overlay", exports: ["Carousel"], content: <StatePreview state="overlay">{<CarouselExample />}</StatePreview> },
    { state: "dark", exports: ["Carousel"], content: <StatePreview state="dark">{<CarouselExample />}</StatePreview> },
    { state: "locale", exports: ["Carousel"], content: <StatePreview state="locale">{<CarouselExample />}</StatePreview> },
  ],
  content: <CarouselExample />,
  code: `<Carousel slides={slides} ariaLabel="运营摘要" value={value} onValueChange={setValue} loop />`,
} satisfies ExplorerCase;

export default explorerCase;
