# ui-builder-xtn data workflow contract

Use this reference for searchable lists, server-backed filters, asynchronous option data, tables, sorting, selection, pagination, and retry behavior. Public signatures and defaults are generated in the [component API](component-api.md); the [component catalog](component-catalog.md) is the family index.

## Choose the owning component

| Need | Public owner |
| --- | --- |
| Text query with one clear affordance | `SearchInput` |
| Small fixed option set | `Select` |
| Searchable local options | `Combobox` or `SearchableSelect` |
| Remote or very large options | `AsyncSelect` |
| Submitted filter row and applied-filter summary | `FilterBar` |
| Sortable, selectable, responsive result set | `DataTable` |
| Hierarchical rows with branch commands and row operations | `TreeTable` |
| Ordinary list page shell | `ListManagementPage` or `SearchFilterPage` |
| Complete server-list reference | `MemberManagementPage` |
| File drop with a keyboard selection command | `DragDrop` (built-in browse); optional `FileUpload` for a file queue |
| Continuous observation with a keyboard load/retry command | `InfiniteScroll` (built-in manual load/retry); optional coordinated `LoadMore` |

Do not rebuild these controls with native interactive markup, a third-party command menu, or application-owned `.ui-*` styles. Import them from the installed `ui` barrel.

## Country capsule tags

Use the official `Tag` country variant for a flag, uppercase two-letter country code, country/territory name and optional calling code:

```tsx
import { Tag } from "./ui";

<Tag country={{ code: "GB", name: "英国", callingCode: "+44" }} />;
<Tag tone="blue" selected country={{ code: "DE", name: "德国", callingCode: "+49" }} />;
<Tag country={{ code: "AS", name: "美属萨摩亚", callingCode: "+1 684" }}
     onRemove={removeTerritory} removeLabel="移除美属萨摩亚" />;
```

`country.code` is trimmed and rendered uppercase; the default decorative flag URL is `https://flagcdn.com/w40/{lowercase code}.png`. Pass `country.flagSrc` for local or alternative flag hosting. The fixed 20×20 circular flag slot uses `object-fit: cover` with centered cropping, preserving the image's aspect ratio without stretching. Loading and failure states reuse the same circular slot with a neutral fallback, so flag state changes keep the tag's dimensions stable. No flag request is needed for ordinary tags.

The name and optional calling code belong to the caller; the component does not infer, translate, or validate geographic telephone mappings. GB uses +44; +49 belongs to DE. Supplied flag URL inventories are not calling-code authorities.

