import { createRef } from "react";
import {
  ButtonGroup,
  ClipboardButton,
  FilterBar,
  Link,
  SplitButton,
  ToggleButton,
  Toolbar,
  type ControlHandle,
  type LinkProps,
} from "../../src/personal-ui";

const controlRef = createRef<ControlHandle>();
const allowedActions = (
  <>
    <Link href="/accounts" target="_blank" rel="author" aria-label="Accounts" data-track="accounts">
      Accounts
    </Link>
    <ButtonGroup ariaLabel="Record actions" orientation="horizontal" data-track="record-actions">
      <span>Actions</span>
    </ButtonGroup>
    <Toolbar ariaLabel="List tools" start={<span>Start</span>} end={<span>End</span>} data-track="tools">
      <span>Main</span>
    </Toolbar>
    <FilterBar
      ariaLabel="Account filters"
      action="/accounts"
      method="get"
      data-track="filters"
      actions={<span>Submit</span>}
    >
      <span>Fields</span>
    </FilterBar>
    <SplitButton
      controlRef={controlRef}
      menuItems={[]}
      menuAriaLabel="More actions"
      name="intent"
      value="run"
      form="report"
      data-track="run-report"
    >
      Run report
    </SplitButton>
    <ToggleButton
      controlRef={controlRef}
      pressed={false}
      onPressedChange={() => undefined}
      name="pinned"
      data-track="pin"
    >
      Pin
    </ToggleButton>
    <ToggleButton defaultPressed data-track="favorite">Favorite</ToggleButton>
    <ClipboardButton controlRef={controlRef} text="value" name="copy" data-track="copy" />
  </>
);
void allowedActions;

// @ts-expect-error fixed action controls do not expose className
const linkClassName = <Link className="foreign" href="/">Home</Link>;
// @ts-expect-error fixed action controls do not expose style
const linkStyle = <Link style={{ color: "red" }} href="/">Home</Link>;
// @ts-expect-error fixed action controls do not expose CSS-in-JS props
const linkCss = <Link css={{ color: "red" }} href="/">Home</Link>;
// @ts-expect-error fixed action controls do not expose sx
const linkSx = <Link sx={{ color: "red" }} href="/">Home</Link>;
// @ts-expect-error fixed action controls do not expose utility class props
const linkTw = <Link tw="text-red" href="/">Home</Link>;
// @ts-expect-error fixed action controls do not expose raw DOM refs
const linkRef = <Link ref={createRef<HTMLAnchorElement>()} href="/">Home</Link>;
// @ts-expect-error fixed action controls do not expose raw HTML injection
const linkHtml = <Link dangerouslySetInnerHTML={{ __html: "unsafe" }} href="/">Home</Link>;
// @ts-expect-error reserved ownership attributes are never public
const linkOwner = <Link data-pui-owner="Consumer" href="/">Home</Link>;
// @ts-expect-error the wildcard contract rejects unregistered reserved keys in Props objects
const linkPrivateData: LinkProps = { href: "/", "data-pui-private": "foreign" };

// @ts-expect-error ButtonGroup follows the protected public-control contract
const buttonGroupClassName = <ButtonGroup className="foreign" ariaLabel="Actions" />;
// @ts-expect-error ButtonGroup does not expose raw DOM refs
const buttonGroupRef = <ButtonGroup ref={createRef<HTMLDivElement>()} ariaLabel="Actions" />;
// @ts-expect-error Toolbar follows the protected public-control contract
const toolbarStyle = <Toolbar style={{ color: "red" }} ariaLabel="Tools" />;
// @ts-expect-error Toolbar cannot accept reserved ownership attributes
const toolbarOwner = <Toolbar data-pui-slot="foreign" ariaLabel="Tools" />;
// @ts-expect-error FilterBar follows the protected public-control contract
const filterClassName = <FilterBar className="foreign" ariaLabel="Filters" actions={null}>Fields</FilterBar>;
// @ts-expect-error FilterBar does not expose raw HTML injection
const filterHtml = <FilterBar dangerouslySetInnerHTML={{ __html: "unsafe" }} ariaLabel="Filters" actions={null}>Fields</FilterBar>;
// @ts-expect-error SplitButton cannot reopen Button's styling escape hatch
const splitStyle = <SplitButton style={{ color: "red" }} menuItems={[]} menuAriaLabel="More">Run</SplitButton>;
// @ts-expect-error ToggleButton cannot expose reserved ownership attributes
const toggleOwner = <ToggleButton data-pui-owner="Consumer" pressed={false} onPressedChange={() => undefined}>Pin</ToggleButton>;
// @ts-expect-error controlled ToggleButton requires onPressedChange
const toggleMissingChange = <ToggleButton pressed>Pin</ToggleButton>;
// @ts-expect-error ToggleButton cannot be controlled and uncontrolled simultaneously
const toggleContradictory = <ToggleButton pressed defaultPressed onPressedChange={() => undefined}>Pin</ToggleButton>;
// @ts-expect-error ClipboardButton cannot expose utility class props
const clipboardTw = <ClipboardButton tw="text-red" text="value" />;

void linkClassName;
void linkStyle;
void linkCss;
void linkSx;
void linkTw;
void linkRef;
void linkHtml;
void linkOwner;
void linkPrivateData;
void buttonGroupClassName;
void buttonGroupRef;
void toolbarStyle;
void toolbarOwner;
void filterClassName;
void filterHtml;
void splitStyle;
void toggleOwner;
void toggleMissingChange;
void toggleContradictory;
void clipboardTw;
