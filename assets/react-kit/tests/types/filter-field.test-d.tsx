import { createRef } from "react";
import { Field, FilterBar, FilterField, SearchInput, type FilterFieldProps } from "../../src/ui";

const supported = <FilterBar ariaLabel="任务筛选" actions={null}>
  <FilterField width="short"><SearchInput value="" onChange={() => {}} aria-label="国家代码" /></FilterField>
  <FilterField width="medium"><SearchInput value="" onChange={() => {}} aria-label="任务类型" /></FilterField>
  <FilterField width="long"><SearchInput value="" onChange={() => {}} aria-label="关键词" /></FilterField>
  <FilterField width={260} id="task-filter" data-track="task">
    <Field htmlFor="task" label="任务编号"><SearchInput id="task" name="task" value="" onChange={() => {}} /></Field>
  </FilterField>
  <FilterField><SearchInput value="" onChange={() => {}} aria-label="默认宽度" /></FilterField>
</FilterBar>;

// @ts-expect-error preset values are intentionally finite and documented
const unknownWidth = <FilterField width="large">内容</FilterField>;
// @ts-expect-error custom widths use positive pixel numbers, not arbitrary CSS
const cssWidth = <FilterField width="50vw">内容</FilterField>;
// @ts-expect-error required children represent the sized canonical field
const missingControl = <FilterField />;
// @ts-expect-error arbitrary style cannot override the sizing contract
const styleOverride = <FilterField style={{ width: 1000 }}>内容</FilterField>;
// @ts-expect-error arbitrary className cannot override the sizing contract
const classOverride = <FilterField className="foreign">内容</FilterField>;
// @ts-expect-error raw DOM refs cannot override protected field geometry
const refOverride = <FilterField ref={createRef<HTMLDivElement>()}>内容</FilterField>;
// @ts-expect-error CSS-in-JS escape props remain protected
const cssOverride = <FilterField css={{ width: 1000 }}>内容</FilterField>;
// @ts-expect-error reserved ownership markers are private
const ownerOverride = <FilterField data-ui-owner="Consumer">内容</FilterField>;
// @ts-expect-error private marker objects are rejected by the public Props type
const markerOverride: FilterFieldProps = { children: "内容", "data-ui-private": "foreign" };

void supported;
void unknownWidth;
void cssWidth;
void missingControl;
void styleOverride;
void classOverride;
void refOverride;
void cssOverride;
void ownerOverride;
void markerOverride;
