import buttonCase from "./button.case";
import buttonGroupCase from "./button-group.case";
import clipboardCase from "./clipboard.case";
import dragCase from "./drag.case";
import filterBarCase from "./filter-bar.case";
import iconButtonCase from "./icon-button.case";
import linkCase from "./link.case";
import sortableCase from "./sortable.case";
import splitButtonCase from "./split-button.case";
import toggleButtonCase from "./toggle-button.case";
import toolbarCase from "./toolbar.case";

export const actionExplorerCases = {
  button: [buttonCase],
  "button-group": [buttonGroupCase],
  clipboard: [clipboardCase],
  drag: [dragCase],
  "filter-bar": [filterBarCase],
  "icon-button": [iconButtonCase],
  link: [linkCase],
  sortable: [sortableCase],
  "split-button": [splitButtonCase],
  "toggle-button": [toggleButtonCase],
  toolbar: [toolbarCase],
} as const;
