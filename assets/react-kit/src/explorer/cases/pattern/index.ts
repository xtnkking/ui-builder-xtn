import type { ExplorerCases } from "../types";
import authenticationCase from "./authentication.case";
import createEditCase from "./create-edit.case";
import detailCase from "./detail.case";
import importExportCase from "./import-export.case";
import listFilterCase from "./list-filter.case";
import projectConsistencyCase from "./project-consistency.example";
import masterDetailCase from "./master-detail.case";
import settingsCase from "./settings.case";
import statusPageCase from "./status-page.case";
import wizardCase from "./wizard.case";

export const patternExplorerCases: ExplorerCases = {
  authentication: [authenticationCase],
  "create-edit": [createEditCase],
  detail: [detailCase],
  "import-export": [importExportCase],
  "list-filter": [listFilterCase, projectConsistencyCase],
  "master-detail": [masterDetailCase],
  settings: [settingsCase],
  "status-page": [statusPageCase],
  wizard: [wizardCase],
};
