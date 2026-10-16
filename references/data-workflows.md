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
| Different, stable field widths within a filter row | `FilterField` inside `FilterBar` |
| Sortable, selectable, responsive result set | `DataTable` |
| Hierarchical rows with branch commands and row operations | `TreeTable` |
| Consistent table primary/secondary text and long-value overflow | `TableCellText` |
| Compact row commands and overflow actions | `IconButton` + `Tooltip` + `Inline`, or `DropdownMenu` |
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
- Retain the last successful rows in caller state across requests. A refresh may show stable-height skeleton rows; if it fails, restore or retain the cached rows. Retry from a retained-data error keeps those rows visible, while a zero-row error is reserved for requests with no usable result.
- Keep loading, ready, empty, error, and retry transitions in the same `DataTable` frame. Do not swap the table for a differently sized page-level placeholder.
- Business query values, API errors, and row data remain caller-owned. Locale only owns component fallback and ARIA text; machine values do not change with display language.

### Table request failures

`DataTable state="error"` owns its failure presentation. It automatically sends one danger Toast for that failure episode, using `errorTitle` and `errorDescription` (or localized fallback copy), and keeps a short persistent status with the sole retry command inside the table frame. It does not render an Alert above the table. With cached rows, those rows remain available; with no usable rows, the error state stays inside the existing frame. Supply `onRetry` and `retrying` to the table, rather than adding another external retry button.

Ordinary parent re-renders, new inline callbacks, and newly created description JSX do not create new failure notifications. A new failed request after leaving the error state, or a failed retry after its pending state, is a new failure episode and may notify again. Bind `retrying` to the actual retry request so the table can distinguish a continuing failure from a fresh failed attempt. Each mounted table owns its own failure scope; errors in one table must not be mistaken for another table's request.

Place one official `ToastProvider` around the application to share its default global limit of three visible notifications and its queue across tables and other actions. DataTable reuses that provider; a standalone DataTable without one has an internal fallback, so existing table calls do not require a new wrapper. The automatic table notification lasts five seconds, has a close button, and contains no retry action; its dismissal does not clear the error or remove the persistent in-frame retry/status.

Do not combine that same table request with an above-table `Alert`, an additional `ErrorState`, or a manual `toast()` call. Do not render raw server stacks or verbose technical payloads as notification copy; provide a concise business summary and retain diagnostics in the application's own logging. Other failure scopes may need different owners: field validation remains with `Field`, a page-wide service outage may use an `Alert`, and a non-table action may use Toast. See the [toast contract](toast-contract.md#automatic-table-error-notifications).

```tsx
import { DataTable, ToastProvider } from "./ui";

<ToastProvider maxVisible={3}>
  <DataTable
    ariaLabel="订单列表" columns={columns} rows={lastSuccessfulRows}
    rowKey={(order) => order.id} state={tableState}
    errorTitle="订单加载失败"
    errorDescription="请检查网络后重试。"
    onRetry={retryOrders} retrying={retrying}
    pagination={pagination}
  />
</ToastProvider>;
// Do not also render an Alert/ErrorState or call toast() for this failure.
```

Pair query commands with fields using `Button size="field"`. `FilterBar` defaults to compact 38px desktop fields/actions with tighter button padding; `density="comfortable"` uses 44px. Narrow containers, mobile viewports and coarse-pointer devices retain 44px targets. Standalone field-aligned buttons remain 44px. For a compact two-character action, pass `loadingLabel="查询"` or `loadingLabel="搜索"` to match its visible label; use the same localized action in other languages. The official spinner then appears beside that label without reserving extra width for the generic processing text, and idle/loading dimensions stay identical. The `FilterBar` Explorer's default example demonstrates an explicit, duplicate-blocked 800ms request while preserving the last applied results; the action's loading state belongs to Button.

## Search feedback

`FilterBar` submits the form and `Button` displays the supplied loading state; neither component knows whether the business query succeeded. Compose result feedback at the owner that awaits the actual request, rather than adding a click-only success handler.

