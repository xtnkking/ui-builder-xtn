---
name: ui-builder-xtn
description: Build or revise React and TypeScript product interfaces by installing and composing the bundled ui-builder-xtn source components and page patterns. Use for login, forms, CRUD, searchable data lists, tables, feedback, overlays, and operational pages that should follow this personal design system; do not use for backend-only work or a product that must preserve another established UI system.
license: MIT
---

# ui-builder-xtn

Build the requested interface from the bundled ui-builder-xtn implementation. This is an enforced source kit, not a prose style guide: every control, feedback surface, navigation control, overlay, data renderer, and bundled page pattern must be a registered public export with real React source in this Skill.

## Start here

1. Inspect the target framework, package manager, source root, aliases, existing UI system, and tests. An explicit request to use this Skill chooses ui-builder-xtn for the inspected application surface; do not mix component systems.
2. Read the [integration guide](references/integration.md), then use `scripts/install_ui.py` in `starter` or `integrate` mode. Never copy isolated snippets or use an archived HTML preview as application source.
3. Find the needed family in the generated [component catalog](references/component-catalog.md), then read its exact Props, defaults, behavior, example, and migration notes in the generated [component API](references/component-api.md). Inspect the matching runnable Explorer route when appearance or interaction matters.
4. Import runtime components and patterns only from the installed `src/ui/index.ts` barrel, normally through `./ui` or its project alias. Compose business data, callbacks, copy, product media, approved tokens, and non-interactive layout around those exports.
5. Run the target build, relevant tests, and `python scripts/verify_ui.py --target <project-path>` before handoff. Check the browser deployment directory with `python scripts/check_consumer_output.py --output <public-output-path>` for direct project branding and source maps. Report the public exports used and any canonical capability added.

## Enforced ownership

The canonical implementation is `assets/react-kit/src/ui/`; `assets/react-kit/component-manifest.json` binds every family, runtime export, source file, alias, and ownership marker. The installer copies that versioned source into the target, owns its fixed `verify:ui` command, and prefixes that command directly to the existing `build` script while preserving an unrelated caller-owned `prebuild`.

