import { createRef } from "react";
import {
  Breadcrumbs,
  DataTable,
  Pagination,
  Tabs,
  type BreadcrumbsProps,
  type PaginationProps,
  type TabsProps,
} from "../../src/ui";

const items = [
  { id: "overview", label: "Overview", content: "Overview content" },
  { id: "security", label: "Security", content: "Security content" },
];

const controlledTabs: TabsProps = {
  items,
  ariaLabel: "Account sections",
  value: "overview",
  onValueChange: () => undefined,
  title: "Account tabs",
};
const uncontrolledTabs: TabsProps = {
  items,
  ariaLabel: "Account sections",
  defaultValue: "security",
};
const breadcrumbProps: BreadcrumbsProps = {
  items: [{ id: "home", label: "Home", href: "/" }],
  title: "Breadcrumb trail",
};
const paginationProps: PaginationProps = {
  page: 1,
  pageCount: 3,
  onPageChange: () => undefined,
  title: "Result pages",
};
const cursorPaginationProps: PaginationProps = {
  mode: "cursor", page: 3, hasPreviousPage: true, hasNextPage: false,
  onPageChange: () => undefined, loadingTarget: "previous",
};
void controlledTabs;
void uncontrolledTabs;
void breadcrumbProps;
void paginationProps;
void cursorPaginationProps;

const allowedUsage = (
  <>
    <Tabs items={items} ariaLabel="Account sections" defaultValue="overview" data-track="tabs" />
    <Tabs items={items} ariaLabel="Account sections" value="overview" onValueChange={() => undefined} />
    <Breadcrumbs items={[{ id: "home", label: "Home", href: "/" }]} data-track="breadcrumbs" />
    <Pagination page={1} pageCount={3} onPageChange={() => undefined} data-track="pagination" />
    <Pagination {...cursorPaginationProps} />
    <DataTable ariaLabel="Cursor data" columns={[{ id: "name", header: "Name", cell: (row: { id: string }) => row.id }]}
      rows={[{ id: "one" }]} rowKey={(row) => row.id} pagination={cursorPaginationProps} />
  </>
);
void allowedUsage;

// @ts-expect-error controlled Tabs require onValueChange
const tabsMissingChange = <Tabs items={items} ariaLabel="Account sections" value="overview" />;
// @ts-expect-error Tabs cannot be controlled and uncontrolled simultaneously
const tabsContradictory = <Tabs items={items} ariaLabel="Account sections" value="overview" defaultValue="security" onValueChange={() => undefined} />;
// @ts-expect-error fixed controls do not expose className
const tabsClassName = <Tabs items={items} ariaLabel="Account sections" className="foreign" />;
// @ts-expect-error fixed controls do not expose style
const tabsStyle = <Tabs items={items} ariaLabel="Account sections" style={{ color: "red" }} />;
// @ts-expect-error fixed controls do not expose raw DOM refs
const tabsRef = <Tabs items={items} ariaLabel="Account sections" ref={createRef<HTMLDivElement>()} />;
// @ts-expect-error reserved ownership attributes are never public
const tabsOwner = <Tabs items={items} ariaLabel="Account sections" data-ui-owner="Consumer" />;

// @ts-expect-error Breadcrumbs keeps styling internal
const breadcrumbsClassName = <Breadcrumbs items={[]} className="foreign" />;
// @ts-expect-error Breadcrumbs does not expose internal ownership
const breadcrumbsOwner = <Breadcrumbs items={[]} data-ui-owner="Consumer" />;

// @ts-expect-error Pagination is controlled and requires onPageChange
const paginationMissingChange = <Pagination page={1} pageCount={3} />;
// @ts-expect-error Pagination keeps styling internal
const paginationStyle = <Pagination page={1} pageCount={3} onPageChange={() => undefined} style={{ color: "red" }} />;
// @ts-expect-error Pagination does not expose raw DOM refs
const paginationRef = <Pagination page={1} pageCount={3} onPageChange={() => undefined} ref={createRef<HTMLElement>()} />;
// @ts-expect-error Pagination does not expose internal ownership
const paginationOwner = <Pagination page={1} pageCount={3} onPageChange={() => undefined} data-ui-owner="Consumer" />;
// @ts-expect-error numbered pagination requires a real page count
const paginationMissingCount = <Pagination page={1} onPageChange={() => undefined} />;
// @ts-expect-error cursor pagination cannot advertise an invented page count
const cursorPaginationCount = <Pagination mode="cursor" page={1} pageCount={3} hasPreviousPage={false} hasNextPage onPageChange={() => undefined} />;
// @ts-expect-error cursor pagination cannot advertise a result total
const cursorPaginationTotal = <Pagination mode="cursor" page={1} total={30} hasPreviousPage={false} hasNextPage onPageChange={() => undefined} />;
// @ts-expect-error cursor pagination needs explicit endpoint availability
const cursorPaginationAvailability = <Pagination mode="cursor" page={1} onPageChange={() => undefined} />;
// @ts-expect-error cursor pagination has no direct page-jump loading target
const cursorPaginationJump = <Pagination mode="cursor" page={1} hasPreviousPage={false} hasNextPage loadingTarget="page" onPageChange={() => undefined} />;
// @ts-expect-error DataTable preserves cursor pagination's discriminated total contract
const cursorTableCount = <DataTable ariaLabel="Invalid cursor" columns={[{ id: "id", header: "ID", cell: (row: { id: string }) => row.id }]} rows={[]} rowKey={(row) => row.id} pagination={{ mode: "cursor", page: 1, pageCount: 3, hasPreviousPage: false, hasNextPage: true, onPageChange: () => undefined }} />;

void tabsMissingChange;
void tabsContradictory;
void tabsClassName;
void tabsStyle;
void tabsRef;
void tabsOwner;
void breadcrumbsClassName;
void breadcrumbsOwner;
void paginationMissingChange;
void paginationStyle;
void paginationRef;
void paginationOwner;
void paginationMissingCount;
void cursorPaginationCount;
void cursorPaginationTotal;
void cursorPaginationAvailability;
void cursorPaginationJump;
void cursorTableCount;
