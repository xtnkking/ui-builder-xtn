# Layout and sizing contract

Use this reference for controls stretched across wide screens, changing table height, mismatched query actions, small status labels, and inconsistent pagination. These are component-library design choices, not universal industry measurements. Use public APIs and canonical styles rather than overriding protected controls in application CSS.

## Fields and settings

Choose width from the expected value, label, control chrome and local container. Short intervals and thresholds do not need an entire desktop column. Width stays stable while editing; do not resize when a number gains a digit.

`Field width="short"`, `"medium"`, and `"long"` prefer 240, 360 and 560 CSS pixels. A positive finite number selects another preference. The field is bounded by its container; omitting width preserves ordinary full-width fields. `FilterField` remains the filter-bar composition with separate 140/240/320px baselines and bounded placeholder measurement. Long instructions belong in labels/hints, not indefinitely expanding placeholders.

Bound the field group as well as each short control. `Grid minItemWidth` sets a track's lower bound; its `1fr` tracks still grow to share the available width. Putting 240px fields at the start of unbounded tracks leaves extra space between the visible controls. For a compact pair, use a public `Box` with `width: "100%"` and `maxWidth: 504`, then `Grid minItemWidth={240} gap="large"`: two 240px fields plus the 24px gap fill 504px, and a narrower container switches to one column. Keep this bound local to the short-field group; medium/long fields and textareas need their own appropriate widths.

```tsx
import { Box, Button, Field, Form, Grid, NumberInput } from "./ui";

<Form onSubmit={saveSettings}>
  <Box style={{ width: "100%", maxWidth: 504 }}>
    <Grid minItemWidth={240} gap="large">
      <Field htmlFor="poll-interval" label="有任务时拉取间隔（秒）" width="short">
        <NumberInput id="poll-interval" ariaLabel="有任务时拉取间隔" value={interval}
          min={0.1} step={0.1} onValueChange={setInterval} />
      </Field>
      <Field htmlFor="backlog-threshold" label="积压暂停阈值（条）" width="short">
        <NumberInput id="backlog-threshold" ariaLabel="积压暂停阈值" value={threshold}
          min={1} onValueChange={setThreshold} />
      </Field>
    </Grid>
  </Box>
  <Button type="submit" variant="primary" loading={saving}
    loadingLabel="保存全部设置">保存全部设置</Button>
</Form>
```

`Form` keeps a direct Button at its content width. Group multiple commands in an official `Inline`; do not stretch an ordinary save command across a desktop form. Deliberate full-width actions can use a surrounding layout of a defined width; login patterns retain their own geometry.

`SettingsPage layoutWidth="readable"` is the default and bounds its content section to 800px. Select `layoutWidth="wide"` for content that needs the space. Navigation/content respond to the actual container, including a narrow embedded panel on a wide monitor. The runnable service-settings form is at `#/patterns/settings`.

`SettingsPage` leaves outer page-shell padding to the application's existing shell. For a standalone embed in a bordered container, the official example wraps it in public `Box style={{ padding: "clamp(16px, 3%, 24px)" }}` to provide 16–24px of inset according to the actual containing width. If the host already supplies padding, reuse that inset without adding another padded wrapper.

## Modal forms

Size the form as a group for its panel, rather than selecting a different preferred width for every vertically stacked field. The ordinary 44px control height and existing Form/Field gaps apply inside a Dialog; a larger browser zoom scales their appearance and does not imply a different CSS height.

Related short fields can share `Grid minItemWidth={200} gap="medium"` in the default 520px Dialog: each fits a roughly 228px track when the 472px body is available. The pair becomes single-column below 416px of body width, including a narrow embedded/viewport layout. Leave the Field width unset within these tracks so visible control edges align; an additional 240px Field bound would make the pair's sizing rules disagree. Keep long names, addresses and notes full-width in the same Form. Use `width="large"` only when the content actually needs a larger panel, not simply to suppress all vertical scrolling.

Place persistent commands in `Dialog.footer` or `Drawer.footer`, connected to the body's unique Form id with `Button type="submit" form={formId}`. The header/footer stay visible while long content scrolls in the body; scrolling is appropriate on a short screen. Do not hide necessary content, reduce text size or create nested scrollbars to fit everything. The complete native validation, Enter and external submit composition is in the [modal form contract](form-contract.md#forms-inside-dialogs-and-drawers) and `#/components/dialog`.

## Filters and actions

Use `FilterField` with `FilterBar` for mixed-length query controls. Fields wrap with the actions without enlarging to occupy unused desktop space. FilterBar actions use the same corner radius as fields. Default compact desktop height is 38px; comfortable density, narrow containers, mobile viewports and coarse pointers retain 44px controls. Outside FilterBar, ordinary fields remain 44px and Buttons remain 38px; use `size="field"` when aligning a Button with a field.

