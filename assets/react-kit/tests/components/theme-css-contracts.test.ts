// @personal-ui-coverage {"kind":"unit","runner":"components","exports":["ThemeProvider"]}
import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const entryPath = resolve(process.cwd(), "src/personal-ui/styles.css");
const sourceRoot = resolve(dirname(entryPath), "../..");
const rawColorPattern = /#[0-9a-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\s*\(/i;
const localImportPattern = /@import\s+["']([^"']+\.css)["']\s*;/g;
const themeTokenDeclarationPattern = /^--(?:pui|_pui)-[\w-]+\s*:/;

function stripCommentsPreservingLines(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, " "));
}

function collectStyleSources(path: string, sources = new Map<string, string>()): Map<string, string> {
  if (sources.has(path)) return sources;
  const source = stripCommentsPreservingLines(readFileSync(path, "utf8"));
  sources.set(path, source);
  for (const match of source.matchAll(localImportPattern)) {
    collectStyleSources(resolve(dirname(path), match[1]), sources);
  }
  return sources;
}

function isThemeDefinitionScope(ruleStack: readonly string[]): boolean {
  return ruleStack.some((rule) => (
    /(^|,)\s*:root(?:\s|,|$)/.test(rule)
    || /\.pui-(?:theme|portal)\[data-color-scheme=["'](?:light|dark|system)["']\]/.test(rule)
  ));
}

function rawColorViolations(path: string, source: string): string[] {
  const violations: string[] = [];
  const ruleStack: string[] = [];
  let pendingHeader = "";

  source.split(/\r?\n/).forEach((line, index) => {
    const trimmed = line.trim();
    if (rawColorPattern.test(line)) {
      const declaration = trimmed.replace(/^\s+/, "");
      if (!themeTokenDeclarationPattern.test(declaration) || !isThemeDefinitionScope(ruleStack)) {
        violations.push(`${relative(sourceRoot, path)}:${index + 1}: ${trimmed}`);
      }
    }

    for (const character of `${line}\n`) {
      if (character === "{") {
        ruleStack.push(pendingHeader.trim());
        pendingHeader = "";
      } else if (character === "}") {
        ruleStack.pop();
        pendingHeader = "";
      } else if (character === ";") {
        pendingHeader = "";
      } else {
        pendingHeader += character;
      }
    }
  });

  return violations;
}

describe("theme CSS contracts", () => {
  it("keeps raw colors inside semantic theme-token definitions", () => {
    const violations = Array.from(collectStyleSources(entryPath)).flatMap(([path, source]) => (
      rawColorViolations(path, source)
    ));
    expect(violations, violations.join("\n")).toEqual([]);
  });

  it("uses the dedicated focus token for CSS outlines", () => {
    const violations = Array.from(collectStyleSources(entryPath)).flatMap(([path, source]) => (
      source.split(/\r?\n/).flatMap((line, index) => (
        /outline(?:-color)?\s*:[^;]*var\(--pui-primary\)/.test(line)
          ? [`${relative(sourceRoot, path)}:${index + 1}: ${line.trim()}`]
          : []
      ))
    ));
    expect(violations, violations.join("\n")).toEqual([]);
  });
});
