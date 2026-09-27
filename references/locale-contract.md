# Locale Contract

Read this reference when setting application language or time zone, formatting consumer-owned values beside Personal UI components, adding built-in component copy, or diagnosing server-rendered language differences.

## Public Usage

`LocaleProvider` is a context-only provider. It adds no DOM wrapper and accepts only `children`, `locale`, and `timeZone`. The supported locale union is intentionally closed to `zh-CN | en-US`; `zh-CN` is the deterministic default and is never inferred from `window`, `navigator`, or the operating system.

```tsx
import { LocaleProvider } from "./personal-ui";

<LocaleProvider locale="en-US" timeZone="America/New_York">
  <App />
</LocaleProvider>
```

Nested providers inherit `locale` and `timeZone` independently. A nested provider may change only one value without resetting the other. React Portals inherit the logical provider context, including Dialog, Drawer, selectors, and other bundled overlays.

`usePersonalUILocale` is public so consumer-rendered business values can use the same locale and time zone as bundled components:

```tsx
import { usePersonalUILocale } from "./personal-ui";

function InvoiceTotal({ amount, issuedAt }: { amount: number; issuedAt: number }) {
  const { formatDate, formatNumber } = usePersonalUILocale();
  return (
    <span>
      {formatNumber(amount, { style: "currency", currency: "USD" })}
      {" · "}
      {formatDate(issuedAt, { dateStyle: "medium" })}
    </span>
  );
}
```

Its stable public value contains:

- `locale` and optional `timeZone`;
- `formatDate`, backed by `Intl.DateTimeFormat`;
- `formatNumber`, backed by `Intl.NumberFormat`;
- typed `message` and `plural` functions for Personal UI's built-in vocabulary.

`message` and `plural` are not a business translation system. Their closed keys belong to Personal UI component copy and ARIA text. Product names, headings, field labels, server errors, option labels, and other business copy stay in consumer props or the product's own translation layer. There is no provider prop for replacing or partially overriding the internal dictionaries, so consumers cannot create silent key fallback or incomplete-locale states.

## Values And Formatting

Language changes presentation only. Select values, IDs, `FormData`, ISO date input values, page/sort parameters, and API payloads must remain stable. A display label may change while its value does not:

```tsx
import { usePersonalUILocale } from "./personal-ui";

function useRoleOptions() {
  const { locale } = usePersonalUILocale();
  return [
    { value: "admin", label: locale === "en-US" ? "Administrator" : "管理员" },
  ];
}
```

Built-in numeric counts and plural forms use `Intl.NumberFormat` and `Intl.PluralRules`. Dates use `Intl.DateTimeFormat`. `formatDate` applies the provider `timeZone` unless the call supplies an explicit `options.timeZone`.

Date-only machine values such as `2026-09-22` should be interpreted as calendar dates, not instants. Components that own such values preserve the calendar date when formatting. Timestamp values are formatted in the resolved provider time zone.

## SSR And Hydration

The provider can render on the server because it does not read browser globals or create a wrapper element. Server and client must receive the same initial `locale`. When server-rendered output includes a timestamp whose displayed date or time can vary by zone, also provide the same explicit `timeZone` on both sides; relying on each runtime's default zone can create different text even when the locale matches.

Toast is a special Portal case: `useToast()` captures the locale context at the call site. A ToastProvider outside a nested LocaleProvider therefore still renders the notification's built-in controls in the caller's language.

## Maintainer Invariants

- Keep the `zh-CN` and `en-US` message and plural keys identical.
- Keep placeholder sets identical for every translated message and plural form.
- Every plural entry requires an `other` form; do not silently fall back to Chinese.
- Put reusable component UI and ARIA copy in `locale.tsx`. Do not move business copy into that dictionary.
- Keep exceptions in `assets/react-kit/locale-hardcoded-exceptions.json` exact, owned, and justified. Unused exceptions fail the locale check.
- Register every public Locale runtime export in the Manifest, registry, component docs, Explorer case, API report, and coverage matrix.

Focused verification:

```powershell
npm --prefix assets/react-kit run locale:check
npm --prefix assets/react-kit run test:components -- tests/components/locale-contracts.test.tsx tests/components/locale-source-contracts.test.ts
npm --prefix assets/react-kit run test:types
```
