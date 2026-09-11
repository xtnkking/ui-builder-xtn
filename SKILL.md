---
name: ui-builder-xtn
description: Build or revise React and TypeScript product interfaces by installing and composing the bundled Personal UI source components and page patterns. Use for login, forms, CRUD, searchable data lists, tables, feedback, overlays, and operational pages that should follow this personal design system; do not use for backend-only work or a product that must preserve another established UI system.
---

# UI Builder XTN

Build the requested feature from the bundled source code. Do not treat this Skill as a prose style guide and do not redraw an equivalent button, field, tag, toast, drawer, table, or login shell in local page CSS when the source kit already provides it.

## Start From Source

The canonical output source is `assets/react-kit/src/personal-ui/`. Treat it as code to copy and import, not as instructions to paraphrase. Never use the old monolithic preview HTML as application source.

1. Inspect the target project's framework, package manager, source root, aliases, existing design system, and tests.
2. Read [integration](references/integration.md) before installing into a project. Run `scripts/install_personal_ui.py` for a new starter or an existing React project.
3. Read [component catalog](references/component-catalog.md) only for the component families needed by the request.
4. Before composing the page, write down the exact public exports that own its requested controls. Compose the feature from those exports in `src/personal-ui/index.ts`. Prefer an included pattern when it matches the workflow, then customize content, product imagery, columns, and callbacks through props.
5. Put product-specific composition in the application. Put a missing reusable control or behavior in `src/personal-ui/` first and consume it from there; do not create a one-page lookalike.

## Fixed Implementation Contract

- Default stack for a new app: React, TypeScript, Vite, `lucide-react`, and the bundled CSS tokens. Do not add another component library or Tailwind merely to recreate existing controls.
- Keep control geometry and states owned by `personal-ui/styles.css`. Customize brands through the documented tokens, props, and visual slots instead of copying component selectors into page CSS.
- Application CSS must not select `.pui-*` classes. Add a reusable prop or token to the source component when a supported variation is missing, then consume that API from the page.
- Use Lucide icons through component props. Do not hand-author interface SVG paths.
- Treat option, tab, menu-item, product, table-column, and table-row identities as data contracts. Values and IDs must be stable, unique, and non-empty within their owning collection unless the component explicitly documents a single empty form value. The bundled components fail fast on ambiguous identities; never silence that error with array indexes or generated-on-render keys.
- Use `Select` for compact option sets and `Combobox` for searchable or large datasets. Both are bundled popover controls; do not substitute a raw HTML `select`, a browser-native popup, or a command menu. Use `placement="top"` where pagination or a viewport edge leaves no room below.
- Use `SearchInput` as the single owner of its search and clear adornments. Do not add a second page-level clear icon, and keep desktop query fields within the provided toolbar width instead of stretching across all remaining space.
- Every async command uses the bundled loading API so its dimensions remain stable and duplicate submissions are blocked. This includes buttons, sortable table headers, retries, and pagination targets.
- Search and filter fields on server-backed data pages edit a draft only. Fetch on the explicit query button or Enter; pagination and sorting are explicit requests. Preserve the last successful rows when a later request fails.
- Pinned and hidden table columns are developer configuration. Do not expose freeze-column controls to end users unless the product explicitly asks for them.
- Keep data-table column widths, row heights, table height, and pagination placement stable while a request is loading. Pass the target row count to `loadingRows` whenever the requested page size is not the default.
- Use the default inset `Drawer` for product workflows: it is a rounded desktop panel and a rounded-top mobile sheet. Use `variant="edge"` only when the product explicitly requires a flush full-height rail.
- A product-family login keeps one company identity and one form implementation. Product identity changes through the left visual, accent, name, and supporting copy; do not fork the form markup per product.
- Keep mobile behavior functional down to 320px. Use the provided mobile table renderer, drawer layout, overflow tooltip, and compact pagination instead of shrinking text.
- Treat wide-screen geometry as part of component correctness. Fixed table columns and input adornment slots must not stretch or drift when their container grows; product-family accents must reach every interactive control within the login surface.

## Verification

Run the target project's typecheck/build and its existing tests. Exercise the requested workflow, including loading, success, empty, error, retry, and validation states where applicable. For user-facing pages, inspect at 2560px, 1440px, 1024px, 736px, 360px, and 320px; verify no excessive outer whitespace, stretched fixed columns, drifting adornments, overlap, clipped text, page-level horizontal overflow, or control resizing during loading.

Before handoff, run the verifier with one `--require-component` argument for every public component or pattern the feature promises. For an included pattern, require the pattern export itself; for a page composed directly, require each requested control such as `SearchInput`, `Select`, `Button`, `DataTable`, or `Drawer`. Do not mount an unused component merely to satisfy this check.

```powershell
python scripts/verify_personal_ui.py --target <project-path> --require-component SearchInput --require-component Button --require-component DataTable --require-component Drawer
```

The command must report every required export in `usedComponents`, no entry in `missingRequiredComponents`, no managed-source drift, and the same installed and bundled version. This is a release gate, not an optional diagnostic.

When the requested feature deliberately adds or changes reusable source inside `src/personal-ui`, run the verifier with `--allow-local-extensions` and report every warned path. This flag never permits missing bundled files or other integrity failures.

Report which bundled components and patterns were used, any deliberate extension added to `src/personal-ui/`, and the verification commands that actually passed.
