import type { ExplorerCases } from "../types";
import dialogCase from "./dialog.case";
import drawerCase from "./drawer.case";
import hoverCardCase from "./hover-card.case";
import lightboxCase from "./lightbox.case";
import popconfirmCase from "./popconfirm.case";
import popoverCase from "./popover.case";
import tooltipCase from "./tooltip.case";
import tourCase from "./tour.case";

export const overlayExplorerCases: ExplorerCases = {
  dialog: [dialogCase],
  drawer: [drawerCase],
  "hover-card": [hoverCardCase],
  lightbox: [lightboxCase],
  popconfirm: [popconfirmCase],
  popover: [popoverCase],
  tooltip: [tooltipCase],
  tour: [tourCase],
};
