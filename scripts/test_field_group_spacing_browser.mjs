import assert from "node:assert/strict";
import { isPersonalUiRegressionMain, runPersonalUiRegression } from "./browser-test-harness.mjs";

export async function runFieldGroupSpacingRegression({ page, baseURL }) {
  assert.ok(baseURL, "A baseURL is required");
  await page.setViewportSize({ width: 736, height: 700 });
  await page.goto(baseURL);

  const geometry = await page.evaluate(() => {
    const fixture = document.createElement("div");
    fixture.style.cssText = "position:fixed;inset:20px auto auto 20px;width:570px;padding:20px;background:white;z-index:99999";
    fixture.innerHTML = `
      <div class="pui-field" data-test="regular-field">
        <label class="pui-label"><span>Host or IP</span><span class="pui-label__required">Required</span></label>
        <input class="pui-input" value="92.113.135.107">
      </div>
      <div style="height:24px"></div>
      <fieldset class="pui-field pui-field--group" data-test="group-field">
        <legend class="pui-label"><span>Authentication method</span></legend>
        <div class="pui-segmented" role="group" aria-label="Authentication method">
          <button type="button" aria-pressed="true">Keep</button>
          <button type="button" aria-pressed="false">Replace</button>
          <button type="button" aria-pressed="false">None</button>
        </div>
        <div class="pui-field__hint">Choose how credentials are handled.</div>
      </fieldset>`;
    document.body.append(fixture);

    const regular = fixture.querySelector('[data-test="regular-field"]');
    const group = fixture.querySelector('[data-test="group-field"]');
    const regularLabel = regular.querySelector(".pui-label").getBoundingClientRect();
    const regularControl = regular.querySelector(".pui-input").getBoundingClientRect();
    const groupLabel = group.querySelector(".pui-label").getBoundingClientRect();
    const groupControl = group.querySelector(".pui-segmented").getBoundingClientRect();
    const groupHint = group.querySelector(".pui-field__hint").getBoundingClientRect();

    return {
      regularGap: regularControl.top - regularLabel.bottom,
      groupGap: groupControl.top - groupLabel.bottom,
      groupHintGap: groupHint.top - groupControl.bottom,
    };
  });

  assert.ok(Math.abs(geometry.regularGap - 7) <= 0.1, `regular Field gap drifted: ${geometry.regularGap}px`);
  assert.ok(Math.abs(geometry.groupGap - geometry.regularGap) <= 0.1, `group Field gap differs: ${JSON.stringify(geometry)}`);
  assert.ok(Math.abs(geometry.groupHintGap - 7) <= 0.1, `group Field hint gap drifted: ${geometry.groupHintGap}px`);
  console.log(`Field and Field group spacing match at ${geometry.groupGap}px.`);
}

if (isPersonalUiRegressionMain(import.meta.url)) {
  await runPersonalUiRegression(runFieldGroupSpacingRegression, { viewport: { width: 736, height: 700 } });
}
