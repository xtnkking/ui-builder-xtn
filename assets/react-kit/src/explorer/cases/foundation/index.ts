import aspectCase from "./aspect.case";
import colorCase from "./color.case";
import densityCase from "./density.guide";
import dividerCase from "./divider.case";
import focusCase from "./focus.guide";
import focusTrapCase from "./focus-trap.case";
import iconsCase from "./icons.guide";
import keyboardCase from "./keyboard.case";
import layoutCase from "./layout.case";
import localeCase from "./locale.case";
import motionCase from "./motion.guide";
import portalCase from "./portal.case";
import radiusCase from "./radius.guide";
import resizableCase from "./resizable.case";
import responsiveCase from "./responsive.case";
import responsiveVisibilityCase from "./responsive-visibility.case";
import scrollCase from "./scroll.case";
import spacingCase from "./spacing.guide";
import stickyCase from "./sticky.case";
import surfaceCase from "./surface.guide";
import typographyCase from "./typography.guide";
import visuallyHiddenCase from "./visually-hidden.case";
import zIndexCase from "./z-index.guide";
import "./foundation-demo.css";

export const foundationExplorerCases = {
  aspect: [aspectCase],
  color: [colorCase],
  density: [densityCase],
  divider: [dividerCase],
  focus: [focusCase],
  "focus-trap": [focusTrapCase],
  icons: [iconsCase],
  keyboard: [keyboardCase],
  layout: [layoutCase],
  locale: [localeCase],
  motion: [motionCase],
  portal: [portalCase],
  radius: [radiusCase],
  resizable: [resizableCase],
  responsive: [responsiveCase],
  "responsive-visibility": [responsiveVisibilityCase],
  scroll: [scrollCase],
  spacing: [spacingCase],
  sticky: [stickyCase],
  surface: [surfaceCase],
  typography: [typographyCase],
  "visually-hidden": [visuallyHiddenCase],
  "z-index": [zIndexCase],
} as const;
