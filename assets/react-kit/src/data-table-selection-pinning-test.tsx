import { createRoot } from "react-dom/client";
import {
  Checkbox,
  DataTable,
  VisuallyHidden,
  type DataColumn,
} from "./personal-ui";
import "./personal-ui/styles.css";

interface TestRow {
  id: string;
  name: string;
  role: string;
  team: string;
}

const rows: TestRow[] = [{ id: "u01", name: "陈沐", role: "管理员", team: "平台" }];

function selectionColumn(id: string, label: string, pin?: DataColumn<TestRow>["pin"], hidden = false): DataColumn<TestRow> {
  return {
    id,
    kind: "selection",
    pin,
    hidden,
    width: 52,
    align: "center",
    header: <Checkbox label={<VisuallyHidden>{label}选择全部</VisuallyHidden>} />,
    cell: (row) => <Checkbox label={<VisuallyHidden>{label}选择{row.name}</VisuallyHidden>} />,
  };
}

function dataColumns(): DataColumn<TestRow>[] {
  return [
    { id: "name", header: "姓名", width: 240, cell: (row) => row.name },
    { id: "role", header: "角色", width: 180, cell: (row) => row.role },
    { id: "team", header: "团队", width: 180, cell: (row) => row.team },
    { id: "actions", header: "操作", width: 100, pin: "end", cell: () => "查看" },
  ];
}

const fixtures: Array<{ label: string; columns: DataColumn<TestRow>[] }> = [
  { label: "默认勾选列", columns: [selectionColumn("selection", "默认勾选列"), ...dataColumns()] },
  { label: "首列取消固定", columns: [selectionColumn("selection", "首列取消固定", false), ...dataColumns()] },
  {
    label: "第二列右侧固定",
    columns: [
      selectionColumn("selection", "第二列右侧固定"),
      { ...dataColumns()[0], pin: "end" },
      ...dataColumns().slice(1),
    ],
  },
  {
    label: "隐藏前导列",
    columns: [
      { id: "hidden-prefix", header: "隐藏列", width: 120, hidden: true, cell: () => "隐藏" },
      selectionColumn("selection", "隐藏前导列"),
      ...dataColumns(),
    ],
  },
  {
    label: "隐藏勾选列",
    columns: [selectionColumn("selection", "隐藏勾选列", undefined, true), ...dataColumns()],
  },
];

function TestPage() {
  return (
    <main>
      {fixtures.map(({ label, columns }) => (
        <section key={label}>
          <h2>{label}</h2>
          <DataTable
            ariaLabel={label}
            columns={columns}
            rows={rows}
            rowKey={(row) => row.id}
            mobileRow={(row) => <span>{row.name}</span>}
          />
        </section>
      ))}
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<TestPage />);
