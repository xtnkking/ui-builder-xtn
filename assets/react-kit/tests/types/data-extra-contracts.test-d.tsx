import { createRef } from "react";
import {
  BarChart,
  Button,
  Calendar,
  Carousel,
  DragDrop,
  ExpandableText,
  Inline,
  ResizablePanels,
  Scheduler,
  SortableList,
  Tree,
  TreeTable,
  VirtualList,
  type CarouselProps,
  type TreeProps,
  type TreeTableColumn,
  type TreeTableNode,
  type TreeTableProps,
  type TreeTableRowContext,
  type VirtualListProps,
} from "../../src/ui";

const treeNodes = [
  {
    id: "account",
    label: "Account",
    children: [{ id: "profile", label: "Profile" }],
  },
];
const treeTableNodes = [
  {
    id: "account",
    value: { name: "Account" },
    children: [{ id: "profile", value: { name: "Profile" } }],
  },
];
const treeTableColumns = [
  { id: "name", header: "Name", cell: (value: { name: string }) => value.name },
];
const slides = [
  { id: "overview", label: "Overview", content: "Overview content" },
  { id: "security", label: "Security", content: "Security content" },
];
const month = new Date(2026, 8, 1);

const controlledTree: TreeProps = {
  nodes: treeNodes,
  ariaLabel: "Account tree",
  value: "account",
  onValueChange: () => undefined,
  expandedIds: ["account"],
  onExpandedChange: () => undefined,
  title: "Accounts",
};
const uncontrolledTree: TreeProps = {
  nodes: treeNodes,
  ariaLabel: "Account tree",
  defaultValue: "profile",
  defaultExpandedIds: ["account"],
};
const controlledTreeTable: TreeTableProps<{ name: string }> = {
  nodes: treeTableNodes,
  columns: treeTableColumns,
  treeColumnId: "name",
  ariaLabel: "Account rows",
  expandedIds: ["account"],
  onExpandedChange: () => undefined,
};
const uncontrolledTreeTable: TreeTableProps<{ name: string }> = {
  nodes: treeTableNodes,
  columns: treeTableColumns,
  treeColumnId: "name",
  ariaLabel: "Account rows",
  defaultExpandedIds: ["account"],
};
const emptyDirectory: TreeTableNode<{ name: string }> = {
  id: "directory", value: { name: "Empty directory" }, children: [], hasChildren: true,
};
const branchContext: TreeTableRowContext<{ name: string }> = { node: emptyDirectory, level: 1 };
const actionColumns: readonly TreeTableColumn<{ name: string }>[] = [
  { id: "name", header: "Name", cell: (value) => value.name },
  {
    id: "actions", header: "Operations", width: 120,
    cell: (value, context) => {
      const nodeId: string = context.node.id;
      const rowValue: { name: string } = context.node.value;
      const level: number = context.level;
      return <Button size="small" variant="ghost" onClick={() => void nodeId} title={`${rowValue.name}: ${level}`}>{value.name}</Button>;
    },
  },
];
const treeTableActionAreas = (
  <TreeTable
    nodes={[emptyDirectory]} columns={actionColumns} treeColumnId="name" ariaLabel="Directories"
    toolbar={<Inline><Button size="small" onClick={() => undefined}>Add root</Button></Inline>}
    footer={<span>One root</span>}
    renderBranchFooter={(context) => {
      const row: TreeTableRowContext<{ name: string }> = context;
      return row.node.id === "hidden" ? null : (
        <Inline><Button size="small" variant="ghost" loading={false} loadingLabel="Add child"
          onClick={() => void row.node.id}>Add child</Button></Inline>
      );
    }}
  />
);
const controlledCarousel: CarouselProps = {
  slides,
  ariaLabel: "Highlights",
  value: "overview",
  onValueChange: () => undefined,
};
const uncontrolledCarousel: CarouselProps = {
  slides,
  ariaLabel: "Highlights",
  defaultValue: "security",
};
const virtualListProps: VirtualListProps<{ id: string }> = {
  items: [{ id: "one" }],
  itemKey: (item) => item.id,
  renderItem: (item) => item.id,
  height: 240,
  ariaLabel: "Accounts",
  title: "Virtual accounts",
};
void controlledTree;
void uncontrolledTree;
void controlledTreeTable;
void uncontrolledTreeTable;
void branchContext;
void treeTableActionAreas;
void controlledCarousel;
void uncontrolledCarousel;
void virtualListProps;

