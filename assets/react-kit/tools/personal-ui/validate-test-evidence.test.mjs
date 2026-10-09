import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { validateTestEvidence } from "./validate-test-evidence.mjs";

function write(filePath, contents) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents, "utf8");
}

function keyboardSource({
  directiveExports = ["Button"],
  runner = "browser",
  family = "button",
  includeImport = true,
  includeCall = true,
  duplicate = false,
} = {}) {
  const records = [
    `{ exportName: "Button", family: "${family}", category: "actions", strategy: "native-activate" }`,
    ...(duplicate ? [`{ exportName: "Button", family: "${family}", category: "actions", strategy: "native-activate" }`] : []),
  ];
  return `// @personal-ui-coverage ${JSON.stringify({ kind: "keyboard", runner, exports: directiveExports })}
${includeImport ? 'import { registerKeyboardEvidence, type KeyboardEvidenceCase } from "../support/m6-evidence";' : ""}
const labelOnly = "Button";
const keyboardCases = [${records.join(",")}] as const satisfies readonly KeyboardEvidenceCase[];
${includeCall ? "registerKeyboardEvidence(keyboardCases);" : ""}
`;
}

function ariaSource() {
  return `// @personal-ui-coverage {"kind":"a11y","runner":"a11y","exports":["Button"]}
import { registerAriaEvidence, type AriaEvidenceCase } from "../support/m6-evidence";
const ariaCases = [{ exportName: "Button", family: "button", category: "actions" }] as const satisfies readonly AriaEvidenceCase[];
registerAriaEvidence(ariaCases);
`;
}

function createFixture() {
  const skillRoot = fs.mkdtempSync(path.join(os.tmpdir(), "personal-ui-test-evidence-"));
  const kitRoot = path.join(skillRoot, "assets", "react-kit");
  write(path.join(kitRoot, "registry.json"), JSON.stringify({ exports: ["Button"] }));
  write(path.join(kitRoot, "component-manifest.json"), JSON.stringify({
    entries: [{ id: "button", publicExports: ["Button"] }],
  }));
  write(path.join(kitRoot, "component-docs.json"), JSON.stringify({
    profiles: {
      interactive: {
        stateMode: "stateless",
        applicableStates: ["default"],
        keyboard: { mode: "custom", status: "missing" },
        aria: { mode: "owned", status: "missing" },
      },
    },
    families: { button: { category: "actions" } },
    exports: { Button: { profile: "interactive" } },
  }));
  write(path.join(kitRoot, "src", "explorer", "cases", "actions", "button.case.tsx"), `// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"button/overview","exports":["Button"]}
import { Button } from "../../../personal-ui";
const Demo = () => <Button>Save</Button>;
const buttonCase = {
  id: "button/overview",
  label: "Button",
  summary: "Button example",
  states: ["default"],
  content: <Demo />,
  stateExamples: [{ state: "default", exports: ["Button"], content: <Button>Save</Button> }],
  code: "<Button>Save</Button>",
} as const;
export default buttonCase;
`);
  write(path.join(kitRoot, "tests", "browser", "button.spec.ts"), keyboardSource());
  write(path.join(kitRoot, "tests", "a11y", "button.spec.ts"), ariaSource());
  return {
    kitRoot,
    skillRoot,
    keyboardFile: path.join(kitRoot, "tests", "browser", "button.spec.ts"),
    explorerFile: path.join(kitRoot, "src", "explorer", "cases", "actions", "button.case.tsx"),
  };
}

function withFixture(callback) {
  const fixture = createFixture();
  try {
    callback(fixture);
  } finally {
    fs.rmSync(fixture.skillRoot, { recursive: true, force: true });
  }
}

test("returns per-export keyboard and a11y refs for registered cases", () => {
  withFixture(({ kitRoot }) => {
    const result = validateTestEvidence({ kitRoot });
    assert.equal(result.ok, true, result.errors.join("\n"));
    assert.deepEqual(result.expectedCounts, { keyboard: 1, a11y: 1 });
    assert.deepEqual(result.verifiedCounts, { keyboard: 1, a11y: 1 });
    assert.deepEqual(result.evidence.keyboard.Button, ["assets/react-kit/tests/browser/button.spec.ts"]);
    assert.deepEqual(result.evidence.a11y.Button, ["assets/react-kit/tests/a11y/button.spec.ts"]);
  });
});

test("rejects directive-only ownership", () => {
  withFixture(({ kitRoot, keyboardFile }) => {
    write(keyboardFile, keyboardSource({ includeImport: false, includeCall: false }));
    const result = validateTestEvidence({ kitRoot });
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /requires exactly one registerKeyboardEvidence/);
  });
});

test("rejects an import and export-name string without a registration call", () => {
  withFixture(({ kitRoot, keyboardFile }) => {
    write(keyboardFile, keyboardSource({ includeCall: false }));
    const result = validateTestEvidence({ kitRoot });
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /requires exactly one registerKeyboardEvidence/);
  });
});

test("rejects an evidence family that disagrees with the Manifest", () => {
  withFixture(({ kitRoot, keyboardFile }) => {
    write(keyboardFile, keyboardSource({ family: "other" }));
    const result = validateTestEvidence({ kitRoot });
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /Button family must be button, received other/);
  });
});

test("rejects wrong exports, runners, and duplicate registered cases", () => {
  withFixture(({ kitRoot, keyboardFile }) => {
    write(keyboardFile, keyboardSource({
      directiveExports: ["Unknown"],
      runner: "components",
      duplicate: true,
    }));
    const result = validateTestEvidence({ kitRoot });
    const errors = result.errors.join("\n");
    assert.equal(result.ok, false);
    assert.match(errors, /runner must be browser/);
    assert.match(errors, /directive exports must exactly match/);
    assert.match(errors, /case array contains duplicate export/);
  });
});

test("rejects ownership when the Explorer case only imports or names an export", () => {
  withFixture(({ kitRoot, explorerFile }) => {
    write(explorerFile, `// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"button/overview","exports":["Button"]}
import { Button } from "../../../personal-ui";
const buttonCase = {
  id: "button/overview",
  label: "Button",
  summary: "Button example",
  states: ["default"],
  content: <div>{"Button"}</div>,
  code: "Button",
} as const;
export default buttonCase;
`);
    const result = validateTestEvidence({ kitRoot });
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /Button needs reachable JSX/);
  });
});
