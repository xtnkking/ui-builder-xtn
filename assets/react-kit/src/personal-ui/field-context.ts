import { createContext } from "react";

export interface FieldContextValue {
  controlId?: string;
  labelId?: string;
  groupName?: string;
  describedBy?: string;
  invalid: boolean;
  required: boolean;
  group: boolean;
}

export const FieldContext = createContext<FieldContextValue | null>(null);
