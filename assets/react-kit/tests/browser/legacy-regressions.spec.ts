// @personal-ui-coverage {"kind":"browser","runner":"browser","exports":["AsyncSelect","Autocomplete","ConfirmDialog","ContextMenu","DataTable","DescriptionList","Dialog","Drawer","DropdownMenu","Field","FilterBar","Inline","Input","List","MultiSelect","NumberInput","PasswordInput","TagInput","TreeSelect"]}
import { expect, test, type Page } from "@playwright/test";
import {
  asyncSelectOverlayWidths,
  runAsyncSelectOverlayRegression,
} from "../../../../scripts/test_async_select_overlay_browser.mjs";
import { runDataTableFocusRegression } from "../../../../scripts/test_data_table_focus_browser.mjs";
import { runDataTableRoundedRegression } from "../../../../scripts/test_data_table_rounded_browser.mjs";
import { runDataTableSelectionPinningRegression } from "../../../../scripts/test_data_table_selection_pinning_browser.mjs";
import { runDialogMultiSelectRegression } from "../../../../scripts/test_dialog_multiselect_browser.mjs";
import { runFieldGroupSpacingRegression } from "../../../../scripts/test_field_group_spacing_browser.mjs";
import { runInputInvalidFocusRegression } from "../../../../scripts/test_input_invalid_focus_browser.mjs";
import { runListPageWidthRegression } from "../../../../scripts/test_list_page_width_browser.mjs";
import { runNumberInputRegression } from "../../../../scripts/test_number_input_browser.mjs";
import { runQueryControlAlignmentRegression } from "../../../../scripts/test_query_control_alignment_browser.mjs";

type BrowserRegression = (options: { page: Page; baseURL: string }) => Promise<void>;

const asyncSelectOverlayRegressions = asyncSelectOverlayWidths.map(
  (width) => [
    `async select and overlay positioning at ${width}px`,
    ({ page, baseURL }: { page: Page; baseURL: string }) =>
      runAsyncSelectOverlayRegression({ page, baseURL, widths: [width] }),
  ] as const,
);

const browserRegressions = [
  ...asyncSelectOverlayRegressions,
  ["data table action focus", runDataTableFocusRegression],
  ["data table rounding and stable height", runDataTableRoundedRegression],
  ["data table selection pinning", runDataTableSelectionPinningRegression],
  ["dialog and multiselect behavior", runDialogMultiSelectRegression],
  ["field group spacing", runFieldGroupSpacingRegression],
  ["invalid input focus styling", runInputInvalidFocusRegression],
  ["list page width and drawer layout", runListPageWidthRegression],
  ["number input behavior", runNumberInputRegression],
  ["query control alignment", runQueryControlAlignmentRegression],
] satisfies ReadonlyArray<readonly [string, BrowserRegression]>;

test.describe("browser regressions", () => {
  for (const [name, regression] of browserRegressions) {
    test(name, async ({ page, baseURL }) => {
      test.setTimeout(330_000);
      if (!baseURL) throw new Error("Playwright baseURL is required for browser regressions");
      await test.step("uses the configured browser context", async () => {
        const environment = await page.evaluate(() => ({
          language: navigator.language,
          localeLanguage: new Intl.Locale(Intl.DateTimeFormat().resolvedOptions().locale).language,
          localeRegion: new Intl.Locale(Intl.DateTimeFormat().resolvedOptions().locale).region,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }));
        expect(environment).toEqual({
          language: "zh-CN",
          localeLanguage: "zh",
          localeRegion: "CN",
          timeZone: "Asia/Shanghai",
        });
      });
      await regression({ page, baseURL });
    });
  }
});