| Request / outcome | Feedback owner and behavior |
| --- | --- |
| Query button or Enter submission in progress | The initiating Button must show loading; a shared synchronous request lock blocks duplicate entry before React commits. |
| Current explicit query succeeds | Optionally send one short success Toast after the awaited request succeeds. Use “查询完成” without repeating the table's result count; omit it when the result change is sufficient feedback. |
| Explicit query returns no rows | Keep the DataTable empty state. An optional short info Toast may replace, not accompany, the success Toast. |
| Table query or retry fails | Set `DataTable state="error"` and preserve the last successful rows; the table owns its automatic error Toast and in-frame retry. Do not send another manual error notification. |
| A query fails without a DataTable feedback owner | Its request owner sends one concise failure Toast and preserves the data and retry command. |
| Initial load, pagination, live filter edits or reset succeeds | No success Toast. Draft edits do not request data unless the product explicitly chooses live search. |
| Canceled, stale or unmounted request completes | No Toast and no stale state update. Carry a request identity or AbortSignal through the request owner. |

Use one application-level `ToastProvider` for table errors and optional search-success feedback. The `notifyOnSuccess` option in the `TaskFilters` composition below defaults to `false`; it is an application-owned prop, not a prop on FilterBar, Button or DataTable. Pass it deliberately when a manual query needs a completion confirmation. The runnable [search feedback example](../assets/react-kit/src/explorer/cases/actions/search-feedback.example.tsx), at `#/components/filter-bar` →「搜索反馈」, initially enables its demo switch so this behavior is visible; it uses a shared DataTable failure owner and keeps successful pagination silent.

## Filter field sizing

Use the public `FilterField` as a direct child of `FilterBar` to choose a stable width for each filter. It wraps an existing `SearchInput`, `Select`, or labeled `Field`; it does not create a label, infer field semantics, or replace its child's value and accessibility contract. Give the child an accessible name, such as `SearchInput aria-label`, or associate it with an existing `Field` label; a placeholder does not replace that name. Do not give this wrapper application `style`, `className`, or `ref` overrides.

| `FilterField.width` | Baseline / explicit preferred width |
| --- | --- |
| `"short"` | 140px |
| `"medium"` or omitted | 240px |
| `"long"` | 320px |
| Positive finite `number` | That many CSS pixels, for example `180` |

These are library design values, not authoritative standards or mandatory widths for a data type. With a preset or omitted width, FilterField measures its contained input's placeholder using the actual control font and reserves its padding, borders, icon and clear-button slots. It expands beyond the baseline when needed, up to 360px and the available container width. This is text measurement, not an analysis of the field's business meaning; selectors without an input placeholder retain the chosen baseline. The width does not grow or shrink with the typed value, and clearing the input does not collapse the space reserved for its controls.

Use a positive numeric width for a deliberate preference, such as `width={180}`; that mode does not automatically expand for a placeholder. An explicit number may exceed 360px, while still being bounded by its container. Unsupported runtime values, including non-positive or non-finite numbers, fall back to the medium preset; do not pass CSS strings such as `"180px"`. A very long placeholder can still truncate at the automatic limit or in a narrow container. Put full instructions in the official `Field` label/hint rather than relying on a placeholder to display a paragraph.

Fields and actions share the available wrapping space: on a wide container, query/reset follow the last field when they fit; narrower rows wrap naturally without enlarging every field to distribute unused space. Preferred widths are bounded by the container. At a container width of 520px or less, all filter fields use full width and fields/actions retain 44px targets. The normal compact desktop height is 38px; `density="comfortable"` and coarse-pointer devices use 44px. Choose widths based on the local filter container, not just the browser viewport.

Existing controls used directly as `FilterBar` children keep their legacy 320px sizing. Wrap each field explicitly to adopt the mixed-width composition; updating the Skill does not rewrite a consumer's existing JSX. Choose presets for automatic placeholder accommodation, or a numeric preference for a deliberately fixed layout, rather than overriding protected control CSS.

