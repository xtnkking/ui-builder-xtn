import aspectCase from "./aspect.case";
import colorCase from "./color.case";
import dividerCase from "./divider.case";
import focusTrapCase from "./focus-trap.case";
import keyboardCase from "./keyboard.case";
import layoutCase from "./layout.case";
import localeCase from "./locale.case";
import portalCase from "./portal.case";
import resizableCase from "./resizable.case";
import responsiveCase from "./responsive.case";
import responsiveVisibilityCase from "./responsive-visibility.case";
import scrollCase from "./scroll.case";
import stickyCase from "./sticky.case";
import visuallyHiddenCase from "./visually-hidden.case";

export const foundationExplorerCases = {
  aspect: [aspectCase],
  color: [colorCase],
  divider: [dividerCase],
  "focus-trap": [focusTrapCase],
  keyboard: [keyboardCase],
  layout: [layoutCase],
  locale: [localeCase],
  portal: [portalCase],
  resizable: [resizableCase],
  responsive: [responsiveCase],
  "responsive-visibility": [responsiveVisibilityCase],
  scroll: [scrollCase],
  sticky: [stickyCase],
  "visually-hidden": [visuallyHiddenCase],
} as const;
