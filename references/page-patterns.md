# ui-builder-xtn page pattern routing

Use a bundled page pattern when the requested workflow matches one below. Patterns own page geometry and recurring interaction structure; consumers provide business data, copy, callbacks, permissions, and product media through documented props. See the generated [component API](component-api.md) for exact signatures and the [component catalog](component-catalog.md) for aliases.

## Pattern selection

For a complete application composition, see the [青屿商城 / storefront example](business-examples.md). Its home route `#/examples` connects catalog, product detail, favorites, cart, checkout, orders, account/address book and login/registration under `#/examples/shop/...`, with one shared storefront navigation and in-memory business state. The footer source Drawer exposes actual page composition through the same public patterns and controls. The example demonstrates a local frontend workflow; production services, account authorization and data isolation remain application responsibilities.

| Workflow | Public pattern | Consumer-owned content |
| --- | --- | --- |
| Product-family sign-in | `FamilyLoginPage` | Company/product identity, accents, visual, links, submit callback |
| Custom authentication flow | `AuthenticationPage` | Identity, visual, form body, footer |
| Searchable operational list | `ListManagementPage` or `SearchFilterPage` | `FilterBar`, result component, bulk actions |
| Complete member-list example | `MemberManagementPage` | Fetch function and product-specific actions |
| Create or edit | `CreateEditPage` | Fields, submit/cancel behavior, business validation |
| Record detail | `DetailPage` | Stable sections, values, actions, optional aside |
| Settings | `SettingsPage` | Stable section IDs, controlled current section |
| Multi-step process | `WizardFlow` | Stable steps, controlled step, previous/next behavior |
| Master-detail workspace | `MasterDetail` | Master and detail surfaces, controlled detail visibility |
| Import/export operation | `ImportExportPage` | Format controls, payload handling, async callbacks |
| Empty/error/permission/offline page | `StatusPage` | Business title, description, action or retry |

Do not copy a pattern's JSX into a local variant. Compose its slots with other public exports. If the pattern lacks a reusable capability, follow the canonical missing-capability workflow instead of patching the installed source.

## Page composition ownership

Choose one complete page pattern for the active route. `ListManagementPage`, `SearchFilterPage`, `MemberManagementPage` and the other full-page patterns already render their page heading. Place the pattern inside the application's navigation shell; do not nest another complete page pattern inside it or add a second `PageHeading` for the same page. Use `PageHeading` on its own only when assembling a page without a heading-owning pattern. A separate section title is appropriate for a distinct section; it should not repeat the page title.

Before composing controls, assign each request a data scope, command owner and result-status owner:

| Information or action | Default owner | Avoid |
| --- | --- | --- |
| Product identity and global navigation | Application shell | Repeating the full identity in every page heading |
| Page title and page-level creation action | Page pattern heading | A second heading or the same creation action in the filter bar |
| Draft filters and explicit query | One `FilterBar` | A second button that executes the same list request with the same applied filters |
| List total and record range | `DataTable.pagination` | Repeating the total in the heading and a result-summary line |
| Loading or successful update state | One status region for that request | Two unlabeled “最近读取” times for one dataset |
| Table request failure | `DataTable` automatic Toast and its persistent in-frame status/retry | An above-table Alert, second ErrorState, or manual Toast for the same failure |
| Row actions and selected-row count | Row or bulk-action area | Treating legitimate per-row actions as duplicated page commands |

Querying changed draft filters and refreshing the last applied query are different operations only when the workflow needs both. If both are exposed, label the scopes and use the correct draft/applied state; otherwise keep one query entry point. Different requests may each have a command and status, for example “检查服务状态 / 服务状态更新于…” and “查询任务 / 任务列表更新于…”. Each timestamp must change only after its own request succeeds. Do not invent extra timestamps, English eyebrows, subtitles, descriptions or buttons merely because slots are available. Responsive alternatives are acceptable when only the applicable version is visible; retry and row actions remain valid in their own context.

The runnable “作用域分离” tab at `#/patterns/list-filter` composes one `ListManagementPage`, a service-status region, one list `FilterBar`, and `DataTable` using public exports. Its service check leaves the list result/time unchanged; list submission leaves service status/time unchanged; the pager owns the total. Reuse this structure with product callbacks rather than copying the Explorer shell. `MemberManagementPage` follows the same total ownership: its heading shows the title, its status region shows request state, and its built-in table pager shows the count.

Before handoff, inspect the composed page once for duplicate headings, same-scope buttons, repeated totals and update times. Compare the callbacks and request state, not just button wording: two buttons with different labels can duplicate an operation, while identical row labels can be correct. The provenance checker enforces component source and public API ownership; it does not infer this business meaning.

