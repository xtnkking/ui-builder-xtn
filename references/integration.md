# Integration

Personal UI v0.2.19 is installed source with an enforced provenance boundary. The application package receives the complete managed source tree, its runtime registry, the component manifest, the provenance scanner, and `tools/personal-ui/install-state.json`. Product code may compose public exports, but it may not fork, imitate, or reach inside the managed implementation.

## Resolve The Installation Roots

The installer and verifier use the same three-root model:

- **Project root** is the repository or workspace root. It bounds every write and owns the workspace lockfile.
- **Package root** is the Vite or Next.js application package whose `package.json` is updated. In a standalone application it is the same directory as the project root.
- **Source root** is the managed Personal UI directory relative to the package root. It defaults to `src/personal-ui`; it must not be absolute or escape the package root.

`--target <application>` remains the shorthand for a standalone project. In a workspace, pass the roots explicitly; `--package-root` may be omitted only when exactly one application package can be inferred:

```powershell
python scripts/install_personal_ui.py --mode integrate --project-root <workspace> --package-root apps/web --source-root src/personal-ui
python scripts/verify_personal_ui.py --project-root <workspace> --package-root apps/web
```

The tool detects npm, pnpm, or Yarn from the root lockfile and `packageManager` declarations, and detects Vite or Next.js from the application package. Conflicting evidence, multiple possible application packages, a nested workspace lockfile, an undeclared package root, Yarn Classic, or a linked/junction path fails before any write. Use `--package-manager` or `--framework` only to make otherwise valid intent explicit; these flags do not override conflicting metadata.

## Choose A Mode

Use the deterministic installer rather than manually copying snippets.

### New React application

The destination must be absent or empty on its first install. A later starter rerun recognizes its install state; `--force` can then replace only modified files recorded as installer-owned. An unrelated non-empty destination is always a conflict, including with `--force`.

```powershell
python scripts/install_personal_ui.py --mode starter --target <destination>
python scripts/install_personal_ui.py --mode starter --target <destination> --force --dry-run
```

This copies the allowlisted runnable Vite starter and the complete Personal UI source. The installed runtime registry lives at `src/personal-ui/registry.json`; enforcement support and installation state live under `tools/personal-ui/`. Replace the demo composition in `src/App.tsx`, but keep every UI control and reusable pattern imported from `src/personal-ui`.

The starter includes a dependency lockfile. The installer does not run npm or write `node_modules`; run the install and build commands returned in `plan.commands` after the transaction commits. Regenerate the lockfile only as a deliberate dependency upgrade followed by the complete build and browser verification gate.

### Existing React and TypeScript application

```powershell
python scripts/install_personal_ui.py --mode integrate --target <application-root>
```

The command copies the complete managed source, installs the matching component manifest and provenance scanner under `tools/personal-ui`, records missing kit dependencies in `package.json`, and leaves application routes, aliases, and entrypoints unchanged. It installs the exact `verify:personal-ui` script and prefixes that verifier directly to the existing `build` command. This guarantees that npm, pnpm, and Yarn builds execute the gate without depending on package-manager lifecycle behavior. An unrelated existing `prebuild` remains unchanged; the installer removes only its own exact legacy `npm run verify:personal-ui` segment during migration. Compatible dependency declarations are preserved whether they live in `dependencies` or `devDependencies`. An incompatible dependency or malformed reserved script fails before any write.

Workspace examples:

```powershell
# npm workspace + Vite
python scripts/install_personal_ui.py --mode integrate --project-root <repo> --package-root apps/web --package-manager npm --framework vite

# pnpm workspace + Next.js + custom managed source location
python scripts/install_personal_ui.py --mode integrate --project-root <repo> --package-root apps/portal --source-root ui/personal-ui --package-manager pnpm --framework next

# Yarn 4 workspace + Vite
python scripts/install_personal_ui.py --mode integrate --project-root <repo> --package-root packages/admin --package-manager yarn --framework vite
```

The JSON report supplies the exact follow-up command arrays. For a workspace these use npm `--workspace`, pnpm `--filter`, or `yarn workspace` as appropriate. Run the reported install command from the project root only after a successful apply; neither normal apply nor `--dry-run` invokes a package manager or modifies a lockfile.

Preview every update before replacing managed source:

```powershell
python scripts/install_personal_ui.py --mode integrate --target <application-root> --force --dry-run
```

