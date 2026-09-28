# Personal UI data workflow contract

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
| Ordinary list page shell | `ListManagementPage` or `SearchFilterPage` |
| Complete server-list reference | `MemberManagementPage` |

Do not rebuild these controls with native interactive markup, a third-party command menu, or application-owned `.pui-*` styles. Import them from the installed `personal-ui` barrel.

## Request state

Keep editable filter values separate from the last applied query. Typing and option changes update draft state only; submit from the `FilterBar`, its query button, or Enter starts the request. Sorting and pagination are also explicit requests.

- Give every request an identity or cancellation signal so an older response cannot replace newer results.
- Put the initiating `Button`, sortable header, retry action, or `Pagination` target into its bundled loading state. Loading must block duplicate activation without changing control dimensions.
- Retain the last successful rows in caller state across requests. A refresh may show stable-height skeleton rows; if it fails, restore or retain the cached rows beneath the error. Retry from a retained-data error keeps those rows visible, while a zero-row error is reserved for requests with no usable result.
- Keep loading, ready, empty, error, and retry transitions in the same `DataTable` frame. Do not swap the table for a differently sized page-level placeholder.
- Business query values, API errors, and row data remain caller-owned. Locale only owns component fallback and ARIA text; machine values do not change with display language.

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

## Completion checks

Exercise slow success, empty, retained-data error, zero-row error, retry, sort, page, page-size, selection, long content, and mobile rendering as applicable. Check that the table frame, pager, and action controls do not resize while loading. Use the Explorer routes `#/components/data-table`, `#/components/select`, and `#/patterns/list-filter` as runnable examples.
