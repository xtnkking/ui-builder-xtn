# Component Catalog

Personal UI v0.2.8 contains 118 source-backed families and preserves all 130 directory aliases from the approved preview. The family ID and aliases are discovery terms, not import paths. Application code must import the listed runtime exports from `src/personal-ui/index.ts`; it must never import a source file named in the final column directly.

`assets/react-kit/component-manifest.json` is the machine-readable authority for this table. The manifest validator requires every family to resolve to real source files, every runtime export to exist in the barrel and registry, and every visual component or pattern to carry its registered source owner marker. Foundation families may be CSS or TypeScript artifacts without a runtime export.

## Source-Backed Inventory

Source names below are relative to `assets/react-kit/src/personal-ui/`; duplicate basenames are collapsed only to keep the table readable.

### Foundations

| Family | Directory aliases | Public exports | Source backing |
|---|---|---|---|
| `color` | `semantic-colors` | `ThemeProvider` | `layout.tsx` + `layout-actions-display.css` |
| `typography` | `typography` | None (foundation artifact) | `styles.css` |
| `spacing` | `spacing` | None (foundation artifact) | `styles.css` |
| `radius` | `radius` | None (foundation artifact) | `styles.css` |
| `surface` | `borders-shadows` | None (foundation artifact) | `styles.css` |
| `icons` | `icons` | None (foundation artifact) | `primitives.tsx` + `styles.css` |
| `motion` | `motion` | None (foundation artifact) | `styles.css` |
| `z-index` | `z-index` | None (foundation artifact) | `styles.css` |
| `density` | `density` | None (foundation artifact) | `styles.css` |

### Layout

| Family | Directory aliases | Public exports | Source backing |
|---|---|---|---|
| `responsive` | `breakpoints-grid` | `Grid` | `layout.tsx` + `layout-actions-display.css` |
| `responsive-visibility` | `responsive-visibility` | `ResponsiveVisibility` | `layout.tsx` + `layout-actions-display.css` |
| `layout` | `layout-primitives` | `Box`, `Stack`, `Inline` | `layout.tsx` + `layout-actions-display.css` |
| `divider` | `divider` | `Divider` | `layout.tsx` + `layout-actions-display.css` |
| `scroll` | `scroll-area` | `ScrollArea` | `layout.tsx` + `layout-actions-display.css` |
| `resizable` | `resizable-panels` | `ResizablePanels` | `data-extra.tsx` + `extended.css` |
| `sticky` | `sticky-header-action-bar` | `StickyHeaderActionBar` | `layout.tsx` + `layout-actions-display.css` |
| `collapse` | `collapse` | `Collapse` | `layout.tsx` + `layout-actions-display.css` |
| `aspect` | `aspect-ratio` | `AspectRatio` | `layout.tsx` + `layout-actions-display.css` |

### Utilities

| Family | Directory aliases | Public exports | Source backing |
|---|---|---|---|
| `focus` | `focus-visible` | None (foundation artifact) | `layout-actions-display.css` |
| `focus-trap` | `focus-trap` | `FocusTrap` | `layout.tsx` + `layout-actions-display.css` |
| `visually-hidden` | `visually-hidden` | `VisuallyHidden` | `layout.tsx` + `layout-actions-display.css` |
| `drag` | `drag-drop` | `DragDrop` | `data-extra.tsx` + `extended.css` |
| `sortable` | `sortable` | `SortableList` | `data-extra.tsx` + `extended.css` |
| `keyboard` | `keyboard-shortcut` | `KeyboardShortcut` | `layout.tsx` + `layout-actions-display.css` |
| `clipboard` | `clipboard` | `ClipboardButton` | `actions.tsx` + `layout-actions-display.css` |
| `overflow` | `text-truncation` | `OverflowText`, `ExpandableText` | `overlays.tsx` + `styles.css` + `data-extra.tsx` + `extended.css` |
| `portal` | `portal` | `Portal` | `layout.tsx` + `layout-actions-display.css` |

### Actions

| Family | Directory aliases | Public exports | Source backing |
|---|---|---|---|
| `button` | `button` | `Button` | `primitives.tsx` + `styles.css` |
| `link` | `link` | `Link` | `actions.tsx` + `layout-actions-display.css` |
| `icon-button` | `icon-button` | `IconButton` | `primitives.tsx` + `styles.css` |
| `button-group` | `button-group` | `ButtonGroup` | `actions.tsx` + `layout-actions-display.css` |
| `split-button` | `split-button` | `SplitButton` | `actions.tsx` + `layout-actions-display.css` |
| `toggle-button` | `toggle-button` | `ToggleButton` | `actions.tsx` + `layout-actions-display.css` |
| `toolbar` | `toolbar-filter-bar` | `Toolbar` | `actions.tsx` + `layout-actions-display.css` |
| `filter-bar` | `filter-bar` | `FilterBar` | `actions.tsx` + `layout-actions-display.css` |

