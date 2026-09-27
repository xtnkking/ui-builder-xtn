// @personal-ui-coverage {"kind":"unit","runner":"components","exports":["Tree","TreeSelect"]}
import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Tree, TreeSelect } from "../../src/personal-ui";

const nodes = [
  { id: "account", label: "Account", children: [
    { id: "profile", label: "Profile" },
    { id: "blocked", label: "Blocked", disabled: true },
  ] },
  { id: "settings", label: "Settings" },
];
const options = [
  { value: "account", label: "Account", children: [
    { value: "profile", label: "Profile" },
    { value: "blocked", label: "Blocked", disabled: true },
  ] },
  { value: "settings", label: "Settings" },
];

describe("tree roving keyboard model", () => {
  it("Tree expands and navigates visible enabled items without extra Tab stops", async () => {
    const user = userEvent.setup();
    const changes: string[] = [];
    render(<Tree nodes={nodes} ariaLabel="Account tree" onValueChange={(value) => changes.push(value)} />);
    const tree = screen.getByRole("tree", { name: "Account tree" });
    expect(within(tree).getAllByRole("treeitem").filter((item) => item.tabIndex === 0)).toHaveLength(1);
    const account = within(tree).getByRole("treeitem", { name: "Account" });
    account.focus();
    await user.keyboard("{ArrowRight}");
    expect(account).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{ArrowDown}");
    expect(within(tree).getByRole("treeitem", { name: "Profile" })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(within(tree).getByRole("treeitem", { name: "Settings" })).toHaveFocus();
    await user.keyboard("{Home}");
    expect(account).toHaveFocus();
    await user.keyboard("{ArrowRight}{Enter}");
    expect(changes).toEqual(["profile"]);
    expect(within(tree).getByRole("treeitem", { name: "Profile" })).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowLeft}");
    expect(account).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(account).toHaveAttribute("aria-expanded", "false");
    expect(within(tree).queryByRole("treeitem", { name: "Profile" })).toBeNull();
  });

  it("Tree falls back when its focused item is removed, hidden, or every item is disabled", async () => {
    const user = userEvent.setup();
    function ChangingTree() {
      const [withSettings, setWithSettings] = useState(true);
      return <>
        <button type="button" onClick={() => setWithSettings(false)}>Remove settings</button>
        <Tree nodes={withSettings ? nodes : nodes.slice(0, 1)} ariaLabel="Changing tree" defaultExpandedIds={["account"]} />
      </>;
    }
    const { rerender } = render(<ChangingTree />);
    const settings = screen.getByRole("treeitem", { name: "Settings" });
    settings.focus();
    await user.click(screen.getByRole("button", { name: "Remove settings" }));
    expect(screen.getByRole("treeitem", { name: "Profile" })).toHaveAttribute("tabindex", "0");
    rerender(<Tree nodes={[{ id: "locked", label: "Locked", disabled: true }]} ariaLabel="Locked tree" />);
    expect(screen.getByRole("tree", { name: "Locked tree" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("treeitem", { name: "Locked" })).toHaveAttribute("aria-disabled", "true");
  });

  it("returns real focus to the nearest visible node after removing the active key", () => {
    const { rerender } = render(<Tree nodes={nodes} ariaLabel="Changing tree" defaultExpandedIds={["account"]} />);
    screen.getByRole("treeitem", { name: "Settings" }).focus();
    rerender(<Tree nodes={nodes.slice(0, 1)} ariaLabel="Changing tree" defaultExpandedIds={["account"]} />);
    expect(screen.getByRole("treeitem", { name: "Profile" })).toHaveFocus();
  });

  it("TreeSelect opens, navigates, selects, and restores trigger focus", async () => {
    const user = userEvent.setup();
    render(<form><TreeSelect name="section" options={options} defaultValue="" ariaLabel="Section" /><button type="button">After</button></form>);
    const trigger = screen.getByRole("combobox", { name: "Section" });
    trigger.focus();
    await user.keyboard("{ArrowDown}");
    const tree = screen.getByRole("tree", { name: "Section" });
    const account = within(tree).getByRole("treeitem", { name: "Account" });
    expect(account).toHaveFocus();
    expect(within(tree).getAllByRole("treeitem").filter((item) => item.tabIndex === 0)).toHaveLength(1);
    await user.keyboard("{ArrowRight}{ArrowDown}");
    expect(within(tree).getByRole("treeitem", { name: "Profile" })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(within(tree).getByRole("treeitem", { name: "Settings" })).toHaveFocus();
    await user.keyboard("{ArrowUp}{Enter}");
    expect(trigger).toHaveFocus();
    expect(screen.queryByRole("tree", { name: "Section" })).toBeNull();
    expect(new FormData(trigger.closest("form")!).get("section")).toBe("profile");
  });

  it("TreeSelect pointer selection of a nested item does not select its ancestor", async () => {
    const user = userEvent.setup();
    render(<form><TreeSelect name="section" options={options} defaultValue="" ariaLabel="Section" /></form>);
    const trigger = screen.getByRole("combobox", { name: "Section" });
    await user.click(trigger);
    const tree = screen.getByRole("tree", { name: "Section" });
    await user.keyboard("{ArrowRight}");
    await user.click(within(tree).getByRole("treeitem", { name: "Profile" }));
    expect(new FormData(trigger.closest("form")!).get("section")).toBe("profile");
    expect(trigger).toHaveTextContent("Profile");
    expect(trigger).toHaveFocus();
  });

  it("TreeSelect reconciles collapsed and removed nodes, then permits Tab to leave", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<><TreeSelect options={options} defaultValue="" ariaLabel="Section" /><button type="button">After</button></>);
    const trigger = screen.getByRole("combobox", { name: "Section" });
    trigger.focus();
    await user.keyboard("{ArrowDown}{ArrowRight}{ArrowDown}");
    expect(screen.getByRole("treeitem", { name: "Profile" })).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("treeitem", { name: "Account" })).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(screen.queryByRole("treeitem", { name: "Profile" })).toBeNull();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("treeitem", { name: "Settings" })).toHaveFocus();
    rerender(<><TreeSelect options={options.slice(0, 1)} defaultValue="" ariaLabel="Section" /><button type="button">After</button></>);
    expect(screen.getByRole("treeitem", { name: "Account" })).toHaveFocus();
    await user.keyboard("{Tab}");
    expect(screen.getByRole("button", { name: "After" })).toHaveFocus();
    expect(screen.queryByRole("tree", { name: "Section" })).toBeNull();
  });

  it("TreeSelect offers the tree itself when every option is disabled", async () => {
    const user = userEvent.setup();
    render(<TreeSelect options={[{ value: "blocked", label: "Blocked", disabled: true }]} defaultValue="" ariaLabel="Disabled section" />);
    const trigger = screen.getByRole("combobox", { name: "Disabled section" });
    trigger.focus();
    await user.keyboard("{ArrowDown}");
    const tree = screen.getByRole("tree", { name: "Disabled section" });
    expect(tree).toHaveFocus();
    expect(tree).toHaveAttribute("tabindex", "0");
    expect(within(tree).getByRole("treeitem", { name: "Blocked" })).toHaveAttribute("aria-disabled", "true");
    await user.keyboard("{Escape}");
    expect(trigger).toHaveFocus();
  });

  it("TreeSelect Tab wraps within an enclosing modal when the trigger is last", async () => {
    const user = userEvent.setup();
    render(<div role="dialog" aria-modal="true" aria-label="Modal section">
      <button type="button">First modal command</button>
      <TreeSelect options={options} defaultValue="" ariaLabel="Modal section select" />
    </div>);
    const trigger = screen.getByRole("combobox", { name: "Modal section select" });
    trigger.focus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("treeitem", { name: "Account" })).toHaveFocus();
    await user.keyboard("{Tab}");
    expect(screen.getByRole("button", { name: "First modal command" })).toHaveFocus();
    expect(screen.queryByRole("tree", { name: "Modal section select" })).toBeNull();
  });
});
