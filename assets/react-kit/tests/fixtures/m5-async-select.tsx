import { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { AsyncSelect, Button, Dialog, Field, Form, type AsyncSelectOption } from "../../src/personal-ui";
import "../../src/personal-ui/styles.css";

type Pending = { resolve: (options: readonly AsyncSelectOption[]) => void; reject: (error: Error) => void; signal: AbortSignal };

declare global {
  interface Window {
    asyncSelectFixture: {
      resolve: (query: string) => void;
      reject: (query: string) => void;
      pending: (query: string) => boolean;
      aborted: (query: string) => boolean;
      formValue: () => string | null;
    };
  }
}

const results: Record<string, readonly AsyncSelectOption[]> = {
  slow: [{ value: "gb", label: "United Kingdom", description: "GB +44", leading: "GB" }],
  fast: [
    { value: "blocked", label: "Unavailable", disabled: true },
    { value: "us", label: "United States", description: "US +1", leading: "US" },
  ],
};

function AsyncSelectFixture() {
  const pending = useRef(new Map<string, Pending>());
  const history = useRef(new Map<string, AbortSignal>());
  const [value, setValue] = useState("");
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  window.asyncSelectFixture = {
    resolve: (key) => {
      const request = pending.current.get(key);
      pending.current.delete(key);
      request?.resolve(results[key] ?? []);
    },
    reject: (key) => {
      const request = pending.current.get(key);
      pending.current.delete(key);
      request?.reject(new Error("Offline"));
    },
    pending: (key) => pending.current.has(key),
    aborted: (key) => history.current.get(key)?.aborted ?? false,
    formValue: () => new FormData(document.querySelector<HTMLFormElement>("#country-form")!).get("country") as string | null,
  };

  return (
    <main style={{ maxWidth: 480, margin: "48px auto" }}>
      <Button onClick={() => undefined}>前置操作</Button>
      <Form id="country-form">
        <Field label="国家" htmlFor="country">
          <AsyncSelect
            id="country"
            name="country"
            ariaLabel="国家"
            value={value}
            onValueChange={setValue}
            query={query}
            onQueryChange={setQuery}
            debounceMs={0}
            loadOptions={(nextQuery, { signal }) => {
              if (!nextQuery) return Promise.resolve([]);
              history.current.set(nextQuery, signal);
              return new Promise((resolve, reject) => pending.current.set(nextQuery, { resolve, reject, signal }));
            }}
          />
        </Field>
      </Form>
      <Button onClick={() => undefined}>后置操作</Button>
      <Button onClick={() => setValue("gb")}>外部设置英国</Button>
      <Button onClick={() => setDialogOpen(true)}>打开对话框</Button>
      <Dialog title="选择地区" open={dialogOpen} onOpenChange={setDialogOpen}>
        <Button onClick={() => undefined}>对话框前置操作</Button>
        <Field label="地区" htmlFor="dialog-country">
          <AsyncSelect
            id="dialog-country"
            ariaLabel="地区"
            options={[{ value: "us", label: "United States" }]}
            defaultQuery="us"
            hasMore
            onLoadMore={async () => undefined}
          />
        </Field>
        <Button onClick={() => undefined}>对话框后置操作</Button>
      </Dialog>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<AsyncSelectFixture />);