The deterministic JSON plan uses project-relative paths and lists SHA-256 values, files to create/update/delete, dependency changes, build-gate changes, conflicts, follow-up commands, and `planDigest`. Its `operation` is:

- `install` when no prior Personal UI state or recognized legacy installation exists;
- `upgrade` when a prior installation requires managed changes or state migration;
- `noop` when files, package metadata, and state already match;
- a conflict report when an existing path cannot be changed under the ownership rules.

Exit code `0` means a valid plan or completed apply, `2` means invalid roots/metadata or another operational error, and `3` means unresolved conflicts. A conflicting dry-run still prints its plan and exits `3`. Dry-run writes no source, package, state, lockfile, backup, timestamp, or dependency artifact, so repeating the same input produces the same `planDigest`.

Every managed file and its last installed hash is recorded in `tools/personal-ui/install-state.json`. A normal upgrade changes or retires only clean files owned by that state. A modified owned file is a conflict; `--force` permits replacing that file after it appears in the plan. `--force` cannot replace an unowned collision, remove an unowned file inside the managed source root, clear a directory, or cross the project/package boundaries. A recognized v0.2.19 installation without state can be migrated from its manifest inventory, while an unrelated root `registry.json` remains untouched.

Apply holds a package-scoped operating-system lock, stages individual files, validates the result, and rechecks each destination hash and physical parent chain immediately before its write or deletion. An active lock fails without waiting; an unlocked record left by a crashed process is treated as stale and reused. The lock lives in the operating-system temporary directory, so dry-run does not create a project file or lock record.

On an ordinary in-process failure, the installer restores only writes made by that transaction when they still contain the transaction's value; unrelated files and concurrent user changes are preserved. This is not a durable crash journal: process termination, machine restart, or power loss can interrupt an apply after some files changed. After such an interruption, rerun dry-run and the verifier, review conflicts, and apply again rather than assuming automatic rollback.

For Vite, import the stylesheet exactly once from the application entrypoint (adjust the relative path for a custom source root):

```tsx
import "./personal-ui/styles.css";
```

For a root-level Next.js App Router, keep the global stylesheet import in the server `app/layout.tsx` boundary:

```tsx
import "../src/personal-ui/styles.css";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html><body>{children}</body></html>;
}
```

Place `'use client'` only on a consumer boundary that renders interactive Personal UI exports or uses client hooks. Do not mark the whole layout client-side merely to install the kit:

```tsx
'use client';

import { Button } from "../src/personal-ui";

export default function Page() {
  return <Button>Run</Button>;
}
```

Import every runtime component and pattern through the public barrel:

```tsx
import { Button, DataTable, Drawer, FilterBar, SearchInput, Select } from "./personal-ui";
```

### Field-aligned query controls

Buttons that share a row with the 44px input controls must declare `size="field"`. Keep the query command as a submit button so Enter and click use the same form path; `handleQuery` must call `event.preventDefault()` before starting the application request, and the button must use the bundled loading state while that request is in flight.

```tsx
<FilterBar
  ariaLabel="成员筛选"
  onSubmit={handleQuery}
  actions={(
    <Button size="field" type="submit" variant="primary" loading={querying} loadingLabel="查询中">
      查询
    </Button>
  )}
>
  <SearchInput aria-label="搜索成员" value={draftQuery} onChange={handleDraftQueryChange} />
  <Select ariaLabel="按状态筛选" value={draftStatus} options={statusOptions} onValueChange={setDraftStatus} />
</FilterBar>
```

The same `size="field"` contract applies when a product intentionally composes the command beside a field inside `Inline`; do not recreate the 44px height with application CSS. Ordinary `Button` instances remain 38px and `size="small"` remains 32px.

Do not deep-import an implementation file:

```tsx
// Forbidden: bypasses the public source contract.
import { Button } from "./personal-ui/primitives";
```

Application code may own business state, data fetching, copy, product images, and non-interactive semantic layout. It must not add native protected controls, interactive ARIA roles, locally styled lookalikes, third-party JSX controls, `.pui-*` selectors, reserved `data-pui-*` markers, generic CSS selectors that can restyle protected controls, protected-selector mixins or `@apply`, JSX `<style>`, remote/package-global CSS, CSS-in-JS wrappers, or DOM/CSSOM style mutation. Protected Personal UI components must not receive application `className`, `style`, `css`, `sx`, `tw`, `ref`, or spread props through JSX, factories, runtime JSX calls, aliases, or `cloneElement`; put layout classes on a surrounding element or use a manifest-classified layout utility. A local wrapper is acceptable only when it composes public Personal UI exports without implementing or restyling a replacement control.

