import { createContext } from "react";
import type { ToastOptions } from "../feedback/feedback";
import type { UILocaleContext } from "../foundation/locale";

interface ToastContextValue {
  toast: (options: ToastOptions, localeContext: UILocaleContext) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
  update: (id: string, options: Pick<ToastOptions, "title" | "description" | "tone" | "closable">, localeContext: UILocaleContext) => void;
}

/** Shared internal identity; never re-export this context from the public barrel. */
export const ToastContext = createContext<ToastContextValue | null>(null);
