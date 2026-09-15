---
name: ui-builder-xtn
description: Build or revise React and TypeScript product interfaces by installing and composing the bundled Personal UI source components and page patterns. Use for login, forms, CRUD, searchable data lists, tables, feedback, overlays, and operational pages that should follow this personal design system; do not use for backend-only work or a product that must preserve another established UI system.
---

# UI Builder XTN

Build the requested feature from the bundled Personal UI implementation. This Skill is a source kit with an enforced ownership contract, not a prose style guide: every control, feedback surface, navigation control, overlay, data renderer, and bundled page pattern used in the result must come from a registered public export with real React source in this Skill.

## Use The Bundled Source

The canonical implementation lives in `assets/react-kit/src/personal-ui/`. Its manifest covers 118 families, 139 runtime exports (136 visual components or patterns and 3 explicitly classified non-visual hooks/constants), and 130 discovery aliases. The installer copies that versioned source into the target project; application code then composes it through the installed public barrel. Never use the archived monolithic preview HTML as application source.

The archived `personal-ui-library-preview.html` is a historical design reference, not a live render of the installed kit. Use the runnable React example in `assets/react-kit` to inspect current component appearance; when a visual difference is reported, reconcile it in canonical source, add a representative browser regression, and then reinstall the versioned kit. Do not patch a consumer page to imitate the old HTML.

1. Inspect the target framework, package manager, source root, aliases, existing design system, and tests. An explicit request to use this Skill chooses Personal UI for the inspected application source; do not mix it with another UI component system.
2. Read [integration](references/integration.md), then run `scripts/install_personal_ui.py` in `starter` or `integrate` mode. Do not manually copy isolated snippets.
3. Read [component catalog](references/component-catalog.md) only for the families needed by the request. Confirm that every requested UI capability maps to a `component-manifest.json` entry and at least one public runtime export.
4. Import runtime components and patterns only from `src/personal-ui/index.ts`, normally through `./personal-ui` or the project's alias to that directory. Deep imports into implementation files are forbidden.
5. Put only business data, callbacks, copy, product imagery, documented token overrides, and non-interactive page composition in application code. Do not recreate a Personal UI control with native interactive markup, application CSS, a local wrapper, copied source, or a third-party JSX component.

The installer owns the target's `verify:personal-ui` command and appends that command to the npm `prebuild` lifecycle while preserving an existing prebuild command. Do not remove, rename, weaken, or bypass either script. A normal `npm run build` must fail before compilation when application provenance or managed source integrity fails.

## Missing Capability Gate

A missing export is a blocked library capability, not permission to improvise in the target project.

1. Stop page composition for that capability.
2. Add the reusable implementation and styles to the canonical `assets/react-kit/src/personal-ui/` source, with its source ownership marker and representative states.
3. Export it from the canonical public barrel, register the runtime export, and bind its family, source files, aliases, and ownership marker in `assets/react-kit/component-manifest.json`.
4. Add or update tests and the relevant gallery/example, synchronize all kit version declarations, and increment the kit version.
5. Run `scripts/update_component_manifest_integrity.py`, validate the manifest, typecheck/build the source kit, reinstall that released source into the target, and only then compose the requested feature from the barrel export.

Never edit the installed target `src/personal-ui/` as a local extension. There is no local-extension exception or verifier bypass. If the task does not authorize or permit a canonical addition, report the missing capability instead of shipping a lookalike.

## Fixed Implementation Contract

