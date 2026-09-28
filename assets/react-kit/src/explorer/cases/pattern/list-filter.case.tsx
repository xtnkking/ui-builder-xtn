// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"list-filter/overview","exports":["PageHeading","ListManagementPage","SearchFilterPage","MemberManagementPage"]}
import { Button, EmptyState, FilterBar, Input, ListManagementPage, MemberManagementPage, PageHeading, SearchFilterPage, Tabs } from "../../../personal-ui";
import type { MemberResult } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const result: MemberResult = {
  items: [{ id: "m1", name: "林夏", email: "lin.xia@example.com", team: "客户成功", role: "编辑者", status: "已加入", joinedAt: "2026-09-20" }],
  total: 1,
};

function ListFilterExample() {
  return (
    <Tabs
      ariaLabel="列表页面模式案例"
      defaultValue="management"
      items={[
        { id: "heading", label: "页头", content: <PageHeading title="成员" description="统一页面标题、返回和操作区。" actions={<Button variant="primary">邀请成员</Button>} /> },
        {
          id: "management",
          label: "列表管理",
          content: (
            <ListManagementPage title="项目" description="显式查询并保持结果区域稳定。" filters={<FilterBar ariaLabel="项目筛选" actions={<Button size="field">查询</Button>}><Input aria-label="项目名称" value="" onChange={() => undefined} /></FilterBar>}>
              <EmptyState compact title="暂无项目" description="创建第一个项目后会显示在这里。" />
            </ListManagementPage>
          ),
        },
        {
          id: "search",
          label: "搜索筛选",
          content: <SearchFilterPage title="审计记录" filters={<FilterBar ariaLabel="审计筛选" actions={<Button size="field">搜索</Button>}><Input aria-label="操作者" value="林" onChange={() => undefined} /></FilterBar>}><p>最近一次查询结果</p></SearchFilterPage>,
        },
        {
          id: "members",
          label: "成员工作流",
          content: <MemberManagementPage fetchMembers={async () => result} />,
        },
      ]}
    />
  );
}

const explorerCase: ExplorerCase = {
  id: "list-filter/overview",
  label: "列表、筛选与成员管理",
  summary: "覆盖标准页头、显式查询、加载/空/错误边界以及完整成员管理工作流。",
  states: ["default", "loading", "empty", "error", "validation", "longContent", "keyboard", "mobile", "overlay", "dark", "locale"],
  content: <ListFilterExample />,
  code: `import { MemberManagementPage } from "./personal-ui";

<MemberManagementPage fetchMembers={fetchMembers} />`,
};

export default explorerCase;
