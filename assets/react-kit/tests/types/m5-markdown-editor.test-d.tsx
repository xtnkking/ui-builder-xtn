import { createRef } from "react";
import { MarkdownEditor, RichTextEditor, type MarkdownEditorProps, type RichTextEditorProps, type TextControlHandle } from "../../src/personal-ui";

const textRef = createRef<TextControlHandle>();
const props: MarkdownEditorProps = { value: "**source**", onValueChange: () => undefined, "aria-label": "Markdown source" };
const oldProps: RichTextEditorProps = props;
const canonical = <MarkdownEditor {...props} controlRef={textRef} />;
const legacy = <RichTextEditor {...oldProps} />;

// @ts-expect-error MarkdownEditor owns its controlled source value
const missingValue = <MarkdownEditor onValueChange={() => undefined} />;
// @ts-expect-error MarkdownEditor cannot mix a controlled source and a default value
const defaultValue = <MarkdownEditor value="" defaultValue="draft" onValueChange={() => undefined} />;
// @ts-expect-error MarkdownEditor does not expose a raw textarea ref
const domRef = <MarkdownEditor value="" onValueChange={() => undefined} ref={createRef<HTMLTextAreaElement>()} />;
// @ts-expect-error MarkdownEditor owns its layout and cannot receive consumer style
const style = <MarkdownEditor value="" onValueChange={() => undefined} style={{ color: "red" }} />;

void [canonical, legacy, missingValue, defaultValue, domRef, style];
