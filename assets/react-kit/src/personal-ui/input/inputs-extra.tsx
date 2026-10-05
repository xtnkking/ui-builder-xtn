import {
  useEffect,
  useId,
  useContext,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
  type FormEvent,
  type FormHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import {
  Bold,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  FileText,
  Italic,
  Link as LinkIcon,
  List,
  LoaderCircle,
  Minus,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type {
  ControllableValueProps,
  ControlHandle,
  ControlRef,
  FormControlHandle,
  PublicControlProps,
  TextControlHandle,
  ValidityControlHandle,
} from "../foundation/contracts";
import { useControllableMode, useControllableState } from "../internal/controllable-state";
import { Button, IconButton, Spinner, Tag } from "../foundation/primitives";
import { FieldContext } from "../internal/field-context";
import { floatingPortalTarget, usePopoverPosition } from "../internal/floating-position";
import {
  Combobox,
  Input,
  SearchInput,
  Select,
  Textarea,
  type ComboboxOption,
  type SelectOption,
} from "./forms";
import { createFormControlHandle } from "../internal/control-handles";
import {
  CompositeFieldBoundary,
  CompositeFormControl,
  mergeAriaIds,
  useCompositeFieldState,
} from "../internal/composite-form-control";
import { sanitizeFixedControlProps } from "../internal/fixed-control-props";
import { adjacentTreeKey, resolvedTreeKey, visibleTreeItems } from "../internal/tree-navigation";
import { InternalInputSlot, InternalTextareaSlot } from "../internal/input-slots";
import { usePersonalUILocale } from "../foundation/locale";
import { assertUniqueIdentities, cx, getTabStops, matchesFileAccept } from "../internal/utils";

function useControlledOnlyValueMode(componentName: string, rawProps: object): void {
  useControllableMode({
    componentName,
    controlled: (rawProps as { value?: unknown }).value !== undefined,
    controlledOnly: true,
    defaultValueProvided: (rawProps as { defaultValue?: unknown }).defaultValue !== undefined,
    onChangeProvided: typeof (rawProps as { onValueChange?: unknown }).onValueChange === "function",
  });
}

type ControllableQueryProps =
  | {
      query: string;
      defaultQuery?: never;
      onQueryChange: (query: string) => void;
    }
  | {
      query?: never;
      defaultQuery?: string;
      onQueryChange?: (query: string) => void;
    };

type ControllableInputValueProps =
  | {
      inputValue: string;
      defaultInputValue?: never;
      onInputValueChange: (value: string) => void;
    }
  | {
      inputValue?: never;
      defaultInputValue?: string;
      onInputValueChange?: (value: string) => void;
    };

type ControllableListValueProps =
  | {
      value: readonly string[];
      defaultValue?: never;
      onValueChange: (value: string[]) => void;
    }
  | {
      value?: never;
      defaultValue?: readonly string[];
      onValueChange?: (value: string[]) => void;
    };

function optionText(label: ReactNode, fallback: string): string {
  return typeof label === "string" || typeof label === "number" ? String(label) : fallback;
}

function useOutsideDismiss(
  open: boolean,
  rootRef: React.RefObject<HTMLElement | null>,
  onDismiss: () => void,
  popoverRef?: React.RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!open) return;
    const handleOutside = (event: MouseEvent | FocusEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!rootRef.current?.contains(target) && !popoverRef?.current?.contains(target)) onDismiss();
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("focusin", handleOutside);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("focusin", handleOutside);
    };
  }, [onDismiss, open, popoverRef, rootRef]);
}

export type FormProps = PublicControlProps<FormHTMLAttributes<HTMLFormElement>> & {
  busy?: boolean;
  controlRef?: ControlRef<FormControlHandle>;
};

export function Form(rawProps: FormProps) {
  const safeProps = sanitizeFixedControlProps(rawProps);
  const { busy = false, onSubmit, children, controlRef, ...props } = safeProps;
  const elementRef = useRef<HTMLFormElement>(null);
  useImperativeHandle(controlRef, () => createFormControlHandle(elementRef), []);
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (busy) {
      event.preventDefault();
      return;
    }
    onSubmit?.(event);
  };
  return (
    <form
      {...props}
      ref={elementRef}
      data-pui-owner="Form"
      className="pui-form"
      aria-busy={busy || undefined}
      data-busy={busy || undefined}
      onSubmit={handleSubmit}
    >
      {children}
    </form>
  );
}

export type NumberInputProps = PublicControlProps<{
  id?: string;
  value: number | "";
  onValueChange: (value: number | "") => void;
  min?: number;
  max?: number;
  step?: number;
  name?: string;
  form?: string;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  invalid?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  controlRef?: ControlRef<ValidityControlHandle>;
}>;

export function NumberInput(rawProps: NumberInputProps) {
  const { message } = usePersonalUILocale();
  useControlledOnlyValueMode("NumberInput", rawProps);
  const safeProps = sanitizeFixedControlProps(rawProps);
  const {
    id,
    value,
    onValueChange,
    min,
    max,
    step = 1,
    name,
    form,
    required,
    disabled,
    readOnly,
    invalid,
    placeholder,
    ariaLabel,
    controlRef,
  } = safeProps;
  const fieldLabelId = useContext(FieldContext)?.labelId;
  const increaseId = useId();
  const decreaseId = useId();
  const useFieldLabel = Boolean(fieldLabelId && !ariaLabel);
  const clamp = (next: number): number => Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min ?? Number.NEGATIVE_INFINITY, next));
  const move = (direction: 1 | -1) => {
    const base = value === ""
      ? direction === 1 ? (min ?? step) - step : (max ?? -step) + step
      : value;
    const next = clamp(Number((base + direction * step).toFixed(12)));
    if (Number.isFinite(next) && next !== value) onValueChange(next);
  };
  return (
    <InternalInputSlot name="number-input" controlRef={controlRef}>
      <Input
        id={id}
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        name={name}
        form={form}
        required={required}
        disabled={disabled}
        readOnly={readOnly}
        invalid={invalid}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={(event) => {
          const next = event.target.valueAsNumber;
          onValueChange(event.target.value === "" || !Number.isFinite(next) ? "" : next);
        }}
        endAdornment={(
          <span className="pui-number-input__steps">
            <button type="button" aria-label={useFieldLabel ? undefined : message("number.increase", { label: ariaLabel ?? message("number.value") })} aria-labelledby={useFieldLabel ? `${fieldLabelId} ${increaseId}` : undefined} disabled={disabled || readOnly || (typeof max === "number" && value !== "" && value >= max)} onClick={() => move(1)}><Plus aria-hidden="true" /><span id={increaseId} className="pui-sr-only">{message("number.increase", { label: "" }).trim()}</span></button>
            <button type="button" aria-label={useFieldLabel ? undefined : message("number.decrease", { label: ariaLabel ?? message("number.value") })} aria-labelledby={useFieldLabel ? `${fieldLabelId} ${decreaseId}` : undefined} disabled={disabled || readOnly || (typeof min === "number" && value !== "" && value <= min)} onClick={() => move(-1)}><Minus aria-hidden="true" /><span id={decreaseId} className="pui-sr-only">{message("number.decrease", { label: "" }).trim()}</span></button>
          </span>
        )}
      />
    </InternalInputSlot>
  );
}

export type OtpInputProps = PublicControlProps<{
  id?: string;
  length?: number;
  mode?: "numeric" | "alphanumeric";
  name?: string;
  form?: string;
  required?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  ariaLabel?: string;
  controlRef?: ControlRef<ValidityControlHandle>;
}> & ControllableValueProps<string>;

export function OtpInput(rawProps: OtpInputProps) {
  const { message } = usePersonalUILocale();
  const safeProps = sanitizeFixedControlProps(rawProps);
  const {
    id,
    value,
    defaultValue,
    onValueChange,
    length = 6,
    mode = "numeric",
    name,
    form,
    required,
    disabled,
    invalid,
    ariaLabel = message("otp.label"),
    controlRef,
  } = safeProps;
  const [resolvedValue, setResolvedValue, resetResolvedValue] = useControllableState<string>({
    componentName: "OtpInput",
    controlled: rawProps.value !== undefined,
    value,
    defaultValue: defaultValue ?? "",
    defaultValueProvided: rawProps.defaultValue !== undefined,
    onChange: onValueChange,
  });
  if (!Number.isInteger(length) || length < 1 || length > 12) {
    throw new RangeError("OtpInput length must be an integer between 1 and 12.");
  }
  const generatedId = useId();
  const fallbackId = `pui-otp-${generatedId}`;
  const fieldState = useCompositeFieldState({ id, fallbackId, invalid, required });
  const rootId = fieldState.id ?? fallbackId;
  const resolvedInvalid = fieldState.invalid === true || fieldState.invalid === "true";
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const clean = (candidate: string) => (
    mode === "numeric" ? candidate.replace(/\D/g, "") : candidate.replace(/[^a-z0-9]/gi, "").toUpperCase()
  ).slice(0, length);
  const normalized = clean(resolvedValue);
  const updateAt = (index: number, character: string) => {
    const nextCharacter = clean(character).slice(-1);
    if (!nextCharacter) {
      setResolvedValue(`${normalized.slice(0, index)}${normalized.slice(index + 1)}`);
      return;
    }
    const targetIndex = Math.min(index, normalized.length);
    setResolvedValue(`${normalized.slice(0, targetIndex)}${nextCharacter}${normalized.slice(targetIndex + 1)}`.slice(0, length));
  };
  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    const pasted = clean(event.clipboardData.getData("text"));
    if (!pasted) return;
    event.preventDefault();
    setResolvedValue(pasted);
    refs.current[Math.min(pasted.length, length) - 1]?.focus();
  };
  return (
    <div data-pui-owner="OtpInput" className={cx("pui-otp", resolvedInvalid && "is-invalid")} role="group" aria-label={ariaLabel} aria-describedby={fieldState.describedBy} aria-invalid={fieldState.invalid} aria-required={fieldState.required} onPaste={handlePaste}>
      {Array.from({ length }, (_, index) => (
        <input
          key={index}
          ref={(node) => { refs.current[index] = node; }}
          id={index === 0 ? rootId : undefined}
          className="pui-otp__cell"
          type="text"
          inputMode={mode === "numeric" ? "numeric" : "text"}
          autoComplete={index === 0 ? "one-time-code" : "off"}
          value={normalized[index] ?? ""}
          maxLength={1}
          disabled={disabled}
          aria-describedby={index === 0 ? fieldState.describedBy : undefined}
          aria-invalid={index === 0 ? fieldState.invalid : undefined}
          aria-required={index === 0 ? fieldState.required : undefined}
          aria-label={message("otp.position", { label: ariaLabel, position: index + 1 })}
          onChange={(event) => {
            const next = clean(event.target.value);
            updateAt(index, next);
            if (next && index < length - 1) refs.current[index + 1]?.focus();
          }}
          onKeyDown={(event) => {
            if (event.key === "Backspace" && !normalized[index] && index > 0) {
              updateAt(index - 1, "");
              refs.current[index - 1]?.focus();
            } else if (event.key === "ArrowLeft" && index > 0) {
              event.preventDefault();
              refs.current[index - 1]?.focus();
            } else if (event.key === "ArrowRight" && index < length - 1) {
              event.preventDefault();
              refs.current[index + 1]?.focus();
            }
          }}
        />
      ))}
      <CompositeFormControl
        name={name}
        form={form}
        values={[normalized]}
        disabled={disabled}
        required={required}
        controlRef={controlRef}
        onReset={resetResolvedValue}
      />
    </div>
  );
}

