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

## Filters and actions

Use `FilterField` with `FilterBar` for mixed-length query controls. Fields wrap with the actions without enlarging to occupy unused desktop space. FilterBar actions use the same corner radius as fields. Default compact desktop height is 38px; comfortable density, narrow containers, mobile viewports and coarse pointers retain 44px controls. Outside FilterBar, ordinary fields remain 44px and Buttons remain 38px; use `size="field"` when aligning a Button with a field.

Keep query loading labels equal to the short visible command when longer text is unnecessary. Loading must not widen the button, move adjacent fields or permit duplicate submission. See [filter widths](data-workflows.md#filter-field-sizing) and [search feedback](data-workflows.md#search-feedback).

## Tables and paging

DataTable defaults to a fixed viewport of five standard row-height units, with and without pagination. Sparse and empty results retain the surface; more records scroll inside it. Default capacity is bounded on short screens. A numeric `viewportRows` chooses another explicit capacity; `viewportRows="auto"` chooses content height. Capacity is not the exact visible record count when custom cells wrap. Never derive it from `rows.length` or change it on each request.

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
