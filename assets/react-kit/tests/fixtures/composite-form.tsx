import { createRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  DateRangeField,
  Field,
  Form,
  MultiSelect,
  SegmentedControl,
  Select,
  type ValidityControlHandle,
} from "../../src/personal-ui";

const countryOptions = [
  { value: "cn", label: "China" },
  { value: "us", label: "United States" },
] as const;

const roleOptions = [
  { value: "admin", label: "Administrator" },
  { value: "editor", label: "Editor" },
] as const;

const countryControl = createRef<ValidityControlHandle>();

declare global {
  interface Window {
    compositeFormFixture?: {
      clearCountryError(): void;
      reportCountryValidity(): boolean;
      setCountryError(message: string): void;
    };
  }
}

function CompositeFormFixture() {
  const [country, setCountry] = useState("");
  const [period, setPeriod] = useState({ start: "2026-09-01", end: "2026-09-30" });
  const [view, setView] = useState<"" | "grid" | "list">("");
  const [toggleRolesDisabled, setToggleRolesDisabled] = useState(false);

  window.compositeFormFixture = {
    clearCountryError: () => countryControl.current?.setCustomValidity(""),
    reportCountryValidity: () => countryControl.current?.reportValidity() ?? false,
    setCountryError: (message) => countryControl.current?.setCustomValidity(message),
  };

  return (
    <main className="pui-theme pui-root" data-ready="true">
      <Form id="external-profile" aria-label="External profile" onSubmit={(event) => event.preventDefault()}>
        <button type="submit">Submit external profile</button>
        <button type="reset">Reset external profile</button>
        <fieldset disabled>
          <MultiSelect
            name="fieldset-roles"
            options={roleOptions}
            defaultValue={["editor"]}
            ariaLabel="Fieldset disabled roles"
          />
        </fieldset>
      </Form>

      <section aria-label="External controls">
        <Field label="Country" htmlFor="country" required>
          <Select
            id="country"
            name="country"
            form="external-profile"
            options={countryOptions}
            value={country}
            onValueChange={setCountry}
            ariaLabel="Country"
            required
            controlRef={countryControl}
          />
        </Field>
        <MultiSelect
          name="roles"
          form="external-profile"
          options={roleOptions}
          defaultValue={["admin"]}
          ariaLabel="Roles"
          required
        />
        <MultiSelect
          name="disabled-roles"
          form="external-profile"
          options={roleOptions}
          defaultValue={["editor"]}
          ariaLabel="Disabled roles"
          disabled
        />
        <MultiSelect
          name="empty-roles"
          form="external-profile"
          options={roleOptions}
          defaultValue={[]}
          ariaLabel="Empty roles"
        />
      </section>

      <Form id="unnamed-required" aria-label="Unnamed required" onSubmit={(event) => event.preventDefault()}>
        <Select
          options={countryOptions}
          value=""
          onValueChange={() => undefined}
          ariaLabel="Unnamed country"
          required
        />
        <button type="submit">Submit unnamed form</button>
      </Form>

      <Form id="required-multi" aria-label="Required multi value" onSubmit={(event) => event.preventDefault()}>
        <MultiSelect
          name="required-roles"
          options={roleOptions}
          defaultValue={[]}
          ariaLabel="Required roles"
          required
        />
        <button type="submit">Submit required roles</button>
      </Form>

      <Form id="toggle-disabled" aria-label="Toggle disabled" onSubmit={(event) => event.preventDefault()}>
        <MultiSelect
          name="toggle-roles"
          options={roleOptions}
          defaultValue={["editor"]}
          ariaLabel="Toggle roles"
          required
          disabled={toggleRolesDisabled}
        />
        <button type="button" onClick={() => setToggleRolesDisabled((current) => !current)}>
          {toggleRolesDisabled ? "Enable toggle roles" : "Disable toggle roles"}
        </button>
        <button type="submit">Submit toggle roles</button>
      </Form>

      <Form id="date-range-form" aria-label="Date range form" onSubmit={(event) => event.preventDefault()}>
        <button type="reset">Reset date range</button>
      </Form>
      <DateRangeField
        name="period"
        form="date-range-form"
        value={period}
        onValueChange={setPeriod}
      />

      <Form id="segmented-required" aria-label="Segmented required" onSubmit={(event) => event.preventDefault()}>
        <Field label="View" group required>
          <SegmentedControl
            name="view"
            value={view}
            options={[
              { value: "grid", label: "Grid" },
              { value: "list", label: "List" },
            ]}
            onValueChange={setView}
            ariaLabel="View"
          />
        </Field>
        <button type="submit">Submit view</button>
      </Form>

      <Form
        id="cancelled-reset"
        aria-label="Cancelled reset"
        onReset={(event) => event.preventDefault()}
      >
        <MultiSelect
          name="cancelled-roles"
          options={roleOptions}
          defaultValue={["admin"]}
          ariaLabel="Cancelled roles"
        />
        <button type="reset">Cancel reset</button>
      </Form>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<CompositeFormFixture />);
