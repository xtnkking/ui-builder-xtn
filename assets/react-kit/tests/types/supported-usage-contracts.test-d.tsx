import { Button, type ButtonProps } from "../../src/personal-ui";
import { SupportedUsageExample } from "../fixtures/supported-public-usage";

const supportedExplicitExample = <SupportedUsageExample onSave={() => undefined} />;

// Both the public type contract and compiler-backed provenance accept safe spreads.
const typedButtonProps = { disabled: false, children: "Save" } satisfies ButtonProps;
const supportedTypedSpread = <Button {...typedButtonProps} />;
function WithProps(props: ButtonProps) { return <Button {...props} />; }
function WithGenericProps<T extends ButtonProps>(props: T) { return <Button {...props} />; }
const supportedParameter = <WithProps {...typedButtonProps} />;
const supportedGenericParameter = <WithGenericProps {...typedButtonProps} />;
// @ts-expect-error Public boolean props remain typed in JSX spreads.
const wrongSpread = <Button {...{disabled: "yes"}} />;
// @ts-expect-error Explicit props use the same public boolean contract.
const wrongDirect = <Button loading="yes" />;

void supportedExplicitExample;
void supportedTypedSpread;
void supportedParameter;
void supportedGenericParameter;
void wrongSpread;
void wrongDirect;
