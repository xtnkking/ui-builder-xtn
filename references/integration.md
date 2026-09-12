# Integration

Personal UI v0.2.1 is installed source with an enforced provenance boundary. The target receives the complete managed `src/personal-ui/` tree, its runtime registry, the component manifest, and the provenance scanner. Product code may compose public exports, but it may not fork, imitate, or reach inside the managed implementation.

## Choose A Mode

Use the deterministic installer rather than manually copying snippets.

### New React application

The destination must be absent or empty. `--force` permits overwriting starter-owned paths in a non-empty destination, but it does not delete unrelated application files; use it only after reviewing the dry-run plan.

```powershell
python scripts/install_personal_ui.py --mode starter --target <destination>
python scripts/install_personal_ui.py --mode starter --target <destination> --force --dry-run
```

This copies the runnable Vite starter and the complete Personal UI source. The installed runtime registry lives at `src/personal-ui/registry.json`; enforcement support lives under `tools/personal-ui/`. Replace the demo composition in `src/App.tsx`, but keep every UI control and reusable pattern imported from `src/personal-ui`.

The starter includes a dependency lockfile. Run `npm ci` for the verified dependency set before the first build. Regenerate the lockfile only as a deliberate dependency upgrade followed by the complete build and browser verification gate.

### Existing React and TypeScript application

```powershell
python scripts/install_personal_ui.py --mode integrate --target <project-root>
```

The command copies the complete `src/personal-ui` source, installs the matching component manifest and provenance scanner under `tools/personal-ui`, records missing kit dependencies in `package.json`, and leaves application routes and entrypoints unchanged. It also installs the exact `verify:personal-ui` command and appends it to npm's `prebuild` lifecycle, preserving an existing prebuild command. Compatible dependency declarations are preserved whether they live in `dependencies` or `devDependencies`. An incompatible dependency or conflicting reserved verifier command fails before any write.

Preview every update before replacing managed source:

```powershell
python scripts/install_personal_ui.py --mode integrate --target <project-root> --force --dry-run
```

The JSON plan lists the bundled version, files to create, overwrite, and delete, and dependency changes. Running without `--dry-run` replaces the complete managed directory as one versioned unit, so removed files and unauthorized additions cannot linger. A root `registry.json` is removed during migration only when it identifies itself as a legacy Personal UI registry; unrelated root registries remain untouched.

After installation, import the stylesheet exactly once at the application entrypoint:

```tsx
import "./personal-ui/styles.css";
```

Import every runtime component and pattern through the public barrel:

```tsx
import { Button, DataTable, Drawer, SearchInput } from "./personal-ui";
```

Do not deep-import an implementation file:

```tsx
// Forbidden: bypasses the public source contract.
import { Button } from "./personal-ui/primitives";
```

Application code may own business state, data fetching, copy, product images, and non-interactive semantic layout. It must not add native protected controls, interactive ARIA roles, locally styled lookalikes, third-party JSX controls, `.pui-*` selectors, reserved `data-pui-*` markers, generic CSS selectors that can restyle protected controls, protected-selector mixins or `@apply`, JSX `<style>`, remote/package-global CSS, CSS-in-JS wrappers, or DOM/CSSOM style mutation. Protected Personal UI components must not receive application `className`, `style`, `css`, `sx`, `tw`, `ref`, or spread props through JSX, factories, runtime JSX calls, aliases, or `cloneElement`; put layout classes on a surrounding element or use a manifest-classified layout utility. A local wrapper is acceptable only when it composes public Personal UI exports without implementing or restyling a replacement control.

Respect the target's existing package manager and lockfile. Run its install command after the installer updates `package.json`.

## Managed Source Boundary

`src/personal-ui/` in a target project is generated, versioned source. Do not edit it, add files to it, or copy one of its implementation files elsewhere for customization. The verifier treats every missing, changed, or extra file as a release error; there is no local-extension allowance.

Brand and product differences belong in documented props, visual slots, and tokens. If a reusable visual or behavior cannot be expressed by the public API, follow the canonical extension workflow below before continuing the feature.

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

