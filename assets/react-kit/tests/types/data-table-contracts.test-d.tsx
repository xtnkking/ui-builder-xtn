import { createRef } from "react";
import {
  DataTable,
  type DataColumn,
  type DataTableProps,
} from "../../src/personal-ui";

type Row = {
  id: string;
  name: string;
};

const columns: DataColumn<Row>[] = [
  { id: "name", header: "Name", cell: (row) => row.name },
];
const rows: Row[] = [{ id: "row-1", name: "Ada" }];

const allowedProps: DataTableProps<Row> = {
  ariaLabel: "Accounts",
  columns,
  rows,
  rowKey: (row) => row.id,
  id: "accounts-table",
  "aria-describedby": "accounts-description",
  onMouseEnter: () => undefined,
};
void allowedProps;

const inferredRowUsage = (
  <DataTable
    ariaLabel="Accounts"
    columns={[{ id: "name", header: "Name", cell: (row) => row.name }]}
    rows={rows}
    rowKey={(row) => row.id}
    data-track="accounts"
  />
);
void inferredRowUsage;

// @ts-expect-error fixed data controls do not expose className
const tableClassName = <DataTable ariaLabel="Accounts" columns={columns} rows={rows} rowKey={(row) => row.id} className="foreign" />;
// @ts-expect-error fixed data controls do not expose style
const tableStyle = <DataTable ariaLabel="Accounts" columns={columns} rows={rows} rowKey={(row) => row.id} style={{ color: "red" }} />;
// @ts-expect-error fixed data controls do not expose CSS-in-JS props
const tableCss = <DataTable ariaLabel="Accounts" columns={columns} rows={rows} rowKey={(row) => row.id} css={{ color: "red" }} />;
// @ts-expect-error fixed data controls do not expose sx
const tableSx = <DataTable ariaLabel="Accounts" columns={columns} rows={rows} rowKey={(row) => row.id} sx={{ color: "red" }} />;
// @ts-expect-error fixed data controls do not expose utility class props
const tableTw = <DataTable ariaLabel="Accounts" columns={columns} rows={rows} rowKey={(row) => row.id} tw="text-red" />;
// @ts-expect-error fixed data controls do not expose raw DOM refs
const tableRef = <DataTable ariaLabel="Accounts" columns={columns} rows={rows} rowKey={(row) => row.id} ref={createRef<HTMLDivElement>()} />;
// @ts-expect-error fixed data controls do not expose raw HTML injection
const tableHtml = <DataTable ariaLabel="Accounts" columns={columns} rows={rows} rowKey={(row) => row.id} dangerouslySetInnerHTML={{ __html: "unsafe" }} />;
// @ts-expect-error reserved ownership attributes are never public
const tableOwner = <DataTable ariaLabel="Accounts" columns={columns} rows={rows} rowKey={(row) => row.id} data-pui-owner="Consumer" />;
// @ts-expect-error known private slots are never public
const tableSlot = <DataTable ariaLabel="Accounts" columns={columns} rows={rows} rowKey={(row) => row.id} data-pui-slot="foreign" />;
const tablePrivateData: DataTableProps<Row> = {
  ariaLabel: "Accounts",
  columns,
  rows,
  rowKey: (row) => row.id,
  // @ts-expect-error the wildcard contract rejects unregistered reserved keys in Props objects
  "data-pui-private": "foreign",
};
// @ts-expect-error DataTable owns its rendered table and empty-state children
const tableChildren = <DataTable ariaLabel="Accounts" columns={columns} rows={rows} rowKey={(row) => row.id}>Injected child</DataTable>;

void tableClassName;
void tableStyle;
void tableCss;
void tableSx;
void tableTw;
void tableRef;
void tableHtml;
void tableOwner;
void tableSlot;
void tablePrivateData;
void tableChildren;
