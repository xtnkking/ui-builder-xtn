import type { ExplorerCases } from "../types";
import anchorCase from "./anchor.case";
import appNavigationCase from "./app-navigation.case";
import breadcrumbCase from "./breadcrumb.case";
import commandCase from "./command.case";
import infiniteScrollCase from "./infinite-scroll.case";
import loadMoreCase from "./load-more.case";
import menuCase from "./menu.case";
import paginationCase from "./pagination.case";
import stepperCase from "./stepper.case";
import tabsCase from "./tabs.case";

export const navigationExplorerCases: ExplorerCases = {
  anchor: [anchorCase],
  "app-navigation": [appNavigationCase],
  breadcrumb: [breadcrumbCase],
  command: [commandCase],
  "infinite-scroll": [infiniteScrollCase],
  "load-more": [loadMoreCase],
  menu: [menuCase],
  pagination: [paginationCase],
  stepper: [stepperCase],
  tabs: [tabsCase],
};
