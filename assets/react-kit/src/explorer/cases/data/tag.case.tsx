// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"tag/overview","exports":["Tag"]}
import { StatePreview } from "../state-preview";
import { useState } from "react";
import { Clock3, Flag } from "lucide-react";
import { Button, Inline, Tag } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

function CountryTagExample({ english = false }: { english?: boolean }) {
  const [selected, setSelected] = useState(false);
  const [visible, setVisible] = useState(true);
  return <div style={{ display: "grid", gap: 12 }}>
    <Inline gap="small" wrap>
      <Tag tone="blue" country={{ code: "GB", name: english ? "United Kingdom" : "英国", callingCode: "+44" }} selected={selected} />
      <Tag tone="blue" country={{ code: "DE", name: english ? "Germany" : "德国", callingCode: "+49" }} />
      {visible
        ? <Tag tone="blue" country={{ code: "AS", name: english ? "American Samoa" : "美属萨摩亚", callingCode: "+1684" }} onRemove={() => setVisible(false)} removeLabel={english ? "Remove American Samoa tag" : "移除美属萨摩亚标签"} />
        : <Button size="small" variant="ghost" onClick={() => setVisible(true)}>{english ? "Restore American Samoa tag" : "恢复美属萨摩亚标签"}</Button>}
      <Tag country={{ code: "FR", name: english ? "France" : "法国" }} />
    </Inline>
    <Inline gap="small" wrap>
      <Button size="small" variant="secondary" onClick={() => setSelected((current) => !current)}>{english ? (selected ? "Deselect United Kingdom tag" : "Select United Kingdom tag") : (selected ? "取消选择英国标签" : "选择英国标签")}</Button>
    </Inline>
  </div>;
}

function TagExample({ english = false }: { english?: boolean }) {
  const [visible, setVisible] = useState(true);
  return (
    <div style={{ display: "grid", gap: 20 }}>
      <Inline gap="small" wrap>
        <Tag tone="neutral">草稿</Tag>
        <Tag tone="success" selected>已启用</Tag>
        <Tag tone="blue" leading={<span aria-hidden="true">US</span>}>+1</Tag>
        <Tag tone="blue" leading={<Flag />}>GB +44</Tag>
        <Tag tone="warning" leading={<Clock3 />}>3 天后过期</Tag>
        {visible ? <Tag tone="warning" onRemove={() => setVisible(false)} removeLabel="移除即将过期标签">即将过期</Tag> : <Button variant="ghost" size="small" onClick={() => setVisible(true)}>恢复标签</Button>}
      </Inline>
      <CountryTagExample english={english} />
    </div>
  );
}

function LongTagExample() {
  const [visible, setVisible] = useState(true);
  return <Inline gap="small" wrap>
    <Tag>此标签包含全部产品中的角色配置、数据访问权限、通知偏好和账户安全设置，请确认所有关联配置均符合团队的实际使用要求。</Tag>
    <Tag tone="blue" leading={<Flag />}>跨区域企业工作区身份认证与安全策略审核的完整业务标签</Tag>
    {visible ? <Tag tone="warning" onRemove={() => setVisible(false)}>即将过期的企业订阅标签，包含跨地区结算与访问权限审核的完整业务说明</Tag> : <Button size="small" onClick={() => setVisible(true)}>恢复长标签</Button>}
    <Tag tone="blue" country={{ code: "GB", name: "英国跨区域企业工作区身份认证、访问权限与安全策略审核国家名称", callingCode: "+44" }} />
    <Tag tone="blue" country={{ code: "AS", name: "美属萨摩亚跨区域企业工作区的国家及地区完整名称", callingCode: "+1684" }} />
  </Inline>;
}

const explorerCase = {
  id: "tag/overview",
  label: "胶囊标签",
  summary: "展示普通胶囊和国旗、国家代码、国家名称、可选区号的官方国家胶囊；长名称优先省略，代码与区号保留。支持过期、移除与选中，选中状态不新增图标。",
  states: ["default", "error", "longContent", "keyboard", "dark", "locale"],
  stateExamples: [
    { state: "error", exports: ["Tag"], content: <Tag tone="danger">配置同步失败</Tag> },
    { state: "longContent", exports: ["Tag"], content: <LongTagExample />, instructions: "悬停省略文字查看原生全文提示；用 Tab 聚焦被省略的标签文字，辅助技术可读取完整文字。短标签不额外加入 Tab 顺序，移除按钮保持可访问。" },
    { state: "keyboard", exports: ["Tag"], instructions: "用 Tab 聚焦移除标签按钮，按 Enter 或空格移除；恢复按钮可以重新显示标签。选择英国标签只改变选中颜色，不新增图标或改变宽度。", content: <TagExample /> },
    { state: "default", exports: ["Tag"], content: <TagExample /> },
    { state: "dark", exports: ["Tag"], content: <StatePreview state="dark">{<TagExample />}</StatePreview> },
    { state: "locale", exports: ["Tag"], content: <StatePreview state="locale">{<TagExample english />}</StatePreview> },
  ],
  content: <TagExample />,
  code: `import { Flag } from "lucide-react";\n\n<Tag tone="success" selected>已启用</Tag>\n<Tag leading={<span>US</span>}>+1</Tag>\n<Tag leading={<Flag />}>GB +44</Tag>\n<Tag country={{ code: "GB", name: "英国", callingCode: "+44" }} tone="blue" />\n<Tag country={{ code: "AS", name: "美属萨摩亚", callingCode: "+1684" }} onRemove={remove} removeLabel="移除美属萨摩亚标签" />\n<Tag country={{ code: "FR", name: "法国" }} />\n<Tag onRemove={remove}>即将过期</Tag>`,
} satisfies ExplorerCase;

export default explorerCase;
