// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"filter-bar/overview","exports":["FilterBar"]}
import { useState } from "react";
import { StatePreview } from "../state-preview";
import { Button, FilterBar, SearchInput, Tag } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const members = ["林夏 lin.xia@example.com", "陈屿 chen.yu@example.com", "王宁 wang.ning@example.com"];

function FilterBarExample({ longContent = false }: { longContent?: boolean }) {
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const results = members.filter((member) => member.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  return <FilterBar ariaLabel={longContent ? "完整成员筛选说明" : "成员筛选"} onSubmit={(event) => { event.preventDefault(); setQuery(draft.trim()); }} actions={<Button type="submit" variant="primary">查询</Button>} activeFilters={query ? <Tag tone="blue">关键词：{query}</Tag> : null} status={`共 ${results.length} 条结果；${results.join("；") || "没有匹配成员"}`}><SearchInput aria-label="搜索成员" placeholder="姓名或邮箱" value={draft} onChange={(event) => setDraft(event.currentTarget.value)} />{longContent ? <span>此筛选覆盖全部产品中的角色配置、数据访问权限、通知偏好和账户安全设置，请确认所有关联配置均符合团队的实际使用要求。</span> : null}</FilterBar>;
}

function EnglishFilterBarExample() {
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const results = members.filter((member) => member.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  return <FilterBar ariaLabel="Member filters" onSubmit={(event) => { event.preventDefault(); setQuery(draft.trim()); }} actions={<Button type="submit" variant="primary">Search</Button>} activeFilters={query ? <Tag>Keyword: {query}</Tag> : null} status={`${results.length} results`}><SearchInput aria-label="Search members" placeholder="Name or email" value={draft} onChange={(event) => setDraft(event.currentTarget.value)} /></FilterBar>;
}

const explorerCase = {
  id: "filter-bar/overview",
  label: "筛选栏",
  summary: "筛选字段只更新草稿，显式查询才应用条件；演示本地成员集合过滤，加载、校验和错误由字段、动作与反馈组件负责。",
  states: ["default", "longContent", "keyboard", "mobile", "overlay", "dark", "locale"],
  stateExamples: [
    { state: "default", exports: ["FilterBar"], content: <FilterBarExample /> },
    { state: "longContent", exports: ["FilterBar"], content: <FilterBarExample longContent /> },
    { state: "keyboard", exports: ["FilterBar"], instructions: "输入 lin，再用 Tab 和 Enter 激活查询，或在搜索框按 Enter 提交；输入期间结果不变，提交后结果变为林夏。", content: <FilterBarExample /> },
    { state: "mobile", exports: ["FilterBar"], content: <StatePreview state="mobile"><FilterBarExample /></StatePreview> },
    { state: "overlay", exports: ["FilterBar"], content: <StatePreview state="overlay"><FilterBarExample /></StatePreview> },
    { state: "dark", exports: ["FilterBar"], content: <StatePreview state="dark"><FilterBarExample /></StatePreview> },
    { state: "locale", exports: ["FilterBar"], content: <StatePreview state="locale"><EnglishFilterBarExample /></StatePreview> },
  ],
  content: <FilterBarExample />,
  code: `<FilterBar ariaLabel="成员筛选" onSubmit={applyFilters} actions={<Button type="submit">查询</Button>}>{fields}</FilterBar>`,
} satisfies ExplorerCase;

export default explorerCase;