This complete typed composition keeps draft values separate from the last successful query, submits only on the query command or Enter, and treats reset as an explicit query. The caller's `onQuery` performs the request with the supplied AbortSignal and rejects on failure; retain the last successful rows in that owner, ignore aborted responses, and do not swallow a failure into a successful resolution. This standalone filter example has no DataTable feedback owner, so its catch owns the sole error Toast. The shared application `ToastProvider` supplies the action feedback. The optional `notifyOnSuccess` affects successful manual submission only; reset stays silent on success.

```tsx
import { useEffect, useRef, useState } from "react";
import { Button, FilterBar, FilterField, SearchInput, Select, useToast } from "./ui";

type TaskQuery = {
  taskId: string;
  status: string;
  taskType: string;
  country: string;
  phone: string;
};
const emptyTaskQuery: TaskQuery = {
  taskId: "", status: "", taskType: "", country: "", phone: "",
};

export function TaskFilters({ onQuery, notifyOnSuccess = false }: {
  onQuery: (query: TaskQuery, signal: AbortSignal) => Promise<void>;
  notifyOnSuccess?: boolean;
}) {
  const [draft, setDraft] = useState<TaskQuery>({ ...emptyTaskQuery });
  const [query, setQuery] = useState<TaskQuery | null>(null);
  const [pending, setPending] = useState(false);
  const requestLock = useRef<AbortController | null>(null);
  const { toast } = useToast();
  useEffect(() => () => {
    requestLock.current?.abort();
    requestLock.current = null;
  }, []);
  const update = (key: keyof TaskQuery, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };
  async function apply(next: TaskQuery, reason: "submit" | "reset") {
    if (requestLock.current) return;
    const request = new AbortController();
    requestLock.current = request;
    setPending(true);
    try {
      await onQuery(next, request.signal);
      if (request.signal.aborted || requestLock.current !== request) return;
      setQuery(next);
      if (reason === "submit" && notifyOnSuccess) {
        toast({ tone: "success", description: "查询完成", duration: 2500 });
      }
    } catch {
      if (request.signal.aborted || requestLock.current !== request) return;
      toast({ tone: "danger", title: "查询失败", description: "已保留上次结果，请重试。" });
    } finally {
      if (requestLock.current === request) {
        requestLock.current = null;
        if (!request.signal.aborted) setPending(false);
      }
    }
  }
  function reset() {
    if (requestLock.current) return;
    const next = { ...emptyTaskQuery };
    setDraft(next);
    void apply(next, "reset");
  }
  return <FilterBar ariaLabel="任务筛选"
    onSubmit={(event) => { event.preventDefault(); void apply({ ...draft }, "submit"); }}
    status={pending ? "正在查询…" : query ? "筛选条件已应用" : undefined}
    actions={<>
      <Button type="submit" size="field" loading={pending} loadingLabel="查询">查询</Button>
      <Button type="button" size="field" variant="secondary" disabled={pending} onClick={reset}>重置</Button>
    </>}>
    <FilterField width="medium">
      <SearchInput aria-label="任务编号" placeholder="输入任务编号" value={draft.taskId}
        disabled={pending} onChange={(event) => update("taskId", event.target.value)} />
    </FilterField>
    <FilterField width="short">
      <Select ariaLabel="状态" value={draft.status} disabled={pending}
        options={[{ value: "", label: "全部状态" }, { value: "queued", label: "排队中" },
          { value: "done", label: "已完成" }]}
        onValueChange={(value) => update("status", value)} />
    </FilterField>
    {/* Numeric width is explicit; it does not expand for the placeholder. */}
    <FilterField width={180}>
      <SearchInput aria-label="任务类型" placeholder="输入任务类型" value={draft.taskType}
        disabled={pending} onChange={(event) => update("taskType", event.target.value)} />
    </FilterField>
    {/* The 140px baseline expands for this placeholder and its control slots. */}
    <FilterField width="short">
      <SearchInput aria-label="国家代码" placeholder="输入国家代码" value={draft.country}
        disabled={pending} onChange={(event) => update("country", event.target.value)} />
    </FilterField>
    <FilterField width="medium">
      <SearchInput aria-label="号码" placeholder="输入号码或部分号码" value={draft.phone}
        disabled={pending} onChange={(event) => update("phone", event.target.value)} />
    </FilterField>
  </FilterBar>;
}
```

