import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  checkLocaleContract,
  collectHardcodedLocaleFindings,
  validateLocaleDictionaries,
} from "../../tools/personal-ui/check-locale-contract.mjs";

const localeSource = fs.readFileSync(path.resolve("src/personal-ui/foundation/locale.tsx"), "utf8");

describe("locale source contracts", () => {
  it("keeps dictionaries complete and public source language ownership explicit", () => {
    expect(checkLocaleContract()).toEqual([]);
  });

  it("rejects a missing locale key", () => {
    const broken = localeSource.replace('  "common.processing": "Processing",\n', "");
    expect(validateLocaleDictionaries(broken)).toContainEqual(expect.stringMatching(/Message keys differ/));
  });

  it("rejects placeholder drift and missing plural other forms", () => {
    const placeholderDrift = localeSource.replace(
      '  "toast.closeTitle": "Close notification: {title}",',
      '  "toast.closeTitle": "Close notification: {name}",',
    );
    expect(validateLocaleDictionaries(placeholderDrift)).toContain(
      "Message toast.closeTitle uses different placeholders in zh-CN and en-US.",
    );

    const missingOther = localeSource.replace(
      '  "member.dataRows": { one: "Loaded {count} member record", other: "Loaded {count} member records" },',
      '  "member.dataRows": { one: "Loaded {count} member record" },',
    );
    expect(validateLocaleDictionaries(missingOther)).toContain("Plural member.dataRows is missing en-US.other.");
  });

  it("rejects CJK punctuation even when a template contains no Han characters", () => {
    expect(collectHardcodedLocaleFindings(
      "const label = `${name}，${month}`;",
      "src/personal-ui/fixture.ts",
    )).toContainEqual(expect.objectContaining({
      kind: "language-string",
      value: "，",
    }));
    expect(collectHardcodedLocaleFindings(
      "const label = `${name}, ${month}`;",
      "src/personal-ui/fixture.ts",
    )).toEqual([]);
  });
});