export type FileUploadStatus = "queued" | "uploading" | "success" | "error";

export interface FileUploadItem {
  id: string;
  name: string;
  size?: number;
  value?: string;
  status: FileUploadStatus;
  progress?: number;
  error?: ReactNode;
}

export interface FileUploadRejection {
  file: File;
  reason: "type" | "size" | "count";
  message: string;
}

export type FileUploadProps = PublicControlProps<{
  /** The caller owns upload transport and updates status/progress; only successful items contribute form values. */
  items: readonly FileUploadItem[];
  /** Receives locally selected files after type, size, and count validation; it does not upload them. */
  onFiles: (files: File[]) => void;
  onRejected?: (rejections: FileUploadRejection[]) => void;
  onRemove?: (item: FileUploadItem) => void;
  onRetry?: (item: FileUploadItem) => void | Promise<void>;
  onStart?: () => void | Promise<void>;
  onReset?: () => void;
  onActionError?: (error: unknown, action: "start" | "retry", item?: FileUploadItem) => void;
  accept?: string;
  multiple?: boolean;
  maxFiles?: number;
  maxSize?: number;
  name?: string;
  form?: string;
  required?: boolean;
  disabled?: boolean;
  label?: ReactNode;
  description?: ReactNode;
  browseLabel?: string;
  startLabel?: string;
  controlRef?: ControlRef<ValidityControlHandle>;
}>;

function formatFileSize(size: number | undefined, formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string): string | undefined {
  if (size == null || !Number.isFinite(size)) return undefined;
  if (size < 1024) return `${formatNumber(size)} B`;
  if (size < 1024 * 1024) return `${formatNumber(size / 1024, { maximumFractionDigits: 1 })} KB`;
  return `${formatNumber(size / (1024 * 1024), { maximumFractionDigits: 1 })} MB`;
}

