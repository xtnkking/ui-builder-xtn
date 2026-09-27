import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Cascader, Form, type CascaderOption } from "../../src/personal-ui";
import "../../src/personal-ui/styles.css";

const baseOptions: CascaderOption[] = [
  {
    value: "asia", label: "Asia", children: [
      { value: "tokyo", label: "Tokyo" },
      { value: "kyoto", label: "Kyoto" },
      { value: "osaka", label: "Osaka", disabled: true },
    ],
  },
  { value: "america", label: "America", children: [{ value: "new-york", label: "New York" }] },
  { value: "europe", label: "Europe", disabled: true, children: [{ value: "paris", label: "Paris" }] },
];

function Fixture() {
  const [tokyoDisabled, setTokyoDisabled] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const options: CascaderOption[] = [
    {
      ...baseOptions[0],
      children: baseOptions[0].children?.map((item) => item.value === "tokyo" ? { ...item, disabled: tokyoDisabled } : item),
    },
    ...baseOptions.slice(1),
  ];

  return (
    <main className="pui-theme pui-root" style={{ maxWidth: 680, padding: 24 }} data-ready="true">
      <Form aria-label="Leaf destination" onSubmit={(event) => event.preventDefault()}>
        <Cascader options={options} defaultValue={["asia"]} ariaLabel="Destination" levelLabels={["Continent", "City"]} name="destination" required />
      </Form>
      <Form aria-label="Path destination" onSubmit={(event) => event.preventDefault()}>
        <Cascader options={options} defaultValue={["asia", "tokyo"]} ariaLabel="Path destination" levelLabels={["Path continent", "Path city"]} name="path" required submitValue="path" disabled={disabled} />
      </Form>
      <button type="button" onClick={() => setTokyoDisabled((current) => !current)}>Toggle Tokyo availability</button>
      <button type="button" onClick={() => setDisabled((current) => !current)}>Toggle disabled</button>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<Fixture />);
