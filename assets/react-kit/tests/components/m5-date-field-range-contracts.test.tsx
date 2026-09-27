// @personal-ui-coverage {"kind":"unit","runner":"components","exports":["DateField"]}
import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DateField, type ValidityControlHandle } from "../../src/personal-ui";

describe("DateField range fallback", () => {
  it("does not replace caller-owned custom validity while normalizing a date", () => {
    const controlRef = createRef<ValidityControlHandle>();
    render(<DateField precision="day" defaultValue="2024-03-06" max="2024-03-05" aria-label="Day" controlRef={controlRef} />);
    const input = screen.getByLabelText("Day") as HTMLInputElement;
    expect(input.checkValidity()).toBe(false);
    controlRef.current?.setCustomValidity("Caller error");
    fireEvent.change(input, { target: { value: "2024-03-05" } });
    expect(input.validationMessage).toBe("Caller error");
    controlRef.current?.setCustomValidity("");
    fireEvent.change(input, { target: { value: "2024-03-04" } });
    expect(input.checkValidity()).toBe(true);
  });
});