### Inputs

| Family | Directory aliases | Public exports | Source backing |
|---|---|---|---|
| `form` | `form` | `Form` | `inputs-extra.tsx` + `inputs-extra.css` |
| `field` | `field` | `Field` | `forms.tsx` + `styles.css` |
| `text-input` | `text-input` | `Input`, `PasswordInput` | `forms.tsx` + `styles.css` |
| `search-input` | `search-input` | `SearchInput` | `forms.tsx` + `styles.css` |
| `textarea` | `textarea` | `Textarea` | `forms.tsx` + `styles.css` |
| `number` | `number-input` | `NumberInput` | `inputs-extra.tsx` + `inputs-extra.css` |
| `otp` | `otp-input` | `OtpInput` | `inputs-extra.tsx` + `inputs-extra.css` |
| `upload` | `file-upload` | `FileUpload` | `inputs-extra.tsx` + `inputs-extra.css` |
| `rich-text` | `rich-text-editor` | `RichTextEditor` | `inputs-extra.tsx` + `inputs-extra.css` |
| `code-editor` | `code-editor` | `CodeEditor` | `inputs-extra.tsx` + `inputs-extra.css` |
| `inline-edit` | `inline-edit` | `InlineEdit` | `inputs-extra.tsx` + `inputs-extra.css` |

### Selection

| Family | Directory aliases | Public exports | Source backing |
|---|---|---|---|
| `checkbox` | `checkbox` | `Checkbox` | `forms.tsx` + `styles.css` |
| `radio` | `radio` | `Radio` | `forms.tsx` + `styles.css` |
| `switch` | `switch` | `Switch` | `forms.tsx` + `styles.css` |
| `segmented` | `segmented-control` | `SegmentedControl` | `forms.tsx` + `styles.css` |
| `select` | `select`, `searchable-select`, `async-select` | `Select`, `SearchableSelect`, `AsyncSelect` | `forms.tsx` + `floating-position.ts` + `styles.css` + `inputs-extra.tsx` + `inputs-extra.css` |
| `combobox` | `combobox`, `autocomplete` | `Combobox`, `Autocomplete` | `forms.tsx` + `floating-position.ts` + `styles.css` + `inputs-extra.tsx` + `inputs-extra.css` |
| `multi-select` | `multi-select` | `MultiSelect` | `inputs-extra.tsx` + `floating-position.ts` + `inputs-extra.css` |
| `tag-input` | `tag-input` | `TagInput` | `inputs-extra.tsx` + `floating-position.ts` + `inputs-extra.css` |
| `cascader` | `cascader` | `Cascader` | `inputs-extra.tsx` + `inputs-extra.css` |
| `tree-select` | `tree-select` | `TreeSelect` | `inputs-extra.tsx` + `floating-position.ts` + `inputs-extra.css` |
| `transfer` | `transfer` | `Transfer` | `inputs-extra.tsx` + `inputs-extra.css` |

### Value And Date

| Family | Directory aliases | Public exports | Source backing |
|---|---|---|---|
| `slider` | `slider` | `Slider` | `value-controls.tsx` + `inputs-extra.css` |
| `rating` | `rating` | `Rating` | `value-controls.tsx` + `inputs-extra.css` |
| `color-picker` | `color-picker` | `ColorPicker` | `value-controls.tsx` + `inputs-extra.css` |
| `date-time` | `date-time-picker` | `DateField`, `DateRangeField`, `TimezoneSelect`, `DEFAULT_TIMEZONE_OPTIONS` | `date-field.tsx` + `styles.css` + `value-controls.tsx` + `inputs-extra.css` |

### Navigation