- Default stack for a new app: React, TypeScript, Vite, `lucide-react`, and the bundled CSS tokens. Do not add another component library or Tailwind to recreate controls.
- Keep control geometry and states owned by `personal-ui/styles.css`. Application CSS must not select `.pui-*` classes, reserved `data-pui-*` ownership markers, or generic protected controls such as `input`, `[type="password"]`, and `button`; safe global `box-sizing`/inherited-font resets remain allowed. Do not inject JSX `<style>`, remote/package-global styles, CSS-in-JS wrappers, protected-selector preprocessor mixins, or runtime DOM/CSSOM styles. Protected Personal UI components must not receive application `className`, `style`, `css`, `sx`, `tw`, `ref`, or spread props through JSX, factories, runtime JSX calls, aliases, or `cloneElement`. Use a surrounding layout element, a manifest-classified layout utility, or a documented token instead, and add a canonical prop or token when a reusable variation is missing.
- Do not use `eval`, `Function`, computed element factories, runtime HTML insertion, direct DOM event properties, or dynamic role/attribute mutation to construct interface controls outside React provenance.
- Use Lucide icons through component props. Do not hand-author interface SVG paths.
- Treat option, tab, menu-item, product, table-column, and table-row identities as data contracts. Values and IDs must be stable, unique, and non-empty within their owning collection unless the component explicitly documents one empty form value.
- Use `Select` for compact option sets and `Combobox`, `SearchableSelect`, or `AsyncSelect` for searchable or large datasets according to their public APIs. Do not substitute a raw HTML `select`, native popup, or locally built command menu.
- Use `SearchInput` as the single owner of search and clear adornments. Do not add a second page-level clear icon; keep desktop query fields within the provided toolbar width.
- Compose `Dialog` with no body content for confirmation-only flows; use `ConfirmDialog` when an async confirm and error state are needed. Do not set initial focus on the close icon; preserve the visible keyboard focus state. Place bundled searchable selectors, tag suggestions, tree selectors, and menus directly inside Dialog or Drawer bodies when needed; their registered viewport-positioned surfaces handle clipping, modal focus, and nested overlay order without a custom overflow workaround.
- Set `closeOnBackdropClick={false}` on each `Dialog`, `Drawer`, or `ConfirmDialog` instance that must ignore backdrop clicks, including adjacent and nested modals; verify this still holds after Escape and reopening. The close icon and Escape remain active. The default remains `true`; `closable={false}` on `Dialog`/`Drawer` is the separate fully non-dismissible mode. Keep an explicit Cancel or Save path for editing forms.
- Keep `Dialog` content in coherent field and action groups. Its body gives direct children 16px spacing; confirmation uses the compact 420px variant, while multi-field workflows may use the 520px default. Nested confirmations must use the same `ConfirmDialog` visual contract as standalone ones.
- Every async command uses the bundled loading API so dimensions stay stable and duplicate submissions are blocked. This includes query, retry, sort, and pagination actions.
- Search and filter fields on server-backed pages edit draft state. Fetch on the explicit query button or Enter; pagination and sorting are explicit requests. Preserve the last successful rows when a later request fails.
- Pinned and hidden table columns are developer configuration. Do not expose freeze-column controls unless the product explicitly requests them.
- Keep table column widths, row heights, table height, and pagination placement stable while loading. `loadingRows` controls skeleton count only; it is not a table-height setting.
- For ordinary lists, place `DataTable` inside `ListManagementPage` or `SearchFilterPage`. Pass its typed `pagination` prop for a single rounded table-and-pager surface; paginated tables use a fixed viewport sized from five standard row-height units by default, so sparse results and page-size changes do not move the pager. Keep that pagination prop present for loading, empty, and zero-row error states so the fixed frame does not collapse. Use `viewportRows` to choose another fixed standard-row-height capacity, use `viewportRows="auto"` only when a paginated table should follow content height, and pass a numeric `viewportRows` to opt an unpaginated table into a fixed scrolling viewport. Custom cells may be taller and scroll within that fixed surface; do not clip them to force an exact visible-row count. Every actually scrollable surface is a named keyboard tab stop. A fixed viewport resets only its vertical position when a new request, page, page size, or row identity sequence arrives. Omit `pagination` only for a genuinely unpaginated table and do not duplicate the pager in the page footer. `MemberManagementPage` already follows this composition. Use `layoutWidth="wide"` only for dense tables that need it. `minWidth` grows to fill its container, so assign compact status, date, numeric, and action columns explicit numeric `width`; leave flexible width to genuine long-text columns and allow clearance for action focus outlines.
- Use the default inset `Drawer` for product workflows: a rounded desktop panel and rounded-top mobile sheet. Use `variant="edge"` only for an explicitly flush rail.
- A product-family login keeps one company identity and one form implementation. Product identity changes through the visual slot, accent, name, and copy; never fork the form markup per product.
- Keep behavior functional down to 320px. Use the bundled mobile table renderer, drawer layout, overflow tooltip, and compact pagination instead of shrinking text.
- Treat wide-screen geometry as component correctness. Fixed columns and input adornment slots must not stretch or drift, and product-family accents must reach every interactive control in the login surface.

## Iterative Maintenance Budget

When the user is interactively reviewing this Skill's own component implementation, keep a narrow visual or behavioral fix narrow:

- Inspect only the affected component, styles, composition, and existing focused regression. Make the canonical fix and run the smallest browser check that proves the reported state and viewport; add one adjacent breakpoint only when the behavior is responsive.
- Do not run the full deterministic contract suite, the complete six-viewport matrix, consumer-project reinstallation, full-tree hash comparison, version increment, or GitHub operations for each incremental fix. Run those release gates only after the user explicitly asks to update, release, or publish, or confirms that the review batch is ready for release.
- Escalate beyond focused verification before release only when the change affects a shared primitive, enforcement tooling, the manifest contract, or cross-component behavior that cannot be established by the focused test.
- Keep command output compact. Report pass/fail and actionable errors; do not print complete manifests, verifier inventories, or build logs when a filtered summary is sufficient.

This budget applies to maintaining the Skill during iterative review. It does not weaken the target-project verification required when the Skill is used to deliver a finished application feature, and it does not waive any release gate below.

## Mandatory Verification

Run the target project's typecheck/build and tests. Exercise loading, success, empty, error, retry, and validation states where applicable. Inspect user-facing pages at 2560px, 1440px, 1024px, 736px, 360px, and 320px for whitespace, stretching, adornment drift, overlap, clipping, horizontal overflow, and loading resize.

After changing the canonical kit or enforcement tools, run the deterministic contract suite:

```powershell
python scripts/update_component_manifest_integrity.py
python scripts/validate_component_manifest.py
python scripts/test_strict_enforcement.py
npm --prefix assets/react-kit run build
```

Before handoff, run the verifier without relying on a manually supplied component list:

```powershell
python scripts/verify_personal_ui.py --target <project-path>
```

The installed npm prebuild gate scans project source and stylesheets and verifies every managed file against the manifest's canonical SHA-256 map. It rejects deep or computed imports, unregistered exports, raw protected controls and interactive roles, reserved Personal UI classes or ownership markers, generic or preprocessor CSS that can restyle protected controls, CSS-in-JS wrappers, DOM/CSSOM style mutation, component cloning, application style or imperative props on protected components, unapproved external JSX UI, uninspectable markup, and every missing, changed, linked, or extra managed source file. The Python verifier additionally compares installed support, registry, package scripts, dependencies, and canonical source. `--require-component` remains compatibility-only and cannot replace this scan; `--allow-unreferenced` is only for a just-installed kit before composition and must not be used for final handoff.

A release passes only when `upToDate` is true, `errors` is empty, `componentManifest.valid` and `provenance.valid` are true, installed support files match, installed and bundled versions match, all `sourceDrift` lists are empty, and `usedComponents` reflects the components actually rendered or called. There is no warning-only drift mode and no bypass for locally reimplemented controls.

Report the public Personal UI exports used, any canonical component addition and version increment completed before installation, and the verification commands that actually passed.
