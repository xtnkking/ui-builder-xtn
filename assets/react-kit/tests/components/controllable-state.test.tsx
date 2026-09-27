import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useControllableState } from "../../src/personal-ui/internal/controllable-state";

interface HarnessProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  controlledOnly?: boolean;
}

function Harness(props: HarnessProps) {
  const controlled = props.value !== undefined;
  const [value, setValue] = useControllableState({
    componentName: "Harness",
    controlled,
    controlledOnly: props.controlledOnly,
    value: props.value,
    defaultValue: props.defaultValue ?? "initial",
    defaultValueProvided: Object.prototype.hasOwnProperty.call(props, "defaultValue"),
    onChange: props.onValueChange,
  });
  return <button type="button" onClick={() => setValue((current) => `${current}!`)}>{value}</button>;
}

function expectDevelopmentError(run: () => void, message: RegExp) {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
  try {
    expect(run).toThrow(message);
  } finally {
    consoleError.mockRestore();
  }
}

describe("useControllableState", () => {
  it("owns and reports uncontrolled state", () => {
    const changes: string[] = [];
    render(<Harness defaultValue="draft" onValueChange={(value) => changes.push(value)} />);

    fireEvent.click(screen.getByRole("button"));

    expect(screen.getByRole("button")).toHaveTextContent("draft!");
    expect(changes).toEqual(["draft!"]);
  });

  it("reports controlled changes without mutating the rendered value", () => {
    const changes: string[] = [];
    render(<Harness value="saved" onValueChange={(value) => changes.push(value)} />);

    fireEvent.click(screen.getByRole("button"));
    fireEvent.click(screen.getByRole("button"));

    expect(screen.getByRole("button")).toHaveTextContent("saved");
    expect(changes).toEqual(["saved!", "saved!"]);
  });

  it("rejects contradictory controlled and default props", () => {
    expectDevelopmentError(
      () => render(<Harness value="saved" defaultValue="draft" onValueChange={() => undefined} />),
      /cannot receive both value and defaultValue/,
    );
  });

  it("requires a callback in controlled mode", () => {
    expectDevelopmentError(
      () => render(<Harness value="saved" />),
      /requires onValueChange when value is controlled/,
    );
  });

  it("rejects every invalid controlled-only runtime combination", () => {
    expectDevelopmentError(
      () => render(<Harness controlledOnly onValueChange={() => undefined} />),
      /requires value; uncontrolled mode is not supported/,
    );
    expectDevelopmentError(
      () => render(<Harness controlledOnly value="saved" />),
      /requires onValueChange when value is controlled/,
    );
    expectDevelopmentError(
      () => render(<Harness controlledOnly value="saved" defaultValue="draft" onValueChange={() => undefined} />),
      /cannot receive both value and defaultValue/,
    );
  });

  it("rejects switching between uncontrolled and controlled modes", () => {
    const Wrapper = () => {
      const [controlled, setControlled] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setControlled(true)}>switch</button>
          {controlled
            ? <Harness value="saved" onValueChange={() => undefined} />
            : <Harness defaultValue="draft" />}
        </>
      );
    };
    render(<Wrapper />);

    expectDevelopmentError(
      () => fireEvent.click(screen.getByRole("button", { name: "switch" })),
      /cannot switch from uncontrolled to controlled mode/,
    );
  });
});