export function FileUpload(rawProps: FileUploadProps) {
  const { formatNumber, message, plural } = usePersonalUILocale();
  const safeProps = sanitizeFixedControlProps(rawProps);
  const {
    items,
    onFiles,
    onRejected,
    onRemove,
    onRetry,
    onStart,
    onReset,
    onActionError,
    accept,
    multiple = true,
    maxFiles,
    maxSize,
    name,
    form,
    required,
    disabled,
    label = message("upload.drop"),
    description,
    browseLabel = message("upload.browse"),
    startLabel = message("upload.start"),
    controlRef,
  } = safeProps;
  assertUniqueIdentities("FileUpload", "item.id", items.map((item) => item.id));
  if (maxFiles != null && (!Number.isInteger(maxFiles) || maxFiles < 1)) {
    throw new RangeError("FileUpload maxFiles must be a positive integer.");
  }
  if (maxSize != null && (!Number.isFinite(maxSize) || maxSize <= 0)) {
    throw new RangeError("FileUpload maxSize must be greater than zero.");
  }
  const inputRef = useRef<HTMLInputElement>(null);
  const generatedId = useId();
  const fieldState = useCompositeFieldState({
    fallbackId: `pui-file-upload-${generatedId}`,
    required,
  });
  const fieldInvalid = fieldState.invalid === true || fieldState.invalid === "true";
  const [dragging, setDragging] = useState(false);
  const [starting, setStarting] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const selectFiles = (incoming: File[]) => {
    const accepted: File[] = [];
    const rejected: FileUploadRejection[] = [];
    incoming.forEach((file, index) => {
      if (maxFiles != null && items.length + accepted.length >= maxFiles) {
        rejected.push({ file, reason: "count", message: plural("upload.maxFiles", maxFiles) });
      } else if (!matchesFileAccept(file, accept)) {
        rejected.push({ file, reason: "type", message: message("upload.unsupportedType") });
      } else if (maxSize != null && file.size > maxSize) {
        rejected.push({ file, reason: "size", message: message("upload.tooLarge", { size: formatFileSize(maxSize, formatNumber) ?? "" }) });
      } else if (multiple || index === 0) {
        accepted.push(file);
      }
    });
    if (accepted.length) onFiles(accepted);
    if (rejected.length) onRejected?.(rejected);
  };
  const runStart = async () => {
    if (disabled || !onStart || starting) return;
    setStarting(true);
    try { await onStart(); } catch (error) { onActionError?.(error, "start"); } finally { setStarting(false); }
  };
  const runRetry = async (item: FileUploadItem) => {
    if (disabled || !onRetry || retryingId) return;
    setRetryingId(item.id);
    try { await onRetry(item); } catch (error) { onActionError?.(error, "retry", item); } finally { setRetryingId(null); }
  };
  const queued = items.some((item) => item.status === "queued");
  return (
    <div data-pui-owner="FileUpload" className={cx("pui-file-upload", dragging && "is-dragging", disabled && "is-disabled", fieldInvalid && "is-invalid")} role="group" aria-disabled={disabled || undefined} aria-describedby={fieldState.describedBy} aria-invalid={fieldState.invalid}>
      <div
        className="pui-file-upload__dropzone"
        onDragEnter={(event: DragEvent<HTMLDivElement>) => { event.preventDefault(); if (!disabled) setDragging(true); }}
        onDragOver={(event: DragEvent<HTMLDivElement>) => { event.preventDefault(); }}
        onDragLeave={(event: DragEvent<HTMLDivElement>) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }}
        onDrop={(event: DragEvent<HTMLDivElement>) => {
          event.preventDefault();
          setDragging(false);
          if (!disabled) selectFiles(Array.from(event.dataTransfer.files));
        }}
      >
        <Upload aria-hidden="true" />
        <div className="pui-file-upload__copy"><strong>{label}</strong>{description != null ? <span>{description}</span> : null}</div>
        <Button id={fieldState.id} size="small" disabled={disabled || (maxFiles != null && items.length >= maxFiles)} aria-describedby={fieldState.describedBy} aria-invalid={fieldState.invalid} onClick={() => inputRef.current?.click()}>{browseLabel}</Button>
        <input
          ref={inputRef}
          className="pui-file-upload__native"
          type="file"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            selectFiles(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
        />
      </div>
      {items.length ? (
        <ul className="pui-file-upload__list" aria-label={message("upload.fileList")}>
          {items.map((item) => {
            const progress = Math.max(0, Math.min(100, item.progress ?? (item.status === "success" ? 100 : 0)));
            return (
              <li key={item.id} className="pui-file-upload__item" data-status={item.status}>
                <span className="pui-file-upload__file-icon" aria-hidden="true">
                  {item.status === "success" ? <CircleCheck /> : item.status === "error" ? <CircleAlert /> : item.status === "uploading" ? <LoaderCircle className="pui-spinner" /> : <FileText />}
                </span>
                <span className="pui-file-upload__item-copy">
                  <strong title={item.name}>{item.name}</strong>
                  <span>{item.error ?? formatFileSize(item.size, formatNumber) ?? (item.status === "queued" ? message("upload.queued") : item.status === "uploading" ? message("upload.progress", { progress: Math.round(progress) }) : message("upload.complete"))}</span>
                  {item.status === "uploading" ? <span className="pui-file-upload__progress"><span style={{ width: `${progress}%` }} /></span> : null}
                </span>
                <span className="pui-file-upload__item-actions">
                  {item.status === "error" && onRetry ? <IconButton aria-label={message("upload.retryNamed", { name: item.name })} icon={<RotateCcw />} loading={retryingId === item.id} disabled={disabled} onClick={() => void runRetry(item)} /> : null}
                  {onRemove ? <IconButton aria-label={message("upload.removeNamed", { name: item.name })} icon={<Trash2 />} disabled={disabled || item.status === "uploading"} onClick={() => { if (!disabled && item.status !== "uploading") onRemove(item); }} /> : null}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
      {onStart && queued ? <div className="pui-file-upload__footer"><Button variant="primary" loading={starting} disabled={disabled} onClick={() => void runStart()}>{startLabel}</Button></div> : null}
      <CompositeFormControl
        name={name}
        form={form}
        values={items.filter((item) => item.status === "success").map((item) => item.value ?? item.id)}
        disabled={disabled}
        required={required}
        controlRef={controlRef}
        onReset={onReset}
      />
    </div>
  );
}

export type MarkdownEditorProps = PublicControlProps<Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "children" | "defaultValue" | "onChange" | "value"
>> & {
  value: string;
  onValueChange: (value: string) => void;
  toolbarLabel?: string;
  controlRef?: ControlRef<TextControlHandle>;
};

/** @deprecated Use MarkdownEditor; this control edits Markdown source, not a rich document. */
export type RichTextEditorProps = MarkdownEditorProps;

const MARKDOWN_EDITOR_OWNERS = {
  markdown: "MarkdownEditor",
  legacy: "RichTextEditor",
} as const;

function MarkdownEditorContent({ rawProps, variant }: { rawProps: MarkdownEditorProps; variant: keyof typeof MARKDOWN_EDITOR_OWNERS }) {
  const owner = MARKDOWN_EDITOR_OWNERS[variant];
  useControlledOnlyValueMode(owner, rawProps);
  const { message } = usePersonalUILocale();
  const safeProps = sanitizeFixedControlProps(rawProps, ["children", "defaultValue"]);
  const {
    value,
    onValueChange,
    toolbarLabel = variant === "markdown" ? message("editor.markdownToolbar") : message("editor.textToolbar"),
    disabled,
    readOnly,
    controlRef,
    ...props
  } = safeProps;
  const localRef = useRef<HTMLTextAreaElement | null>(null);
  const replaceSelection = (before: string, after = before, fallback = message("editor.fallbackText")) => {
    const editor = localRef.current;
    if (!editor || disabled || readOnly) return;
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const selected = value.slice(start, end) || fallback;
    const next = `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`;
    onValueChange(next);
    requestAnimationFrame(() => {
      editor.focus();
      editor.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  };
  const listSelection = () => {
    const editor = localRef.current;
    if (!editor || disabled || readOnly) return;
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const selected = value.slice(start, end) || message("editor.listItem");
    const replacement = selected.split("\n").map((line) => `- ${line.replace(/^[-*]\s+/, "")}`).join("\n");
    onValueChange(`${value.slice(0, start)}${replacement}${value.slice(end)}`);
    requestAnimationFrame(() => editor.focus());
  };
  return (
    <div data-pui-owner={owner} className="pui-rich-text">
      <div className="pui-rich-text__toolbar" role="toolbar" aria-label={toolbarLabel}>
        <IconButton aria-label={message("editor.bold")} icon={<Bold />} disabled={disabled || readOnly} onClick={() => replaceSelection("**")} />
        <IconButton aria-label={message("editor.italic")} icon={<Italic />} disabled={disabled || readOnly} onClick={() => replaceSelection("_")} />
        <IconButton aria-label={message("editor.unorderedList")} icon={<List />} disabled={disabled || readOnly} onClick={listSelection} />
        <IconButton aria-label={message("editor.insertLink")} icon={<LinkIcon />} disabled={disabled || readOnly} onClick={() => replaceSelection("[", "](https://)")} />
      </div>
      <InternalTextareaSlot name={variant === "markdown" ? "markdown-editor" : "rich-text-editor"} elementRef={localRef}>
        <Textarea {...props} controlRef={controlRef} value={value} disabled={disabled} readOnly={readOnly} onChange={(event) => onValueChange(event.target.value)} />
      </InternalTextareaSlot>
    </div>
  );
}

export function MarkdownEditor(rawProps: MarkdownEditorProps) {
  return <MarkdownEditorContent rawProps={rawProps} variant="markdown" />;
}

/** @deprecated Use MarkdownEditor; RichTextEditor is a Markdown source editor, not WYSIWYG. */
export function RichTextEditor(rawProps: RichTextEditorProps) {
  const warned = useRef(false);
  useEffect(() => {
    const viteDevelopment = (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV;
    const processValue = (globalThis as typeof globalThis & { process?: { env?: { NODE_ENV?: string } } }).process;
    if (warned.current || !(viteDevelopment ?? (processValue?.env?.NODE_ENV === "development"))) return;
    warned.current = true;
    console.warn("RichTextEditor is deprecated: use MarkdownEditor for Markdown source editing (not WYSIWYG).");
  }, []);
  return <MarkdownEditorContent rawProps={rawProps} variant="legacy" />;
}

export type CodeEditorProps = PublicControlProps<Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "children" | "defaultValue" | "onChange" | "value"
>> & {
  value: string;
  onValueChange: (value: string) => void;
  language?: string;
  indent?: string;
  tabBehavior?: "focus" | "indent";
  controlRef?: ControlRef<TextControlHandle>;
};

function editCodeIndent(value: string, start: number, end: number, indent: string, outdent: boolean) {
  if (!outdent && start === end) {
    return { value: `${value.slice(0, start)}${indent}${value.slice(end)}`, start: start + indent.length, end: start + indent.length };
  }

  const firstLine = value.lastIndexOf("\n", start - 1) + 1;
  const lastSelected = end > start && value[end - 1] === "\n" ? end - 1 : end;
  const nextNewline = value.indexOf("\n", lastSelected);
  const lastLine = nextNewline < 0 ? value.length : nextNewline;
  const lines = value.slice(firstLine, lastLine).split("\n");
  const changes: { position: number; removed: number; added: number }[] = [];
  let position = firstLine;
  const replacement = lines.map((line) => {
    const removed = outdent
      ? line.startsWith(indent) ? indent.length : line.startsWith("\t") ? 1 : Math.min(line.match(/^ */)?.[0].length ?? 0, indent.length)
      : 0;
    const added = outdent ? 0 : indent.length;
    changes.push({ position, removed, added });
    position += line.length + 1;
    return `${outdent ? "" : indent}${line.slice(removed)}`;
  }).join("\n");
  const mapPosition = (offset: number) => offset + changes.reduce((delta, change) => {
    if (offset < change.position) return delta;
    return delta + change.added - Math.min(change.removed, offset - change.position);
  }, 0);
  return {
    value: `${value.slice(0, firstLine)}${replacement}${value.slice(lastLine)}`,
    start: mapPosition(start),
    end: mapPosition(end),
  };
}

export function CodeEditor(rawProps: CodeEditorProps) {
  useControlledOnlyValueMode("CodeEditor", rawProps);
  const { message, plural } = usePersonalUILocale();
  const safeProps = sanitizeFixedControlProps(rawProps, ["children", "defaultValue"]);
  const {
    value,
    onValueChange,
    language = "text",
    indent = "  ",
    tabBehavior = "focus",
    onCompositionStart,
    onCompositionEnd,
    onKeyDown,
    controlRef,
    ...props
  } = safeProps;
  if (tabBehavior === "indent" && !/^[ \t]+$/.test(indent)) {
    throw new Error("CodeEditor indent must contain only spaces or tabs when tabBehavior is indent");
  }
  const [focusTabMode, setFocusTabMode] = useState(false);
  const [composing, setComposing] = useState(false);
  const shortcutId = useId();
  useEffect(() => { setFocusTabMode(false); }, [tabBehavior]);
  const indentOnTab = tabBehavior === "indent" && !focusTabMode;
  const lines = value.split("\n").length;
  return (
    <div data-pui-owner="CodeEditor" className="pui-code-editor">
      <div className="pui-code-editor__meta"><span>{language}</span><span>{plural("editor.lines", lines)}</span></div>
      {tabBehavior === "indent" ? <span id={shortcutId} className="pui-sr-only" role="status" aria-live="polite">{indentOnTab ? message("editor.indentMode") : message("editor.focusMode")}</span> : null}
      <InternalTextareaSlot name="code-editor">
        <Textarea
          {...props}
          controlRef={controlRef}
          value={value}
          spellCheck={false}
          aria-describedby={tabBehavior === "indent" ? mergeAriaIds(props["aria-describedby"], shortcutId) : props["aria-describedby"]}
          aria-keyshortcuts={tabBehavior === "indent" ? "Control+M" : props["aria-keyshortcuts"]}
          onCompositionStart={(event) => { setComposing(true); onCompositionStart?.(event); }}
          onCompositionEnd={(event) => { setComposing(false); onCompositionEnd?.(event); }}
          onChange={(event) => onValueChange(event.target.value)}
          onKeyDown={(event: KeyboardEvent<HTMLTextAreaElement>) => {
            onKeyDown?.(event);
            if (event.defaultPrevented || composing || event.nativeEvent.isComposing || event.keyCode === 229 || props.readOnly || props.disabled) return;
            if (tabBehavior === "indent" && event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey && event.key.toLowerCase() === "m") {
              event.preventDefault();
              setFocusTabMode((current) => !current);
              return;
            }
            if (event.key === "Tab" && indentOnTab && !event.altKey && !event.ctrlKey && !event.metaKey) {
              const target = event.currentTarget;
              const edited = editCodeIndent(value, target.selectionStart, target.selectionEnd, indent, event.shiftKey);
              if (edited.value === value && event.shiftKey) return;
              event.preventDefault();
              onValueChange(edited.value);
              requestAnimationFrame(() => {
                if (document.activeElement === target && target.value === edited.value) target.setSelectionRange(edited.start, edited.end);
              });
            }
          }}
        />
      </InternalTextareaSlot>
    </div>
  );
}

export type InlineEditProps = PublicControlProps<{
  value: string;
  onCommit: (value: string) => void | Promise<void>;
  onReset?: () => void;
  validate?: (value: string) => string | undefined;
  name?: string;
  form?: string;
  required?: boolean;
  disabled?: boolean;
  emptyLabel?: string;
  editLabel?: string;
  controlRef?: ControlRef<ValidityControlHandle>;
}>;

export function InlineEdit(rawProps: InlineEditProps) {
  // The draft is local, but the persisted value remains externally owned and changes only after the commit command succeeds.
  useControllableMode({
    componentName: "InlineEdit",
    controlled: rawProps.value !== undefined,
    controlledOnly: true,
    defaultValueProvided: (rawProps as { defaultValue?: unknown }).defaultValue !== undefined,
    onChangeProvided: typeof rawProps.onCommit === "function",
    changePropName: "onCommit",
  });
  const { message } = usePersonalUILocale();
  const safeProps = sanitizeFixedControlProps(rawProps);
  const {
    value,
    onCommit,
    onReset,
    validate,
    name,
    form,
    required,
    disabled,
    emptyLabel = message("common.notProvided"),
    editLabel = message("common.edit"),
    controlRef,
  } = safeProps;
  const inputRef = useRef<TextControlHandle>(null);
  const editButtonRef = useRef<ControlHandle>(null);
  const returnFocusRef = useRef(false);
  const saveEpochRef = useRef(0);
  const savingRef = useRef(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const generatedId = useId();
  const fallbackId = `pui-inline-edit-${generatedId}`;
  const fieldState = useCompositeFieldState({
    fallbackId,
    invalid: Boolean(error) || undefined,
    required,
  });
  const controlId = fieldState.id ?? fallbackId;
  const localErrorId = `${controlId}-local-error`;
  const describedBy = mergeAriaIds(fieldState.describedBy, error ? localErrorId : undefined);
  const resolvedInvalid = fieldState.invalid === true || fieldState.invalid === "true";
  const resolvedRequired = fieldState.required === true || fieldState.required === "true";
  useEffect(() => { if (!editing) setDraft(value); }, [editing, value]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);
  useEffect(() => {
    if (!editing && returnFocusRef.current) {
      returnFocusRef.current = false;
      editButtonRef.current?.focus();
    }
  }, [editing]);
  const closeEditor = () => {
    returnFocusRef.current = true;
    setEditing(false);
  };
  const cancel = () => {
    if (savingRef.current) return;
    setDraft(value);
    setError(undefined);
    closeEditor();
  };
  const save = async () => {
    if (savingRef.current || disabled) return;
    const validation = validate?.(draft) ?? (resolvedRequired && !draft.trim() ? message("inline.required") : undefined);
    if (validation) { setError(validation); inputRef.current?.focus(); return; }
    if (draft === value) { closeEditor(); return; }
    savingRef.current = true;
    const saveEpoch = ++saveEpochRef.current;
    setSaving(true);
    try {
      await onCommit(draft);
      if (saveEpoch !== saveEpochRef.current) return;
      setError(undefined);
      closeEditor();
    } catch (cause) {
      if (saveEpoch !== saveEpochRef.current) return;
      setError(cause instanceof Error && cause.message ? cause.message : message("inline.saveFailed"));
      inputRef.current?.focus();
    } finally {
      if (saveEpoch === saveEpochRef.current) {
        savingRef.current = false;
        setSaving(false);
      }
    }
  };
  return (
    <div data-pui-owner="InlineEdit" className={cx("pui-inline-edit", editing && "is-editing", resolvedInvalid && "is-invalid")} aria-busy={saving || undefined}>
      {editing ? (
        <>
          <CompositeFieldBoundary>
            <Input id={controlId} controlRef={inputRef} value={draft} invalid={resolvedInvalid} disabled={disabled} readOnly={saving} aria-label={editLabel} aria-describedby={describedBy} aria-required={fieldState.required} onChange={(event) => { setDraft(event.target.value); setError(undefined); }} onKeyDown={(event) => {
              if (event.key === "Enter" && !event.nativeEvent.isComposing && event.keyCode !== 229) {
                event.preventDefault();
                void save();
              } else if (event.key === "Escape") {
                event.stopPropagation();
                cancel();
              }
            }} />
          </CompositeFieldBoundary>
          <span className="pui-inline-edit__actions">
            <IconButton aria-label={message("common.save")} icon={<Check />} loading={saving} disabled={disabled} onClick={() => void save()} />
            <IconButton aria-label={message("common.cancel")} icon={<X />} disabled={disabled || saving} onClick={cancel} />
          </span>
          {error ? <span id={localErrorId} className="pui-inline-edit__error" role="alert">{error}</span> : null}
        </>
      ) : (
        <>
          <span className={cx("pui-inline-edit__value", !value && "is-empty")} title={value || undefined}>{value || emptyLabel}</span>
          <IconButton id={controlId} controlRef={editButtonRef} aria-label={editLabel} aria-describedby={fieldState.describedBy} aria-invalid={fieldState.invalid} icon={<Pencil />} disabled={disabled} onClick={() => setEditing(true)} />
        </>
      )}
      <CompositeFormControl
        name={name}
        form={form}
        values={[value]}
        disabled={disabled}
        required={required}
        controlRef={controlRef}
        onReset={() => {
          ++saveEpochRef.current;
          savingRef.current = false;
          returnFocusRef.current = false;
          setSaving(false);
          setDraft(value);
          setError(undefined);
          setEditing(false);
          onReset?.();
        }}
      />
    </div>
  );
}

export interface AutocompleteOption extends ComboboxOption {}

export type AutocompleteProps = PublicControlProps<{
  id?: string;
  options: readonly AutocompleteOption[];
  onOptionSelect?: (option: AutocompleteOption) => void;
  filterOptions?: boolean;
  allowCustomValue?: boolean;
  loading?: boolean;
  emptyText?: ReactNode;
  placeholder?: string;
  name?: string;
  form?: string;
  required?: boolean;
  disabled?: boolean;
  ariaLabel: string;
  controlRef?: ControlRef<ValidityControlHandle>;
}> & ControllableValueProps<string> & ControllableQueryProps;

export function Autocomplete(rawProps: AutocompleteProps) {
  const { message } = usePersonalUILocale();
  const safeProps = sanitizeFixedControlProps(rawProps);
  const {
    id,
    options,
    value,
    defaultValue,
    query,
    defaultQuery,
    onQueryChange,
    onValueChange,
    onOptionSelect,
    filterOptions = true,
    allowCustomValue = false,
    loading,
    emptyText = message("select.empty"),
    placeholder,
    name,
    form,
    required,
    disabled,
    ariaLabel,
    controlRef,
  } = safeProps;
  const [selectedValue, setSelectedValue, resetSelectedValue] = useControllableState<string>({
    componentName: "Autocomplete",
    controlled: rawProps.value !== undefined,
    value,
    defaultValue: defaultValue ?? "",
    defaultValueProvided: rawProps.defaultValue !== undefined,
    onChange: onValueChange,
  });
  const [search, setSearch, resetSearch] = useControllableState<string>({
    componentName: "Autocomplete",
    controlled: rawProps.query !== undefined,
    value: query,
    defaultValue: defaultQuery ?? "",
    defaultValueProvided: rawProps.defaultQuery !== undefined,
    onChange: onQueryChange,
    valuePropName: "query",
    defaultValuePropName: "defaultQuery",
    changePropName: "onQueryChange",
  });
  assertUniqueIdentities("Autocomplete", "option.value", options.map((option) => option.value), { allowEmpty: true });
  const generatedId = useId();
  const fallbackId = `pui-autocomplete-${generatedId}`;
  const fieldState = useCompositeFieldState({ id, fallbackId, required });
  const controlId = fieldState.id ?? fallbackId;
  const fieldInvalid = fieldState.invalid === true || fieldState.invalid === "true";
  const rootRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const filtered = useMemo(() => {
    if (!filterOptions || !search.trim()) return options;
    const needle = search.trim().toLocaleLowerCase();
    return options.filter((option) => `${option.label} ${option.description ?? ""} ${option.searchText ?? ""}`.toLocaleLowerCase().includes(needle));
  }, [filterOptions, options, search]);
  usePopoverPosition(open && portalTarget !== null, "bottom", rootRef, popoverRef);
  useOutsideDismiss(open, rootRef, () => setOpen(false), popoverRef);
  useEffect(() => { setPortalTarget(floatingPortalTarget(rootRef.current)); }, []);
  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  useEffect(() => { if (activeIndex >= filtered.length) setActiveIndex(0); }, [activeIndex, filtered.length]);
  const choose = (option: AutocompleteOption) => {
    if (disabled || option.disabled) return;
    setSelectedValue(option.value);
    setSearch(option.label);
    onOptionSelect?.(option);
    setOpen(false);
  };
  const submittedValue = allowCustomValue && !selectedValue ? search : selectedValue;
  return (
    <div ref={rootRef} data-pui-owner="Autocomplete" className={cx("pui-autocomplete", fieldInvalid && "is-invalid")} data-open={open || undefined}>
      <CompositeFieldBoundary>
        <Input
          id={controlId}
          value={search}
          placeholder={placeholder}
          disabled={disabled}
          invalid={fieldInvalid}
          aria-describedby={fieldState.describedBy}
          aria-required={fieldState.required}
          role="combobox"
          aria-label={ariaLabel}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={open ? `${controlId}-listbox` : undefined}
          aria-activedescendant={open && filtered[activeIndex] ? `${controlId}-option-${activeIndex}` : undefined}
          startAdornment={<Search />}
          endAdornment={loading ? <LoaderCircle className="pui-spinner" /> : <ChevronDown />}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setSearch(event.target.value);
            if (selectedValue) setSelectedValue("");
            setActiveIndex(0);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              setOpen(true);
              if (!filtered.length) return;
              const direction = event.key === "ArrowDown" ? 1 : -1;
              let next = activeIndex;
              for (let count = 0; count < filtered.length; count += 1) {
                next = (next + direction + filtered.length) % filtered.length;
                if (!filtered[next]?.disabled) break;
              }
              setActiveIndex(next);
            } else if (event.key === "Enter" && open && filtered[activeIndex]) {
              event.preventDefault();
              choose(filtered[activeIndex]);
            } else if (event.key === "Escape" && open) {
              event.preventDefault();
              event.stopPropagation();
              setOpen(false);
            }
          }}
        />
      </CompositeFieldBoundary>
      {open ? (portalTarget ? createPortal(
        <div ref={popoverRef} id={`${controlId}-listbox`} className="pui-extra-popover pui-autocomplete__list pui-portal" data-pui-floating-root="true" role="listbox" aria-label={ariaLabel}>
          {loading ? <div className="pui-extra-state"><Spinner label={message("common.loading")} /></div> : filtered.map((option, index) => (
            <button key={option.value} id={`${controlId}-option-${index}`} type="button" className="pui-extra-option" role="option" aria-selected={option.value === selectedValue} data-active={index === activeIndex || undefined} disabled={option.disabled} onMouseDown={(event) => event.preventDefault()} onMouseMove={() => setActiveIndex(index)} onClick={() => choose(option)}>
              {option.leading != null ? <span className="pui-extra-option__leading" aria-hidden="true">{option.leading}</span> : null}
              <span className="pui-extra-option__copy"><strong>{option.label}</strong>{option.description ? <span>{option.description}</span> : null}</span>
              <Check aria-hidden="true" />
            </button>
          ))}
          {!loading && !filtered.length ? <div className="pui-extra-state" role="status">{emptyText}</div> : null}
        </div>, portalTarget) : null) : null}
      <CompositeFormControl
        name={name}
        form={form}
        values={[submittedValue]}
        disabled={disabled}
        required={required}
        controlRef={controlRef}
        onReset={() => {
          resetSelectedValue();
          resetSearch();
          setOpen(false);
        }}
      />
    </div>
  );
}

export type SearchableSelectProps = PublicControlProps<{
  id?: string;
  options: readonly ComboboxOption[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  ariaLabel: string;
  disabled?: boolean;
  placement?: "bottom" | "top";
  name?: string;
  form?: string;
  required?: boolean;
  controlRef?: ControlRef<ValidityControlHandle>;
}>;

export function SearchableSelect(rawProps: SearchableSelectProps) {
  const safeProps = sanitizeFixedControlProps(rawProps);
  const { name, form, required, controlRef, ...props } = safeProps;
  return (
    <div data-pui-owner="SearchableSelect" className="pui-form-control-bridge">
      <Combobox {...props} name={name} form={form} required={required} controlRef={controlRef} />
    </div>
  );
}

export interface AsyncSelectOption extends ComboboxOption {}

export type AsyncSelectSource =
  | {
      options: readonly AsyncSelectOption[];
      optionsQuery?: string;
      loadOptions?: never;
      debounceMs?: never;
    }
  | {
      options?: never;
      optionsQuery?: never;
      loadOptions: (query: string, context: { signal: AbortSignal }) => Promise<readonly AsyncSelectOption[]>;
      debounceMs?: number;
    };

export type AsyncSelectProps = PublicControlProps<{
  id?: string;
  selectedOption?: AsyncSelectOption;
  loading?: boolean;
  loadingMore?: boolean;
  error?: ReactNode;
  onRetry?: () => void | Promise<void>;
  onLoadMore?: () => void | Promise<void>;
  onActionError?: (error: unknown, action: "retry" | "load-more") => void;
  hasMore?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: ReactNode;
  name?: string;
  form?: string;
  required?: boolean;
  disabled?: boolean;
  ariaLabel: string;
  controlRef?: ControlRef<ValidityControlHandle>;
}> & AsyncSelectSource & ControllableValueProps<string> & ControllableQueryProps;

export function AsyncSelect(rawProps: AsyncSelectProps) {
  const { message } = usePersonalUILocale();
  const safeProps = sanitizeFixedControlProps(rawProps);
  const {
    id,
    options,
    optionsQuery,
    loadOptions,
    debounceMs = 250,
    selectedOption,
    value,
    defaultValue,
    query,
    defaultQuery,
    onQueryChange,
    onValueChange,
    loading,
    loadingMore,
    error,
    onRetry,
    onLoadMore,
    onActionError,
    hasMore,
    placeholder = message("select.placeholder"),
    searchPlaceholder = message("select.searchShortPlaceholder"),
    emptyText = message("select.empty"),
    name,
    form,
    required,
    disabled,
    ariaLabel,
    controlRef,
  } = safeProps;
  const [selectedValue, setSelectedValue, resetSelectedValue] = useControllableState<string>({
    componentName: "AsyncSelect",
    controlled: rawProps.value !== undefined,
    value,
    defaultValue: defaultValue ?? "",
    defaultValueProvided: rawProps.defaultValue !== undefined,
    onChange: onValueChange,
  });
  const [search, setSearch, resetSearch] = useControllableState<string>({
    componentName: "AsyncSelect",
    controlled: rawProps.query !== undefined,
    value: query,
    defaultValue: defaultQuery ?? "",
    defaultValueProvided: rawProps.defaultQuery !== undefined,
    onChange: onQueryChange,
    valuePropName: "query",
    defaultValuePropName: "defaultQuery",
    changePropName: "onQueryChange",
  });
  const generatedId = useId();
  const fallbackId = `pui-async-select-${generatedId}`;
  const fieldState = useCompositeFieldState({ id, fallbackId, required });
  const controlId = fieldState.id ?? fallbackId;
  const fieldInvalid = fieldState.invalid === true || fieldState.invalid === "true";
  const rootRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<TextControlHandle>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [composing, setComposing] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [loadingMoreInternally, setLoadingMoreInternally] = useState(false);
  const [actionError, setActionError] = useState<"async.retryFailed" | "async.loadMoreFailed">();
  const [failedAction, setFailedAction] = useState<"retry" | "load-more">();
  const [loaded, setLoaded] = useState<{ query: string; options: readonly AsyncSelectOption[] }>();
  const [loadPending, setLoadPending] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [requestVersion, setRequestVersion] = useState(0);
  const loadOptionsRef = useRef(loadOptions);
  loadOptionsRef.current = loadOptions;
  const [activeValue, setActiveValue] = useState<string | null>(null);
  const selectedCacheRef = useRef<AsyncSelectOption | null>(null);
  const visibleOptions = loadOptions
    ? loaded?.query === search ? loaded.options : []
    : optionsQuery === undefined || optionsQuery === search ? options ?? [] : [];
  assertUniqueIdentities("AsyncSelect", "option.value", visibleOptions.map((option) => option.value), { allowEmpty: true });
  const selected = visibleOptions.find((option) => option.value === selectedValue)
    ?? (selectedOption?.value === selectedValue ? selectedOption : undefined)
    ?? (selectedCacheRef.current?.value === selectedValue ? selectedCacheRef.current : undefined);
  const effectiveLoading = Boolean(loading || (loadOptions && loadPending));
  const effectiveError = error
    ?? (loadError ? message("async.loadFailed") : undefined)
    ?? (actionError ? message(actionError) : undefined);
  const enabledOptions = effectiveError == null ? visibleOptions.filter((option) => !option.disabled) : [];
  const currentActiveValue = enabledOptions.some((option) => option.value === activeValue)
    ? activeValue
    : enabledOptions.find((option) => option.value === selectedValue)?.value ?? enabledOptions[0]?.value ?? null;
  useEffect(() => { if (selected) selectedCacheRef.current = selected; }, [selected]);
  useEffect(() => {
    if (!open || disabled || composing || !loadOptionsRef.current) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const loader = loadOptionsRef.current;
      if (!loader) return;
      Promise.resolve().then(() => loader(search, { signal: controller.signal })).then((nextOptions) => {
        if (!controller.signal.aborted) {
          setLoaded({ query: search, options: nextOptions });
          setLoadPending(false);
        }
      }, () => {
        if (!controller.signal.aborted) {
          setLoadError(true);
          setLoadPending(false);
        }
      });
    }, Math.max(0, debounceMs));
    setLoaded(undefined);
    setLoadError(false);
    setLoadPending(true);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [disabled, open, composing, search, debounceMs, requestVersion, Boolean(loadOptions)]);
  useEffect(() => {
    if (!open || !currentActiveValue) return;
    const option = Array.from(popoverRef.current?.querySelectorAll<HTMLElement>("[role='option']") ?? [])
      .find((element) => element.dataset.value === currentActiveValue);
    option?.scrollIntoView?.({ block: "nearest" });
  }, [open, currentActiveValue, visibleOptions]);
  usePopoverPosition(open, "bottom", rootRef, popoverRef);
  useOutsideDismiss(open, rootRef, () => setOpen(false), popoverRef);
  useEffect(() => { setPortalTarget(floatingPortalTarget(rootRef.current)); }, []);
  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  useEffect(() => {
    if (!open || disabled) return;
    const frame = requestAnimationFrame(() => searchRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [disabled, open]);
  const retry = async () => {
    if (disabled || retrying) return;
    if (loadOptions) {
      setRequestVersion((current) => current + 1);
      return;
    }
    if (!onRetry) return;
    setRetrying(true);
    setActionError(undefined);
    try {
      await onRetry();
    } catch (cause) {
      setActionError("async.retryFailed");
      setFailedAction("retry");
      onActionError?.(cause, "retry");
    } finally {
      setRetrying(false);
    }
  };
  const loadMore = async () => {
    if (disabled || !onLoadMore || loadingMore || loadingMoreInternally) return;
    setLoadingMoreInternally(true);
    setActionError(undefined);
    try {
      await onLoadMore();
    } catch (cause) {
      setActionError("async.loadMoreFailed");
      setFailedAction("load-more");
      onActionError?.(cause, "load-more");
    } finally {
      setLoadingMoreInternally(false);
    }
  };
  const choose = (option: AsyncSelectOption) => {
    if (disabled || option.disabled || !visibleOptions.some((candidate) => candidate.value === option.value && !candidate.disabled)) return;
    selectedCacheRef.current = option;
    if (option.value !== selectedValue) setSelectedValue(option.value);
    setOpen(false);
    triggerRef.current?.focus();
  };
  const handlePopoverKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (event.key !== "Tab" || !popoverRef.current || !triggerRef.current) return;
    const popupStops = getTabStops(popoverRef.current);
    if (!popupStops.length) return;
    const current = event.target;
    if (event.shiftKey ? current !== popupStops[0] : current !== popupStops[popupStops.length - 1]) return;

    event.preventDefault();
    const trigger = triggerRef.current;
    const modal = trigger.closest<HTMLElement>("[role='dialog'][aria-modal='true']");
    const surroundingStops = getTabStops(modal ?? trigger.ownerDocument)
      .filter((element) => !popoverRef.current?.contains(element));
    const triggerIndex = surroundingStops.indexOf(trigger);
    const next = event.shiftKey
      ? trigger
      : surroundingStops[(triggerIndex + 1) % surroundingStops.length] ?? trigger;
    setOpen(false);
    next.focus({ preventScroll: true });
  };
  return (
    <div ref={rootRef} data-pui-owner="AsyncSelect" className={cx("pui-async-select", fieldInvalid && "is-invalid")} data-open={open || undefined}>
      <button ref={triggerRef} id={controlId} type="button" className="pui-combobox__trigger" role={open ? "button" : "combobox"} aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? `${controlId}-listbox` : undefined} aria-describedby={fieldState.describedBy} aria-invalid={fieldState.invalid} aria-required={fieldState.required} disabled={disabled} onClick={() => setOpen((current) => !current)} onKeyDown={(event) => { if (open && event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setOpen(false); } }}>
        <span className="pui-combobox__value">{selected?.leading != null ? <span className="pui-option__leading" aria-hidden="true">{selected.leading}</span> : null}<span>{selected?.label ?? placeholder}</span></span>
        {effectiveLoading && !open ? <LoaderCircle className="pui-spinner" aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
      </button>
      {open ? (
        portalTarget ? createPortal(<div ref={popoverRef} className="pui-extra-popover pui-async-select__popover pui-portal" data-pui-floating-root="true" onKeyDown={handlePopoverKeyDown}>
          <SearchInput controlRef={searchRef} value={search} placeholder={searchPlaceholder} role="combobox" aria-autocomplete="list" aria-expanded="true" aria-controls={`${controlId}-listbox`} aria-activedescendant={currentActiveValue ? `${controlId}-option-${encodeURIComponent(currentActiveValue)}` : undefined} aria-label={message("select.searchAria", { label: ariaLabel })} onCompositionStart={() => setComposing(true)} onCompositionEnd={() => setComposing(false)} onChange={(event) => { setActionError(undefined); setFailedAction(undefined); setSearch(event.target.value); setActiveValue(null); }} onClear={() => { setActionError(undefined); setFailedAction(undefined); setSearch(""); setActiveValue(null); }} onKeyDown={(event) => {
            if (composing || event.nativeEvent.isComposing || event.key === "Process" || event.keyCode === 229) return;
            if ((event.key === "ArrowDown" || event.key === "ArrowUp") && enabledOptions.length) {
              event.preventDefault();
              const direction = event.key === "ArrowDown" ? 1 : -1;
              const index = enabledOptions.findIndex((option) => option.value === currentActiveValue);
              const next = (index + direction + enabledOptions.length) % enabledOptions.length;
              setActiveValue(enabledOptions[next].value);
            } else if (event.key === "Home" && enabledOptions.length) { event.preventDefault(); setActiveValue(enabledOptions[0].value); }
            else if (event.key === "End" && enabledOptions.length) { event.preventDefault(); setActiveValue(enabledOptions[enabledOptions.length - 1].value); }
            else if (event.key === "Enter" && currentActiveValue) { event.preventDefault(); const option = enabledOptions.find((candidate) => candidate.value === currentActiveValue); if (option) choose(option); }
            else if (event.key === "Escape") { event.preventDefault(); setOpen(false); triggerRef.current?.focus(); }
          }} />
          {effectiveLoading && !visibleOptions.length ? <div className="pui-extra-state" role="status"><Spinner label={message("common.loading")} /></div> : null}
          {effectiveError != null ? <div className="pui-extra-error" role="alert"><span>{effectiveError}</span>{loadOptions || onRetry || (failedAction === "load-more" && onLoadMore) ? <Button size="small" disabled={disabled} loading={failedAction === "load-more" ? loadingMoreInternally : retrying} onClick={(event) => {
            if (document.activeElement === event.currentTarget) searchRef.current?.focus();
            void (failedAction === "load-more" ? loadMore() : retry());
          }}>{message("common.retry")}</Button> : null}</div> : null}
          <div id={`${controlId}-listbox`} className="pui-async-select__list" role="listbox" aria-label={ariaLabel} aria-busy={effectiveLoading || undefined}>
            {effectiveError == null ? visibleOptions.map((option) => (
              <button key={option.value} id={`${controlId}-option-${encodeURIComponent(option.value)}`} data-value={option.value} type="button" tabIndex={-1} className="pui-extra-option" role="option" aria-selected={option.value === selectedValue} data-active={option.value === currentActiveValue || undefined} disabled={option.disabled} onMouseDown={(event) => event.preventDefault()} onMouseMove={() => { if (!option.disabled) setActiveValue(option.value); }} onClick={() => choose(option)}>
                {option.leading != null ? <span className="pui-extra-option__leading" aria-hidden="true">{option.leading}</span> : null}
                <span className="pui-extra-option__copy"><strong>{option.label}</strong>{option.description ? <span>{option.description}</span> : null}</span>
                <Check aria-hidden="true" />
              </button>
            )) : null}
          </div>
          {!effectiveLoading && effectiveError == null && !visibleOptions.length ? <div className="pui-extra-state" role="status">{emptyText}</div> : null}
          {effectiveError == null && hasMore && onLoadMore ? <div className="pui-async-select__footer"><Button size="small" disabled={disabled} loading={Boolean(loadingMore || loadingMoreInternally)} onClick={() => void loadMore()}>{message("loadMore.label")}</Button></div> : null}
        </div>, portalTarget) : null
      ) : null}
      <CompositeFormControl
        name={name}
        form={form}
        values={[selectedValue]}
        disabled={disabled}
        required={required}
        controlRef={controlRef}
        focusTargetRef={triggerRef}
        onReset={() => {
          resetSelectedValue();
          resetSearch();
          setOpen(false);
        }}
      />
    </div>
  );
}

export interface MultiSelectOption extends ComboboxOption {}

export type MultiSelectProps = PublicControlProps<{
  id?: string;
  options: readonly MultiSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: ReactNode;
  name?: string;
  form?: string;
  required?: boolean;
  disabled?: boolean;
  ariaLabel: string;
  controlRef?: ControlRef<ValidityControlHandle>;
}> & ControllableListValueProps & ControllableQueryProps;

export function MultiSelect(rawProps: MultiSelectProps) {
  const { message } = usePersonalUILocale();
  const safeProps = sanitizeFixedControlProps(rawProps);
  const {
    id,
    options,
    value,
    defaultValue,
    onValueChange,
    query,
    defaultQuery,
    onQueryChange,
    placeholder = message("select.placeholder"),
    searchPlaceholder = message("select.searchPlaceholder"),
    emptyText = message("select.empty"),
    name,
    form,
    required,
    disabled,
    ariaLabel,
    controlRef,
  } = safeProps;
  const [selectedValues, setSelectedValues, resetSelectedValues] = useControllableState<readonly string[]>({
    componentName: "MultiSelect",
    controlled: rawProps.value !== undefined,
    value,
    defaultValue: defaultValue ? [...defaultValue] : [],
    defaultValueProvided: rawProps.defaultValue !== undefined,
    onChange: onValueChange ? (nextValue) => onValueChange([...nextValue]) : undefined,
  });
  const [search, setSearch, resetSearch] = useControllableState<string>({
    componentName: "MultiSelect",
    controlled: rawProps.query !== undefined,
    value: query,
    defaultValue: defaultQuery ?? "",
    defaultValueProvided: rawProps.defaultQuery !== undefined,
    onChange: onQueryChange,
    valuePropName: "query",
    defaultValuePropName: "defaultQuery",
    changePropName: "onQueryChange",
  });
  assertUniqueIdentities("MultiSelect", "option.value", options.map((option) => option.value), { allowEmpty: true });
  assertUniqueIdentities("MultiSelect", "value", selectedValues, { allowEmpty: true });
  const unknownValues = selectedValues.filter((item) => !options.some((option) => option.value === item));
  if (unknownValues.length) {
    throw new RangeError(`MultiSelect received unknown value ${JSON.stringify(unknownValues[0])}.`);
  }
  const generatedId = useId();
  const fallbackId = `pui-multi-select-${generatedId}`;
  const fieldState = useCompositeFieldState({ id, fallbackId, required });
  const controlId = fieldState.id ?? fallbackId;
  const fieldInvalid = fieldState.invalid === true || fieldState.invalid === "true";
  const rootRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<TextControlHandle>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const selectedOptions = options.filter((option) => selectedValues.includes(option.value));
  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    return needle ? options.filter((option) => `${option.label} ${option.description ?? ""} ${option.searchText ?? ""}`.toLocaleLowerCase().includes(needle)) : options;
  }, [options, search]);
  usePopoverPosition(open, "bottom", rootRef, popoverRef);
  useOutsideDismiss(open, rootRef, () => setOpen(false), popoverRef);
  useEffect(() => { setPortalTarget(floatingPortalTarget(rootRef.current)); }, []);
  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  useEffect(() => {
    if (!open || disabled) return;
    const frame = requestAnimationFrame(() => searchRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [disabled, open]);
  const toggle = (option: MultiSelectOption) => {
    if (disabled || option.disabled) return;
    setSelectedValues(selectedValues.includes(option.value) ? selectedValues.filter((item) => item !== option.value) : [...selectedValues, option.value]);
  };
  const summary = !selectedOptions.length ? placeholder : selectedOptions.length === 1 ? selectedOptions[0].label : `${optionText(selectedOptions[0].label, selectedOptions[0].value)} +${selectedOptions.length - 1}`;
  return (
    <div ref={rootRef} data-pui-owner="MultiSelect" className={cx("pui-multi-select", fieldInvalid && "is-invalid")} data-open={open || undefined}>
      <button ref={triggerRef} id={controlId} type="button" className="pui-multi-select__trigger" role="combobox" aria-label={message("select.selectedCount", { label: ariaLabel, count: selectedValues.length })} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? `${controlId}-listbox` : undefined} aria-describedby={fieldState.describedBy} aria-invalid={fieldState.invalid} aria-required={fieldState.required} disabled={disabled} onClick={() => setOpen((current) => !current)} onKeyDown={(event) => { if (open && event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setOpen(false); } }}>
        <span className={cx("pui-multi-select__summary", !selectedOptions.length && "is-placeholder")}>{summary}</span>
        <span className="pui-multi-select__count" aria-hidden="true">{selectedValues.length || null}</span>
        <ChevronDown aria-hidden="true" />
      </button>
      {open ? (
        portalTarget ? createPortal(<div ref={popoverRef} className="pui-extra-popover pui-multi-select__popover pui-portal" data-pui-floating-root="true" onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setOpen(false); triggerRef.current?.focus(); } }}>
          <SearchInput controlRef={searchRef} value={search} placeholder={searchPlaceholder} aria-label={message("select.searchAria", { label: ariaLabel })} onChange={(event) => setSearch(event.target.value)} onClear={() => setSearch("")} onKeyDown={(event) => {
            if (event.key !== "ArrowDown") return;
            const firstOption = popoverRef.current?.querySelector<HTMLButtonElement>("[role='option']:not(:disabled)");
            if (firstOption) { event.preventDefault(); firstOption.focus(); }
          }} />
          <div id={`${controlId}-listbox`} className="pui-multi-select__list" role="listbox" aria-label={ariaLabel} aria-multiselectable="true">
            {filtered.map((option) => (
              <button key={option.value} type="button" className="pui-extra-option" role="option" aria-selected={selectedValues.includes(option.value)} disabled={option.disabled} onClick={() => toggle(option)} onKeyDown={(event) => {
                if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
                const options = Array.from(popoverRef.current?.querySelectorAll<HTMLButtonElement>("[role='option']:not(:disabled)") ?? []);
                const index = options.indexOf(event.currentTarget);
                const next = options[index + (event.key === "ArrowDown" ? 1 : -1)];
                if (next) { event.preventDefault(); next.focus(); }
                else if (event.key === "ArrowUp" && index === 0) { event.preventDefault(); searchRef.current?.focus(); }
              }}>
                <span className="pui-multi-select__check" aria-hidden="true">{selectedValues.includes(option.value) ? <Check /> : null}</span>
                {option.leading != null ? <span className="pui-extra-option__leading" aria-hidden="true">{option.leading}</span> : null}
                <span className="pui-extra-option__copy"><strong>{option.label}</strong>{option.description ? <span>{option.description}</span> : null}</span>
              </button>
            ))}
            {!filtered.length ? <div className="pui-extra-state" role="status">{emptyText}</div> : null}
          </div>
          <div className="pui-multi-select__footer"><Button size="small" disabled={disabled || !selectedValues.length} onClick={() => { if (!disabled) setSelectedValues([]); }}>{message("common.clear")}</Button><Button size="small" variant="primary" disabled={disabled} onClick={() => { setOpen(false); triggerRef.current?.focus(); }}>{message("common.done")}</Button></div>
        </div>, portalTarget) : null
      ) : null}
      <CompositeFormControl
        name={name}
        form={form}
        values={selectedValues}
        disabled={disabled}
        required={required}
        controlRef={controlRef}
        focusTargetRef={triggerRef}
        onReset={() => {
          resetSelectedValues();
          resetSearch();
          setOpen(false);
        }}
      />
    </div>
  );
}

export interface TagSuggestion {
  value: string;
  label?: ReactNode;
  leading?: ReactNode;
  disabled?: boolean;
}

export type TagInputProps = PublicControlProps<{
  id?: string;
  suggestions?: readonly TagSuggestion[];
  normalizeValue?: (value: string) => string;
  validateValue?: (value: string) => string | undefined;
  maxTags?: number;
  allowDuplicates?: boolean;
  placeholder?: string;
  name?: string;
  form?: string;
  required?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  controlRef?: ControlRef<ValidityControlHandle>;
}> & ControllableListValueProps & ControllableInputValueProps;

export function TagInput(rawProps: TagInputProps) {
  const { message, plural } = usePersonalUILocale();
  const safeProps = sanitizeFixedControlProps(rawProps);
  const {
    id,
    value,
    defaultValue,
    inputValue,
    defaultInputValue,
    onInputValueChange,
    onValueChange,
    suggestions = [],
    normalizeValue = (candidate) => candidate.trim(),
    validateValue,
    maxTags,
    allowDuplicates = false,
    placeholder = message("tagInput.placeholder"),
    name,
    form,
    required,
    disabled,
    ariaLabel = message("tagInput.label"),
    controlRef,
  } = safeProps;
  const [tagValues, setTagValues, resetTagValues] = useControllableState<readonly string[]>({
    componentName: "TagInput",
    controlled: rawProps.value !== undefined,
    value,
    defaultValue: defaultValue ? [...defaultValue] : [],
    defaultValueProvided: rawProps.defaultValue !== undefined,
    onChange: onValueChange ? (nextValue) => onValueChange([...nextValue]) : undefined,
  });
  const [draftInput, setDraftInput, resetDraftInput] = useControllableState<string>({
    componentName: "TagInput",
    controlled: rawProps.inputValue !== undefined,
    value: inputValue,
    defaultValue: defaultInputValue ?? "",
    defaultValueProvided: rawProps.defaultInputValue !== undefined,
    onChange: onInputValueChange,
    valuePropName: "inputValue",
    defaultValuePropName: "defaultInputValue",
    changePropName: "onInputValueChange",
  });
  if (!allowDuplicates) assertUniqueIdentities("TagInput", "value", tagValues);
  assertUniqueIdentities("TagInput", "suggestion.value", suggestions.map((item) => item.value));
  const generatedId = useId();
  const fallbackId = `pui-tag-input-${generatedId}`;
  const [error, setError] = useState<string>();
  const fieldState = useCompositeFieldState({ id, fallbackId, invalid: Boolean(error) || undefined, required });
  const controlId = fieldState.id ?? fallbackId;
  const localErrorId = `${controlId}-local-error`;
  const describedBy = mergeAriaIds(fieldState.describedBy, error ? localErrorId : undefined);
  const resolvedInvalid = fieldState.invalid === true || fieldState.invalid === "true";
  const rootRef = useRef<HTMLDivElement>(null);
  const inputElementRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const needle = draftInput.trim().toLocaleLowerCase();
  const visibleSuggestions = needle ? suggestions.filter((item) => `${item.label ?? ""} ${item.value}`.toLocaleLowerCase().includes(needle) && !tagValues.includes(item.value)) : [];
  const showSuggestions = open && !disabled && visibleSuggestions.length > 0;
  usePopoverPosition(showSuggestions, "bottom", rootRef, popoverRef);
  useOutsideDismiss(open, rootRef, () => setOpen(false), popoverRef);
  useEffect(() => { setPortalTarget(floatingPortalTarget(rootRef.current)); }, []);
  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  const add = (candidate: string) => {
    if (disabled) return;
    const normalized = normalizeValue(candidate);
    const validation = !normalized ? message("tagInput.empty") : validateValue?.(normalized);
    if (validation) { setError(validation); return; }
    if (!allowDuplicates && tagValues.includes(normalized)) { setError(message("tagInput.duplicate")); return; }
    if (maxTags != null && tagValues.length >= maxTags) { setError(plural("tagInput.maxTags", maxTags)); return; }
    setTagValues([...tagValues, normalized]);
    setDraftInput("");
    setError(undefined);
    setOpen(false);
  };
  return (
    <div ref={rootRef} data-pui-owner="TagInput" className={cx("pui-tag-input", resolvedInvalid && "is-invalid", disabled && "is-disabled")}>
      <div className="pui-tag-input__control" onClick={() => document.getElementById(controlId)?.focus()}>
        {tagValues.map((tag, index) => <Tag key={`${tag}-${index}`} onRemove={disabled ? undefined : () => setTagValues(tagValues.filter((_, itemIndex) => itemIndex !== index))}>{tag}</Tag>)}
        <input ref={inputElementRef} id={controlId} className="pui-tag-input__input" value={draftInput} placeholder={!tagValues.length ? placeholder : undefined} disabled={disabled || (maxTags != null && tagValues.length >= maxTags)} role="combobox" aria-autocomplete="list" aria-expanded={showSuggestions} aria-controls={showSuggestions ? `${controlId}-listbox` : undefined} aria-label={ariaLabel} aria-describedby={describedBy} aria-invalid={fieldState.invalid} aria-required={fieldState.required} onFocus={() => setOpen(true)} onChange={(event) => { setDraftInput(event.target.value); setError(undefined); setOpen(true); }} onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === ",") { event.preventDefault(); add(draftInput); }
          else if (event.key === "Backspace" && !draftInput && tagValues.length) setTagValues(tagValues.slice(0, -1));
          else if (event.key === "Escape" && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); }
        }} />
      </div>
      {showSuggestions && portalTarget ? createPortal(<div ref={popoverRef} id={`${controlId}-listbox`} className="pui-extra-popover pui-tag-input__suggestions pui-portal" data-pui-floating-root="true" role="listbox" aria-label={message("tagInput.suggestions")}>{visibleSuggestions.map((item) => <button key={item.value} type="button" className="pui-extra-option" role="option" aria-selected="false" disabled={item.disabled} onMouseDown={(event) => event.preventDefault()} onClick={() => add(item.value)}>{item.leading != null ? <span className="pui-extra-option__leading">{item.leading}</span> : null}<span className="pui-extra-option__copy"><strong>{item.label ?? item.value}</strong></span></button>)}</div>, portalTarget) : null}
      {error ? <span id={localErrorId} className="pui-tag-input__error" role="alert">{error}</span> : null}
      <CompositeFormControl
        name={name}
        form={form}
        values={tagValues}
        disabled={disabled}
        required={required}
        controlRef={controlRef}
        focusTargetRef={inputElementRef}
        onReset={() => {
          resetTagValues();
          resetDraftInput();
          setError(undefined);
          setOpen(false);
        }}
      />
    </div>
  );
}

