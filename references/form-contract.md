# Form Contract

Read this reference when composing a form, integrating a form library, or maintaining a form-associated ui-builder-xtn component. Native controls and composite controls must expose the same observable form behavior even though their internal implementations differ.

## Public Usage

Import controls only from the installed public barrel. Use `Field` for label, hint, required, and error relationships. Use `Form` for the form surface and its limited `controlRef` when imperative submit, reset, or validity checks are required.

```tsx
import {
  Button,
  Field,
  Form,
  Input,
  MultiSelect,
  type ValidityControlHandle,
} from "./ui";
```

Native inputs such as `Input`, `Textarea`, and `DateField` use browser form behavior directly. Composite controls such as `Select`, `MultiSelect`, `TagInput`, `TreeSelect`, `Rating`, and `Slider` use the kit's internal form-association protocol. Consumers must not add hidden inputs or duplicate serialization.

`Textarea` owns its rounded clipping frame and keeps scrolling and vertical drag-resizing on the native text control inside it. Focus, error and disabled borders belong to that same frame, so native scrollbar tracks and resize grips cannot replace the rounded edge. Use `rows` for the initial text area size; long content scrolls within it. Business code does not need a clipping wrapper or control-style overrides. The editor compositions reuse this internal frame without adding a second border.

## Values And FormData

For geometry, `Field width="short" | "medium" | "long"` uses bounded 240/360/560px preferences; a positive finite number selects another width, while omission retains full width. Form direct Buttons keep content width. Use [layout and sizing](layout-sizing.md) for responsive settings forms without stretching short values or actions.

The machine value is independent from the displayed label and locale.

| Value shape | `FormData` contract |
| --- | --- |
| Scalar with a non-empty value | One `[name, value]` entry. |
| Scalar with an empty value | One `[name, ""]` entry. |
| Multi-value with values | One entry per value using the same name, in component value order. Values are not JSON encoded. |
| Multi-value with no values | No successful-field entry, matching native multi-select and checkbox-group behavior. |
| Disabled control | No entry. |
| Read-only control | Included when the component supports read-only; native constraint validation does not enforce `required` on it. |

Do not give a native field and a composite control the same `name` unless repeated values are intentional. `new FormData(form)` and a normal browser submission use the same representation.

`DateRangeField` submits two ISO-like machine strings. With `name="period"`, the default names are `period.start` and `period.end`; `startName` and `endName` override them. The exact value syntax follows its `precision` and never depends on the displayed language:

- `year`: `YYYY`
- `month`: `YYYY-MM`
- `day`: `YYYY-MM-DD`
- `minute`: `YYYY-MM-DDTHH:mm`
- `second`: `YYYY-MM-DDTHH:mm:ss`
- `time`: `HH:mm`
- `time-second`: `HH:mm:ss`

## Required And Validation

`required` is functional, not only visual. An empty required composite control participates in `checkValidity()`, `reportValidity()`, normal submit, and `requestSubmit()`. Invalid submission is prevented and focus moves to the component's visible interaction owner. A component remains validatable even when it has no `name`.

`form.submit()` intentionally keeps native browser semantics and bypasses constraint validation. Do not use it when validation is required; use `requestSubmit()` or a submit button.

`Field required` supplies the required state to its child controls. `Field hint` and `Field error` supply the accessible description and invalid presentation. `Field error` does not invent a browser validation message from arbitrary React content. For a server-side error that must also block native submission, use the limited validity handle:

```tsx
const countryRef = createRef<ValidityControlHandle>();

<Field label="Country" htmlFor="country" required error={countryError}>
  <Select
    id="country"
    name="country"
    options={countryOptions}
    value={country}
    onValueChange={setCountry}
    ariaLabel="Country"
    required
    controlRef={countryRef}
  />
</Field>

countryRef.current?.setCustomValidity("Country is unavailable");
countryRef.current?.reportValidity();
countryRef.current?.setCustomValidity("");
```

The handle exposes only `focus`, `setCustomValidity`, `checkValidity`, and `reportValidity`. It does not expose a DOM node or styling escape hatch.

## Disabled And External Forms

Passing `disabled` excludes the composite value from successful controls and bars validation. A disabled ancestor `fieldset` follows native browser rules as well.

Use `form` to associate a control rendered outside the form element:

```tsx
<Form id="profile" onSubmit={saveProfile}>
  <Button type="submit">Save</Button>
</Form>

<Field label="Roles" group required>
  <MultiSelect
    name="roles"
    form="profile"
    options={roleOptions}
    defaultValue={["member"]}
    ariaLabel="Roles"
    required
  />
</Field>
```

The referenced id must identify an `HTMLFormElement` in the same document. Submit, reset, validity, and `FormData` then operate on that external owner.

## Forms Inside Dialogs And Drawers

