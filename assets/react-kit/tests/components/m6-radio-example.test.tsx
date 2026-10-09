// @personal-ui-coverage {"kind":"unit","runner":"components","exports":["Radio"]}
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it } from "vitest";
import radioCase from "../../src/explorer/cases/input/radio.case";

afterEach(cleanup);

it("keeps two mounted Radio examples independent during keyboard selection", async () => {
  render(<>{radioCase.content}{radioCase.content}</>);
  const groups = screen.getAllByRole("group");
  expect(groups).toHaveLength(2);

  const names = groups.map((group) => {
    const radios = within(group).getAllByRole("radio") as HTMLInputElement[];
    expect(radios).toHaveLength(3);
    const name = radios[0].name;
    expect(name).not.toBe("");
    for (const radio of radios) expect(radio.name).toBe(name);
    return name;
  });
  expect(names[0]).not.toBe(names[1]);

  const first = within(groups[0]);
  const second = within(groups[1]);
  const firstPersonal = first.getByRole("radio", { name: "个人版", exact: true });
  const firstTeam = first.getByRole("radio", { name: "团队版", exact: true });
  const secondPersonal = second.getByRole("radio", { name: "个人版", exact: true });
  const secondTeam = second.getByRole("radio", { name: "团队版", exact: true });
  expect(firstTeam).toBeChecked();
  expect(secondTeam).toBeChecked();
  expect(first.getByRole("radio", { name: "企业版（暂不可用）", exact: true })).toBeDisabled();

  firstPersonal.focus();
  await userEvent.setup().keyboard(" ");
  expect(firstPersonal).toBeChecked();
  expect(firstTeam).not.toBeChecked();
  expect(secondPersonal).not.toBeChecked();
  expect(secondTeam).toBeChecked();
});
