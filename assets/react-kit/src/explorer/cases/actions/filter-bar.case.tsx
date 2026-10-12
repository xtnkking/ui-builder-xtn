// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"filter-bar/overview","exports":["FilterBar"]}
import { useId, useRef, useState, type FormEvent } from "react";
import { StatePreview } from "../state-preview";
import { Button, Field, FilterBar, SearchInput, Select, Tag } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const members = ["林夏 lin.xia@example.com", "陈屿 chen.yu@example.com", "王宁 wang.ning@example.com"];

function FilterBarExample({ longContent = false, simulateRequest = false, density = "compact" }: { longContent?: boolean; simulateRequest?: boolean; density?: "compact" | "comfortable" }) {
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const requestPending = useRef(false);
  const results = members.filter((member) => member.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const applyQuery = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (requestPending.current) return;
    const nextQuery = draft.trim();
    requestPending.current = true;
    setLoading(simulateRequest);
    try {
      if (simulateRequest) await new Promise<void>((resolve) => setTimeout(resolve, 800));
      setQuery(nextQuery);
    } finally {
      requestPending.current = false;
      setLoading(false);
    }
  };
  return <FilterBar ariaLabel={longContent ? "完整成员筛选说明" : "成员筛选"} density={density} onSubmit={applyQuery} actions={<Button type="submit" size="field" variant="primary" loading={loading} loadingLabel="查询">查询</Button>} activeFilters={query ? <Tag tone="blue">关键词：{query}</Tag> : null} status={`${loading ? "正在查询；" : ""}共 ${results.length} 条结果；${results.join("；") || "没有匹配成员"}`}><SearchInput aria-label="搜索成员" placeholder="姓名或邮箱" value={draft} onChange={(event) => setDraft(event.currentTarget.value)} />{longContent ? <span>此筛选覆盖全部产品中的角色配置、数据访问权限、通知偏好和账户安全设置，请确认所有关联配置均符合团队的实际使用要求。</span> : null}</FilterBar>;
}

function EnglishFilterBarExample() {
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const results = members.filter((member) => member.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  return <FilterBar ariaLabel="Member filters" onSubmit={(event) => { event.preventDefault(); setQuery(draft.trim()); }} actions={<Button type="submit" size="field" variant="primary" loadingLabel="Search">Search</Button>} activeFilters={query ? <Tag>Keyword: {query}</Tag> : null} status={`${results.length} results`}><SearchInput aria-label="Search members" placeholder="Name or email" value={draft} onChange={(event) => setDraft(event.currentTarget.value)} /></FilterBar>;
}

function FieldFilterBarExample() {
  const id = useId();
  const [draft, setDraft] = useState("");
  const [authentication, setAuthentication] = useState("unverified");
  const [applied, setApplied] = useState<{ query: string; authentication: string } | null>(null);
  const authenticationOptions = [
    { value: "all", label: "全部状态" },
    { value: "verified", label: "已认证" },
    { value: "unverified", label: "待认证" },
  ];
  const selectedLabel = authenticationOptions.find((option) => option.value === applied?.authentication)?.label;
  return <FilterBar
    ariaLabel="带提示的成员筛选"
    onSubmit={(event) => { event.preventDefault(); setApplied({ query: draft.trim(), authentication }); }}
    actions={<Button type="submit" size="field" variant="primary" loadingLabel="应用筛选">应用筛选</Button>}
    status={applied ? `已应用筛选：${applied.query || "全部成员"}；${selectedLabel}` : "输入仅更新草稿，点击应用筛选或按 Enter 后应用。"}
  >
    <Field label="成员姓名或邮箱（支持跨区域团队成员与外部协作者的完整名称）" htmlFor={`${id}-name`} hint="仅编辑查询草稿，点击应用筛选或按 Enter 后更新结果；支持完整成员姓名与邮箱，长提示自然换行。">
      <SearchInput id={`${id}-name`} aria-label="成员姓名" placeholder="姓名或邮箱" value={draft} onChange={(event) => setDraft(event.currentTarget.value)} onClear={() => setDraft("")} />
    </Field>
    <Field label="认证状态" htmlFor={`${id}-authentication`} error={authentication === "unverified" ? "此账号尚未完成认证，请核对状态。" : undefined}>
      <Select id={`${id}-authentication`} ariaLabel="认证状态" value={authentication} onValueChange={setAuthentication} options={authenticationOptions} />
    </Field>
  </FilterBar>;
}

const explorerCase = {
  id: "filter-bar/overview",
  label: "筛选栏",
  summary: "桌面默认 38px 紧凑控件，搜索字段约 320px；移动端与窄容器恢复 44px 并换行。字段只更新草稿，显式查询才应用条件；需要宽松尺寸时使用 density=comfortable。",
  states: ["default", "longContent", "keyboard", "mobile", "overlay", "dark", "locale"],
  stateExamples: [
    { state: "default", exports: ["FilterBar"], instructions: "输入 lin 后点击查询或按 Enter，模拟 800ms 请求；动作按钮保留查询文字并显示转圈，保持高度和宽度，重复提交不会启动新请求，完成后显示林夏。加载由 Button 拥有，FilterBar 仅组合字段、动作与结果。", content: <FilterBarExample simulateRequest /> },
    { state: "longContent", exports: ["FilterBar"], instructions: "此例使用 density=comfortable，保留 44px 宽松控件；长说明与操作自然换行。其他案例默认使用紧凑密度。", content: <FilterBarExample longContent density="comfortable" /> },
    { state: "keyboard", exports: ["FilterBar"], instructions: "输入 lin，再用 Tab 和 Enter 激活查询，或在搜索框按 Enter 提交；输入期间结果不变，提交后结果变为林夏。", content: <FilterBarExample /> },
    { state: "mobile", exports: ["FilterBar"], instructions: "此 320px 容器在桌面视口内也会纵排字段和动作；搜索框保持原高度，输入不会自动提交。", content: <StatePreview state="mobile"><FilterBarExample /></StatePreview> },
    { state: "overlay", exports: ["FilterBar"], content: <StatePreview state="overlay"><FilterBarExample /></StatePreview> },
    { state: "dark", exports: ["FilterBar"], content: <StatePreview state="dark"><FilterBarExample /></StatePreview> },
    { state: "locale", exports: ["FilterBar"], content: <StatePreview state="locale"><EnglishFilterBarExample /></StatePreview> },
  ],
  content: <div style={{ display: "grid", gap: 24 }}><FilterBarExample simulateRequest /><FieldFilterBarExample /></div>,
  code: `<FilterBar ariaLabel="成员筛选" onSubmit={applyFilters} actions={<Button type="submit" size="field" variant="primary" loading={querying} loadingLabel="查询">查询</Button>}>{fields}</FilterBar>`,
} satisfies ExplorerCase;

export default explorerCase;
