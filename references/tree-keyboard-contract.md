# Tree And TreeSelect Keyboard Contract (M5-01)

Both widgets use a single selected value (`id` for `Tree`, `value` for `TreeSelect`) and a separate active key. Expansion does not select. They do not expose multi-select, checkboxes, or cascade selection. Keys must be unique and stable across renders. For a rich React label, provide `textValue` so its `treeitem` has a meaningful accessible name.

`Tree` is an inline hierarchy. `TreeSelect` is a form-associated combobox trigger with a portal tree; it keeps scalar `FormData`, required/reset, and portal positioning from the existing form/overlay contracts. The component owns its trigger and restores trigger focus after selecting or pressing Escape. The portal does not add a Tab stop for each node.

| Key | Active treeitem behavior |
| --- | --- |
| ArrowDown / ArrowUp | Move to the next / previous visible enabled item. |
| Home / End | Move to first / last visible enabled item. |
| ArrowRight | Expand a collapsed branch; when already expanded, move to its first enabled child. |
| ArrowLeft | Collapse an expanded branch; otherwise move to its closest enabled ancestor. |
| Enter / Space | Select the focused item. In `TreeSelect`, close and restore trigger focus. |
| Tab / Shift+Tab | Leave the tree. In `TreeSelect`, close its portal and continue from the trigger's adjacent Tab stop. |
| Escape | In `TreeSelect`, close the portal and restore trigger focus. |

The `TreeSelect` trigger opens on click/Enter/Space and on ArrowDown (first enabled node) or ArrowUp (last enabled visible node); disabled and all-disabled trees have a focusable tree fallback but no active/selectable node. A `Tree` with all nodes disabled also puts the empty active stop on the tree root. Collapsing an ancestor moves active focus to that ancestor. Removing or filtering the active key falls forward to the nearest still-visible enabled key from the prior order, then backward; an entirely disabled tree falls back to its root. A controlled `value` still requires `onValueChange`; an externally supplied value does not turn a disabled item into a keyboard target. When the trigger is the last Tab stop inside a modal, Tab from the portal tree wraps to the first modal Tab stop instead of escaping the dialog.

```tsx
const [selected, setSelected] = useState("");
const [expanded, setExpanded] = useState<string[]>([]);
<Tree
  nodes={[{ id: "account", label: "Account", children: [{ id: "profile", label: "Profile" }] }]}
  ariaLabel="Account tree"
  value={selected}
  onValueChange={setSelected}
  expandedIds={expanded}
  onExpandedChange={setExpanded}
/>;
```