If `onQuery` drives `DataTable state="error"`, let that table own its automatic error Toast and remove the catch notification above so the same request has one failure owner; keep the catch to consume the rejected request, leaving data/error/retry updates with that owner. The `onQuery` promise must still reject on failure so the optional success notification cannot run. The runnable [mixed-width filter example](../assets/react-kit/src/explorer/cases/actions/filter-sizing.example.tsx) at `#/components/filter-bar` includes the same five field purposes, actual query/reset behavior, accessible control names and narrow-container layouts; use the separate [search feedback example](../assets/react-kit/src/explorer/cases/actions/search-feedback.example.tsx) for the complete DataTable-owned failure composition. The primary FilterBar example separately demonstrates labeled `Field` controls and helper-text alignment. Reuse the public exports and request ownership, replacing the example service with the product API.

## DataTable configuration

Column and row identities are data contracts: every `column.id` and `rowKey` result must be stable, unique, and non-empty. Developers configure visibility, width, and pinning; end users do not receive freeze controls unless the product explicitly requires them.

- A leading checkbox column declares `kind: "selection"`. When visible, it and the next visible column pin to the start by default. Use `pin: false`, `pin: "start"`, or `pin: "end"` for deliberate overrides; an action column may be pinned to the end at the same time.
- Give compact status, date, numeric, selection, and action columns explicit numeric widths. Leave flexible width to genuine long-text columns and leave room for action focus outlines.
- Supply `mobileRow` for data that must remain useful on narrow screens. Do not shrink the desktop table until its content becomes unreadable.
- Use `state`, `loadingRows`, `onRetry`, `retrying`, `sort`, `onSort`, and `loadingSortColumnId` for their documented state. `loadingRows` controls skeleton count, not table height.
- String/number cells use `TableCellText` automatically, including full-value overflow titles. For custom primary/secondary text use the same public component; other custom content owns its own accessible name and overflow behavior.
- Compose operation columns using the [table operation-column contract](#table-operation-columns); DataTable does not infer business commands or replace arbitrary caller JSX with icon buttons.

## Table cell typography

`DataTable` and `TreeTable` use the same primary-data baseline: the application UI font, 14px text, weight 400 and 21px line height. A column returning a string or number is automatically rendered through the official `TableCellText`. An ID, phone number, name, country code or date does not acquire a smaller size, a heavier weight or a monospace font merely because of its data type. Return long IDs and phone numbers as strings to preserve leading zeroes and avoid JavaScript number precision loss; the component does not parse or reformat their values.

For multiple text levels in one cell, use this real public component from the installed barrel:

```tsx
import { Button, DataTable, TableCellText, Tag, type DataColumn } from "./ui";

type Task = {
  id: string;
  phone: string;
  type: string;
  country: string;
  claims: number;
  updatedAt: string;
  result: string;
};

export function TaskTable({ tasks, onDetails }: {
  tasks: Task[];
  onDetails: (taskId: string) => void;
}) {
  const columns: DataColumn<Task>[] = [
    { id: "id", header: "任务", width: 220, cell: (task) => task.id },
    { id: "phone", header: "号码", width: 150,
      cell: (task) => <TableCellText numeric>{task.phone}</TableCellText> },
    { id: "type", header: "任务类型", width: 130, cell: (task) => task.type },
    { id: "country", header: "国家", width: 90, cell: (task) => task.country },
    { id: "status", header: "状态", width: 100,
      cell: () => <Tag size="small">排队中</Tag> },
    { id: "claims", header: "成功领取次数", width: 160,
      cell: (task) => <TableCellText secondary="上次尚未派发">{`筛选 ${task.claims} 次`}</TableCellText> },
    { id: "updatedAt", header: "时间", width: 200,
      cell: (task) => <TableCellText secondary="档案更新时间" numeric>{task.updatedAt}</TableCellText> },
    { id: "result", header: "结果／最近记录错误", minWidth: 180,
      cell: (task) => <TableCellText secondary="未记录错误">{task.result}</TableCellText> },
    { id: "actions", header: "操作", width: 100, pin: "end",
      cell: (task) => <Button size="small" variant="ghost" onClick={() => onDetails(task.id)}>详情</Button> },
  ];
  return <DataTable ariaLabel="任务列表" columns={columns} rows={tasks} rowKey={(task) => task.id} />;
}
```

`TableCellText` accepts only the text contract below, without application styling overrides:

| Prop | Behavior |
| --- | --- |
| `children: string \| number` | Primary value; 14px / 400 / 21px. A numeric zero remains visible. |
| `secondary?: string \| number` | Optional supporting value on the next line; 12px / 18px and the theme's muted text color. A numeric zero is valid; omitted content reserves no line. |
| `numeric?: boolean` | Opt into tabular-width digits using the same UI font and primary size/weight. Does not convert to monospace or format the value. |
| `emphasis?: boolean` | Deliberate primary emphasis at weight 600; default false. Reserve for a product-relevant highlight rather than all values of one data type. |
| `wrap?: boolean` | Default false: primary and secondary each stay on one line with ellipsis, and each exposes its full value through the native title. True: wrap long text within the available column width. |

Use explicit column widths or `minWidth` as appropriate, and `mobileRow` for a meaningful narrow-screen layout. `TableCellText` fills the available space without imposing a new fixed column width; `wrap` may increase row height and should be a deliberate choice. For example, `<TableCellText numeric secondary="可用库存">{0}</TableCellText>` keeps zero and its supporting label, while `<TableCellText wrap>{task.result}</TableCellText>` allows a verbose result to wrap. The same text export can compose a `TreeTableColumn.cell` or `mobileRow`.

When upgrading an existing custom `cell`, replace ordinary-data `code`, `small`, `strong`, or business font classes with `TableCellText`; upgrading the kit cannot infer the meaning of arbitrary caller JSX. Keep semantic status indicators, Tag and action Button components as those components: they intentionally have their own size and emphasis. Deliberately technical code content can still use the official code components where the product calls for it; that is separate from ordinary business-data typography. No global font override is needed or permitted.

The Explorer's **表格正文排版** case at `#/components/data-table` includes primary/secondary, actual numeric zero, opt-in emphasis, long ellipsis/full titles, wrapping, dark theme, locale and 320px examples. Compare equivalent primary values with each other, rather than expecting supporting labels, status tags and commands to share one text level.

## Table operation columns

For familiar row commands such as edit and delete, use the official `IconButton` with a `Tooltip`, and place the commands on one line with `Inline gap="small" wrap={false}`. Each icon needs its own row-specific `aria-label`; a tooltip is supporting copy, not a replacement for that name. The current IconButton is 36×36px and has no public `size` prop. Do not invent a smaller size, assume it grows to 44px, or override its CSS. Use a small text `Button` for business commands whose icon would be unclear, such as “检查连接”.

Give the two-icon column an explicit `width: 120` to include both controls, the gap, cell padding and focus space. `pin: "end"` is optional when the right-hand actions should stay visible during horizontal scrolling. Do not stack the buttons or reduce their hit areas to fit a narrower column. On mobile, use the official horizontal viewport or compose the same controls in `mobileRow` with enough space; do not squeeze the desktop table's type or buttons.

This complete typed example reuses existing public exports. The page owns the selected delete target and one confirmation dialog outside the row renderer; callers own permissions, request state and business callbacks:

```tsx
import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import {
  ConfirmDialog, DataTable, IconButton, Inline, Tooltip, type DataColumn,
} from "./ui";

type ProxyRow = {
  id: string;
  name: string;
  address: string;
  readOnly?: boolean;
  pendingAction?: "edit" | "delete";
};
type ProxyTableProps = {
  rows: ProxyRow[];
  permissions: { edit: boolean; delete: boolean };
  onEdit: (row: ProxyRow) => void;
  onDelete: (proxyId: string) => Promise<void>;
};

export function ProxyTable({ rows, permissions, onEdit, onDelete }: ProxyTableProps) {
  const [deleteTarget, setDeleteTarget] = useState<ProxyRow | null>(null);
  const columns: DataColumn<ProxyRow>[] = [
    { id: "name", header: "代理名称", minWidth: 180, cell: (row) => row.name },
    { id: "address", header: "连接地址", minWidth: 220, cell: (row) => row.address },
  ];
  if (permissions.edit || permissions.delete) columns.push({
    id: "actions", header: "操作", width: 120, pin: "end",
    cell: (row) => <Inline gap="small" wrap={false}>
      {permissions.edit && <Tooltip content={row.readOnly ? "只读，无法编辑" : "编辑"}>
        <IconButton icon={<Pencil />} variant="ghost" aria-label={`编辑${row.name}`}
          loading={row.pendingAction === "edit"}
          disabled={row.readOnly || row.pendingAction === "delete"}
          onClick={() => onEdit(row)} />
      </Tooltip>}
      {permissions.delete && <Tooltip content={row.readOnly ? "只读，无法删除" : "删除"}>
        <IconButton icon={<Trash2 />} variant="danger" aria-label={`删除${row.name}`}
          loading={row.pendingAction === "delete"}
          disabled={row.readOnly || row.pendingAction === "edit"}
          onClick={() => setDeleteTarget(row)} />
      </Tooltip>}
    </Inline>,
  });
  return <>
    <DataTable ariaLabel="代理列表" rows={rows} columns={columns} rowKey={(row) => row.id} />
    <ConfirmDialog open={deleteTarget !== null}
      onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
      title="删除代理" description={`确认删除“${deleteTarget?.name ?? ""}”？此操作不可撤销。`}
      tone="danger" confirmLabel="删除代理" cancelLabel="取消"
      errorMessage="删除失败，请重试。"
      onConfirm={async () => { if (deleteTarget) await onDelete(deleteTarget.id); }} />
  </>;
}
```

Omit commands the caller has no permission to perform; omit the whole operation column when no commands are available for that scope. Keep temporarily unavailable commands in place with `disabled`, and bind `loading` only to their actual request. Do not reserve empty icon placeholders. If availability differs per row, render only that row's permitted commands and use concise non-interactive text for a row with none. Treat permissions as display decisions, not a replacement for backend authorization.

The delete callback must reject on failure so ConfirmDialog retains the target and supplies its own error Toast; it owns confirmation loading and blocks repeated confirmation. Do not swallow the failure and accidentally close the dialog, add an above-table Alert, or send a second failure Toast. Keep the dialog outside `cell` so row re-renders do not create one modal per row. Edit dialogs or other asynchronous commands should likewise be owned by the page and expose their actual pending state through `pendingAction`.

For a larger set, use one official `DropdownMenu` in place of the icon cluster. It owns its trigger; it does not accept a custom `trigger` prop. Pass an `ariaLabel` that identifies the row, stable unique item IDs, per-command permissions/disabled state, and `danger: true` for deletion. For example, these callbacks can be supplied by the same page owner:

```tsx
import type { ComponentProps } from "react";
import { DropdownMenu, type DataColumn } from "./ui";

function moreActionColumn(
  permissions: { edit: boolean; copy: boolean; delete: boolean },
  onEdit: (row: ProxyRow) => void,
  onCopy: (address: string) => void,
  onRequestDelete: (row: ProxyRow) => void,
): DataColumn<ProxyRow> | undefined {
  if (!permissions.edit && !permissions.copy && !permissions.delete) return undefined;
  return { id: "actions", header: "操作", width: 120, pin: "end", cell: (row) => {
    const items: ComponentProps<typeof DropdownMenu>["items"] = [];
    const busy = Boolean(row.pendingAction);
    if (permissions.edit) items.push({ id: "edit", label: "编辑",
      disabled: row.readOnly || busy, onSelect: () => onEdit(row) });
    if (permissions.copy) items.push({ id: "copy", label: "复制地址",
      disabled: busy, onSelect: () => onCopy(row.address) });
    if (permissions.delete) items.push({ id: "delete", label: "删除", danger: true,
      disabled: row.readOnly || busy, onSelect: () => onRequestDelete(row) });
    return <DropdownMenu label="更多" ariaLabel={`更多操作：${row.name}`} align="end" items={items} />;
  } };
}
```

Add the returned column only when it is defined, instead of the two-icon column; bind `onRequestDelete` to the page's `setDeleteTarget`. The helper filters unauthorized commands before passing `items`; omit the menu when no commands remain. Do not duplicate the same commands in both a menu and an always-visible icon group. Copy/export results may use one official Toast from the page owner. A less common command can instead use `<Button size="small" variant="ghost" loading={checking} loadingLabel="检查连接" onClick={checkConnection}>检查连接</Button>`; reserve enough column width for that complete label.

The runnable **操作列组合** case (`data-table/actions`) is available at `#/components/data-table`. Its [complete companion source](../assets/react-kit/src/explorer/cases/data/table-actions.example.tsx) demonstrates edit, confirmed delete, pending and read-only states, overflow commands, a small text business action, keyboard use, dark theme and narrow screens. It composes existing controls; no new table API or replacement controls are required.

## Height and pagination

Pass the typed `pagination` object directly to `DataTable`; this keeps the pager inside the same rounded frame. Do not render a second `Pagination` in the page footer.

Tables use a stable viewport of five standard row-height units by default, whether paginated or unpaginated; all fixed capacities share the same short-screen limit. Keep `pagination` present during loading, empty, and zero-row error states so sparse pages and changing page sizes do not move the pager. Outside a project provider, use a numeric `viewportRows` for another explicit fixed capacity, or `viewportRows="auto"` only when following content height is intentional. Never derive capacity from `rows.length`, page size or request state; taller custom cells scroll without being clipped into standard rows.

### Project table-height policy

Stable height within one table and consistent height across pages are separate responsibilities. For comparable management lists, place one public `DataTableProvider` in the application shell, outside route switching. Select its `viewportRows` once for the project; omitting it uses five standard row-height units. The provider owns fixed height and takes precedence over each descendant table's `viewportRows`, including `"auto"`. A local preference left behind by a copied example therefore cannot change one list's capacity. Values are normalized to whole units from 1 to 100; invalid non-finite values use five. A nested provider deliberately establishes another scope for a genuinely different workspace.

```tsx
import { DataTableProvider } from "./ui";

// Keep this provider mounted around the product's existing router outlet.
// The proxy and phone pages each compose DataTable with built-in pagination.
<DataTableProvider viewportRows={5}>
  {activePage === "proxies" ? <ProxyListPage /> : <PhoneListPage />}
</DataTableProvider>;
```

Do not use returned record counts, `pageSize`, loading skeleton counts or the current route to choose this capacity. One record, twenty records, an empty response, loading and errors keep the same viewport; excess rows scroll inside it. Preserve the table and its `pagination` object across those states. Use the same mobile presentation across comparable lists: desktop tables and mobile cards have different standard row units. Different headers, filter wrapping or the presence of a pager can still change total page geometry; keep the surrounding page composition consistent rather than asking DataTable to position the whole page.

Implicit, explicit and provider capacities share the limit `min(configuredHeight, max(158px, 100dvh - 220px))`. This responds to screen height without depending on data. It does not calculate space below arbitrary toolbars or fill the remaining parent height. Outside a provider, `viewportRows="auto"` remains available for an intentionally content-sized table; do not choose it for ordinary management lists that require stable height.

For an existing application, first update its installed canonical source through the Skill installer, then add the provider to its page shell and remove conflicting per-page sizing choices. Updating the Skill alone cannot rewrite previously generated business pages. The runnable **项目统一表格高度** example at `#/components/data-table` compares sparse proxy data with a populated phone list and exercises request states under one provider.

### Project pagination consistency

Use one official pagination design throughout an application: `DataTable.pagination` owns table paging; other paged lists use `Pagination` from the same installed kit and application theme. Keep the same control heights, typography, corner radius, spacing, page-size control and highlighted current-page treatment across pages. Do not add an alternative pager, rebuild controls, or apply page-specific CSS to make individual pages look different. Loading and responsive compact layouts remain adaptations of this shared design.

Choose the mode from the actual API contract. When endpoints supply real totals and numbered page access, use the same numbered composition across those lists. Use cursor mode only where the API supplies adjacent-page availability without a real page count; do not infer that capability from the current response length or switch modes because a page has few results. Its highlighted “第 N 页” is a non-interactive status, not a page-jump button; retaining this semantic difference does not require a different visual style. Never fabricate totals to force a cursor endpoint into numbered paging.

For known page counts, keep the ordinary `page`, `pageCount` and `onPageChange` props. For cursor/unknown-total APIs, use the same in-frame component with `mode="cursor"`, `page`, `hasPreviousPage`, `hasNextPage`, and `onPageChange`; this mode has no `pageCount` or `total`, numbered jumps or invented total. For example:

```tsx
<DataTable ariaLabel="派发队列" columns={columns} rows={rows} rowKey={row => row.id}
  pagination={{ mode: "cursor", page, hasPreviousPage, hasNextPage,
    onPageChange: requestAdjacentPage, pageSize, onPageSizeChange: changePageSize }} />
```

The application owns cursor history, request cancellation and page-size/filter resets. Loading/empty/error retain the same pager; do not rebuild it from ordinary Button and Select. Use `Tag size="small"` or `StatusIndicator` for business status; Badge is for supplementary counts/markers. See [layout and sizing](layout-sizing.md).

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

For `InfiniteScroll showLoadMoreButton={false}` + `LoadMore`, bind `onLoadMore` to the same owner callback, records, cursor, loading and hasMore. Establish a synchronous pending-promise latch before fetch can run; React loading state alone is not cross-entry mutual exclusion. Reentrant calls join the pending promise. The owner consumes failures, retains records and cursor, preserves an accessible failure/retry state, and releases the latch in `finally`. The bundled composition uses one official Toast for each failed request, retains the original LoadMore button and adds a short retry explanation to its existing status line; no Alert is inserted above the records. Wrap direct use of this example in the application's shared ToastProvider. Follow the [feedback selection rules](toast-contract.md#feedback-selection) and do not add another notification for that request. While an error remains, disable automatic observation and let LoadMore explicitly retry that same cursor. Success appends the returned page once and adopts its cursor/hasMore; after `hasMore=false`, neither path starts another request. A global disabled state blocks both commands without deleting retained data. InfiniteScroll's internal lock coordinates its own default button; an independently bound external LoadMore still requires this shared business callback.

The [composition keyboard contract](m5-keyboard-contracts.md#official-compositions-d2d3-2026-10-09) names the actual Tab/activation owners and evidence. D3's four unit contracts and its keyboard/observer/retry/end/focus/axe browser scenario passed in all three engines using retained Chromium and bounded recovery receipts. D2's three unit contracts and nine browser cases passed, with eight prior results retained and only the missing WebKit keyboard case rechecked after fixing its mounted starting-focus prerequisite. Existing individual-component passes retain their original source identities; these development results are not a release. Do not infer OS file-dialog focus restoration from automated filechooser injection or infer full workflow behavior from axe alone.