export interface CascaderOption {
  value: string;
  label: ReactNode;
  leading?: ReactNode;
  disabled?: boolean;
  children?: readonly CascaderOption[];
}

export type CascaderProps = PublicControlProps<{
  options: readonly CascaderOption[];
  ariaLabel: string;
  levelLabels?: readonly string[];
  placeholder?: string;
  name?: string;
  form?: string;
  required?: boolean;
  disabled?: boolean;
  submitValue?: "leaf" | "path";
  controlRef?: ControlRef<ValidityControlHandle>;
}> & ControllableListValueProps;

function flattenCascader(options: readonly CascaderOption[]): CascaderOption[] {
  return options.flatMap((option) => [option, ...flattenCascader(option.children ?? [])]);
}

export function Cascader(rawProps: CascaderProps) {
  const { message } = usePersonalUILocale();
  const safeProps = sanitizeFixedControlProps(rawProps);
  const { options, value, defaultValue, onValueChange, ariaLabel, levelLabels = [], placeholder = message("select.placeholder"), name, form, required, disabled, submitValue = "leaf", controlRef } = safeProps;
  const [selectedPath, setSelectedPath, resetSelectedPath] = useControllableState<readonly string[]>({
    componentName: "Cascader",
    controlled: rawProps.value !== undefined,
    value,
    defaultValue: defaultValue ? [...defaultValue] : [],
    defaultValueProvided: rawProps.defaultValue !== undefined,
    onChange: onValueChange ? (nextValue) => onValueChange([...nextValue]) : undefined,
  });
  const generatedId = useId();
  const fallbackId = `pui-cascader-${generatedId}`;
  const fieldState = useCompositeFieldState({ fallbackId, required });
  const controlId = fieldState.id ?? fallbackId;
  const fieldInvalid = fieldState.invalid === true || fieldState.invalid === "true";
  assertUniqueIdentities("Cascader", "option.value", flattenCascader(options).map((option) => option.value));
  const levels: Array<{ options: readonly CascaderOption[]; selected?: string }> = [];
  let current = options;
  let index = 0;
  let complete = false;
  while (current.length) {
    const selectedOption = current.find((option) => option.value === selectedPath[index] && !option.disabled);
    const hasChildren = Boolean(selectedOption?.children?.length);
    const isLast = index === selectedPath.length - 1;
    const selected = selectedOption && (hasChildren || isLast) ? selectedOption.value : undefined;
    levels.push({ options: current, selected });
    if (!selectedOption || !selected) break;
    if (!hasChildren) {
      complete = isLast;
      break;
    }
    current = selectedOption.children!;
    index += 1;
  }
  const submitted = complete
    ? submitValue === "path" ? JSON.stringify(selectedPath) : selectedPath[selectedPath.length - 1]
    : undefined;
  return (
    <div data-pui-owner="Cascader" className={cx("pui-cascader", fieldInvalid && "is-invalid")} role="group" aria-label={ariaLabel} aria-describedby={fieldState.describedBy} aria-invalid={fieldState.invalid}>
      <CompositeFieldBoundary>
        {levels.map((level, levelIndex) => (
          <Select key={levelIndex} id={levelIndex === 0 ? controlId : `${fallbackId}-level-${levelIndex + 1}`} options={level.options.map((option): SelectOption => ({ value: option.value, label: option.label, leading: option.leading, disabled: option.disabled, textValue: optionText(option.label, option.value) }))} value={level.selected} placeholder={levelLabels[levelIndex] ?? placeholder} ariaLabel={levelLabels[levelIndex] ?? message("cascader.level", { label: ariaLabel, level: levelIndex + 1 })} disabled={disabled} aria-describedby={fieldState.describedBy} aria-invalid={fieldState.invalid} aria-required={levelIndex === 0 ? fieldState.required : undefined} onValueChange={(next) => setSelectedPath([...selectedPath.slice(0, levelIndex), next])} />
        ))}
      </CompositeFieldBoundary>
      <CompositeFormControl
        name={name}
        form={form}
        values={submitted === undefined ? [] : [submitted]}
        disabled={disabled}
        required={required}
        controlRef={controlRef}
        onReset={resetSelectedPath}
      />
    </div>
  );
}

