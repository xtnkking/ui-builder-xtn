// Pure inventory contracts: discovery/capture is separate from visual acceptance.
export function inspectExplorerDirectory(links, manifest, docs) {
  const expected = new Map(manifest.entries.map(entry => {
    const section = docs.families[entry.id]?.category === "pattern" ? "patterns" : "components";
    return [`#/${section}/${entry.id}`, entry.id];
  }));
  const seen = new Set();
  const families = [];
  const excluded = [];
  const errors = [];
  for (const link of links) {
    if (/^#\/(?:examples(?:\/[^?#]*)?|themes)$/.test(link.href ?? "")) {
      excluded.push({ ...link, reason: "outside-component-and-pattern-inventory" });
      continue;
    }
    const id = expected.get(link.href);
    if (!id) {
      errors.push(`Unexpected family directory route: ${link.href}`);
      continue;
    }
    if (seen.has(link.href)) {
      errors.push(`Duplicate family directory route: ${link.href}`);
      continue;
    }
    seen.add(link.href);
    families.push({ ...link, id });
  }
  for (const route of expected.keys()) {
    if (!seen.has(route)) errors.push(`Missing family directory route: ${route}`);
  }
  return { families, excluded, expectedRoutes: [...expected.keys()], errors };
}

export function selectAuditCases(available, requestedIds = []) {
  if (!available.length) throw new Error("No runnable Explorer preview cases were discovered");
  if (!requestedIds.length) return [available[0]];
  const byId = new Map(available.map(item => [item.id, item]));
  if (byId.size !== available.length) throw new Error("Duplicate Explorer case ids were discovered");
  return [...new Set(requestedIds)].map(id => {
    const item = byId.get(id);
    if (!item) throw new Error(`Requested Explorer case is missing: ${id}`);
    return item;
  });
}

export function summarizeCapturedMetrics(metrics) {
  return {
    outcome: "captured-not-accepted",
    requiresVisualReview: true,
    observations: [
      ...(metrics.documentOverflow > 1 ? [{ kind: "document-horizontal-overflow", pixels: metrics.documentOverflow }] : []),
      ...(metrics.textClips ?? []).map(clip => ({ kind: "possible-vertical-text-clip", ...clip })),
    ],
    // Internal table/list scrolling is intentional and is not document overflow.
    acceptance: "not-evaluated",
  };
}