| Family | Directory aliases | Public exports | Source backing |
|---|---|---|---|
| `app-navigation` | `top-nav`, `side-nav`, `bottom-nav` | `AppNavigation`, `TopNavigation`, `SideNavigation`, `BottomNavigation` | `navigation-extra.tsx` + `extended.css` |
| `breadcrumb` | `breadcrumb` | `Breadcrumbs` | `navigation.tsx` + `styles.css` |
| `tabs` | `tabs` | `Tabs` | `navigation.tsx` + `styles.css` |
| `menu` | `menu`, `dropdown-menu`, `context-menu` | `Menu`, `DropdownMenu`, `ContextMenu` | `navigation-extra.tsx` + `extended.css` + `overlays.tsx` + `floating-position.ts` + `styles.css` + `overlays-extra.tsx` |
| `pagination` | `pagination` | `Pagination` | `navigation.tsx` + `styles.css` |
| `load-more` | `load-more` | `LoadMore` | `navigation-extra.tsx` + `extended.css` |
| `infinite-scroll` | `infinite-scroll` | `InfiniteScroll` | `navigation-extra.tsx` + `extended.css` |
| `stepper` | `stepper` | `Stepper` | `navigation-extra.tsx` + `extended.css` |
| `command` | `command-palette` | `CommandPalette`, `useCommandPaletteShortcut` | `navigation-extra.tsx` + `extended.css` |
| `anchor` | `anchor-nav` | `AnchorNavigation` | `navigation-extra.tsx` + `extended.css` |

### Display

| Family | Directory aliases | Public exports | Source backing |
|---|---|---|---|
| `list` | `list`, `virtual-list` | `List`, `VirtualList` | `display.tsx` + `layout-actions-display.css` + `data-extra.tsx` + `extended.css` |
| `description` | `description-list` | `DescriptionList` | `display.tsx` + `layout-actions-display.css` |
| `card` | `card` | `Card` | `display.tsx` + `layout-actions-display.css` |
| `tree` | `tree` | `Tree` | `data-extra.tsx` + `extended.css` |
| `accordion` | `accordion` | `Accordion` | `display.tsx` + `layout-actions-display.css` |
| `timeline` | `timeline` | `Timeline` | `display.tsx` + `layout-actions-display.css` |
| `calendar` | `calendar` | `Calendar` | `data-extra.tsx` + `extended.css` |
| `scheduler` | `scheduler` | `Scheduler` | `data-extra.tsx` + `extended.css` |
| `statistic` | `statistic` | `Statistic` | `display.tsx` + `layout-actions-display.css` |
| `chart` | `chart` | `BarChart` | `data-extra.tsx` + `extended.css` |
| `code-block` | `code-block` | `CodeBlock` | `display.tsx` + `layout-actions-display.css` |
| `meter` | `meter` | `Meter` | `display.tsx` + `layout-actions-display.css` |

### Identity

| Family | Directory aliases | Public exports | Source backing |
|---|---|---|---|
| `avatar` | `avatar` | `Avatar`, `AvatarGroup` | `display.tsx` + `layout-actions-display.css` |
| `tag` | `tag` | `Tag` | `primitives.tsx` + `styles.css` |
| `badge` | `badge` | `Badge` | `display.tsx` + `layout-actions-display.css` |
| `status` | `status` | `StatusIndicator` | `display.tsx` + `layout-actions-display.css` |

### Content

| Family | Directory aliases | Public exports | Source backing |
|---|---|---|---|
| `media` | `media` | `Media` | `display.tsx` + `layout-actions-display.css` |
| `attachment` | `attachment` | `Attachment` | `display.tsx` + `layout-actions-display.css` |
| `gallery` | `gallery` | `Gallery` | `display.tsx` + `layout-actions-display.css` |
| `carousel` | `carousel` | `Carousel` | `data-extra.tsx` + `extended.css` |

### Data Table

| Family | Directory aliases | Public exports | Source backing |
|---|---|---|---|
| `data-table` | `data-table`, `tree-table` | `DataTable`, `TreeTable` | `data-table.tsx` + `styles.css` + `data-extra.tsx` + `extended.css` |

### Feedback

| Family | Directory aliases | Public exports | Source backing |
|---|---|---|---|
| `inline-message` | `inline-message` | `InlineMessage` | `feedback-extra.tsx` + `extended.css` |
| `alert` | `alert` | `Alert` | `feedback.tsx` + `styles.css` |
| `banner` | `banner` | `Banner` | `feedback-extra.tsx` + `extended.css` |
| `toast` | `toast-snackbar` | `ToastProvider`, `useToast` | `feedback.tsx` + `styles.css` |
| `spinner` | `spinner` | `Spinner` | `primitives.tsx` + `styles.css` |
| `progress` | `progress` | `Progress`, `ProgressRing` | `feedback.tsx` + `styles.css` + `feedback-extra.tsx` + `extended.css` |
| `skeleton` | `skeleton` | `Skeleton` | `primitives.tsx` + `styles.css` |
| `result` | `empty-state`, `error-state` | `EmptyState`, `ErrorState`, `NoResults`, `RetryButton`, `AsyncAction` | `feedback.tsx` + `styles.css` + `feedback-extra.tsx` + `extended.css` |
| `validation-summary` | `validation-summary` | `ValidationSummary` | `feedback-extra.tsx` + `extended.css` |

