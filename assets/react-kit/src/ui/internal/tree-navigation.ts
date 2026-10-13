export interface VisibleTreeItem<Node> {
  key: string;
  node: Node;
  parentKey?: string;
  level: number;
  position: number;
  setSize: number;
  disabled: boolean;
}

export function visibleTreeItems<Node>(
  nodes: readonly Node[],
  expanded: ReadonlySet<string>,
  keyOf: (node: Node) => string,
  childrenOf: (node: Node) => readonly Node[] | undefined,
  disabledOf: (node: Node) => boolean,
  parentKey?: string,
  level = 1,
): VisibleTreeItem<Node>[] {
  return nodes.flatMap((node, index) => {
    const key = keyOf(node);
    const item: VisibleTreeItem<Node> = {
      key, node, parentKey, level, position: index + 1, setSize: nodes.length, disabled: disabledOf(node),
    };
    return expanded.has(key)
      ? [item, ...visibleTreeItems(childrenOf(node) ?? [], expanded, keyOf, childrenOf, disabledOf, key, level + 1)]
      : [item];
  });
}

export function resolvedTreeKey<Node>(
  visible: readonly VisibleTreeItem<Node>[],
  current: string | undefined,
  previousOrder: readonly string[],
): string | undefined {
  if (visible.some((item) => item.key === current && !item.disabled)) return current;
  const oldIndex = previousOrder.indexOf(current ?? "");
  if (oldIndex >= 0) {
    for (let index = oldIndex; index < previousOrder.length; index += 1) {
      const candidate = visible.find((item) => item.key === previousOrder[index] && !item.disabled);
      if (candidate) return candidate.key;
    }
    for (let index = oldIndex - 1; index >= 0; index -= 1) {
      const candidate = visible.find((item) => item.key === previousOrder[index] && !item.disabled);
      if (candidate) return candidate.key;
    }
  }
  return visible.find((item) => !item.disabled)?.key;
}

export function adjacentTreeKey<Node>(
  visible: readonly VisibleTreeItem<Node>[],
  current: string | undefined,
  direction: 1 | -1,
): string | undefined {
  const index = visible.findIndex((item) => item.key === current);
  for (let next = index + direction; next >= 0 && next < visible.length; next += direction) {
    if (!visible[next].disabled) return visible[next].key;
  }
  return current;
}
