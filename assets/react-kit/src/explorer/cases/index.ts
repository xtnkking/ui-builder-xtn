import { actionExplorerCases } from "./actions";
import { dataExplorerCases } from "./data";
import { feedbackExplorerCases } from "./feedback";
import { foundationExplorerCases } from "./foundation";
import { inputExplorerCases } from "./input";
import { navigationExplorerCases } from "./navigation";
import { overlayExplorerCases } from "./overlay";
import { patternExplorerCases } from "./pattern";
import type { ExplorerCase, ExplorerCases } from "./types";

export type { ExplorerCase, ExplorerCases, ExplorerCaseState } from "./types";

export const bundledExplorerCases: ExplorerCases = {
  ...foundationExplorerCases,
  ...actionExplorerCases,
  ...inputExplorerCases,
  ...navigationExplorerCases,
  ...dataExplorerCases,
  ...feedbackExplorerCases,
  ...overlayExplorerCases,
  ...patternExplorerCases,
};

export function mergeExplorerCases(
  bundled: ExplorerCases,
  additions: ExplorerCases = {},
): ExplorerCases {
  const merged: Record<string, readonly ExplorerCase[]> = {};
  for (const [familyId, cases] of Object.entries(bundled)) {
    if (cases?.length) merged[familyId] = cases;
  }
  for (const [familyId, cases] of Object.entries(additions)) {
    if (!cases?.length) continue;
    merged[familyId] = [...(merged[familyId] ?? []), ...cases];
  }
  return merged;
}