Respect the target's existing package manager and project-root lockfile. Run the exact install and build commands from `plan.commands` after the installer updates `package.json`; the installer deliberately does not execute them inside its file transaction.

## Managed Source Boundary

`src/personal-ui/` in a target project is generated, versioned source. Do not edit it, add files to it, or copy one of its implementation files elsewhere for customization. The verifier treats every missing, changed, or extra file as a release error; there is no local-extension allowance.

Brand and product differences belong in documented props, visual slots, and tokens. If a reusable visual or behavior cannot be expressed by the public API, follow the canonical extension workflow below before continuing the feature.

For a sparse operational list, use the bundled `ListManagementPage` or `SearchFilterPage` with `DataTable` as its content. A first visible checkbox column must declare `kind: "selection"`; the table then pins it and the following visible data column to the start by default. Use `pin: false` on the selection column to disable the pair default, or an explicit `pin` on either column for a deliberate override. Pass `DataTable.pagination` to attach the bundled pager inside the table's rounded frame; paginated tables default to a fixed viewport sized from five standard row-height units so their height and pager placement do not change with sparse results or larger page sizes. Keep the pagination object present during loading, empty, and zero-row error states; the bundled `MemberManagementPage` does this and renders a pending, zero-result, or no-cache summary without collapsing the frame. Set `viewportRows` for a different fixed standard-row-height capacity or `viewportRows="auto"` for deliberate content height. Custom cells can be taller and scroll within the fixed surface; never clip them to force an exact visible-row count. An unpaginated table remains automatic unless it receives a numeric `viewportRows`. Every actually scrollable surface is a named keyboard tab stop. Fixed viewports reset their vertical position for a new request, page, page size, or row identity sequence while preserving horizontal column context. Do not also place `Pagination` in the page footer. Their default readable width aligns every part of the page; set `layoutWidth="wide"` only for genuinely dense tables. Fixed-width status, date, number, and action columns avoid distributing ultrawide empty space across short values.

The machine-readable authority is `assets/react-kit/component-manifest.json`:

- The current manifest classifies all 139 runtime exports as 136 visual components or patterns and 3 non-visual hooks/constants across 118 families and 130 discovery aliases.
- Every `component` or `pattern` family maps to real source files and at least one registered public runtime export.
- Every rendered component family declares a source ownership marker that exists in those source files.
- Foundation entries map to real CSS or TypeScript artifacts even when they have no runtime component.
- Every registry runtime export must be covered by the manifest, and the manifest version must equal the registry version.
- `sourceIntegrity` contains the canonical SHA-256 for every file under `src/personal-ui/`; both manifest validation and the installed npm gate require an exact file set and exact content.

The catalog explains behavior; it cannot create or authorize an export that is absent from the manifest and barrel.

## Extending The Canonical Kit

A requested capability that has no registered public export must not be built inside the target application. Extend the Skill's canonical kit first:

1. Implement the reusable React source in `assets/react-kit/src/personal-ui/` and add its styles to the canonical style entry.
2. Give the component root its unique `data-pui-owner` marker and cover its expected states, including disabled, loading, empty, error, keyboard, and responsive behavior when applicable.
3. Export the runtime API from `assets/react-kit/src/personal-ui/index.ts`.
4. Add the export to `assets/react-kit/registry.json`.
5. Add or update the `component-manifest.json` family entry with `publicExports`, `sourceFiles`, aliases, and `ownerMarkers`.
6. Add focused tests and a representative gallery or workflow example.
7. Run `python scripts/update_component_manifest_integrity.py`, then run the manifest validator, strict-enforcement self-test, and source typecheck/build.
8. Increment and synchronize the semantic version across the kit registry, component manifest, and package metadata.
9. Reinstall the new version into the target with `integrate --force` after reviewing `--dry-run`, then compose the feature from its public barrel export.

If canonical source cannot be changed within the task's authority, stop and report the missing library capability. Do not make a temporary native, CSS-only, or third-party substitute.

## Floating Surfaces

`Select`, searchable selectors, comboboxes, tag suggestions, tree selectors, and dropdown menus portal their open surfaces outside clipped content and use fixed positioning. They attach to the owning modal overlay when present, otherwise to `document.body`, so a nested modal stays above its parent's menu. Their preferred placement flips when useful, clamps on both axes, and preserves a viewport gutter while retaining locally computed `--pui-*` tokens.

