import type { ReactNode } from "react";

export type ExplorerCaseState =
  | "default"
  | "disabled"
  | "readOnly"
  | "controlled"
  | "uncontrolled"
  | "loading"
  | "empty"
  | "error"
  | "validation"
  | "longContent"
  | "keyboard"
  | "mobile"
  | "overlay"
  | "dark"
  | "locale"
  | "usage";

export interface ExplorerCase {
  id: string;
  label: string;
  summary: string;
  states: readonly ExplorerCaseState[];
  content: ReactNode;
  code: string;
}

export type ExplorerCases = Partial<Record<string, readonly ExplorerCase[]>>;
