import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Calendar, DateField } from "../../src/personal-ui";
import "../../src/personal-ui/styles.css";

function Fixture() {
  const [month, setMonth] = useState(new Date(2024, 1, 1));
  const [value, setValue] = useState<Date | undefined>(new Date(2024, 1, 28));
  return (
    <main className="pui-theme pui-root" style={{ maxWidth: 760, padding: 24 }} data-ready="true">
      <button type="button" onClick={() => { setMonth(new Date(2026, 8, 1)); setValue(new Date(2026, 8, 15)); }}>External update</button>
      <Calendar
        month={month}
        value={value}
        onMonthChange={setMonth}
        onValueChange={setValue}
        min={new Date(2024, 1, 27)}
        isDateDisabled={(day) => day.getFullYear() === 2024 && day.getMonth() === 2 && day.getDate() === 2}
        locale="en-US"
        ariaLabel="Booking date"
      />
      <button type="button">After calendar</button>
      <form id="date-precision-form" aria-label="Date precision" onSubmit={(event) => event.preventDefault()}>
        <DateField aria-label="Year" name="year" precision="year" defaultValue="2024" min="2020" max="2030" />
        <DateField aria-label="Month" name="month" precision="month" defaultValue="2024-02" min="2024-01" max="2024-12" />
        <DateField aria-label="Day" name="day" precision="day" defaultValue="2024-02-29" min="2024-02-01" max="2024-03-05" />
        <DateField aria-label="Minute" name="minute" precision="minute" defaultValue="2024-02-29T12:34" />
        <DateField aria-label="Second" name="second" precision="second" defaultValue="2024-02-29T12:34:56" />
        <DateField aria-label="Time" name="time" precision="time" defaultValue="12:34" />
        <DateField aria-label="Time second" name="time-second" precision="time-second" defaultValue="12:34:56" />
      </form>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<Fixture />);
