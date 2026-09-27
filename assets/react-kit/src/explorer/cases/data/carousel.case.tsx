// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"carousel/overview","exports":["Carousel"]}
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
  states: ["default", "disabled", "readOnly", "controlled", "uncontrolled", "validation", "longContent", "keyboard", "overlay", "dark", "locale"],
  content: <CarouselExample />,
  code: `<Carousel slides={slides} ariaLabel="运营摘要" value={value} onValueChange={setValue} loop />`,
} satisfies ExplorerCase;

export default explorerCase;