export interface TreeSelectOption {
  value: string;
  label: ReactNode;
  textValue?: string;
  leading?: ReactNode;
  disabled?: boolean;
  children?: readonly TreeSelectOption[];
}

export type TreeSelectProps = PublicControlProps<{
  id?: string;
  options: readonly TreeSelectOption[];
  placeholder?: ReactNode;
  name?: string;
  form?: string;
  required?: boolean;
  disabled?: boolean;
  ariaLabel: string;
  controlRef?: ControlRef<ValidityControlHandle>;
}> & ControllableValueProps<string>;

function flattenTree(options: readonly TreeSelectOption[]): TreeSelectOption[] {
  return options.flatMap((option) => [option, ...flattenTree(option.children ?? [])]);
}

export function TreeSelect(rawProps: TreeSelectProps) {
  const { message } = usePersonalUILocale();
  const safeProps = sanitizeFixedControlProps(rawProps);
  const { id, options, value, defaultValue, onValueChange, placeholder = message("select.placeholder"), name, form, required, disabled, ariaLabel, controlRef } = safeProps;
  const [selectedValue, setSelectedValue, resetSelectedValue] = useControllableState<string>({
    componentName: "TreeSelect",
    controlled: rawProps.value !== undefined,
    value,
    defaultValue: defaultValue ?? "",
    defaultValueProvided: rawProps.defaultValue !== undefined,
    onChange: onValueChange,
  });
  const flat = flattenTree(options);
  assertUniqueIdentities("TreeSelect", "option.value", flat.map((option) => option.value), { allowEmpty: true });
  const generatedId = useId();
  const fallbackId = `pui-tree-select-${generatedId}`;
  const fieldState = useCompositeFieldState({ id, fallbackId, required });
  const controlId = fieldState.id ?? fallbackId;
  const fieldInvalid = fieldState.invalid === true || fieldState.invalid === "true";
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const selected = flat.find((option) => option.value === selectedValue);
  const visible = visibleTreeItems(options, expanded, (option) => option.value, (option) => option.children, (option) => Boolean(option.disabled));
  const [activeKey, setActiveKey] = useState<string | undefined>(() => (
    visible.find((item) => item.key === selectedValue && !item.disabled)?.key
    ?? visible.find((item) => !item.disabled)?.key
  ));
  const previousOrderRef = useRef<string[]>([]);
  const treeHasFocusRef = useRef(false);
  const focusOnOpenRef = useRef(false);
  const focusKey = resolvedTreeKey(visible, activeKey, previousOrderRef.current);
  usePopoverPosition(open, "bottom", rootRef, popoverRef);
  useOutsideDismiss(open, rootRef, () => setOpen(false), popoverRef);
  useEffect(() => { setPortalTarget(floatingPortalTarget(rootRef.current)); }, []);
  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  useEffect(() => {
    previousOrderRef.current = visible.map((item) => item.key);
    if (activeKey !== focusKey) setActiveKey(focusKey);
    if (!open || (!focusOnOpenRef.current && !treeHasFocusRef.current)) return;
    const target = focusKey
      ? Array.from(popoverRef.current?.querySelectorAll<HTMLElement>("[role='treeitem'][data-tree-key]") ?? [])
        .find((item) => item.dataset.treeKey === focusKey)
      : popoverRef.current;
    if (target && document.activeElement !== target) target.focus();
    if (target) focusOnOpenRef.current = false;
  });
  const toggleExpanded = (itemValue: string) => {
    const next = new Set(expanded);
    if (next.has(itemValue)) {
      next.delete(itemValue);
      let focused = visible.find((item) => item.key === focusKey);
      while (focused?.parentKey) {
        if (focused.parentKey === itemValue) { setActiveKey(itemValue); break; }
        focused = visible.find((item) => item.key === focused?.parentKey);
      }
    } else next.add(itemValue);
    setExpanded(next);
  };
  const focusAdjacentToTrigger = (backwards: boolean) => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const boundary = trigger.closest<HTMLElement>("[role='dialog'][aria-modal='true']");
    const candidates = getTabStops(document, (element) => (
      (!boundary || boundary.contains(element)) && !popoverRef.current?.contains(element)
    ));
    const triggerIndex = candidates.indexOf(trigger);
    const next = candidates[triggerIndex + (backwards ? -1 : 1)]
      ?? (boundary ? (backwards ? candidates[candidates.length - 1] : candidates[0]) : undefined);
    setOpen(false);
    if (next) next.focus();
    else trigger.blur();
  };
  const handleTreeKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (event.key === "Tab") {
      event.preventDefault();
      focusAdjacentToTrigger(event.shiftKey);
      return;
    }
    const itemElement = (event.target as HTMLElement).closest<HTMLElement>("[role='treeitem'][data-tree-key]");
    const current = visible.find((item) => item.key === itemElement?.dataset.treeKey);
    if (!current || current.disabled) return;
    let nextKey: string | undefined;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      nextKey = adjacentTreeKey(visible, current.key, event.key === "ArrowDown" ? 1 : -1);
    } else if (event.key === "Home" || event.key === "End") {
      const enabled = visible.filter((item) => !item.disabled);
      nextKey = (event.key === "Home" ? enabled[0] : enabled[enabled.length - 1])?.key;
    } else if (event.key === "ArrowRight") {
      if (current.node.children?.length && !expanded.has(current.key)) toggleExpanded(current.key);
      else nextKey = visible.find((item) => item.parentKey === current.key && !item.disabled)?.key;
    } else if (event.key === "ArrowLeft") {
      if (current.node.children?.length && expanded.has(current.key)) toggleExpanded(current.key);
      else {
        let parent = visible.find((item) => item.key === current.parentKey);
        while (parent?.disabled) parent = visible.find((item) => item.key === parent?.parentKey);
        nextKey = parent?.key;
      }
    } else if (event.key === "Enter" || event.key === " ") {
      setSelectedValue(current.key);
      setOpen(false);
      triggerRef.current?.focus();
    } else return;
    event.preventDefault();
    event.stopPropagation();
    if (nextKey) setActiveKey(nextKey);
  };
  const renderNodes = (nodes: readonly TreeSelectOption[], depth = 0): ReactNode => nodes.map((option) => {
    const hasChildren = Boolean(option.children?.length);
    const isExpanded = expanded.has(option.value);
    const item = visible.find((candidate) => candidate.key === option.value);
    return (
      <div
        key={option.value}
        role="treeitem"
        data-tree-key={option.value}
        aria-label={option.textValue ?? optionText(option.label, option.value)}
        aria-level={item?.level}
        aria-posinset={item?.position}
        aria-setsize={item?.setSize}
        aria-selected={!option.disabled && option.value === selectedValue}
        aria-expanded={hasChildren ? isExpanded : undefined}
        aria-disabled={option.disabled || undefined}
        tabIndex={!option.disabled && focusKey === option.value ? 0 : -1}
        onFocus={(event) => { if (event.target === event.currentTarget && !option.disabled) setActiveKey(option.value); }}
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("[role='treeitem']") !== event.currentTarget) return;
          event.stopPropagation();
          if (disabled || option.disabled) return;
          setActiveKey(option.value);
          setSelectedValue(option.value);
          setOpen(false);
          triggerRef.current?.focus();
        }}
      >
        <div className="pui-tree-select__row" style={{ paddingInlineStart: `${8 + depth * 20}px` }}>
          {hasChildren ? (
            <span className="pui-tree-select__expander" aria-hidden="true" onClick={(event) => {
              event.stopPropagation();
              if (option.disabled) return;
              toggleExpanded(option.value);
              event.currentTarget.closest<HTMLElement>("[role='treeitem']")?.focus();
            }}>{isExpanded ? <ChevronDown /> : <ChevronRight />}</span>
          ) : <span className="pui-tree-select__spacer" />}
          <span className="pui-tree-select__label">{option.leading != null ? <span aria-hidden="true">{option.leading}</span> : null}<span>{option.label}</span>{option.value === selectedValue ? <Check aria-hidden="true" /> : null}</span>
        </div>
        {hasChildren && isExpanded ? <div role="group">{renderNodes(option.children ?? [], depth + 1)}</div> : null}
      </div>
    );
  });
  return (
    <div ref={rootRef} data-pui-owner="TreeSelect" className={cx("pui-tree-select", fieldInvalid && "is-invalid")} data-open={open || undefined}>
      <button ref={triggerRef} id={controlId} type="button" className="pui-combobox__trigger" role="combobox" aria-label={ariaLabel} aria-haspopup="tree" aria-expanded={open} aria-controls={open ? `${controlId}-tree` : undefined} aria-describedby={fieldState.describedBy} aria-invalid={fieldState.invalid} aria-required={fieldState.required} disabled={disabled} onClick={() => { focusOnOpenRef.current = true; setOpen((currentOpen) => !currentOpen); }} onKeyDown={(event) => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          setActiveKey((event.key === "ArrowDown" ? visible.find((item) => !item.disabled) : [...visible].reverse().find((item) => !item.disabled))?.key);
          focusOnOpenRef.current = true;
          setOpen(true);
        } else if (open && event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
        }
      }}><span className="pui-combobox__value">{selected?.leading != null ? <span className="pui-option__leading">{selected.leading}</span> : null}<span>{selected?.label ?? placeholder}</span></span><ChevronDown /></button>
      {open && portalTarget ? createPortal(<div ref={popoverRef} id={`${controlId}-tree`} className="pui-extra-popover pui-tree-select__tree pui-portal" data-pui-floating-root="true" role="tree" aria-label={ariaLabel} tabIndex={focusKey ? -1 : 0} onKeyDown={handleTreeKeyDown} onFocusCapture={() => { treeHasFocusRef.current = true; }} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) treeHasFocusRef.current = false; }}>{renderNodes(options)}</div>, portalTarget) : null}
      <CompositeFormControl
        name={name}
        form={form}
        values={[selectedValue]}
        disabled={disabled}
        required={required}
        controlRef={controlRef}
        focusTargetRef={triggerRef}
        onReset={() => {
          resetSelectedValue();
          setOpen(false);
          setExpanded(new Set());
          setActiveKey(undefined);
        }}
      />
    </div>
  );
}

