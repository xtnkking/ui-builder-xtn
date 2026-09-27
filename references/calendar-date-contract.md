# Calendar And DateField Contract (M5-02)

`Calendar` is an inline, day-precision date grid. `DateField` remains a native input for seven independent precisions; it does not own a Calendar trigger or popup. A consumer that displays Calendar in a Dialog or Popover owns that surface's opening, closing, and trigger focus restoration.

## Calendar

- `month` is the displayed month. Pass `onMonthChange` to permit month navigation; update `month` in response. `value` requires `onValueChange`; `defaultValue` is uncontrolled. Only an enabled date can become active or be selected through the widget. `isDateDisabled(date)` excludes additional local calendar days alongside inclusive `min` and `max`.
- The seven-column grid owns one weekday `row` with `columnheader` cells and six date `row`s with `gridcell` cells. Each date cell contains a button. Selected state belongs to its `gridcell`, while only one enabled date button has `tabIndex=0`. When no date is enabled in the displayed grid, the grid itself is the fallback Tab stop.
- ArrowLeft/Right move one calendar day, ArrowUp/Down one week; disabled targets are skipped forward/backward. Home/End move to the first/last enabled day of the current Sunday-to-Saturday week. PageUp/PageDown move a month, and Shift+PageUp/PageDown move a year, clamping a missing day such as February 29 to the month's last day. These page keys require `onMonthChange`.
- Previous/next month controls remain separate Tab stops and are disabled when `onMonthChange` is absent or the adjacent month is wholly beyond `min`/`max`. Keyboard crossing requests the target month and restores real focus to the target date after the caller updates `month`. The month header announces changes; each focused date has a full localized date name. Enter/Space select the focused date through its native button, and Tab exits the date grid normally.
- Date arithmetic uses the browser's local calendar day and noon for traversal so UTC conversion and local daylight-saving transitions do not shift grid keys. `onValueChange` and `isDateDisabled` receive a local date at midnight (subject to timezone rules if midnight does not exist), preserving the existing selection convention. Display names use `Intl.DateTimeFormat(locale)`; component text localization remains with M6.

```tsx
const [month, setMonth] = useState(new Date(2024, 1, 1));
const [date, setDate] = useState(new Date(2024, 1, 29));
<Calendar
  month={month}
  onMonthChange={setMonth}
  value={date}
  onValueChange={setDate}
  min={new Date(2024, 1, 1)}
  isDateDisabled={(day) => day.getDay() === 0}
  ariaLabel="Booking date"
/>;
```

## DateField

`DateField` uses native `number` (`year`), `month`, `date` (`day`), `datetime-local` (`minute`/`second`), and `time` (`time`/`time-second`). Minute variants use `step=60`; second variants use `step=1`. The input owns one normal Tab stop, native `name`/`FormData`, browser display, `required`, and supported `min`/`max`. Form values are native strings, such as `2024`, `2024-02`, `2024-02-29`, `2024-02-29T12:34`, `2024-02-29T12:34:56`, `12:34`, and `12:34:56`; browser-normalized second values may include `.000`. No custom calendar grid is imposed on year/month/time precision.

The component fills a browser-specific native range-validation gap: Playwright WebKit reports `validity.rangeOverflow=false` for a `type=date` value of `2024-03-06` with `max=2024-03-05`. DateField applies its own range error only when native range validity misses it, and clears only the error it owns when the value returns in range. It preserves caller-supplied custom validity and the native input/serialization contract.