### Overlays

| Family | Directory aliases | Public exports | Source backing |
|---|---|---|---|
| `tooltip` | `tooltip` | `Tooltip` | `overlays.tsx` + `styles.css` |
| `popover` | `popover` | `Popover` | `overlays-extra.tsx` + `floating-position.ts` + `extended.css` |
| `hover-card` | `hover-card` | `HoverCard` | `overlays-extra.tsx` + `floating-position.ts` + `extended.css` |
| `dialog` | `dialog`, `confirm-dialog` | `Dialog`, `ConfirmDialog` | `overlays.tsx` + `styles.css` + `overlays-extra.tsx` + `extended.css` |
| `popconfirm` | `popconfirm` | `Popconfirm` | `overlays-extra.tsx` + `floating-position.ts` + `extended.css` |
| `drawer` | `drawer-sheet` | `Drawer` | `overlays.tsx` + `styles.css` |
| `lightbox` | `lightbox` | `Lightbox` | `overlays-extra.tsx` + `extended.css` |
| `tour` | `guided-tour` | `GuidedTour` | `overlays-extra.tsx` + `extended.css` |

### Page Patterns

| Family | Directory aliases | Public exports | Source backing |
|---|---|---|---|
| `authentication` | `authentication` | `AuthenticationPage`, `FamilyLoginPage` | `standard-pages.tsx` + `extended.css` + `family-login-page.tsx` + `styles.css` |
| `list-filter` | `list-management`, `search-filter-page` | `PageHeading`, `ListManagementPage`, `SearchFilterPage`, `MemberManagementPage` | `standard-pages.tsx` + `extended.css` + `member-management-page.tsx` + `styles.css` |
| `create-edit` | `create-edit-page` | `CreateEditPage` | `standard-pages.tsx` + `extended.css` |
| `detail` | `detail-page` | `DetailPage` | `standard-pages.tsx` + `extended.css` |
| `settings` | `settings-page` | `SettingsPage` | `standard-pages.tsx` + `extended.css` |
| `wizard` | `wizard-flow` | `WizardFlow` | `standard-pages.tsx` + `extended.css` |
| `master-detail` | `master-detail` | `MasterDetail` | `standard-pages.tsx` + `extended.css` |
| `import-export` | `import-export-page` | `ImportExportPage` | `standard-pages.tsx` + `extended.css` |
| `status-page` | `empty-error-page` | `StatusPage` | `standard-pages.tsx` + `extended.css` |

## Selection And Form Contracts

- Use `Select` for compact options, `SearchableSelect` or `Combobox` for local searchable data, `AsyncSelect` for remote results, and `Autocomplete` when free text plus suggestions is intentional. Use `MultiSelect`, `TagInput`, `Cascader`, `TreeSelect`, or `Transfer` for their explicit selection models instead of adapting a native select.
- Searchable selectors, `Autocomplete`, `TagInput` suggestions, `TreeSelect`, and `DropdownMenu` render their open surfaces outside scroll-clipped Dialog content. Keep the bundled trigger and surface wiring intact; the component handles modal focus, viewport bounds, option scrolling, and nested modal stacking.
- `AsyncSelect` retains the label of an option chosen from earlier remote results when the current response changes. For a controlled value set before its option is fetched, provide a matching `selectedOption` so the trigger can show that value. `MultiSelect` currently requires every selected value to exist in its complete `options` collection; it is not a server-paged multi-select.
- `Input`, `PasswordInput`, `SearchInput`, and `Textarea` own their adornment geometry. `SearchInput` renders its own search and clear actions. Do not add another clear button outside it.
- `NumberInput` owns one pair of visible step buttons and hides the browser's native stepper without removing number-input keyboard semantics. Wrap it in `Field` or pass `ariaLabel` so each step button names its field; an empty value steps first to `min` or `max` when defined. Keep its end slot free of unrelated adornments.
- `Field` owns labels, required state, hints, errors, and grouped choice semantics. `Form` is the public form root. The verifier rejects an application-owned native form.
- Every option, tab, menu item, product, table column, tree node, and row uses a stable, unique business identity. Do not use array positions or values generated during render.
- `DateField` covers year, month, day, minute, second, time, and time-with-seconds precision. `DateRangeField` owns ranges; `TimezoneSelect` owns timezone choice.
- `Tag` is a stable capsule label: selected state changes style, not geometry. Use `Badge` for a compact count/indicator and `StatusIndicator` for status semantics.

