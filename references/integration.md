# Integration

## Choose A Mode

Use the deterministic installer rather than manually copying snippets.

### New React application

The destination must be absent or empty. `--force` permits overwriting starter-owned paths in a non-empty destination, but it does not delete unrelated application files; use it only after reviewing the dry-run plan.

```powershell
python scripts/install_personal_ui.py --mode starter --target <destination>
python scripts/install_personal_ui.py --mode starter --target <destination> --force --dry-run
```

This copies the runnable Vite starter, including the source library and two reference patterns. The installed kit manifest lives at `src/personal-ui/registry.json`; the installer never claims an unrelated root `registry.json`. Replace the demo composition in `src/App.tsx`; keep feature code importing from `src/personal-ui`.

The starter includes a dependency lockfile. Run `npm ci` for the verified dependency set before the first build; regenerate the lockfile only as a deliberate dependency upgrade followed by the complete build and browser verification gate.

### Existing React and TypeScript application

```powershell
python scripts/install_personal_ui.py --mode integrate --target <project-root>
```

The command copies `src/personal-ui`, records every missing kit dependency in `package.json`, and leaves application routes and entrypoints unchanged. Existing compatible dependency declarations are preserved whether they live in `dependencies` or `devDependencies`. An incompatible declaration, or a dependency declared in both sections, fails validation before the installer writes any files so the project can resolve the conflict through its normal dependency workflow. The installer refuses to overwrite an existing `src/personal-ui` directory.

Preview every update before replacing the managed source:

```powershell
python scripts/install_personal_ui.py --mode integrate --target <project-root> --force --dry-run
```

The JSON plan lists the bundled version, files that will be created, overwritten, and deleted, plus dependency additions and preserved declarations. Running the same command without `--dry-run` replaces the complete managed `src/personal-ui` directory, so files and nested directories removed from a newer kit cannot linger. A root `registry.json` is removed during migration only when its contents identify it as a legacy Personal UI manifest; unrelated root registries are left untouched.

After installation, import the stylesheet once at the application entrypoint:

```tsx
import "./personal-ui/styles.css";
```

Then import components from the barrel:

```tsx
import { Button, SearchInput, Tag } from "./personal-ui";
```

Respect an existing package manager and lockfile. Run its install command after the script updates `package.json`.

`Select` and `Combobox` portal their open surfaces to `document.body` and use fixed positioning. Their explicit `top` or `bottom` placement is a preference: each surface flips when the other side has more useful room, clamps on both axes, and limits its scrollable height to the resolved viewport space while preserving a 12px viewport gutter. Because these surfaces are portaled, they escape clipping ancestors such as scrolling table, drawer, and `overflow: hidden` containers. They copy the trigger's computed `--pui-*` custom properties and resynchronize them while open when any ancestor attribute, stylesheet, or supported user-preference media query changes. A locally themed product surface therefore keeps both its initial and live Personal UI tokens after the portal move. Positioning is recalculated on viewport or ancestor scrolling, resize, dynamic option-content changes, and those theme changes.

Inside `Dialog` or `Drawer`, keep the bundled trigger/listbox relationship and floating-root marker intact. The modal focus boundary follows `aria-controls` from the trigger to the portaled `Select` or `Combobox` surface; `Combobox` also moves Tab or Shift+Tab to the adjacent focus target inside that same modal boundary. Do not wrap or replace these controls in a way that removes that wiring.

`DropdownMenu` is intentionally different: its menu remains non-portal, absolutely positioned inside the dropdown root. It honors `align="start"` or `align="end"`, then clamps horizontally and flips or shifts vertically within the intersection of the viewport and all clipping ancestors. This keeps the menu inside a deliberately bounded toolbar or panel, but it does not escape that panel's clipping or stacking context. Its roving-focus items close and re-anchor focus to the trigger on Tab or Escape, including when the dropdown is inside a modal.

`Tooltip` portals its non-interactive bubble to `document.body`, uses fixed positioning, flips to the opposite side when needed, and clamps the final position to a 12px viewport margin. The bubble remains open while hovered and closes on Escape. Focus stays on the described trigger; the component attaches `aria-describedby` to actual focusable descendants or provides an accessible fallback trigger when none exists. Dialog, Drawer, Tooltip, and Toast portals copy locally inherited `--pui-*` tokens and automatically resynchronize them after ancestor attributes, stylesheet/media conditions, or font-loading state changes; product code must not mirror those tokens onto `document.body`. Pass `fill` when wrapping a full-width Button, Input, or block-level trigger so the Tooltip wrappers do not shrink it to content width. `OverflowText` also remeasures after typography or late-font changes, and shares its document-level observers across large result sets. Keep tooltip content supplementary and non-interactive, then verify it above dialogs and drawers as well as near every viewport edge. `DateField` uses native browser date/time input types, so its picker surface and displayed locale format vary by browser and operating system.

## Existing Design Systems

If the project already has a deliberate component system, do not silently install a second one. Explain the conflict and ask whether the feature should migrate to Personal UI or remain on the existing system. A request explicitly naming this Skill resolves that choice in favor of Personal UI unless doing so would break an established shared application shell.

## Updating A Previously Installed Kit

Run the verifier first. It reads `src/personal-ui/registry.json`, reports installed and bundled versions, validates the public runtime export registry, and lists missing, changed, or extra managed source files. It also checks the stylesheet import and package dependencies. For a fresh install that has not yet been wired into the application, `--allow-unreferenced` waives only the barrel-consumption and stylesheet-import checks; manifest integrity, source drift, and dependency validation still apply. For a deliberate reusable extension kept inside `src/personal-ui`, use `--allow-local-extensions`; changed and extra files become explicit warnings while missing bundled files remain errors. Compare and move local reusable extensions before using `--force`; the installer replaces the complete `src/personal-ui` directory as one versioned unit. Move genuine application composition out of that directory before syncing.

Upgrade any previously customized application with integrate mode, even when it originally came from the starter:

```powershell
python scripts/install_personal_ui.py --mode integrate --target <project-root> --force --dry-run
python scripts/install_personal_ui.py --mode integrate --target <project-root> --force
```

Do not rerun starter mode to upgrade a customized application. Starter mode also owns files such as `src/App.tsx`, `src/main.tsx`, `src/demo.css`, and the build configuration, so its force mode is only for deliberately resetting those starter-owned paths after reviewing the plan.

After the update, run the verifier again with repeated `--require-component <export>` arguments for the components or pattern promised by the feature. A successful result must have equal `installedVersion` and `bundledVersion`, empty `sourceDrift.missing`, `sourceDrift.changed`, and `sourceDrift.extra` lists, and an empty `missingRequiredComponents` list. The required-component check uses reachable application code; importing a symbol without rendering or calling it does not count.
