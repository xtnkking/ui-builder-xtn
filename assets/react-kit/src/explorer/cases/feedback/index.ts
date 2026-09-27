import type { ExplorerCases } from "../types";
import alert from "./alert.case";
import banner from "./banner.case";
import inlineMessage from "./inline-message.case";
import progress from "./progress.case";
import result from "./result.case";
import skeleton from "./skeleton.case";
import spinner from "./spinner.case";
import toast from "./toast.case";
import validationSummary from "./validation-summary.case";

export const feedbackExplorerCases = {
  alert: [alert],
  banner: [banner],
  "inline-message": [inlineMessage],
  progress: [progress],
  result: [result],
  skeleton: [skeleton],
  spinner: [spinner],
  toast: [toast],
  "validation-summary": [validationSummary],
} satisfies ExplorerCases;
