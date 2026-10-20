import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Flag } from "lucide-react";
import {
  AsyncSelect, Autocomplete, Button, Cascader, GuidedTour, HoverCard,
  MultiSelect, Popover, Select, Tag, TagInput, ThemeProvider, type ThemePreset,
} from "../../src/ui";
import "../../src/ui/styles.css";

const params = new URLSearchParams(location.search);
const scenario = params.get("case") ?? "inputs";
const preset: ThemePreset = params.get("theme") === "apple" ? "apple" : params.get("theme") === "material" ? "material" : "default";
const options = [
  { value: "gb", label: "英国工作区", leading: <Flag /> },
  { value: "fr", label: "法国工作区" },
  { value: "long", label: "国际订阅平台跨区域结算与安全审计工作区".repeat(4), leading: <Flag /> },
];
function Fixture() {
  const [value, setValue] = useState("gb");
  const [tag, setTag] = useState(true);
  const [tour, setTour] = useState(false);
  const [step, setStep] = useState("intro");
  return <ThemeProvider mode="light" preset={preset}><main style={{ padding: 16, display: "grid", gap: 16 }}>
    {scenario === "inputs" && <>
      <section id="multi" style={{ width: 240 }}><MultiSelect ariaLabel="多选工作区" options={options} defaultValue={["gb"]} /></section>
      <section id="async" style={{ width: 240 }}><AsyncSelect ariaLabel="异步工作区" options={options} defaultValue="gb" /></section>
      <section id="auto" style={{ width: 240 }}><Autocomplete ariaLabel="自动完成工作区" options={options} /></section>
      <section id="tag-input" style={{ width: 240 }}><TagInput ariaLabel="标签工作区" suggestions={options} /></section>
      <section id="single" style={{ width: 240 }}><Select ariaLabel="单选工作区" options={options} value={value} onValueChange={setValue} /></section>
    </>}
    {scenario === "sizing" && <>
      <section id="small-tags" style={{ display: "flex", alignItems: "center", gap: 8, maxWidth: 260 }}>
        <Tag size="small">已启用</Tag>{tag && <Tag size="small" onRemove={() => setTag(false)} removeLabel="删除小标签">已启用</Tag>}
      </section>
      <section id="medium-tags" style={{ display: "flex", alignItems: "center", gap: 8, maxWidth: 260 }}><Tag>已启用</Tag><Tag onRemove={() => {}} removeLabel="删除普通标签">已启用</Tag></section>
      <section id="long-tag" style={{ width: 160 }}><Tag size="small" onRemove={() => {}} removeLabel="删除长标签">国际结算安全审计工作区的超长状态说明</Tag></section>
      <section id="cascade" style={{ width: 160 }}><Cascader ariaLabel="区域" defaultValue={["asia", "cn"]} options={[{ value: "asia", label: "亚洲", children: [{ value: "cn", label: "中国" }, { value: "jp", label: "日本" }] }, { value: "eu", label: "欧洲", children: [{ value: "gb", label: "英国" }] }]} /></section>
    </>}
    {scenario === "popover" && <>
      <Popover triggerLabel="打开筛选" ariaLabel="筛选设置"><Select ariaLabel="浮层内区域" options={[{ value: "gb", label: "英国" }, { value: "fr", label: "法国" }]} value={value} onValueChange={setValue} /><MultiSelect ariaLabel="浮层内权限" options={options} /><Button>保存筛选</Button></Popover>
      <Button>浮层外操作</Button>
    </>}
    {scenario === "hover" && <>
      <HoverCard triggerLabel="查看成员" ariaLabel="成员卡片"><Button>卡片内第一操作</Button><Button>卡片内第二操作</Button><Select ariaLabel="卡片内区域" options={options} value={value} onValueChange={setValue} /></HoverCard>
      <Button>卡片外操作</Button>
    </>}
    {scenario === "tour" && <>
      <Button onClick={() => { setStep("intro"); setTour(true); }}>打开长引导</Button>
      <GuidedTour open={tour} onOpenChange={setTour} currentId={step} onCurrentChange={setStep} steps={[{ id: "intro", title: "配置说明", description: "请确认角色配置、数据访问权限、通知偏好和账户安全设置符合团队要求。".repeat(35) }, { id: "finish", title: "完成配置", description: "已完成全部步骤。" }]} />
    </>}
  </main></ThemeProvider>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
