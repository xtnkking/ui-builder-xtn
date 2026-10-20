/** Follow the same aria-controls ownership used by the modal layer kernel. */
export function floatingBranchContainers(roots: readonly HTMLElement[]): HTMLElement[] {
  const containers = [...roots];
  const discovered = new Set(containers);
  for (let index = 0; index < containers.length; index += 1) {
    const container = containers[index];
    container.querySelectorAll<HTMLElement>("[aria-controls]").forEach((controller) => {
      controller.getAttribute("aria-controls")?.trim().split(/\s+/).forEach((controlledId) => {
        const floatingRoot = container.ownerDocument.getElementById(controlledId)
          ?.closest<HTMLElement>("[data-ui-floating-root='true']");
        if (!floatingRoot || discovered.has(floatingRoot)) return;
        discovered.add(floatingRoot);
        containers.push(floatingRoot);
      });
    });
  }
  return containers;
}

export function floatingBranchContains(roots: readonly HTMLElement[], target: EventTarget | null): boolean {
  if (!target || !("nodeType" in target)) return false;
  return floatingBranchContainers(roots).some((container) => container.contains(target as Node));
}
