import {
  LocaleProvider,
  usePersonalUILocale,
  type LocaleMessageKey,
  type LocaleProviderProps,
  type LocalePluralKey,
  type PersonalUILocale,
  type PersonalUILocaleContext,
} from "../../src/personal-ui";

const locale: PersonalUILocale = "en-US";
const messageKey: LocaleMessageKey = "toast.closeTitle";
const pluralKey: LocalePluralKey = "pagination.results";
const providerProps: LocaleProviderProps = {
  locale,
  timeZone: "America/New_York",
  children: <span>Content</span>,
};
const provider = <LocaleProvider {...providerProps} />;

function ConsumerFormatting() {
  const context: PersonalUILocaleContext = usePersonalUILocale();
  const date = context.formatDate(Date.UTC(2026, 8, 22), { dateStyle: "long" });
  const number = context.formatNumber(1288, { style: "currency", currency: "USD" });
  const close = context.message("toast.closeTitle", { title: "Saved" });
  const results = context.plural(pluralKey, 2);
  return <span>{date}{number}{close}{results}</span>;
}

// @ts-expect-error locale is a closed supported union
const unsupportedLocale = <LocaleProvider locale="fr-FR"><span /></LocaleProvider>;
// @ts-expect-error LocaleProvider is context-only and has no DOM styling escape hatch
const styledProvider = <LocaleProvider className="foreign"><span /></LocaleProvider>;
// @ts-expect-error built-in messages require their declared placeholders
const missingPlaceholder = usePersonalUILocale().message("toast.closeTitle");
// @ts-expect-error built-in message keys are not a business translation namespace
const businessMessage = usePersonalUILocale().message("business.accountTitle");

void provider;
void ConsumerFormatting;
void unsupportedLocale;
void styledProvider;
void missingPlaceholder;
void businessMessage;
