import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Button, Field, Form, InlineEdit } from "../../src/personal-ui";
import "../../src/personal-ui/styles.css";

declare global {
  interface Window {
    inlineEditRequest?: {
      resolve: () => void;
      reject: (message: string) => void;
    };
  }
}

function InlineEditFixture() {
  const [value, setValue] = useState("Ada");
  const onCommit = (next: string) => new Promise<void>((resolve, reject) => {
    window.inlineEditRequest = {
      resolve: () => { setValue(next); resolve(); },
      reject: (message) => reject(new Error(message)),
    };
  });
  return (
    <main style={{ maxWidth: 520, margin: "48px auto" }}>
      <Form aria-label="Profile">
        <Field label="Display name" htmlFor="display-name" required>
          <InlineEdit name="name" value={value} onCommit={onCommit} onReset={() => setValue("Ada")} editLabel="Edit display name" />
        </Field>
        <Button type="reset">Reset profile</Button>
      </Form>
      <Button onClick={() => undefined}>After editor</Button>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<InlineEditFixture />);
