import assert from "node:assert/strict";
import test from "node:test";
import { inspectExplorerDirectory, selectAuditCases, summarizeCapturedMetrics } from "./explorer-visual-audit-core.mjs";

const manifest = { entries: [{ id: "button" }, { id: "list-filter" }] };
const docs = { families: { button: { category: "actions" }, "list-filter": { category: "pattern" } } };
const links = [{ href: "#/components/button", label: "按钮" }, { href: "#/patterns/list-filter", label: "列表" }];

test("family directory accepts exact component/pattern sets and records business links separately", () => {
  const result = inspectExplorerDirectory([...links, { href: "#/examples/shop", label: "商城" }], manifest, docs);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.families.map(item => item.id), ["button", "list-filter"]);
  assert.equal(result.excluded[0].href, "#/examples/shop");
  assert.equal(result.excluded[0].reason, "outside-component-and-pattern-inventory");
});

test("family directory rejects equal-count substitution instead of trusting a count", () => {
  const result = inspectExplorerDirectory([links[0], { href: "#/components/unknown" }], manifest, docs);
  assert.match(result.errors.join("\n"), /Unexpected.*unknown/);
  assert.match(result.errors.join("\n"), /Missing.*patterns\/list-filter/);
});

test("family directory rejects duplicate component links", () => {
  const result = inspectExplorerDirectory([...links, links[0]], manifest, docs);
  assert.match(result.errors.join("\n"), /Duplicate.*components\/button/);
});

test("family directory rejects a known pattern under the component namespace", () => {
  const result = inspectExplorerDirectory([links[0], { href: "#/components/list-filter" }], manifest, docs);
  assert.match(result.errors.join("\n"), /Unexpected.*components\/list-filter/);
  assert.match(result.errors.join("\n"), /Missing.*patterns\/list-filter/);
});

test("family directory rejects malformed or unrecognised navigation rather than excluding it", () => {
  const result = inspectExplorerDirectory([...links, { href: "#/component/button" }], manifest, docs);
  assert.match(result.errors.join("\n"), /Unexpected.*component\/button/);
});

test("case selection defaults to the first and explicitly selects a later stable case id", () => {
  const available = [{ id: "data-table/overview", tabIndex: 0 }, { id: "data-table/actions", tabIndex: 6 }];
  assert.deepEqual(selectAuditCases(available), [available[0]]);
  assert.deepEqual(selectAuditCases(available, ["data-table/actions"]), [available[1]]);
  assert.throws(() => selectAuditCases(available, ["data-table/missing"]), /missing/);
  assert.throws(() => selectAuditCases([]), /No runnable/);
});

test("captured layout observations never imply visual acceptance or fail intentional internal scrolling", () => {
  const captured = summarizeCapturedMetrics({ documentOverflow: 0, textClips: [], internalTableOverflow: 300 });
  assert.equal(captured.outcome, "captured-not-accepted");
  assert.equal(captured.acceptance, "not-evaluated");
  assert.deepEqual(captured.observations, []);
  const flagged = summarizeCapturedMetrics({ documentOverflow: 20, textClips: [{ text: "截断" }] });
  assert.deepEqual(flagged.observations.map(item => item.kind), ["document-horizontal-overflow", "possible-vertical-text-clip"]);
  assert.equal(flagged.acceptance, "not-evaluated");
});