## Async And Data Contracts

- Commands that wait for data use the component's `loading` or pending API. `AsyncAction` and `RetryButton` cover reusable async commands; do not replace button content manually and cause width changes.
- Server-backed filters edit draft values. The explicit query button or Enter applies them; sorting and pagination are explicit requests. Preserve the last successful data while a later request is pending or fails.
- `DataTable` owns desktop columns, sorting, loading skeletons, empty/error states, developer-pinned and hidden columns, and mobile row rendering. Omit `pagination` for an unpaginated 12px rounded surface; pass the typed `pagination` configuration to render the bundled pager within the same rounded frame. Rows are still provided by the caller, so this does not change server/client paging. Pass the requested page size as `loadingRows` so its surface remains stable.
- `DataTable` fills its containing width. `minWidth` is a flexible lower bound; give compact status, date, numeric, and action columns explicit `width` values, leaving only genuinely long text columns flexible. Keep action columns wide enough for icon-button focus outlines.
- Use `ListManagementPage` or `SearchFilterPage` for ordinary lists: their default readable width keeps the heading, filters, and table aligned. `layoutWidth="wide"` is for a dense table that benefits from the full viewport. `MemberManagementPage` has the same readable-width behavior built in. Keep `ListManagementPage.footer` for non-table actions rather than a second pager.
- `VirtualList` is for large flat collections; `Tree` and `TreeTable` own hierarchical data. `LoadMore` and `InfiniteScroll` are distinct fetch models and should not be combined on one surface.
- Use `OverflowText` for a tooltip only when text is actually truncated. Use `ExpandableText` when the user should deliberately reveal longer content.

## Navigation, Feedback, And Overlay Contracts

- `Pagination` owns page, previous, next, page-size, and per-target loading geometry. `Tabs`, navigation variants, menus, steppers, commands, and anchors keep selection/focus state in their public APIs.
- `ToastProvider` and `useToast` support top-center, top-right, and bottom-right placement, rounded or pill shape, optional close, optional countdown, and async actions. A persistent toast must retain a dismissal path.
- `Alert`, `InlineMessage`, `Banner`, and `ValidationSummary` have different scopes. Use result components for empty, error, and no-results states rather than restyling alerts into page placeholders.
- `Tooltip`, `Popover`, `HoverCard`, `Dialog`, `Drawer`, `ConfirmDialog`, `Popconfirm`, `ContextMenu`, `Lightbox`, and `GuidedTour` own their focus, dismissal, and positioning behavior. Do not reproduce an overlay with application event handlers.
- A confirmation without additional content has no Dialog body band. For an async destructive action, `ConfirmDialog` focuses Cancel first and reserves its body for a failed request; the close control remains keyboard reachable, not the initial focus target.
- `Dialog` provides 16px spacing between direct body children. Keep related form fields in one content group and separate action rows from fields; use the 420px `small` width for confirmation and the 520px default for multi-field forms. A nested async confirmation uses `ConfirmDialog`, the same visual and focus contract as a standalone confirmation.
- `Drawer` defaults to an inset rounded desktop panel and rounded-top mobile sheet. Use `variant="edge"` only for a deliberately flush rail.

## Page Pattern Contracts

- `FamilyLoginPage` keeps one company form implementation while product visual, accent, name, and supporting copy vary. `AuthenticationPage` is the general authentication shell.
- `MemberManagementPage` is the complete server-data reference for draft filtering, explicit query, request cancellation, sorting, pagination, retained-data errors, retry, and mobile rendering.
- Use `ListManagementPage`, `SearchFilterPage`, `CreateEditPage`, `DetailPage`, `SettingsPage`, `WizardFlow`, `MasterDetail`, `ImportExportPage`, and `StatusPage` as the owning shells for those workflows. Customize their documented slots and callbacks; do not copy their markup into a local page variant.

When a requested family or behavior is absent from this inventory, follow the canonical extension workflow in [integration](integration.md). Do not create a target-local substitute.
