import type { ExplorerCases } from "../types";
import cascaderCase from "./cascader.case";
import checkboxCase from "./checkbox.case";
import codeEditorCase from "./code-editor.case";
import colorPickerCase from "./color-picker.case";
import comboboxCase from "./combobox.case";
import dateTimeCase from "./date-time.case";
import fieldCase from "./field.case";
import formCase from "./form.case";
import inlineEditCase from "./inline-edit.case";
import markdownEditorCase from "./markdown-editor.case";
import multiSelectCase from "./multi-select.case";
import numberCase from "./number.case";
import otpCase from "./otp.case";
import radioCase from "./radio.case";
import ratingCase from "./rating.case";
import searchInputCase from "./search-input.case";
import segmentedCase from "./segmented.case";
import selectCase from "./select.case";
import sliderCase from "./slider.case";
import switchCase from "./switch.case";
import tagInputCase from "./tag-input.case";
import textInputCase from "./text-input.case";
import textareaCase from "./textarea.case";
import transferCase from "./transfer.case";
import treeSelectCase from "./tree-select.case";
import uploadCase from "./upload.case";

export const inputExplorerCases: ExplorerCases = {
  cascader: [cascaderCase],
  checkbox: [checkboxCase],
  "code-editor": [codeEditorCase],
  "color-picker": [colorPickerCase],
  combobox: [comboboxCase],
  "date-time": [dateTimeCase],
  field: [fieldCase],
  form: [formCase],
  "inline-edit": [inlineEditCase],
  "markdown-editor": [markdownEditorCase],
  "multi-select": [multiSelectCase],
  number: [numberCase],
  otp: [otpCase],
  radio: [radioCase],
  rating: [ratingCase],
  "search-input": [searchInputCase],
  segmented: [segmentedCase],
  select: [selectCase],
  slider: [sliderCase],
  switch: [switchCase],
  "tag-input": [tagInputCase],
  "text-input": [textInputCase],
  textarea: [textareaCase],
  transfer: [transferCase],
  "tree-select": [treeSelectCase],
  upload: [uploadCase],
};
