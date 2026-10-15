import {
  Button,
  DataTable,
  TableCellText,
  Tag,
  TreeTable,
  useToast,
  type DataColumn,
  type TreeTableColumn,
  type TreeTableNode,
} from "../../../ui";
import { StatePreview } from "../state-preview";
import type { ExplorerCase } from "../types";

interface TaskRow {
  id: string;
  phone: string;
  type: string;
  country: string;
  area: number;
  claimed: number;
  arrangement: string;
}

const tasks: TaskRow[] = [
  { id: "26090817113818751879", phone: "15145034912", type: "tgActive", country: "CA", area: 1, claimed: 0, arrangement: "等待筛选领取" },
  { id: "26090817113818751880", phone: "15145032113", type: "tgActive", country: "CA", area: 2, claimed: 12, arrangement: "等待筛选领取" },
  { id: "26090817113818751881", phone: "15144979481", type: "tgActive", country: "CA", area: 3, claimed: 3, arrangement: "等待筛选领取" },
];

interface ProjectRow { name: string; owner: string; members: number }
const projects: TreeTableNode<ProjectRow>[] = [{
  id: "project",
  value: { name: "加拿大任务项目", owner: "林晓", members: 3 },
  children: [{ id: "group", value: { name: "第一项目组", owner: "陈屿", members: 0 } }],
}];
const projectColumns: TreeTableColumn<ProjectRow>[] = [
  { id: "name", header: "项目 / 项目组", cell: (row) => row.name, width: "50%" },
  { id: "owner", header: "负责人", cell: (row) => <TableCellText secondary="项目成员">{row.owner}</TableCellText>, width: "30%" },
  { id: "members", header: "成员数", cell: (row) => <TableCellText numeric>{row.members}</TableCellText>, width: "20%" },
];

function TaskTypographyExample() {
  const { toast } = useToast();
  const columns: DataColumn<TaskRow>[] = [
    { id: "id", header: "任务", cell: (row) => row.id, width: 190 },
    { id: "phone", header: "号码", cell: (row) => <TableCellText numeric>{row.phone}</TableCellText>, width: 130 },
    { id: "type", header: "任务类型", cell: (row) => row.type, width: 100 },
    { id: "country", header: "国家", cell: (row) => row.country, width: 70 },
    { id: "area", header: "区号", cell: (row) => row.area, width: 70 },
    { id: "status", header: "状态", cell: () => <Tag>排队中</Tag>, width: 100 },
    { id: "arrangement", header: "当前安排", cell: (row) => row.arrangement, width: 160 },
    { id: "claimed", header: "成功领取次数", cell: (row) => <TableCellText numeric secondary="累计领取">{row.claimed}</TableCellText>, width: 120 },
    { id: "time", header: "时间", cell: () => <TableCellText secondary="档案更新：10/15 15:23:40">首次入库：10/15 15:23:40</TableCellText>, width: 230 },
    { id: "result", header: "结果 / 最近记录错误", cell: () => <TableCellText secondary="未记录错误">尚无结果</TableCellText>, width: 190 },
    { id: "actions", header: "操作", width: 90, cell: (row) => <Button
      size="small"
      variant="ghost"
      aria-label={`查看任务 ${row.id}`}
      onClick={() => toast({ tone: "success", title: `已选择任务 ${row.id}`, description: "演示操作已接收，任务数据保持原值。" })}
    >详情</Button> },
  ];
  return <div style={{ display: "grid", gap: 20, minWidth: 0 }}>
    <DataTable
      ariaLabel="任务数据正文排版"
      columns={columns}
      rows={tasks}
      rowKey={(row) => row.id}
      viewportRows={3}
      pagination={{ page: 1, pageCount: 1, total: tasks.length, pageSize: 3, onPageChange: () => undefined }}
    />
    <TreeTable
      ariaLabel="项目树表正文排版"
      nodes={projects}
      columns={projectColumns}
      treeColumnId="name"
      getRowLabel={(node) => node.value.name}
      defaultExpandedIds={["project"]}
    />
  </div>;
}