Use Toast for save/delete/copy/export, login/confirmation and recoverable request outcomes so feedback does not displace the page. FamilyLoginPage, ConfirmDialog, Popconfirm and the bundled storefront already own their Toast feedback. Keep field validation and recovery controls in their relevant context without adding a duplicate notification. See the [implemented defaults and concrete action code](toast-contract.md#feedback-selection).

## Family login

`AuthenticationPage` defaults to `layout="page"` and fills at least the viewport height. Use `layout="embedded"` in a preview, tab or other bounded surface; its minimum height is capped while long content can still grow. Without a `visual`, the form is a single centered column with a maximum content width of 420px. With a visual, it uses two columns above 760px of **component container** width, and hides the visual below that width. Compose the form body with the official `Form` and `Field`; submit through the Form so click and Enter share one path. Do not patch page geometry with application CSS.

`FamilyLoginPage` intentionally keeps one company identity and one credential form across products. Vary each product through stable `id`, name, accent tokens, headline, supporting copy, and `visual`. Do not fork the form markup for each product or override input/button geometry in application CSS.

The pattern owns validation focus, password visibility, pending submission, duplicate-submit prevention, and component fallback text. Submission failures use one automatic Toast; no-product configuration uses a persistent Toast. Field validation stays inline and the original submit button remains available for retry. The caller owns authentication, account links, legal copy, and errors returned by the business service; do not notify those same errors again. Product accents must retain readable control states; visual media must describe the actual product rather than serve as generic decoration. The runnable example is `#/patterns/authentication`.

## List and CRUD pages

Place `FilterBar` and `DataTable` inside `ListManagementPage` or `SearchFilterPage`. Choose one shared `layoutWidth` for comparable routes, including `MemberManagementPage`: `"readable"` (the default) bounds and centers content at 1160px; `"wide"` fills the available shell. Reuse that application choice and the shell's outer padding across the routes, rather than deciding width separately from each page's record or column count. MemberManagementPage reuses the public list and filter layout and adds no private outer inset. See the [project consistency composition and preview](layout-sizing.md#project-consistency). Keep table pagination in `DataTable.pagination`, not the page footer. Put comparable list routes under one application-shell `DataTableProvider` and choose their common height strategy as described in the [data workflow contract](data-workflows.md#project-table-height-policy).

For a table request error, keep `DataTable` mounted with `state="error"`. The table owns its automatic short Toast and persistent in-frame status/retry; `MemberManagementPage` uses that same mechanism. Do not add another Alert, ErrorState, manual Toast or error-summary line around it for the same request. A shared application `ToastProvider` coordinates notifications from the page's tables and other operations; the table has a fallback for standalone use. A service-health failure is a distinct scope and may still require its own appropriate feedback. See [table request failures](data-workflows.md#table-request-failures).

`CreateEditPage` owns the form and stable action footer. Compose fields from ui-builder-xtn and follow the [form contract](form-contract.md). For editing inside a modal surface, use `Dialog` or `Drawer` rather than nesting a page pattern merely to obtain actions.

## Detail and process pages

Keep IDs stable and unique for detail sections, settings sections, and wizard steps. Controlled navigation state remains with the application; patterns render its accessible structure and built-in pending state. Use `DescriptionList` for term/value metadata and public feedback components for business outcomes.

SettingsPage defaults to `layoutWidth="readable"`, bounding its content section to 800px, and switches navigation/content by the actual container width. Choose `layoutWidth="wide"` deliberately for content that needs more room. Group short numerical settings in `Box style={{ width: "100%", maxWidth: 504 }}` around `Grid minItemWidth={240} gap="large"`, with `Field width="short"`: this keeps two 240px fields 24px apart and switches to one column in a narrower container. `minItemWidth` is a track minimum; `1fr` tracks expand, so a wide unbounded Grid around short fields creates excess visible spacing. Apply the 504px bound only to these short-field groups; mixed medium/long fields and textareas retain their appropriate widths. Save actions keep content width. See the complete [layout and sizing example](layout-sizing.md#fields-and-settings) and the runnable service-settings form at `#/patterns/settings`.

SettingsPage does not automatically add outer page-shell padding; the application's existing shell owns that inset. For standalone embedding in a bordered container, the official example uses public `Box style={{ padding: "clamp(16px, 3%, 24px)" }}` for 16–24px of padding based on the actual containing width. Omit this padded wrapper when the host already provides padding.

`ImportExportPage` provides operation shells and pending buttons, not parsing, upload transport, or authorization. Its operation outcomes use Toast. `StatusPage` represents a page-level outcome; use `EmptyState` or `ErrorState` for a persistent unavailable/empty region within an otherwise usable page. Persistent notifications can use `Toast duration={null}` or Banner, which now renders a persistent floating Toast. Alert is an explicit inline option, not an automatic operation-result companion. Table request failures use DataTable's own Toast/status/retry rather than an additional feedback surface.

## Overlays, locale, and responsive behavior

Use page patterns as the base surface and public overlays for transient work. Drawer and modal dismissal, focus, nesting, and Portal behavior are defined by the [overlay contract](overlay-contract.md). Component fallback and ARIA text follow the nearest locale provider; business page titles and field labels remain explicit consumer props as described by the [locale contract](locale-contract.md).

Before handoff, exercise the pattern's applicable loading, error, empty, validation, long-content, keyboard, and narrow-screen states. Inspect the Explorer pattern route rather than the archived static HTML preview.