const allowedUsage = (
  <>
    <VirtualList items={[{ id: "one" }]} itemKey={(item) => item.id} renderItem={(item) => item.id} height={240} itemSize={40} ariaLabel="Accounts" data-track="virtual-list" />
    <Tree nodes={treeNodes} ariaLabel="Account tree" defaultValue="account" defaultExpandedIds={["account"]} data-track="tree" />
    <Tree nodes={[{ id: "rich", label: <strong>Rich label</strong>, textValue: "Rich label" }]} ariaLabel="Rich tree" />
    <Tree nodes={treeNodes} ariaLabel="Account tree" value="account" onValueChange={() => undefined} expandedIds={["account"]} onExpandedChange={() => undefined} />
    <TreeTable nodes={treeTableNodes} columns={treeTableColumns} treeColumnId="name" ariaLabel="Account rows" defaultExpandedIds={["account"]} data-track="tree-table" />
    <Calendar month={month} defaultValue={new Date(2026, 8, 15)} data-track="calendar" />
    <Calendar month={month} value={new Date(2026, 8, 15)} onValueChange={() => undefined} />
    <Scheduler date={month} events={[]} aria-label="Schedule" data-track="scheduler" />
    <BarChart data={[{ id: "active", label: "Active", value: 4 }]} ariaLabel="Accounts" data-track="chart" />
    <Carousel slides={slides} ariaLabel="Highlights" defaultValue="overview" data-track="carousel" />
    <ResizablePanels first="One" second="Two" ariaLabel="Resize panels" data-track="panels" />
    <DragDrop onFiles={() => undefined} data-track="drop-zone">Drop files</DragDrop>
    <SortableList items={[{ id: "one", value: "One" }]} renderItem={(value) => value} onReorder={() => undefined} ariaLabel="Priority" data-track="sortable" />
    <ExpandableText data-track="description">Long description</ExpandableText>
  </>
);
void allowedUsage;

// @ts-expect-error controlled Tree selection requires onValueChange
const treeMissingValueChange = <Tree nodes={treeNodes} ariaLabel="Account tree" value="account" />;
// @ts-expect-error Tree selection cannot be controlled and uncontrolled simultaneously
const treeContradictoryValue = <Tree nodes={treeNodes} ariaLabel="Account tree" value="account" defaultValue="profile" onValueChange={() => undefined} />;
// @ts-expect-error controlled Tree expansion requires onExpandedChange
const treeMissingExpandedChange = <Tree nodes={treeNodes} ariaLabel="Account tree" expandedIds={["account"]} />;
// @ts-expect-error Tree expansion cannot be controlled and uncontrolled simultaneously
const treeContradictoryExpansion = <Tree nodes={treeNodes} ariaLabel="Account tree" expandedIds={["account"]} defaultExpandedIds={[]} onExpandedChange={() => undefined} />;
// @ts-expect-error controlled TreeTable expansion requires onExpandedChange
const treeTableMissingExpandedChange = <TreeTable nodes={treeTableNodes} columns={treeTableColumns} treeColumnId="name" ariaLabel="Account rows" expandedIds={["account"]} />;
// @ts-expect-error TreeTable expansion cannot be controlled and uncontrolled simultaneously
const treeTableContradictoryExpansion = <TreeTable nodes={treeTableNodes} columns={treeTableColumns} treeColumnId="name" ariaLabel="Account rows" expandedIds={["account"]} defaultExpandedIds={[]} onExpandedChange={() => undefined} />;
// @ts-expect-error branch renderers receive node context rather than the bare business value
const treeTableBareBranchValue = <TreeTable nodes={treeTableNodes} columns={treeTableColumns} treeColumnId="name" ariaLabel="Rows" renderBranchFooter={(value: { name: string }) => value.name} />;
// @ts-expect-error row context is typed to the same business value as the column
const treeTableWrongCellContext: TreeTableColumn<{ name: string }> = { id: "wrong", header: "Wrong", cell: (_value, context: TreeTableRowContext<{ size: number }>) => context.node.value.size };
// @ts-expect-error controlled Calendar selection requires onValueChange
const calendarMissingChange = <Calendar month={month} value={new Date(2026, 8, 15)} />;
// @ts-expect-error Calendar selection cannot be controlled and uncontrolled simultaneously
const calendarContradictory = <Calendar month={month} value={new Date(2026, 8, 15)} defaultValue={new Date(2026, 8, 16)} onValueChange={() => undefined} />;
// @ts-expect-error controlled Carousel requires onValueChange
const carouselMissingChange = <Carousel slides={slides} ariaLabel="Highlights" value="overview" />;
// @ts-expect-error Carousel cannot be controlled and uncontrolled simultaneously
const carouselContradictory = <Carousel slides={slides} ariaLabel="Highlights" value="overview" defaultValue="security" onValueChange={() => undefined} />;