const longPrimary = "跨地区订阅任务：这是需要保持完整含义的很长任务名称，默认在固定列宽内省略，悬停可查看完整内容。";
const longSecondary = "这是补充说明，字号保持次级层次，长文本不会扩大表格或把其他列挤出页面。";
const longColumns: DataColumn<{ id: string }>[] = [
  { id: "plain", header: "普通文本自动省略", cell: () => longPrimary, width: 220 },
  { id: "stacked", header: "主次信息分别省略", cell: () => <TableCellText secondary={longSecondary}>{longPrimary}</TableCellText>, width: 220 },
  { id: "wrapped", header: "显式允许换行", cell: () => <TableCellText wrap secondary={longSecondary}>{longPrimary}</TableCellText>, width: 220 },
  { id: "emphasized", header: "显式强调", cell: () => <TableCellText emphasis>待复核</TableCellText>, width: 120 },
  { id: "zero", header: "数字零不丢失", cell: () => <TableCellText secondary={0}>累计领取</TableCellText>, width: 120 },
];

function LongTypographyExample() {
  return <DataTable ariaLabel="长文本与显式强调" columns={longColumns} rows={[{ id: "long-task" }]} rowKey={(row) => row.id} viewportRows="auto" />;
}

const explorerCase = {
  id: "data-table/typography",
  label: "表格正文排版",
  summary: "任务编号、号码、类型、国家、数字、时间和结果采用同一级正文；辅助说明保留次级层次。普通字符串与数字自动统一；复杂单元格使用 TableCellText。状态标签与按钮保留各自的组件排版。",
  states: ["default", "longContent", "mobile", "dark", "locale"],
  content: <TaskTypographyExample />,
  stateExamples: [
    { state: "default", exports: ["DataTable", "TreeTable", "TableCellText"], content: <TaskTypographyExample /> },
    { state: "longContent", exports: ["DataTable", "TableCellText"], content: <LongTypographyExample />, instructions: "固定列宽内默认省略，title 保留完整内容；仅指定 wrap 时换行，仅指定 emphasis 时强调。数字 0 与次级数字 0 均保留。" },
    { state: "mobile", exports: ["DataTable", "TreeTable", "TableCellText"], content: <StatePreview state="mobile"><TaskTypographyExample /></StatePreview>, instructions: "窄屏在表格自己的滚动区域查看全部列；正文不通过缩小字号来迁就宽度。" },
    { state: "dark", exports: ["DataTable", "TreeTable", "TableCellText"], content: <StatePreview state="dark"><TaskTypographyExample /></StatePreview> },
    { state: "locale", exports: ["DataTable", "TreeTable", "TableCellText"], content: <StatePreview state="locale"><TaskTypographyExample /></StatePreview>, instructions: "业务数据保持原值；组件自带分页和无障碍文字随 LocaleProvider 切换。" },
  ],
  code: `const columns = [
  { id: "id", header: "任务", cell: (row) => row.id, width: 190 },
  { id: "phone", header: "号码", cell: (row) =>
    <TableCellText numeric>{row.phone}</TableCellText>, width: 130 },
  { id: "result", header: "结果", cell: (row) =>
    <TableCellText secondary={row.lastError}>{row.result}</TableCellText>, width: 190 },
  { id: "status", header: "状态", cell: (row) => <Tag>{row.status}</Tag>, width: 100 },
];
<DataTable ariaLabel="任务列表" columns={columns} rows={rows} rowKey={(row) => row.id} />
// numeric 仅使数字等宽；emphasis 才强调正文；wrap 才允许长文本换行。
// 日期和电话号码由业务格式化为字符串，不自动改写值。
// 状态 Tag、操作 Button 不需要包在 TableCellText 内。`,
} satisfies ExplorerCase;

export default explorerCase;
