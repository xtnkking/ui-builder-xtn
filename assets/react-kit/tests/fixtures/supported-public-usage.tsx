import { useRef, useState } from "react";
import { useController, useForm } from "react-hook-form";
import { Button, Field, Form, Input, Select, Stack, type TextControlHandle } from "../../src/personal-ui";

interface AccountValues { email: string; }

export function SupportedUsageExample({ onSave }: { onSave: (values: AccountValues) => void }) {
  const { control, handleSubmit } = useForm<AccountValues>({ defaultValues: { email: "" } });
  const { field, fieldState } = useController({ control, name: "email", rules: { required: "请输入邮箱" } });
  const nicknameRef = useRef<TextControlHandle>(null);
  const [country, setCountry] = useState("us");
  const countries = [{ value: "us", label: "美国" }, { value: "gb", label: "英国" }];

  return (
    <Form noValidate onSubmit={handleSubmit(onSave)}>
      <Stack gap="medium">
        <Field label="邮箱" htmlFor="usage-email" error={fieldState.error?.message}>
          <Input id="usage-email" type="email" controllerField={field} />
        </Field>
        <Field label="昵称" htmlFor="usage-nickname">
          <Input id="usage-nickname" defaultValue="新成员" controlRef={nicknameRef} />
        </Field>
        <Field label="国家" htmlFor="usage-country">
          <Select id="usage-country" options={countries} value={country} onValueChange={setCountry} ariaLabel="国家" />
        </Field>
        <Field label="备注" htmlFor="usage-notes">
          <Input id="usage-notes" defaultValue="新成员备注" />
        </Field>
        <Button type="button" onClick={() => nicknameRef.current?.focus()}>聚焦昵称</Button>
        <Button type="submit">保存</Button>
      </Stack>
    </Form>
  );
}