export interface TransferOption {
  value: string;
  label: ReactNode;
  textValue?: string;
  disabled?: boolean;
}

export type TransferProps = PublicControlProps<{
  options: readonly TransferOption[];
  sourceTitle?: string;
  targetTitle?: string;
  name?: string;
  form?: string;
  required?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  controlRef?: ControlRef<ValidityControlHandle>;
}> & ControllableListValueProps;

export function Transfer(rawProps: TransferProps) {
  const { message } = usePersonalUILocale();
  const safeProps = sanitizeFixedControlProps(rawProps);
  const { options, value, defaultValue, onValueChange, sourceTitle = message("transfer.source"), targetTitle = message("transfer.target"), name, form, required, disabled, ariaLabel = message("transfer.label"), controlRef } = safeProps;
  const [selectedValues, setSelectedValues, resetSelectedValues] = useControllableState<readonly string[]>({
    componentName: "Transfer",
    controlled: rawProps.value !== undefined,
    value,
    defaultValue: defaultValue ? [...defaultValue] : [],
    defaultValueProvided: rawProps.defaultValue !== undefined,
    onChange: onValueChange ? (nextValue) => onValueChange([...nextValue]) : undefined,
  });
  assertUniqueIdentities("Transfer", "option.value", options.map((option) => option.value), { allowEmpty: true });
  assertUniqueIdentities("Transfer", "value", selectedValues, { allowEmpty: true });
  const [sourceSelection, setSourceSelection] = useState<string[]>([]);
  const [targetSelection, setTargetSelection] = useState<string[]>([]);
  const generatedId = useId();
  const fallbackId = `pui-transfer-${generatedId}`;
  const fieldState = useCompositeFieldState({ fallbackId, required });
  const fieldInvalid = fieldState.invalid === true || fieldState.invalid === "true";
  const sourceSelectRef = useRef<HTMLSelectElement | null>(null);
  const targetSelectRef = useRef<HTMLSelectElement | null>(null);
  const source = options.filter((option) => !selectedValues.includes(option.value));
  const target = options.filter((option) => selectedValues.includes(option.value));
  useEffect(() => {
    setSourceSelection((current) => current.filter((item) => source.some((option) => option.value === item && !option.disabled)));
    setTargetSelection((current) => current.filter((item) => target.some((option) => option.value === item && !option.disabled)));
  }, [options, selectedValues]);
  const readSelection = (event: ChangeEvent<HTMLSelectElement>) => Array.from(event.target.selectedOptions, (option) => option.value).filter((item) =>
    options.some((option) => option.value === item && !option.disabled));
  const movableSource = sourceSelection.filter((item) => source.some((option) => option.value === item && !option.disabled));
  const movableTarget = targetSelection.filter((item) => target.some((option) => option.value === item && !option.disabled));
  return (
    <div data-pui-owner="Transfer" className={cx("pui-transfer", fieldInvalid && "is-invalid")} role="group" aria-label={ariaLabel} aria-disabled={disabled || undefined} aria-describedby={fieldState.describedBy} aria-invalid={fieldState.invalid}>
      <label className="pui-transfer__panel"><span>{sourceTitle}<small>{source.length}</small></span><select ref={sourceSelectRef} id={fieldState.id} multiple value={sourceSelection} disabled={disabled} aria-label={sourceTitle} aria-describedby={fieldState.describedBy} aria-invalid={fieldState.invalid} aria-required={fieldState.required} onChange={(event) => setSourceSelection(readSelection(event))}>{source.map((option) => <option key={option.value} value={option.value} disabled={option.disabled}>{option.textValue ?? optionText(option.label, option.value)}</option>)}</select></label>
      <div className="pui-transfer__actions">
        <IconButton aria-label={message("transfer.add")} icon={<ChevronRight />} disabled={disabled || !movableSource.length} onClick={() => {
          setSelectedValues([...selectedValues, ...movableSource]);
          setSourceSelection([]);
          setTargetSelection(movableSource);
          targetSelectRef.current?.focus();
        }} />
        <IconButton aria-label={message("transfer.remove")} icon={<ChevronLeft />} disabled={disabled || !movableTarget.length} onClick={() => {
          setSelectedValues(selectedValues.filter((item) => !movableTarget.includes(item)));
          setTargetSelection([]);
          setSourceSelection(movableTarget);
          sourceSelectRef.current?.focus();
        }} />
      </div>
      <label className="pui-transfer__panel"><span>{targetTitle}<small>{target.length}</small></span><select ref={targetSelectRef} multiple value={targetSelection} disabled={disabled} aria-label={targetTitle} aria-describedby={fieldState.describedBy} aria-invalid={fieldState.invalid} onChange={(event) => setTargetSelection(readSelection(event))}>{target.map((option) => <option key={option.value} value={option.value} disabled={option.disabled}>{option.textValue ?? optionText(option.label, option.value)}</option>)}</select></label>
      <CompositeFormControl
        name={name}
        form={form}
        values={selectedValues}
        disabled={disabled}
        required={required}
        controlRef={controlRef}
        focusTargetRef={sourceSelectRef}
        onReset={() => {
          resetSelectedValues();
          setSourceSelection([]);
          setTargetSelection([]);
        }}
      />
    </div>
  );
}