Keep query loading labels equal to the short visible command when longer text is unnecessary. Loading must not widen the button, move adjacent fields or permit duplicate submission. See [filter widths](data-workflows.md#filter-field-sizing) and [search feedback](data-workflows.md#search-feedback).

## Project consistency

Decide the visual treatment once for each repeated business role in the application. The default explicit list query uses `Button variant="primary" size="field"`, a Lucide `Search` icon and short visible text, followed by a `variant="secondary"` reset. Use `FilterBar` for these controls; its private action context keeps the same corners and padding through Fragment or official Inline wrappers. MemberManagementPage uses that same composition. A product may deliberately select another query treatment, but all comparable query entry points in that scope must use it. Primary creation/save, destructive actions and compact row actions retain their own semantics.

Choose the width of comparable list routes from the application layout, then reuse it. `ListManagementPage`, `SearchFilterPage` and `MemberManagementPage` accept the same `layoutWidth="readable" | "wide"`; the default is readable (1160px maximum, centered), and wide fills the available shell. Keep one shared choice in application configuration rather than switching each route according to returned records or column count. The application shell owns shared horizontal padding, including for MemberManagementPage. Distinct authentication forms, settings and editing surfaces can retain their suitable readable widths.

```tsx
import { ListManagementPage, SearchFilterPage, MemberManagementPage } from "./ui";

const projectListWidth = "wide" as const;

<ListManagementPage title="服务器" layoutWidth={projectListWidth} filters={serverFilters}>{serverTable}</ListManagementPage>;
<SearchFilterPage title="任务中心" layoutWidth={projectListWidth} filters={taskFilters}>{taskTable}</SearchFilterPage>;
<MemberManagementPage layoutWidth={projectListWidth} fetchMembers={fetchMembers} />;
```

The page container chooses the content boundary; DataTable fills that boundary; its columns choose how the inner table uses the space. Give a name/description column `minWidth` without `width` when it should receive remaining room, keeping short values and operations bounded. When every column has an explicit width, the inner table deliberately uses their sum and can leave blank space inside its full-width frame. TreeTable shares DataTable's frame border and table-radius tokens.

Before handoff, compare at least the affected routes at the same viewport and shell width: heading/filter/table left and right edges, query color/icon/height/corners, loading stability and empty results. Inspect the actual narrow container too. The runnable “同站列表一致性” example at `#/patterns/list-filter` compares three list pages with one shared width, direct/Inline query actions, column policies and themes. Provenance validation checks source ownership; it cannot decide which business actions or routes should share a treatment.

## Segmented choices

`SegmentedControl` defaults to content width, including when it is a direct child of a column flex or grid layout. Its background hugs the option group instead of stretching across unused space. Use `fill` to deliberately fill the container with equal-width options, or `fill="mobile"` to fill only at viewport widths up to 640px. All modes remain bounded by their container and retain long-label truncation. Do not add application CSS to fix the background width; use the public `fill` choice. Compare both parent layouts at `#/components/segmented` → “宽度与父布局”.

## Tables and paging

DataTable defaults to a fixed viewport of five standard row-height units, with and without pagination. Sparse and empty results retain the surface; more records scroll inside it. Every fixed capacity uses the same short-screen limit, whether implicit, numeric or supplied by `DataTableProvider`. A numeric `viewportRows` chooses another explicit capacity outside a provider; `viewportRows="auto"` deliberately chooses content height outside a provider. Capacity is not the exact visible record count when custom cells wrap. Never derive it from `rows.length`, page size or request state.

For comparable list pages, place one `DataTableProvider` outside route switching and choose the height strategy once. The default `heightMode="rows"` preserves fixed capacity: desktop viewport height is `42 + 58 × capacity` CSS pixels before the shared short-screen limit; mobile cards use `76 × capacity`, and the pager adds its own height. For a full-page list, choose `heightMode="fill"` and place the table in a bounded, shrinkable remaining-space layout track: the whole table, including pagination, fills that track. Auto-sized headers and wrapping filters consume their real height; shared page padding owns the bottom inset. Fill is based on available container space, never record count. A provider takes precedence over local table height choices; a nested provider deliberately establishes another scope. Keep pagination present through request states. See the [project height composition and complete example](data-workflows.md#project-table-height-policy).

Keep pagination in `DataTable.pagination` during loading, empty and error states. The same official Pagination owns numbered and unknown-total layouts, loading, page-size selection and responsive geometry. Do not reconstruct a pager from ordinary Buttons/Select or add a second one outside the table.

Use one pagination design across the application. Table and other list pagers share the application theme, control heights, typography, corners, spacing, page-size control and highlighted current-page treatment. Cursor mode displays the same current-page treatment as a non-interactive “第 N 页” status; numbered mode exposes real page-jump buttons. Responsive compact layouts are component-owned adaptations of this design. Do not introduce page-specific pager styles or application CSS overrides; choose the mode from the API's capabilities using the [project consistency rules](data-workflows.md#project-pagination-consistency).

- For known page counts, pass `pageCount` and the controlled page callbacks. Numeric buttons may collapse in a narrow container without changing paging semantics.
- For cursor APIs, use `mode="cursor"`, the actual `hasPreviousPage`/`hasNextPage`, and a controlled page ordinal. Do not invent totals or offer random page jumps. The application owns cursor history, requests and history resets when filters or page size change.

See [height and pagination](data-workflows.md#height-and-pagination) for composition and the runnable `#/components/data-table` and `#/components/pagination` examples.

## Status and long content

Use `Tag size="small"` for compact business status: minimum height 26px, 13px text and medium weight. Normal Tag remains 30px with 12px text. Use `StatusIndicator` for a dot plus label, keeping explicit words so color is not the only signal. Small Badge suits counts and supplementary markers; do not choose it for every row's primary status merely because it accepts text.

Keep table text readable and give action columns explicit room. Use supported truncation for long labels; Tag already bounds width, exposes full text and makes truncated text keyboard reachable. Large screens do not require distributing all remaining space among short values.

## Focused review

Horizontal ButtonGroup wraps ordinary controls; attached groups retain their connected shape and scroll internally when necessary, without shrinking icons. A scrollable group becomes a named keyboard stop and preserves visible child focus. Dialog/Drawer bound long descriptions in a separately scrollable region so they cannot consume the body and footer; that description enters Tab order only when it overflows.

For affected components inspect desktop, ultrawide, narrow embedded containers and a 320px viewport; exercise a short screen where height matters. Check empty/few/many rows, long labels, loading stability, control alignment and actual text space. Reuse unchanged source-specific evidence and run only impacted tests; maintenance does not restart M1–M8 acceptance or publication.
