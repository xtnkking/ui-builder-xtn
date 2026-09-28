// @personal-ui-coverage {"kind":"unit","runner":"components","exports":["Cascader"]}
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Cascader, type CascaderOption } from "../../src/personal-ui";

const options: CascaderOption[] = [
  {
    value: "asia", label: "Asia", children: [
      { value: "tokyo", label: "Tokyo" },
      { value: "kyoto", label: "Kyoto" },
    ],
  },
  {
    value: "europe", label: "Europe", disabled: true, children: [
      { value: "paris", label: "Paris" },
    ],
  },
];

const entries = (form: HTMLFormElement) => Array.from(new FormData(form).entries());

describe("Cascader completed path contract", () => {
  it("submits a leaf only after every enabled level has been selected", () => {
    render(
      <form aria-label="Leaf form">
        <Cascader options={options} defaultValue={["asia"]} ariaLabel="Region" levelLabels={["Continent", "City"]} name="region" required />
      </form>,
    );
    const form = screen.getByRole("form", { name: "Leaf form" }) as HTMLFormElement;
    expect(entries(form)).toEqual([]);
    expect(form.checkValidity()).toBe(false);
    fireEvent.click(screen.getByRole("combobox", { name: /City/ }));
    fireEvent.click(screen.getByRole("option", { name: "Tokyo" }));
    expect(entries(form)).toEqual([["region", "tokyo"]]);
    expect(form.checkValidity()).toBe(true);
  });

  it("serializes only a completed path and restores its initial value on form reset", async () => {
    render(
      <form aria-label="Path form">
        <Cascader options={options} defaultValue={["asia", "tokyo"]} ariaLabel="Region" levelLabels={["Continent", "City"]} name="region" required submitValue="path" />
      </form>,
    );
    const form = screen.getByRole("form", { name: "Path form" }) as HTMLFormElement;
    expect(entries(form)).toEqual([["region", '["asia","tokyo"]']]);
    fireEvent.click(screen.getByRole("combobox", { name: /Continent/ }));
    fireEvent.click(screen.getByRole("option", { name: "Europe" }));
    expect(entries(form)).toEqual([["region", '["asia","tokyo"]']]);
    fireEvent.click(screen.getByRole("option", { name: "Asia" }));
    expect(entries(form)).toEqual([["region", '["asia","tokyo"]']]);
    fireEvent.click(screen.getByRole("combobox", { name: /City/ }));
    fireEvent.click(screen.getByRole("option", { name: "Kyoto" }));
    expect(entries(form)).toEqual([["region", '["asia","kyoto"]']]);
    fireEvent.reset(form);
    await waitFor(() => expect(entries(form)).toEqual([["region", '["asia","tokyo"]']]));
  });

  it("rejects empty, disabled, removed and overlong paths without mutating the owner value", () => {
    const onValueChange = vi.fn();
    const view = render(
      <form aria-label="Changing form">
        <Cascader options={options} defaultValue={[]} onValueChange={onValueChange} ariaLabel="Region" levelLabels={["Continent", "City"]} name="region" required submitValue="path" />
      </form>,
    );
    const form = screen.getByRole("form", { name: "Changing form" }) as HTMLFormElement;
    expect(entries(form)).toEqual([]);
    expect(form.checkValidity()).toBe(false);
    view.unmount();

    const selected = render(
      <form aria-label="Changing form">
        <Cascader options={options} defaultValue={["asia", "tokyo"]} onValueChange={onValueChange} ariaLabel="Region" levelLabels={["Continent", "City"]} name="region" required />
      </form>,
    );
    const selectedForm = screen.getByRole("form", { name: "Changing form" }) as HTMLFormElement;
    expect(entries(selectedForm)).toEqual([["region", "tokyo"]]);
    const changedOptions: CascaderOption[] = [
      { value: "asia", label: "Asia", children: [{ value: "tokyo", label: "Tokyo", disabled: true }, { value: "kyoto", label: "Kyoto" }] },
      options[1],
    ];
    selected.rerender(
      <form aria-label="Changing form">
        <Cascader options={changedOptions} defaultValue={["asia", "tokyo"]} onValueChange={onValueChange} ariaLabel="Region" levelLabels={["Continent", "City"]} name="region" required />
      </form>,
    );
    expect(entries(selectedForm)).toEqual([]);
    expect(selectedForm.checkValidity()).toBe(false);
    expect(onValueChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("combobox", { name: /City/ }));
    fireEvent.click(screen.getByRole("option", { name: "Kyoto" }));
    expect(entries(selectedForm)).toEqual([["region", "kyoto"]]);
    selected.unmount();

    for (const invalidPath of [["europe", "paris"], ["asia", "missing"], ["asia", "tokyo", "stale"]]) {
      const invalid = render(
        <form aria-label="Invalid form">
          <Cascader options={options} defaultValue={invalidPath} ariaLabel="Region" levelLabels={["Continent", "City"]} name="region" required />
        </form>,
      );
      const invalidForm = screen.getByRole("form", { name: "Invalid form" }) as HTMLFormElement;
      expect(entries(invalidForm)).toEqual([]);
      expect(invalidForm.checkValidity()).toBe(false);
      invalid.unmount();
    }
  });
});
