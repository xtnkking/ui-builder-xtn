import { createRef } from "react";
import {
  AsyncAction,
  Button,
  ClipboardButton,
  IconButton,
  RetryButton,
  SplitButton,
  ToggleButton,
  type ControlHandle,
} from "../../src/personal-ui";

const controlRef = createRef<ControlHandle>();
const allowedButtons = (
  <>
    <Button controlRef={controlRef} name="intent" value="save" form="profile" data-track="save">
      Save
    </Button>
    <IconButton controlRef={controlRef} aria-label="Close" icon={<span />} data-track="close" />
  </>
);
void allowedButtons;

// @ts-expect-error fixed buttons do not expose className
const buttonClassName = <Button className="foreign">Save</Button>;
// @ts-expect-error fixed buttons do not expose style
const buttonStyle = <Button style={{ color: "red" }}>Save</Button>;
// @ts-expect-error fixed buttons do not expose CSS-in-JS props
const buttonCss = <Button css={{ color: "red" }}>Save</Button>;
// @ts-expect-error fixed buttons do not expose sx
const buttonSx = <Button sx={{ color: "red" }}>Save</Button>;
// @ts-expect-error fixed buttons do not expose utility class props
const buttonTw = <Button tw="text-red">Save</Button>;
// @ts-expect-error fixed buttons do not expose raw DOM refs
const buttonRef = <Button ref={createRef<HTMLButtonElement>()}>Save</Button>;
// @ts-expect-error a raw DOM ref is not a limited control handle
const buttonDomControlRef = <Button controlRef={createRef<HTMLButtonElement>()}>Save</Button>;
// @ts-expect-error fixed buttons do not expose raw HTML injection
const buttonHtml = <Button dangerouslySetInnerHTML={{ __html: "unsafe" }}>Save</Button>;
// @ts-expect-error fixed buttons do not expose internal ownership markers
const buttonOwner = <Button data-pui-owner="Consumer">Save</Button>;

// @ts-expect-error IconButton follows the same closed styling contract
const iconButtonClassName = <IconButton className="foreign" aria-label="Close" icon={<span />} />;
// @ts-expect-error IconButton owns its children
const iconButtonChildren = <IconButton aria-label="Close" icon={<span />}>Injected</IconButton>;

// @ts-expect-error SplitButton cannot reopen Button's styling escape hatch
const splitClassName = <SplitButton className="foreign" menuItems={[]} menuAriaLabel="More">Run</SplitButton>;
// @ts-expect-error ToggleButton cannot reopen Button's styling escape hatch
const toggleStyle = <ToggleButton style={{ color: "red" }} pressed={false} onPressedChange={() => undefined}>Pin</ToggleButton>;
// @ts-expect-error ClipboardButton cannot reopen Button's styling escape hatch
const clipboardClassName = <ClipboardButton className="foreign" text="value" />;
// @ts-expect-error RetryButton cannot reopen Button's styling escape hatch
const retryOwner = <RetryButton data-pui-owner="Consumer" onRetry={() => undefined} />;
// @ts-expect-error AsyncAction cannot reopen Button's styling escape hatch
const asyncStyle = <AsyncAction style={{ color: "red" }} onAction={() => undefined}>Save</AsyncAction>;

void buttonClassName;
void buttonStyle;
void buttonCss;
void buttonSx;
void buttonTw;
void buttonRef;
void buttonDomControlRef;
void buttonHtml;
void buttonOwner;
void iconButtonClassName;
void iconButtonChildren;
void splitClassName;
void toggleStyle;
void clipboardClassName;
void retryOwner;
void asyncStyle;
