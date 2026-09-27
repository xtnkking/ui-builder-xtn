import type { PublicControlProps } from "../foundation/contracts";

const FIXED_CONTROL_PROTECTED_PROPS = new Set([
  "classname",
  "style",
  "css",
  "sx",
  "tw",
  "ref",
  "dangerouslysetinnerhtml",
  "internalclassname",
]);

export function sanitizeFixedControlProps<Props extends object>(
  props: Props,
  componentProtectedProps: readonly string[] = [],
): PublicControlProps<Props> {
  const componentProtected = new Set(componentProtectedProps.map((key) => key.toLowerCase()));
  const entries = Object.entries(props).filter(([key]) => {
    const normalizedKey = key.toLowerCase();
    return !FIXED_CONTROL_PROTECTED_PROPS.has(normalizedKey)
      && !componentProtected.has(normalizedKey)
      && !normalizedKey.startsWith("data-pui-");
  });
  return Object.fromEntries(entries) as PublicControlProps<Props>;
}
