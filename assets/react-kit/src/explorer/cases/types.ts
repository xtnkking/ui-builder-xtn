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
  /** Applicable states are declarations; only these runnable fixtures demonstrate them. */
  stateExamples?: readonly ExplorerStateExample[];
  content: ReactNode;
  code: string;
}

export interface ExplorerStateExample {
  state: ExplorerCaseState;
  exports: readonly string[];
  content: ReactNode;
  /** Manual interaction steps, not a claim that browser behavior has been verified. */
  instructions?: string;
}

export type ExplorerCases = Partial<Record<string, readonly ExplorerCase[]>>;
