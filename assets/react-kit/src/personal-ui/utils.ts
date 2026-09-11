import type { CSSProperties } from "react";

export function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export function assertUniqueIdentities(
  componentName: string,
  identityName: string,
  identities: readonly unknown[],
  { allowEmpty = false }: { allowEmpty?: boolean } = {},
): void {
  const firstIndexByIdentity = new Map<string, number>();
  identities.forEach((identity, index) => {
    if (
      typeof identity !== "string"
      || (identity !== "" && !identity.trim())
      || (!allowEmpty && identity === "")
    ) {
      throw new Error(
        `${componentName} received an invalid ${identityName} at index ${index}: ${JSON.stringify(identity)}. `
        + (allowEmpty
          ? "Identity values must be non-empty strings except for a single empty-string form value."
          : "Identity values must be non-empty strings."),
      );
    }
    const firstIndex = firstIndexByIdentity.get(identity);
    if (firstIndex !== undefined) {
      throw new Error(
        `${componentName} received a duplicate ${identityName} "${identity}" at indices ${firstIndex} and ${index}.`,
      );
    }
    firstIndexByIdentity.set(identity, index);
  });
}

export type CSSVariableProperties = CSSProperties & Record<`--${string}`, string | number>;

export function stopPropagation(event: { stopPropagation(): void }): void {
  event.stopPropagation();
}

const tabbableSelector = [
  "a[href]",
  "area[href]",
  "button:not(:disabled)",
  "input:not(:disabled):not([type='hidden'])",
  "select:not(:disabled)",
  "textarea:not(:disabled)",
  "summary",
  "iframe",
  "object",
  "embed",
  "audio[controls]",
  "video[controls]",
  "[contenteditable='true']",
  "[contenteditable='plaintext-only']",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function isVisibleElement(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);
  return style.display !== "none"
    && style.visibility !== "hidden"
    && element.getClientRects().length > 0;
}

export function getTabStops(
  root: Document | HTMLElement,
  include?: (element: HTMLElement) => boolean,
): HTMLElement[] {
  const ordered = Array.from(root.querySelectorAll<HTMLElement>(tabbableSelector))
    .map((element, order) => ({ element, order }))
    .filter(({ element }) => (
      element.tabIndex >= 0
      && !element.matches(":disabled")
      && (!include || include(element))
      && !element.closest("[inert]")
      && !element.closest("[aria-hidden='true']")
      && isVisibleElement(element)
    ))
    .sort((left, right) => {
      const leftIndex = left.element.tabIndex;
      const rightIndex = right.element.tabIndex;
      if (leftIndex > 0 && rightIndex > 0) return leftIndex - rightIndex || left.order - right.order;
      if (leftIndex > 0) return -1;
      if (rightIndex > 0) return 1;
      return left.order - right.order;
    })
    .map(({ element }) => element);
  const radioGroups = new Map<HTMLFormElement | null, Map<string, HTMLInputElement[]>>();

  ordered.forEach((element) => {
    if (!(element instanceof HTMLInputElement) || element.type !== "radio" || !element.name) return;
    const formGroups = radioGroups.get(element.form) ?? new Map<string, HTMLInputElement[]>();
    const group = formGroups.get(element.name) ?? [];
    group.push(element);
    formGroups.set(element.name, group);
    radioGroups.set(element.form, formGroups);
  });

  const activeRadios = new Set<HTMLInputElement>();
  radioGroups.forEach((formGroups) => {
    formGroups.forEach((group) => activeRadios.add(group.find((radio) => radio.checked) ?? group[0]));
  });

  return ordered.filter((element) => (
    !(element instanceof HTMLInputElement)
    || element.type !== "radio"
    || !element.name
    || activeRadios.has(element)
  ));
}