- Do not recreate a registered control with native interactive markup, application CSS, a local wrapper, copied source, or a third-party JSX component. Do not deep-import implementation files.
- Do not style protected controls through `.ui-*`, `data-ui-*`, generic control selectors, CSS-in-JS, runtime CSS/DOM mutation, external global styles, or JSX `<style>`.
- Protected public components must not receive application `className`, `style`, `css`, `sx`, `tw`, `ref`, or `cloneElement` overrides, including through property spreads. Use a surrounding layout element, a documented token, or a canonical typed prop.
- Use public props and pass both TypeScript and provenance checks. Typed JSX spreads must resolve to safe public properties; unknown/opaque objects and protected overrides fail closed. Use the official `controllerField` adapter for form-library fields; see the supported syntax and compiler requirements in [supported usage](references/integration.md#supported-public-usage).
- Use Lucide icons through component props. Keep option, tab, menu-item, product, table-column, and row identities stable, unique, and non-empty within their owner.
- Keep business copy and machine values consumer-owned. Built-in fallback and ARIA text use the locale contract; product data must not be silently translated or reformatted for submission.
- Give each business action, result total, and update status one visible owner per data scope. Page patterns already own their heading: compose their slots, never nest complete page patterns or add a second page heading. Do not fill optional descriptions or English eyebrows without a product need. Follow the concrete [page composition rules and example](references/page-patterns.md#page-composition-ownership); source verification alone cannot detect business-semantic duplication.
- Use official Toast for action results such as save, delete, copy, export, login, confirmation, and recoverable request success/failure so feedback does not push the page layout. The bundled login, confirmation, Banner, storefront and continuous-loading examples follow this default. Keep field validation and necessary recovery controls in their relevant context. Respect component-owned feedback rather than adding a second notification for the same failure; see the [feedback selection rules and code](references/toast-contract.md#feedback-selection).
- For table request failures, set `DataTable state="error"` and use its `errorTitle`, `errorDescription`, `onRetry`, and `retrying` props. The table owns one automatic Toast per failure episode plus a short persistent in-frame status/retry; do not add an above-table Alert, another ErrorState, or a manual Toast for that same failure. Use one shared `ToastProvider` for an application; DataTable, FamilyLoginPage, ConfirmDialog, Popconfirm and Banner reuse it and supply an internal fallback for standalone use. Alert remains available when explicitly requested for an inline message; do not automatically add it to these workflows.
- Keep consumer applications free of Skill/repository promotion: use the neutral consumer starter, never copy the Explorer, demo code, repository links, attribution UI, generator metadata or development paths into a product. Set product titles and branding from the user's business requirements. Keep source maps private in production; retain required legal notices outside rendered UI. Internal component names and styles are not a guarantee that implementation origin cannot be inferred.

If a requested capability has no registered public export, stop that part of page composition. Add the reusable source and styles to the canonical kit, export it from the public barrel, register it in the Manifest and docs metadata, add a compiled Explorer case and focused tests, refresh integrity/API/coverage artifacts, and only then reinstall it. Never patch an installed `src/ui/` as a local extension or bypass the verifier.

## Read by task

- Installation, integration, source checks, and field-aligned controls: [integration guide](references/integration.md).
- Brand colors, Apple-inspired and Material presets, solid/glass surfaces, nested themes and overlay inheritance: [theme contract](references/theme-contract.md). Use the official `ThemeProvider` options and color tokens; preview at `#/themes`. Preserve the default theme unless the product requests another style.
- Default entry/exit, interrupted reopening, dynamic Collapse height, Tabs/SegmentedControl indicators, Carousel/Lightbox content switching, and system reduced-motion behavior: [motion contract](references/motion-contract.md). Reuse component-owned motion without application animation wrappers or CSS; preview at `#/components/motion`.
- Native/composite submission, validation, reset, external forms, and React Hook Form: [form contract](references/form-contract.md).
- Search, async options, explicit queries, loading, tables, sorting, pinning, height, and pagination: [data workflow contract](references/data-workflows.md).
- Keyboard file selection with drag-and-drop, and manual loading with infinite scrolling: [file and loading workflows](references/data-workflows.md#official-file-and-continuous-loading-compositions). DragDrop and InfiniteScroll own their keyboard command by default; disable that command explicitly when the documented companion control owns it.
- Dialog, Drawer custom width/fullscreen, ConfirmDialog, nested layers, dismissal, focus, Portal, and scroll lock: [overlay contract](references/overlay-contract.md). Drawer supports preset widths, positive pixel numbers and px/%/vw values plus `fullScreen`; use these public props for wider workspaces.
- Feedback selection (prefer Toast for transient outcomes), concrete action composition, visibility limits, queueing, deduplication, dismissal, duration, progress and seconds display: [toast contract](references/toast-contract.md).
- Login, CRUD/list, create/edit, detail, settings, wizard, import/export, and status shells: [page pattern routing](references/page-patterns.md).
- One complete storefront project with home, catalog, product details, favorites, cart, checkout, login/registration, account, addresses and customer orders: [business examples](references/business-examples.md). Reuse its shared business state and public-component composition after installation; replace mock services and use your product branding and router. Do not copy the Explorer shell into a product.
- Built-in text, `zh-CN`/`en-US`, nested providers, Portal inheritance, SSR, dates, numbers, and plurals: [locale contract](references/locale-contract.md).
- Public API changes and upgrade action: [v0.3.0 migrations](references/v0.3.0-migrations.md).
- Canonical source and generated-copy policy: [source authority](references/source-authority.md).
- Official project naming and neutral consumer identifiers: [naming contract](references/naming-contract.md).

## Completion contract

Use bundled loading APIs for every asynchronous command so dimensions remain stable and duplicate actions are blocked. Server-backed filters edit draft state and fetch only on explicit submit or Enter; sorting and pagination are explicit requests. Preserve the last successful data when a later request fails.

Exercise applicable loading, success, empty, error, retry, validation, long-content, keyboard, overlay, locale, and mobile states. Keep behavior functional at 320px and inspect relevant wider layouts for stretching, adornment drift, overlap, clipping, overflow, and loading resize. Use component-owned responsive table, Drawer, tooltip, and pagination behavior rather than shrinking type or patching geometry.

For maintenance of this Skill's own component platform, documentation, installer, or release system, first read the [v0.3.0 hardening roadmap](references/v0.3.0-roadmap.md). Preserve milestone scope and evidence; do not upgrade, synchronize generated copies, tag, or publish merely because one milestone passed. Run focused checks while iterating and the milestone gate once at its boundary.
