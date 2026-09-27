// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"filter-bar/overview","exports":["FilterBar"]}
import { Button, FilterBar, SearchInput, Tag } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const explorerCase = {
  id: "filter-bar/overview",
  label: "筛选栏",
  summary: "筛选字段只更新草稿，显式查询按钮才触发请求；活动条件和结果状态独立呈现。",
  states: ["default", "loading", "empty", "error", "validation", "longContent", "keyboard", "mobile", "overlay", "dark", "locale"],
  content: <FilterBar ariaLabel="成员筛选" onSubmit={(event) => event.preventDefault()} actions={<Button type="submit" variant="primary">查询</Button>} activeFilters={<Tag tone="blue">状态：已加入</Tag>} status="共 24 条结果"><SearchInput aria-label="搜索成员" placeholder="姓名或邮箱" value="" onChange={() => undefined} /></FilterBar>,
  code: `<FilterBar ariaLabel="成员筛选" actions={<Button type="submit">查询</Button>}>{fields}</FilterBar>`,
} satisfies ExplorerCase;

export default explorerCase;
