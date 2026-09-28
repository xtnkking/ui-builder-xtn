// @personal-ui-coverage {"kind":"unit","runner":"components","exports":["Form","Input","MultiSelect"]}
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Controller, useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import { Button, Field, Form, Input, MultiSelect } from "../../src/personal-ui";

interface ProfileValues {
  email: string;
}

interface AccessValues {
  roles: string[];
}

function ControllerForm({ onSubmit }: { onSubmit: (values: ProfileValues) => void }) {
  const {
    control,
    formState,
    handleSubmit,
    reset,
    setError,
  } = useForm<ProfileValues>({ defaultValues: { email: "" } });
  const [submitted, setSubmitted] = useState(0);

  return (
    <Form
      aria-label="Profile form"
      onSubmit={handleSubmit((values) => {
        onSubmit(values);
        setSubmitted((current) => current + 1);
      })}
    >
      <Controller
        control={control}
        name="email"
        rules={{ required: "Email is required" }}
        render={({ field, fieldState }) => (
          <Field label="Email" htmlFor="profile-email" error={fieldState.error?.message}>
            <Input
              id="profile-email"
              type="email"
              controllerField={field}
              aria-label="Profile email"
            />
          </Field>
        )}
      />
      <span data-testid="touched">{formState.touchedFields.email ? "touched" : "untouched"}</span>
      <span data-testid="submitted">{submitted}</span>
      <Button type="submit">Submit</Button>
      <Button type="button" onClick={() => reset({ email: "reset@example.com" })}>Reset values</Button>
      <Button
        type="button"
        onClick={() => setError("email", { type: "manual", message: "Manual error" }, { shouldFocus: true })}
      >
        Focus error
      </Button>
    </Form>
  );
}

function CompositeControllerForm({ onSubmit }: { onSubmit: (values: AccessValues) => void }) {
  const { control, handleSubmit, reset, setError } = useForm<AccessValues>({
    defaultValues: { roles: [] },
  });
  return (
    <Form noValidate aria-label="Access form" onSubmit={handleSubmit(onSubmit)}>
      <Controller
        control={control}
        name="roles"
        rules={{ validate: (value) => value.length > 0 || "Select at least one role" }}
        render={({ field, fieldState }) => (
          <Field label="Roles" group required error={fieldState.error?.message}>
            <MultiSelect
              name={field.name}
              options={[
                { value: "admin", label: "Administrator" },
                { value: "editor", label: "Editor" },
              ]}
              value={field.value}
              onValueChange={field.onChange}
              controlRef={field.ref}
              ariaLabel="Access roles"
              required
            />
          </Field>
        )}
      />
      <Button type="submit">Submit access</Button>
      <Button type="button" onClick={() => reset({ roles: ["admin"] })}>Reset access</Button>
      <Button
        type="button"
        onClick={() => setError("roles", { type: "manual", message: "Role unavailable" }, { shouldFocus: true })}
      >
        Focus role error
      </Button>
    </Form>
  );
}

describe("form-library controllerField adapter", () => {
  it("maps change, blur, reset, submit, validation, and focus without exposing a DOM ref", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<ControllerForm onSubmit={onSubmit} />);
    const input = screen.getByRole("textbox", { name: "Profile email" });

    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(await screen.findByText("Email is required")).toBeInTheDocument();
    expect(input).toHaveFocus();
    expect(onSubmit).not.toHaveBeenCalled();

    await user.type(input, "ada@example.com");
    await user.tab();
    expect(screen.getByTestId("touched")).toHaveTextContent("touched");

    await user.click(screen.getByRole("button", { name: "Submit" }));
    expect(onSubmit).toHaveBeenCalledWith({ email: "ada@example.com" });
    expect(screen.getByTestId("submitted")).toHaveTextContent("1");

    await user.click(screen.getByRole("button", { name: "Reset values" }));
    expect(input).toHaveValue("reset@example.com");

    await user.click(screen.getByRole("button", { name: "Focus error" }));
    expect(input).toHaveFocus();
    expect(await screen.findByText("Manual error")).toBeInTheDocument();
  });

  it("maps composite values, validation focus, and library resets through a limited handle", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<CompositeControllerForm onSubmit={onSubmit} />);
    const trigger = screen.getByRole("combobox", { name: /Access roles/ });

    await user.click(screen.getByRole("button", { name: "Submit access" }));
    expect(await screen.findByText("Select at least one role")).toBeInTheDocument();
    expect(trigger).toHaveFocus();

    await user.click(trigger);
    await user.click(screen.getByRole("option", { name: "Editor" }));
    await user.click(screen.getByRole("button", { name: "完成" }));
    await user.click(screen.getByRole("button", { name: "Submit access" }));
    expect(onSubmit).toHaveBeenCalledWith({ roles: ["editor"] }, expect.anything());

    await user.click(screen.getByRole("button", { name: "Reset access" }));
    expect(trigger).toHaveAccessibleName(/已选择 1 项/);

    await user.click(screen.getByRole("button", { name: "Focus role error" }));
    expect(trigger).toHaveFocus();
    expect(await screen.findByText("Role unavailable")).toBeInTheDocument();
  });
});
