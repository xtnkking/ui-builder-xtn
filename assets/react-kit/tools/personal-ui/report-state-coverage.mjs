#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { validateExplorerCases } from "./validate-explorer-cases.mjs";

const output = process.argv[2];
if (!output) throw new Error("Provide a state coverage inventory path.");
const result = validateExplorerCases({ kitRoot: process.cwd(), requireStateExamples: false });
const records = Object.entries(result.stateCoverage.evidence);
const report = {
  schemaVersion: 1,
  kind: "personal-ui-runnable-state-inventory",
  kitRoot: path.resolve(process.cwd()),
  sourceValidity: result.ok,
  stateCoverageComplete: result.stateCoverage.complete,
  familyCount: result.expectedCaseCount,
  mappedExportCount: records.length,
  realizedExportStateCount: records.reduce((sum, [, states]) => sum + states.length, 0),
  remainingExportStateCount: result.stateCoverage.gaps.length,
  sourceHashes: result.sourceHashes,
  cases: result.cases,
  evidence: result.stateCoverage.evidence,
  gaps: result.stateCoverage.gaps,
  sourceErrors: result.errors,
  stateErrors: result.stateCoverage.errors,
  note: "Source inventory, not release acceptance. Runnable source fixtures and manual keyboard entries do not certify browser behavior. Default examples:check remains strict and rejects outstanding states.",
};
fs.writeFileSync(path.resolve(output), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${report.familyCount} families; ${report.realizedExportStateCount} mapped export-states; ${report.remainingExportStateCount} remaining; source validity ${result.ok}; full state coverage ${report.stateCoverageComplete}.\n`);
process.exitCode = result.ok ? 0 : 1;