`Select`, searchable selectors, and comboboxes portal their open surfaces to `document.body` and use fixed positioning. Their preferred placement flips when useful, clamps on both axes, and preserves a viewport gutter. Because the surfaces are portaled, they escape clipping ancestors such as tables, drawers, and `overflow: hidden` containers while retaining locally computed `--pui-*` tokens.

Inside `Dialog` or `Drawer`, keep the bundled trigger/surface relationship intact so modal focus containment can follow the portaled surface. Do not wrap or replace these controls in a way that removes their focus and `aria-controls` wiring.

Menus that intentionally remain within their owning container use their component's documented positioning behavior. Tooltips are supplementary and non-interactive; use `OverflowText` when the tooltip should exist only for actual truncation. Verify floating surfaces near every viewport edge and above dialogs or drawers.

## Existing Design Systems

The provenance scanner inspects script, JSX/TSX, MDX, HTML, CSS, PostCSS, SCSS, Sass, and Less files across the project while excluding generated output, dependencies, installed enforcement tools, and the managed component source itself. A target that already renders another component system or raw interactive controls will not pass strict mode unchanged. Do not silently install Personal UI beside that system. Confirm that the requested surface can be migrated to Personal UI or place it in a separate application; explicit Skill use selects Personal UI but does not authorize an unrelated whole-product migration.

## Updating An Installed Kit

Run the verifier before upgrading and preserve any application composition outside `src/personal-ui/`:

```powershell
python scripts/verify_personal_ui.py --target <project-root>
python scripts/install_personal_ui.py --mode integrate --target <project-root> --force --dry-run
python scripts/install_personal_ui.py --mode integrate --target <project-root> --force
```

Do not rerun starter mode to upgrade a customized application. Starter mode also owns `src/App.tsx`, `src/main.tsx`, `src/demo.css`, and build configuration, so its force mode is for deliberately resetting those starter-owned paths.

After installation, build and test the application, then run the verifier again:

```powershell
npm run build
python scripts/verify_personal_ui.py --target <project-root>
```

`npm run build` automatically runs `verify:personal-ui` first. The prebuild gate checks both application provenance and the managed source SHA-256 inventory, so a changed, missing, linked, or extra component source file stops the build before TypeScript or Vite runs. Directly invoking a lower-level compiler or bundler is not an accepted release verification path.

The verifier automatically scans reachable application source; no component list is needed. `--require-component` is compatibility-only and may add an explicit assertion, but it never weakens or replaces automatic provenance. `--allow-unreferenced` may be used only to check a fresh installation before any application code consumes it; final delivery must run without that flag.

A passing report requires:

- `upToDate: true` and an empty top-level `errors` array.
- Equal installed and bundled versions and registries.
- `componentManifest.valid: true` and matching installed enforcement support.
- `provenance.valid: true`, with actual rendered or called barrel exports in `usedComponents`.
- `buildGate.verifyScriptMatches: true` and `buildGate.prebuildIncludesGate: true`.
- Empty `sourceDrift.missing`, `sourceDrift.changed`, and `sourceDrift.extra` lists.
- Exactly one application import of the Personal UI stylesheet and compatible dependencies.

The automatic scan rejects deep imports, private or unregistered exports, raw protected HTML controls, interactive roles or raw interaction handlers used to imitate controls, reserved Personal UI classes and owner markers, generic or preprocessor styles that can alter protected controls, dynamic and external global styles, CSS-in-JS wrappers, DOM/CSSOM style mutation, `cloneElement`, protected-component `className`/`style`/`css`/`sx`/`tw`/`ref`/spread overrides (including factory, runtime, alias, and memo paths), unapproved external JSX components, and markup injection paths that cannot prove ownership. These failures are release blockers, not warnings.

This is a deterministic build-time ownership gate, not a sandbox for hostile JavaScript. Deliberately obfuscated runtime code, generated source outside the inspected project, browser extensions, and code fetched after build require separate security review. They are not accepted ways to bypass the component contract; keep UI construction statically inspectable and verify the rendered product as part of release review.
