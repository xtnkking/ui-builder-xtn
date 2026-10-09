import { Button, type ButtonProps } from "../../src/personal-ui";
import { SupportedUsageExample } from "../fixtures/supported-public-usage";

const supportedExplicitExample = <SupportedUsageExample onSave={() => undefined} />;

// TypeScript supports object spread; provenance deliberately rejects this policy boundary.
// This positive type fixture records the difference rather than pretending spread is a type error.
const typedButtonProps = { disabled: false, children: "Save" } satisfies ButtonProps;
const typeCorrectButPolicyUnsupported = <Button {...typedButtonProps} />;

void supportedExplicitExample;
void typeCorrectButPolicyUnsupported;
