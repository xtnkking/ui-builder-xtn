# Personal UI page pattern routing

Use a bundled page pattern when the requested workflow matches one below. Patterns own page geometry and recurring interaction structure; consumers provide business data, copy, callbacks, permissions, and product media through documented props. See the generated [component API](component-api.md) for exact signatures and the [component catalog](component-catalog.md) for aliases.

## Pattern selection

| Workflow | Public pattern | Consumer-owned content |
| --- | --- | --- |
| Product-family sign-in | `FamilyLoginPage` | Company/product identity, accents, visual, links, submit callback |
| Custom authentication flow | `AuthenticationPage` | Identity, visual, form body, footer |
| Searchable operational list | `ListManagementPage` or `SearchFilterPage` | `FilterBar`, result component, bulk actions |
| Complete member-list example | `MemberManagementPage` | Fetch function and product-specific actions |
| Create or edit | `CreateEditPage` | Fields, submit/cancel behavior, business validation |
| Record detail | `DetailPage` | Stable sections, values, actions, optional aside |
| Settings | `SettingsPage` | Stable section IDs, controlled current section |
| Multi-step process | `WizardFlow` | Stable steps, controlled step, previous/next behavior |
| Master-detail workspace | `MasterDetail` | Master and detail surfaces, controlled detail visibility |
| Import/export operation | `ImportExportPage` | Format controls, payload handling, async callbacks |
| Empty/error/permission/offline page | `StatusPage` | Business title, description, action or retry |

Do not copy a pattern's JSX into a local variant. Compose its slots with other public exports. If the pattern lacks a reusable capability, follow the canonical missing-capability workflow instead of patching the installed source.

## Family login

`FamilyLoginPage` intentionally keeps one company identity and one credential form across products. Vary each product through stable `id`, name, accent tokens, headline, supporting copy, and `visual`. Do not fork the form markup for each product or override input/button geometry in application CSS.

The pattern owns validation focus, password visibility, pending submission, duplicate-submit prevention, and component fallback text. The caller owns authentication, account links, legal copy, and errors returned by the business service. Product accents must retain readable control states; visual media must describe the actual product rather than serve as generic decoration. The runnable example is `#/patterns/authentication`.

## List and CRUD pages

Place `FilterBar` and `DataTable` inside `ListManagementPage` or `SearchFilterPage`. Their default `layoutWidth="readable"` aligns heading, filters, table, and footer; use `layoutWidth="wide"` only for a table that genuinely needs the width. Keep table pagination in `DataTable.pagination`, not the page footer. Detailed request and height behavior is in the [data workflow contract](data-workflows.md).

`CreateEditPage` owns the form and stable action footer. Compose fields from Personal UI and follow the [form contract](form-contract.md). For editing inside a modal surface, use `Dialog` or `Drawer` rather than nesting a page pattern merely to obtain actions.

## Detail and process pages

Keep IDs stable and unique for detail sections, settings sections, and wizard steps. Controlled navigation state remains with the application; patterns render its accessible structure and built-in pending state. Use `DescriptionList` for term/value metadata and public feedback components for business outcomes.

`ImportExportPage` provides operation shells and pending buttons, not parsing, upload transport, or authorization. `StatusPage` represents a page-level outcome; use `Alert`, `EmptyState`, or `ErrorState` for feedback within an otherwise usable page.

## Overlays, locale, and responsive behavior

Use page patterns as the base surface and public overlays for transient work. Drawer and modal dismissal, focus, nesting, and Portal behavior are defined by the [overlay contract](overlay-contract.md). Component fallback and ARIA text follow the nearest locale provider; business page titles and field labels remain explicit consumer props as described by the [locale contract](locale-contract.md).

Before handoff, exercise the pattern's applicable loading, error, empty, validation, long-content, keyboard, and narrow-screen states. Inspect the Explorer pattern route rather than the archived static HTML preview.