Use the overlay's `footer` slot for persistent save/cancel actions and a `Form` in its body. Connect the external save Button with `type="submit" form={formId}` to the Form's unique `id`; handle saving once in `Form.onSubmit`, so click, Enter and native validation follow the same path. Set cancel to `type="button"`. During an asynchronous save, use the Button's loading state, block duplicate requests and deliberately choose whether dismissing the overlay remains allowed.

The header and footer remain outside the scrolling body. Putting actions at the bottom of a tall body makes them disappear until the user scrolls; `Dialog` cannot infer that an arbitrary child is intended as its footer. Do not nest a complete create/edit page pattern just to obtain a footer, or add another fixed-height/scrolling wrapper inside the Form.

Choose the form layout for the available panel width. Keep an address, long name or notes on its own row. Pair related short controls with public `Grid minItemWidth={200} gap="medium"` when each control remains readable; the pair becomes one column below 416px of actual content width. Here 200px is an example's design choice, not a universal minimum. Let fields fill their grid tracks instead of applying unrelated `short`/`medium`/`long` widths to every field in a single Stack. For an intentionally single-column form, keep a common field edge or bound the whole group. See [modal form sizing](layout-sizing.md#modal-forms) and the complete compiled form at `#/components/dialog`.

```tsx
const formId = useId();

<Dialog open={open} onOpenChange={setOpen} title="编辑连接"
  footer={<Inline justify="end">
    <Button type="button" onClick={() => setOpen(false)}>取消</Button>
    <Button type="submit" form={formId} variant="primary" loading={saving}>保存</Button>
  </Inline>}>
  <Form id={formId} onSubmit={handleSubmit}>
    <Field label="连接地址" htmlFor={`${formId}-host`} required>
      <Input id={`${formId}-host`} name="host" required />
    </Field>
    <Grid minItemWidth={200} gap="medium">
      {portField}
      {protocolField}
    </Grid>
    {credentialFields}
    {notesField}
  </Form>
</Dialog>
```

Import `useId` from React and the named public controls from `./ui`. The placeholders represent business fields; the Explorer case provides a complete compiling implementation. `handleSubmit` prevents default navigation, validates business rules and owns the actual request; it must not close the overlay before saving succeeds. The mock Explorer form demonstrates native required validation and form submission without calling a backend.

## Reset

A native form reset is a state transition, not a DOM-only visual reset.

- An uncontrolled composite returns to the latest rendered `defaultValue` baseline.
- A controlled composite requests its documented reset value through `onValueChange`; the parent remains the source of truth and must apply that value.
- Controlled-only selection controls clear to their documented empty value unless they define a stable mounted baseline. `SegmentedControl` returns to its initial mounted value because one segment normally remains selected.
- `DateRangeField` resets both native date inputs and their shared state together, including when associated through `form`.
- Externally owned workflows such as `FileUpload` and `InlineEdit` call their explicit `onReset` callback; the owner must reset the persisted items or value.
- If a reset event is canceled, component state must not reset.

Changing an uncontrolled `defaultValue` does not immediately overwrite the current value. It changes the value used by the next form reset.

## React Hook Form

For native text controls, pass React Hook Form's field object through `controllerField`. For a composite value, map the value channel explicitly and give `field.ref` to `controlRef`. Use `noValidate` when the form library, rather than native constraint validation, owns error production.

```tsx
import { Controller, useForm } from "react-hook-form";

interface AccessValues {
  roles: string[];
}

function AccessForm() {
  const { control, handleSubmit } = useForm<AccessValues>({
    defaultValues: { roles: [] },
  });

  return (
    <Form noValidate onSubmit={handleSubmit(saveAccess)}>
      <Controller
        control={control}
        name="roles"
        rules={{ validate: (value) => value.length > 0 || "Select at least one role" }}
        render={({ field, fieldState }) => (
          <Field label="Roles" group required error={fieldState.error?.message}>
            <MultiSelect
              name={field.name}
              options={roleOptions}
              value={field.value}
              onValueChange={field.onChange}
              controlRef={field.ref}
              ariaLabel="Roles"
              required
            />
          </Field>
        )}
      />
      <Button type="submit">Save</Button>
    </Form>
  );
}
```

Library reset must update library state. Do not call `form.reset()` as a substitute for `useForm().reset(...)` in a library-controlled form.

## Maintainer Invariants

The shared internal protocol owns serialization, required validation, invalid focus, custom validity, external form association, and reset observation. A new composite form control must use that protocol instead of adding its own hidden-input bridge.

Maintain browser coverage for:

- named and unnamed required controls;
- scalar, repeated, and empty multi-value `FormData`;
- disabled props and disabled fieldsets;
- internal and external form ownership;
- controlled and uncontrolled reset, including canceled reset;
- custom validity, visible error focus, and clearing the error;
- Chromium, Firefox, and WebKit behavior.