// @ts-expect-error fixed controls do not expose className
const virtualListClassName = <VirtualList items={[]} itemKey={() => "item"} renderItem={() => null} height={120} ariaLabel="Items" className="foreign" />;
// @ts-expect-error variable-height estimates are no longer advertised as fixed item geometry
const virtualListEstimateSize = <VirtualList items={[]} itemKey={() => "item"} renderItem={() => null} height={120} ariaLabel="Items" estimateSize={48} />;
// @ts-expect-error fixed controls do not expose className
const treeClassName = <Tree nodes={treeNodes} ariaLabel="Account tree" className="foreign" />;
// @ts-expect-error fixed controls do not expose className
const treeTableClassName = <TreeTable nodes={treeTableNodes} columns={treeTableColumns} treeColumnId="name" ariaLabel="Rows" className="foreign" />;
// @ts-expect-error fixed controls do not expose className
const calendarClassName = <Calendar month={month} className="foreign" />;
// @ts-expect-error fixed controls do not expose className
const schedulerClassName = <Scheduler date={month} events={[]} className="foreign" />;
// @ts-expect-error fixed controls do not expose className
const chartClassName = <BarChart data={[]} ariaLabel="Chart" className="foreign" />;
// @ts-expect-error fixed controls do not expose className
const carouselClassName = <Carousel slides={slides} ariaLabel="Highlights" className="foreign" />;
// @ts-expect-error fixed controls do not expose className
const panelsClassName = <ResizablePanels first="One" second="Two" ariaLabel="Resize" className="foreign" />;
// @ts-expect-error fixed controls do not expose className
const dragDropClassName = <DragDrop onFiles={() => undefined} className="foreign">Files</DragDrop>;
// @ts-expect-error DragDrop owns its accessible group role
const dragDropRole = <DragDrop onFiles={() => undefined} role="button">Files</DragDrop>;
// @ts-expect-error fixed controls do not expose className
const sortableClassName = <SortableList items={[]} renderItem={() => null} onReorder={() => undefined} ariaLabel="Items" className="foreign" />;
// @ts-expect-error fixed controls do not expose className
const expandableClassName = <ExpandableText className="foreign">Description</ExpandableText>;
// @ts-expect-error fixed controls do not expose style
const treeStyle = <Tree nodes={treeNodes} ariaLabel="Account tree" style={{ color: "red" }} />;
// @ts-expect-error fixed controls do not expose raw DOM refs
const carouselRef = <Carousel slides={slides} ariaLabel="Highlights" ref={createRef<HTMLElement>()} />;
// @ts-expect-error reserved ownership attributes are never public
const chartOwner = <BarChart data={[]} ariaLabel="Chart" data-ui-owner="Consumer" />;
// @ts-expect-error wildcard reserved ownership attributes are never public in Props objects
const treePrivateData: TreeProps = { nodes: treeNodes, ariaLabel: "Account tree", "data-ui-private": "foreign" };

void treeMissingValueChange;
void treeContradictoryValue;
void treeMissingExpandedChange;
void treeContradictoryExpansion;
void treeTableMissingExpandedChange;
void treeTableContradictoryExpansion;
void treeTableBareBranchValue;
void treeTableWrongCellContext;
void calendarMissingChange;
void calendarContradictory;
void carouselMissingChange;
void carouselContradictory;
void virtualListClassName;
void virtualListEstimateSize;
void treeClassName;
void treeTableClassName;
void calendarClassName;
void schedulerClassName;
void chartClassName;
void carouselClassName;
void panelsClassName;
void dragDropClassName;
void dragDropRole;
void sortableClassName;
void expandableClassName;
void treeStyle;
void carouselRef;
void chartOwner;
void treePrivateData;
