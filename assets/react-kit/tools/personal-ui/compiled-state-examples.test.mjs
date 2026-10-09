import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

import { compiledExampleModule, defaultKitRoot } from "./public-api-model.mjs";

const requireFromKit = createRequire(path.join(defaultKitRoot, "package.json"));
const source = `import { useState } from "react";
import { Input, PasswordInput } from "../../../personal-ui";
import { StatePreview } from "../state-preview";
import type { ExplorerCase, ExplorerCaseState as CaseState } from "../types";
const stateLabel: CaseState = "default";
function ControlledExample() {
  const [value, setValue] = useState("hello");
  return <Input aria-label={stateLabel} value={value} onChange={(event) => setValue(event.currentTarget.value)} />;
}
const explorerCase = {
  id: "text-input/contract",
  label: "Inputs",
  summary: "Consumer state fixture contract",
  states: ["default", "disabled", "dark"],
  content: <ControlledExample />,
  stateExamples: [
    { state: "default", exports: ["Input"], content: <ControlledExample /> },
    { state: "disabled", exports: ["Input"], content: <Input disabled defaultValue="account" /> },
    { state: "disabled", exports: ["PasswordInput"], content: <PasswordInput disabled defaultValue="secret" />, instructions: "This password control is disabled." },
    { state: "dark", exports: ["Input"], content: <StatePreview state="dark"><ControlledExample /></StatePreview> },
  ],
  code: '<Input value={value} onChange={handleChange} />',
} satisfies ExplorerCase;
export default explorerCase;`;

function withCompiledFixture(callback) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pui-compiled-state-contract-"));
  try {
    const cases = path.join(root, "cases");
    const input = path.join(cases, "input");
    fs.mkdirSync(input, { recursive: true });
    fs.copyFileSync(path.join(defaultKitRoot, "src/explorer/cases/state-preview.tsx"), path.join(cases, "state-preview.tsx"));
    fs.copyFileSync(path.join(defaultKitRoot, "src/explorer/cases/types.ts"), path.join(cases, "types.ts"));
    const filePath = path.join(input, "contract.case.tsx");
    fs.writeFileSync(filePath, source);
    callback(compiledExampleModule(filePath, ["Input", "PasswordInput"]));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function semanticDiagnostics(code) {
  // Virtual files sit next to the installed React typings, without changing the kit.
  const normalizePath = (file) => path.resolve(file).replaceAll("\\", "/");
  const examplePath = normalizePath(path.join(defaultKitRoot, "src/compiled-state-contract.tsx"));
  const barrelPath = normalizePath(path.join(defaultKitRoot, "src/compiled-state-contract-ui.tsx"));
  const stub = `import type { ChangeEventHandler, JSX, ReactNode } from "react";
type InputProps = { value?: string; defaultValue?: string; disabled?: boolean; onChange?: ChangeEventHandler<HTMLInputElement>; "aria-label"?: string };
export declare function Input(props: InputProps): JSX.Element;
export declare function PasswordInput(props: InputProps): JSX.Element;
export declare function Box(props: { padding?: string; surface?: string; lang?: string; children?: ReactNode }): JSX.Element;
export declare function Button(props: { children?: ReactNode; onClick?: () => void }): JSX.Element;
export declare function Dialog(props: { open: boolean; onOpenChange: (value: boolean) => void; title?: string; description?: string; children?: ReactNode }): JSX.Element;
export declare function ThemeProvider(props: { mode?: "dark" | "light" | "inherit"; children?: ReactNode }): JSX.Element;
export declare function LocaleProvider(props: { locale: string; children?: ReactNode }): JSX.Element;`;
  const options = { strict: true, noEmit: true, skipLibCheck: true, target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, jsx: ts.JsxEmit.ReactJSX };
  const virtual = new Map([[examplePath, code], [barrelPath, stub]]);
  const host = ts.createCompilerHost(options);
  const fileExists = host.fileExists.bind(host);
  const readFile = host.readFile.bind(host);
  const getSourceFile = host.getSourceFile.bind(host);
  host.fileExists = (file) => virtual.has(normalizePath(file)) || fileExists(file);
  host.readFile = (file) => virtual.get(normalizePath(file)) ?? readFile(file);
  host.getSourceFile = (file, languageVersion, onError, shouldCreateNewSourceFile) => virtual.has(normalizePath(file))
    ? ts.createSourceFile(file, virtual.get(normalizePath(file)), languageVersion, true, ts.ScriptKind.TSX)
    : getSourceFile(file, languageVersion, onError, shouldCreateNewSourceFile);
  host.resolveModuleNames = (names, containingFile) => names.map((name) => name === "./personal-ui" && normalizePath(containingFile) === examplePath
    ? { resolvedFileName: barrelPath, extension: ts.Extension.Tsx }
    : ts.resolveModuleName(name, containingFile, options, host).resolvedModule);
  const program = ts.createProgram([examplePath], options, host);
  return ts.getPreEmitDiagnostics(program).map((item) => ts.flattenDiagnosticMessageText(item.messageText, " "));
}

test("complete consumer state module inlines real host and retains necessary local types", () => {
  withCompiledFixture((compiled) => {
    assert.doesNotMatch(compiled.code, /(?:from\s+["']|import\(["'])\.\.\/(?:state-preview|types)/);
    assert.match(compiled.code, /export const PersonalUiStateExamples/);
    assert.match(compiled.code, /function StatePreview/);
    assert.match(compiled.code, /type CaseState = ExplorerCaseState/);
    assert.deepEqual(compiled.stateFixtures.map(({ state, exports }) => ({ state, exports })), [
      { state: "default", exports: ["Input"] },
      { state: "disabled", exports: ["Input"] },
      { state: "disabled", exports: ["PasswordInput"] },
      { state: "dark", exports: ["Input"] },
    ]);
    assert.deepEqual(semanticDiagnostics(compiled.code), []);
  });
});

test("consumer selector keeps overview and activates exactly one requested export-state fixture", () => {
  withCompiledFixture((compiled) => {
    const publicUi = Object.fromEntries(["Input", "PasswordInput", "Box", "Button", "Dialog", "LocaleProvider", "ThemeProvider"]
      .map((name) => [name, function FixtureControl() {}]));
    const output = ts.transpileModule(compiled.code, { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
    } });
    const context = { exports: {}, require: (name) => name === "./personal-ui" ? publicUi : requireFromKit(name) };
    vm.runInNewContext(output.outputText, context);
    const { PersonalUiExample, PersonalUiStateExamples } = context.exports;
    assert.equal(PersonalUiStateExamples.length, 4);
    assert.equal(PersonalUiExample().type.name, "ControlledExample");
    const active = PersonalUiExample({ state: "disabled", component: "PasswordInput" });
    assert.equal(active.type, "section");
    assert.equal(active.props.children[0].props.children, "This password control is disabled.");
    assert.equal(active.props.children[1].type, publicUi.PasswordInput);
    assert.equal(active.props.children[1].props.disabled, true);
    assert.equal(PersonalUiExample({ state: "disabled" }).props.children[1].type, publicUi.Input);
    assert.throws(() => PersonalUiExample({ state: "dark", component: "PasswordInput" }), /No state fixture/);
  });
});
