---
name: ui-builder-xtn
description: Build or revise React and TypeScript product interfaces by installing and composing the bundled Personal UI source components and page patterns. Use for login, forms, CRUD, searchable data lists, tables, feedback, overlays, and operational pages that should follow this personal design system; do not use for backend-only work or a product that must preserve another established UI system.
license: MIT
---

# UI Builder XTN

Build the requested interface from the bundled Personal UI implementation. This is an enforced source kit, not a prose style guide: every control, feedback surface, navigation control, overlay, data renderer, and bundled page pattern must be a registered public export with real React source in this Skill.

## Start here

1. Inspect the target framework, package manager, source root, aliases, existing UI system, and tests. An explicit request to use this Skill chooses Personal UI for the inspected application surface; do not mix component systems.
2. Read the [integration guide](references/integration.md), then use `scripts/install_personal_ui.py` in `starter` or `integrate` mode. Never copy isolated snippets or use the archived `personal-ui-library-preview.html` as application source.
3. Find the needed family in the generated [component catalog](references/component-catalog.md), then read its exact Props, defaults, behavior, example, and migration notes in the generated [component API](references/component-api.md). Inspect the matching runnable Explorer route when appearance or interaction matters.
4. Import runtime components and patterns only from the installed `src/personal-ui/index.ts` barrel, normally through `./personal-ui` or its project alias. Compose business data, callbacks, copy, product media, approved tokens, and non-interactive layout around those exports.
5. Run the target build, tests, and `python scripts/verify_personal_ui.py --target <project-path>` before handoff. Report the public exports used and any canonical capability added.

## Enforced ownership

The canonical implementation is `assets/react-kit/src/personal-ui/`; `assets/react-kit/component-manifest.json` binds every family, runtime export, source file, alias, and ownership marker. The installer copies that versioned source into the target, owns its fixed `verify:personal-ui` command, and prefixes that command directly to the existing `build` script while preserving an unrelated caller-owned `prebuild`.

- Do not recreate a registered control with native interactive markup, application CSS, a local wrapper, copied source, or a third-party JSX component. Do not deep-import implementation files.
- Do not style protected controls through `.pui-*`, `data-pui-*`, generic control selectors, CSS-in-JS, runtime CSS/DOM mutation, external global styles, or JSX `<style>`.
- Protected public components must not receive application `className`, `style`, `css`, `sx`, `tw`, `ref`, spread props, or `cloneElement` overrides. Use a surrounding layout element, a documented token, or a canonical typed prop.
- Use Lucide icons through component props. Keep option, tab, menu-item, product, table-column, and row identities stable, unique, and non-empty within their owner.
- Keep business copy and machine values consumer-owned. Built-in fallback and ARIA text use the locale contract; product data must not be silently translated or reformatted for submission.

If a requested capability has no registered public export, stop that part of page composition. Add the reusable source and styles to the canonical kit, export it from the public barrel, register it in the Manifest and docs metadata, add a compiled Explorer case and focused tests, refresh integrity/API/coverage artifacts, and only then reinstall it. Never patch an installed `src/personal-ui/` as a local extension or bypass the verifier.

## Read by task

- Installation, integration, source checks, and field-aligned controls: [integration guide](references/integration.md).
- Native/composite submission, validation, reset, external forms, and React Hook Form: [form contract](references/form-contract.md).
- Search, async options, explicit queries, loading, tables, sorting, pinning, height, and pagination: [data workflow contract](references/data-workflows.md).
- Dialog, Drawer, ConfirmDialog, nested layers, dismissal, focus, Portal, and scroll lock: [overlay contract](references/overlay-contract.md).
- Login, CRUD/list, create/edit, detail, settings, wizard, import/export, and status shells: [page pattern routing](references/page-patterns.md).
- Built-in text, `zh-CN`/`en-US`, nested providers, Portal inheritance, SSR, dates, numbers, and plurals: [locale contract](references/locale-contract.md).
- Public API changes and upgrade action: [v0.3.0 migrations](references/v0.3.0-migrations.md).
- Canonical source and generated-copy policy: [source authority](references/source-authority.md).

## Completion contract

Use bundled loading APIs for every asynchronous command so dimensions remain stable and duplicate actions are blocked. Server-backed filters edit draft state and fetch only on explicit submit or Enter; sorting and pagination are explicit requests. Preserve the last successful data when a later request fails.

Exercise applicable loading, success, empty, error, retry, validation, long-content, keyboard, overlay, locale, and mobile states. Keep behavior functional at 320px and inspect relevant wider layouts for stretching, adornment drift, overlap, clipping, overflow, and loading resize. Use component-owned responsive table, Drawer, tooltip, and pagination behavior rather than shrinking type or patching geometry.

For maintenance of this Skill's own component platform, documentation, installer, or release system, first read the [v0.3.0 hardening roadmap](references/v0.3.0-roadmap.md). Preserve milestone scope and evidence; do not upgrade, synchronize generated copies, tag, or publish merely because one milestone passed. Run focused checks while iterating and the milestone gate once at its boundary.