Inside `Dialog` or `Drawer`, keep the bundled trigger/surface relationship intact so modal focus containment can follow the portaled surface. Do not wrap or replace these controls in a way that removes their focus and `aria-controls` wiring.

Popover and context-menu surfaces also follow their owning modal overlay. Tooltips are supplementary and non-interactive; use `OverflowText` when the tooltip should exist only for actual truncation. Verify floating surfaces near every viewport edge and above dialogs or drawers.

## Existing Design Systems

The provenance scanner inspects script, JSX/TSX, MDX, HTML, CSS, PostCSS, SCSS, Sass, and Less files across the project while excluding generated output, dependencies, installed enforcement tools, and the managed component source itself. A target that already renders another component system or raw interactive controls will not pass strict mode unchanged. Do not silently install Personal UI beside that system. Confirm that the requested surface can be migrated to Personal UI or place it in a separate application; explicit Skill use selects Personal UI but does not authorize an unrelated whole-product migration.

## Updating An Installed Kit

Run the verifier before upgrading and preserve application composition outside the configured managed source root:

```powershell
python scripts/verify_personal_ui.py --target <application-root>
python scripts/install_personal_ui.py --mode integrate --target <application-root> --dry-run
python scripts/install_personal_ui.py --mode integrate --target <application-root>
```

For a workspace, use the same `--project-root` and `--package-root` values for both tools. The verifier reads a previously installed custom `sourceRoot` from install state when `--source-root` is omitted. If the plan reports a user-modified owned file that you intentionally want to replace, rerun dry-run with `--force`, inspect the exact forced paths, and only then apply with `--force`. Unowned conflicts remain non-forceable.

Do not rerun starter mode to upgrade a customized application. Starter mode also owns `src/App.tsx`, `src/main.tsx`, `src/demo.css`, and build configuration, so its force mode is for deliberately resetting those starter-owned paths.

After installation, run the install and build arrays reported in `plan.commands`, test the application, and then run the verifier again. For a standalone npm package this is typically:

```powershell
npm run build
python scripts/verify_personal_ui.py --target <application-root>
```

The installed `build` script begins with the provenance command and then invokes the package's original build string. The gate checks both application provenance and the managed source SHA-256 inventory, so a changed, missing, linked, or extra component source file stops npm, pnpm, or Yarn before TypeScript, Vite, or Next.js runs. Directly invoking a lower-level compiler or bundler is not an accepted release verification path.

The verifier automatically scans reachable application source; no component list is needed. `--require-component` is compatibility-only and may add an explicit assertion, but it never weakens or replaces automatic provenance. `--allow-unreferenced` may be used only to check a fresh installation before any application code consumes it; final delivery must run without that flag.

A passing report requires:

- `upToDate: true` and an empty top-level `errors` array.
- Equal installed and bundled versions and registries.
- `componentManifest.valid: true` and matching installed enforcement support.
- `provenance.valid: true`, with actual rendered or called barrel exports in `usedComponents`.
- `installState.valid: true` with matching source root, framework, and package manager.
- `buildGate.verifyScriptMatches: true` and `buildGate.buildIncludesGate: true`.
- Empty `sourceDrift.missing`, `sourceDrift.changed`, and `sourceDrift.extra` lists.
- Exactly one application import of the Personal UI stylesheet and compatible dependencies.

The automatic scan rejects deep imports, private or unregistered exports, raw protected HTML controls, interactive roles or raw interaction handlers used to imitate controls, reserved Personal UI classes and owner markers, generic or preprocessor styles that can alter protected controls, dynamic and external global styles, CSS-in-JS wrappers, DOM/CSSOM style mutation, `cloneElement`, protected-component `className`/`style`/`css`/`sx`/`tw`/`ref`/spread overrides (including factory, runtime, alias, and memo paths), unapproved external JSX components, and markup injection paths that cannot prove ownership. These failures are release blockers, not warnings.

This is a deterministic build-time ownership gate, not a sandbox for hostile JavaScript. Deliberately obfuscated runtime code, generated source outside the inspected project, browser extensions, and code fetched after build require separate security review. They are not accepted ways to bypass the component contract; keep UI construction statically inspectable and verify the rendered product as part of release review.
