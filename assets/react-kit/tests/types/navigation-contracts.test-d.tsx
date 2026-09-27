import { createRef } from "react";
import {
  Breadcrumbs,
  Pagination,
  Tabs,
  type BreadcrumbsProps,
  type PaginationProps,
  type TabsProps,
} from "../../src/personal-ui";

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
void controlledTabs;
void uncontrolledTabs;
void breadcrumbProps;
void paginationProps;

const allowedUsage = (
  <>
    <Tabs items={items} ariaLabel="Account sections" defaultValue="overview" data-track="tabs" />
    <Tabs items={items} ariaLabel="Account sections" value="overview" onValueChange={() => undefined} />
    <Breadcrumbs items={[{ id: "home", label: "Home", href: "/" }]} data-track="breadcrumbs" />
    <Pagination page={1} pageCount={3} onPageChange={() => undefined} data-track="pagination" />
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
const tabsOwner = <Tabs items={items} ariaLabel="Account sections" data-pui-owner="Consumer" />;

// @ts-expect-error Breadcrumbs keeps styling internal
const breadcrumbsClassName = <Breadcrumbs items={[]} className="foreign" />;
// @ts-expect-error Breadcrumbs does not expose internal ownership
const breadcrumbsOwner = <Breadcrumbs items={[]} data-pui-owner="Consumer" />;

// @ts-expect-error Pagination is controlled and requires onPageChange
const paginationMissingChange = <Pagination page={1} pageCount={3} />;
// @ts-expect-error Pagination keeps styling internal
const paginationStyle = <Pagination page={1} pageCount={3} onPageChange={() => undefined} style={{ color: "red" }} />;
// @ts-expect-error Pagination does not expose raw DOM refs
const paginationRef = <Pagination page={1} pageCount={3} onPageChange={() => undefined} ref={createRef<HTMLElement>()} />;
// @ts-expect-error Pagination does not expose internal ownership
const paginationOwner = <Pagination page={1} pageCount={3} onPageChange={() => undefined} data-pui-owner="Consumer" />;

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