Country tags share the ordinary Tag capsule, tone, selected and removal styles. Only the country name truncates within the available width (up to the normal 20rem tag bound); the flag, code, calling code and remove action retain their slots. The full label is available on hover, and an overflowing label becomes a named keyboard focus target. Selected state adds no visual icon or width. `country` cannot be combined with `children` or `leading`; use ordinary Tag for unrelated content. See [Tag API](component-api.md#tag) and the Explorer's Tag page for default, long-content, keyboard, dark and locale examples.

## Request state

Keep editable filter values separate from the last applied query. Typing and option changes update draft state only; submit from the `FilterBar`, its query button, or Enter starts the request. Sorting and pagination are also explicit requests.

- Give every request an identity or cancellation signal so an older response cannot replace newer results.
- Put the initiating `Button`, sortable header, retry action, or `Pagination` target into its bundled loading state. Loading must block duplicate activation without changing control dimensions.
- Retain the last successful rows in caller state across requests. A refresh may show stable-height skeleton rows; if it fails, restore or retain the cached rows beneath the error. Retry from a retained-data error keeps those rows visible, while a zero-row error is reserved for requests with no usable result.
- Keep loading, ready, empty, error, and retry transitions in the same `DataTable` frame. Do not swap the table for a differently sized page-level placeholder.
- Business query values, API errors, and row data remain caller-owned. Locale only owns component fallback and ARIA text; machine values do not change with display language.

Pair query commands with fields using `Button size="field"`. `FilterBar` defaults to compact 38px desktop fields/actions with tighter button padding; `density="comfortable"` uses 44px. Narrow containers, mobile viewports and coarse-pointer devices retain 44px targets. Standalone field-aligned buttons remain 44px. For a compact two-character action, pass `loadingLabel="查询"` or `loadingLabel="搜索"` to match its visible label; use the same localized action in other languages. The official spinner then appears beside that label without reserving extra width for the generic processing text, and idle/loading dimensions stay identical. The `FilterBar` Explorer's default example demonstrates an explicit, duplicate-blocked 800ms request while preserving the last applied results; the action's loading state belongs to Button.

## DataTable configuration

Column and row identities are data contracts: every `column.id` and `rowKey` result must be stable, unique, and non-empty. Developers configure visibility, width, and pinning; end users do not receive freeze controls unless the product explicitly requires them.

- A leading checkbox column declares `kind: "selection"`. When visible, it and the next visible column pin to the start by default. Use `pin: false`, `pin: "start"`, or `pin: "end"` for deliberate overrides; an action column may be pinned to the end at the same time.
- Give compact status, date, numeric, selection, and action columns explicit numeric widths. Leave flexible width to genuine long-text columns and leave room for action focus outlines.
- Supply `mobileRow` for data that must remain useful on narrow screens. Do not shrink the desktop table until its content becomes unreadable.
- Use `state`, `loadingRows`, `onRetry`, `retrying`, `sort`, `onSort`, and `loadingSortColumnId` for their documented state. `loadingRows` controls skeleton count, not table height.
- Text cells already provide overflow titles. Custom cell content owns its own accessible name and overflow behavior.

## Height and pagination

Pass the typed `pagination` object directly to `DataTable`; this keeps the pager inside the same rounded frame. Do not render a second `Pagination` in the page footer.

Paginated tables use a fixed viewport of five standard rows by default. Keep `pagination` present during loading, empty, and zero-row error states so sparse pages and changing page sizes do not move the pager. Use a numeric `viewportRows` for another fixed capacity, or `viewportRows="auto"` only when following content height is intentional. An unpaginated table follows content unless it receives a numeric `viewportRows`.

A fixed viewport is a named keyboard region even when the current page is sparse, because later pages and custom rows can overflow the same stable surface. An automatic-height viewport becomes a named keyboard region only when it actually scrolls horizontally. A new request, page, page size, or row identity sequence resets vertical position while retaining horizontal column context.

## TreeTable action areas

`TreeTable` exposes three optional action areas; omitted areas and `null`, `undefined` or `false` reserve no space. `toolbar` appears above the scrolling table and `footer` below it, so these areas remain outside the horizontal scroll surface. Compose them with official `Button`, `DropdownMenu`, and `Inline` exports rather than native controls or application overrides.

`renderBranchFooter(context)` renders a branch's actions after all of its currently visible descendants, only while that branch is expanded. The action content aligns with the next level's tree text. A branch has non-empty `children` or `hasChildren: true`; marking an empty directory with `hasChildren: true` allows it to expand and show an “新增子项” command even without a loader. Returning `null`, `undefined` or `false` omits that branch's action area. The footer is auxiliary content, not a synthetic data node: never add fake node IDs or count it as a record.

`TreeTableRowContext<T>` contains `node: TreeTableNode<T>` and a **one-based** `level` (root = 1). Both `renderBranchFooter` and `TreeTableColumn.cell(value, context)` receive it. Use `context.node.id` to address the row or parent; business values need not repeat their node IDs. Existing one-argument cell renderers remain valid. A rightmost operation column is an ordinary column whose cell composes official actions; TreeTable does not automatically pin that column.

```tsx
import {
  Button, Inline, TreeTable,
  type TreeTableColumn, type TreeTableNode,
} from "./ui";

type Folder = { name: string };

export function FolderTable({ nodes, pendingNodeId, onAddRoot, onAddChild, onEdit }: {
  nodes: readonly TreeTableNode<Folder>[];
  pendingNodeId?: string;
  onAddRoot: () => void;
  onAddChild: (parentId: string) => void;
  onEdit: (nodeId: string) => void;
}) {
  const columns: readonly TreeTableColumn<Folder>[] = [
    { id: "name", header: "名称", cell: (value) => value.name },
    {
      id: "actions", header: "操作", width: 120,
      cell: (_value, { node }) => (
        <Button size="small" variant="ghost" onClick={() => onEdit(node.id)}>编辑</Button>
      ),
    },
  ];
  return (
    <TreeTable
      nodes={nodes} columns={columns} treeColumnId="name" ariaLabel="目录"
      getRowLabel={(node) => node.value.name}
      toolbar={<Inline><Button size="small" onClick={onAddRoot}>新增根节点</Button></Inline>}
      footer={<span>共 {nodes.length} 个根节点</span>}
      renderBranchFooter={({ node }) => (
        <Inline>
          <Button size="small" variant="ghost" loading={pendingNodeId === node.id}
            loadingLabel="新增子项" onClick={() => onAddChild(node.id)}>新增子项</Button>
        </Inline>
      )}
    />
  );
}
```

The caller owns additions, edits, deletions, permissions, statistics, loading and errors. For a permission-restricted branch, return `null` from `renderBranchFooter`; for an async action, supply the official Button's `loading` and matching `loadingLabel` so repeat activation is blocked and dimensions remain stable. `onRequestChildren` owns initial child loading and retry: it runs on expansion only when `node.children === undefined` and a loader is provided. Set `children: []` after an empty response to mark the branch as loaded; retain `hasChildren: true` when that empty directory must remain expandable. A branch footer may provide a caller-owned “加载更多” Button for subsequent pages. Manage `expandedIds` with `onExpandedChange` for toolbar expand/collapse commands. These slots do not add selection, bulk-operation state, sorting, column pinning or pagination to TreeTable. See [TreeTable API](component-api.md#export-tree-table) and `#/components/data-table` for runnable examples.

### Explicit project / group / member loading

The complete runnable [project, group and member example](../assets/react-kit/src/explorer/cases/data/project-members.example.tsx) is available at `#/components/data-table` → **项目、项目组与成员预览**. It composes the existing public `TreeTable`, `Button`, `Inline`, `InlineMessage`, `StatusIndicator` and `Tag`; no additional runtime API is required. Reuse its business state and replace `requestChildren` with your own API, importing controls through the installed public barrel.

- Level 1 is a project; its operation loads **all groups for that project** in one explicit request. Level 2 is a project group; its operation loads **all members of that group**. Level 3 members are leaves.
- Omit `onRequestChildren` when only the load buttons may fetch. Initial project/group branches use `hasChildren: true, children: []`; expansion controls only visibility. Keep independent request state so an unloaded branch is distinct from a successful empty response.
- Use stable hierarchical IDs, a synchronous per-node pending lock and the official Button's `loading`/matching `loadingLabel`. Replace a branch's children with a functional state update, retaining concurrent sibling responses. Successful load buttons are disabled; reopening branches uses cached data.
- Put direct-child counts and request state in the **parent row** when they describe that parent: the example's `下级数据` column shows `3 个项目组`, `2 位成员`, pending, empty or failure state, and stays visible when collapsed. Avoid repeating loaded summaries after large subtrees; reserve `renderBranchFooter` for commands genuinely performed at the branch end. Existing indentation, bold branch names and official type tags/icons distinguish the three levels. Explicit column widths keep tags/actions readable, and the official viewport owns narrow-screen horizontal scrolling.
- Errors leave existing branches intact and allow the same button to retry. Empty results get explicit parent-row feedback. A generation counter prevents requests started before reset or unmount from writing into the new tree. The example includes a first-member-request failure variant, empty project and empty group, actual counts, and keyboard/mobile previews. Its 900ms simulated data is not a production backend or a large-tree virtualization claim.

## Completion checks

Exercise slow success, empty, retained-data error, zero-row error, retry, sort, page, page-size, selection, long content, and mobile rendering as applicable. Check that the table frame, pager, and action controls do not resize while loading. Use the Explorer routes `#/components/data-table`, `#/components/select`, and `#/patterns/list-filter` as runnable examples.

## Official file and continuous loading compositions

`DragDrop` and `InfiniteScroll` now include their own keyboard commands by default. The default Explorer routes use [StandaloneDragExample](../assets/react-kit/src/explorer/cases/actions/drag.case.tsx) and [StandaloneInfiniteScrollExample](../assets/react-kit/src/explorer/cases/navigation/infinite-scroll.case.tsx). Import controls through the public barrel.

DragDrop owns one browse Button and a hidden, non-tabbable native chooser. Configure `accept`, `multiple` (default true), `disabled`, `browseLabel`, `onFiles` and `onRejected`; selection and drop use one validation path. Accept rules are OR-matched. With `multiple=false`, the first matching file is accepted and any additional or incompatible files are reported to onRejected. The chooser resets after change, supporting repeated same-file selection. The component does not own an upload queue or network transport.

InfiniteScroll owns a manual load/retry Button and coordinates it with the observer through one synchronous request lock. Supply `onLoadMore`, `hasMore` and `loadKey`; advance loadKey when adopting the next successful cursor. The same successful key is not requested twice. Rejected requests retain children, show localized error feedback and enable manual retry of that key; automatic observation pauses for that failed key. `loading`, `disabled` and `hasMore=false` block requests. Loading/error/end transitions keep the same button node and current focus; end removes that button from the sequential Tab order. Manual loading works even without IntersectionObserver. `loadMoreLabel`, `loadingLabel`, `retryLabel`, `errorLabel` and `endLabel` allow business copy.

The complete [DragExample](../assets/react-kit/src/explorer/cases/actions/drag.case.tsx) and [InfiniteScrollExample](../assets/react-kit/src/explorer/cases/navigation/infinite-scroll.case.tsx) remain optional shared-state compositions. They explicitly set `showBrowseButton=false` or `showLoadMoreButton=false` so their companion owns the only manual command. These opt-outs deliberately require the companion; do not disable the default command without providing an accessible replacement. Do not fork the implementation or bind two unrelated queues/requests.

For `DragDrop showBrowseButton={false}` + `FileUpload`, one owner holds the file queue, receive/reject callbacks, disabled state and item removal. `accept=".csv,text/csv"` accepts any listed rule: a matching extension **or** matching MIME is sufficient, and a file matching neither is rejected. FileUpload supplies the composition's sole browse button. The example keeps received files `queued` and reports rejected filenames with an official `InlineMessage`; it performs no network upload. Repeated same-name selections have distinct stable IDs, and removal uses `FileUploadItem.id`. Apply global disabled to both controls and guard shared callbacks. If a business composition configures size/count limits, its drop and selection paths must enforce those same limits; the example does not configure them.

For `InfiniteScroll showLoadMoreButton={false}` + `LoadMore`, bind `onLoadMore` to the same owner callback, records, cursor, loading and hasMore. Establish a synchronous pending-promise latch before fetch can run; React loading state alone is not cross-entry mutual exclusion. Reentrant calls join the pending promise. The owner consumes failures, retains records and cursor, shows the official `Alert`, and releases the latch in `finally`. While an error remains, disable automatic observation and let LoadMore explicitly retry that same cursor. Success appends the returned page once and adopts its cursor/hasMore; after `hasMore=false`, neither path starts another request. A global disabled state blocks both commands without deleting retained data. InfiniteScroll's internal lock coordinates its own default button; an independently bound external LoadMore still requires this shared business callback.

The [composition keyboard contract](m5-keyboard-contracts.md#official-compositions-d2d3-2026-10-09) names the actual Tab/activation owners and evidence. D3's four unit contracts and its keyboard/observer/retry/end/focus/axe browser scenario passed in all three engines using retained Chromium and bounded recovery receipts. D2's three unit contracts and nine browser cases passed, with eight prior results retained and only the missing WebKit keyboard case rechecked after fixing its mounted starting-focus prerequisite. Existing individual-component passes retain their original source identities; these development results are not a release. Do not infer OS file-dialog focus restoration from automated filechooser injection or infer full workflow behavior from axe alone.
