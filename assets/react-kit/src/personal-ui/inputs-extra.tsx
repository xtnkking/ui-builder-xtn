import {
  forwardRef,
  useEffect,
  useId,
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
import { Button, IconButton, Spinner, Tag } from "./primitives";
import {
  Combobox,
  Input,
  SearchInput,
  Select,
  Textarea,
  type ComboboxOption,
  type SelectOption,
} from "./forms";
import { assertUniqueIdentities, cx } from "./utils";

function optionText(label: ReactNode, fallback: string): string {
  return typeof label === "string" || typeof label === "number" ? String(label) : fallback;
}

function FormValueBridge({
  name,
  form,
  value,
  disabled,
  required,
}: {
  name?: string;
  form?: string;
  value: string;
  disabled?: boolean;
  required?: boolean;
}) {
  if (!name) return null;
  return (
    <input
      type="hidden"
      name={name}
      form={form}
      value={value}
      disabled={disabled}
      required={required}
      data-pui-form-bridge="true"
      readOnly
    />
  );
}

function FormValuesBridge({
  name,
  form,
  values,
  disabled,
  required,
}: {
  name?: string;
  form?: string;
  values: readonly string[];
  disabled?: boolean;
  required?: boolean;
}) {
  if (!name) return null;
  if (!values.length) {
    return <FormValueBridge name={name} form={form} value="" disabled={disabled} required={required} />;
  }
  return (
    <>
      {values.map((value) => (
        <FormValueBridge key={value} name={name} form={form} value={value} disabled={disabled} />
      ))}
    </>
  );
}

function useOutsideDismiss(
  open: boolean,
  rootRef: React.RefObject<HTMLElement>,
  onDismiss: () => void,
) {
  useEffect(() => {
    if (!open) return;
    const handlePointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) onDismiss();
    };
    document.addEventListener("mousedown", handlePointer);
    return () => document.removeEventListener("mousedown", handlePointer);
  }, [onDismiss, open, rootRef]);
}

export interface FormProps extends FormHTMLAttributes<HTMLFormElement> {
  busy?: boolean;
}

export const Form = forwardRef<HTMLFormElement, FormProps>(function Form(
  { busy = false, className, onSubmit, children, ...props },
  ref,
) {
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
      ref={ref}
      data-pui-owner="Form"
      className={cx("pui-form", className)}
      aria-busy={busy || undefined}
      data-busy={busy || undefined}
      onSubmit={handleSubmit}
    >
      {children}
    </form>
  );
});

export interface NumberInputProps {
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
  className?: string;
}

export function NumberInput({
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
  className,
}: NumberInputProps) {
  const clamp = (next: number): number => Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min ?? Number.NEGATIVE_INFINITY, next));
  const move = (direction: 1 | -1) => {
    const base = value === "" ? (min ?? 0) : value;
    const next = clamp(Number((base + direction * step).toFixed(12)));
    if (next !== value) onValueChange(next);
  };
  return (
    <Input
      data-pui-owner="NumberInput"
      id={id}
      className={cx("pui-number-input", className)}
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
      onChange={(event) => onValueChange(event.target.value === "" ? "" : event.target.valueAsNumber)}
      endAdornment={(
        <span className="pui-number-input__steps">
          <button type="button" aria-label="增加" disabled={disabled || readOnly || (typeof max === "number" && value !== "" && value >= max)} onClick={() => move(1)}><Plus /></button>
          <button type="button" aria-label="减少" disabled={disabled || readOnly || (typeof min === "number" && value !== "" && value <= min)} onClick={() => move(-1)}><Minus /></button>
        </span>
      )}
    />
  );
}

export interface OtpInputProps {
  id?: string;
  value: string;
  onValueChange: (value: string) => void;
  length?: number;
  mode?: "numeric" | "alphanumeric";
  name?: string;
  form?: string;
  required?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  ariaLabel?: string;
  className?: string;
}

export function OtpInput({
  id,
  value,
  onValueChange,
  length = 6,
  mode = "numeric",
  name,
  form,
  required,
  disabled,
  invalid,
  ariaLabel = "验证码",
  className,
}: OtpInputProps) {
  if (!Number.isInteger(length) || length < 1 || length > 12) {
    throw new RangeError("OtpInput length must be an integer between 1 and 12.");
  }
  const generatedId = useId();
  const rootId = id ?? `pui-otp-${generatedId}`;
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const clean = (candidate: string) => (
    mode === "numeric" ? candidate.replace(/\D/g, "") : candidate.replace(/[^a-z0-9]/gi, "").toUpperCase()
  ).slice(0, length);
  const normalized = clean(value);
  const updateAt = (index: number, character: string) => {
    const nextCharacter = clean(character).slice(-1);
    if (!nextCharacter) {
      onValueChange(`${normalized.slice(0, index)}${normalized.slice(index + 1)}`);
      return;
    }
    const targetIndex = Math.min(index, normalized.length);
    onValueChange(`${normalized.slice(0, targetIndex)}${nextCharacter}${normalized.slice(targetIndex + 1)}`.slice(0, length));
  };
  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    const pasted = clean(event.clipboardData.getData("text"));
    if (!pasted) return;
    event.preventDefault();
    onValueChange(pasted);
    refs.current[Math.min(pasted.length, length) - 1]?.focus();
  };
  return (
    <div data-pui-owner="OtpInput" className={cx("pui-otp", invalid && "is-invalid", className)} role="group" aria-label={ariaLabel} aria-invalid={invalid || undefined} onPaste={handlePaste}>
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
          required={required && index === 0}
          aria-label={`${ariaLabel}第 ${index + 1} 位`}
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
      <FormValueBridge name={name} form={form} value={normalized} disabled={disabled} required={required} />
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

export interface FileUploadProps {
  items: readonly FileUploadItem[];
  onFiles: (files: File[]) => void;
  onRejected?: (rejections: FileUploadRejection[]) => void;
  onRemove?: (item: FileUploadItem) => void;
  onRetry?: (item: FileUploadItem) => void | Promise<void>;
  onStart?: () => void | Promise<void>;
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
  className?: string;
}

function matchesAccept(file: File, accept?: string): boolean {
  if (!accept?.trim()) return true;
  return accept.split(",").some((rawRule) => {
    const rule = rawRule.trim().toLocaleLowerCase();
    if (!rule) return false;
    if (rule.startsWith(".")) return file.name.toLocaleLowerCase().endsWith(rule);
    if (rule.endsWith("/*")) return file.type.toLocaleLowerCase().startsWith(rule.slice(0, -1));
    return file.type.toLocaleLowerCase() === rule;
  });
}

function formatFileSize(size?: number): string | undefined {
  if (size == null || !Number.isFinite(size)) return undefined;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileUpload({
  items,
  onFiles,
  onRejected,
  onRemove,
  onRetry,
  onStart,
  onActionError,
  accept,
  multiple = true,
  maxFiles,
  maxSize,
  name,
  form,
  required,
  disabled,
  label = "拖放文件到这里",
  description,
  browseLabel = "选择文件",
  startLabel = "开始上传",
  className,
}: FileUploadProps) {
  assertUniqueIdentities("FileUpload", "item.id", items.map((item) => item.id));
  if (maxFiles != null && (!Number.isInteger(maxFiles) || maxFiles < 1)) {
    throw new RangeError("FileUpload maxFiles must be a positive integer.");
  }
  if (maxSize != null && (!Number.isFinite(maxSize) || maxSize <= 0)) {
    throw new RangeError("FileUpload maxSize must be greater than zero.");
  }
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [starting, setStarting] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const selectFiles = (incoming: File[]) => {
    const accepted: File[] = [];
    const rejected: FileUploadRejection[] = [];
    incoming.forEach((file, index) => {
      if (maxFiles != null && items.length + accepted.length >= maxFiles) {
        rejected.push({ file, reason: "count", message: `最多上传 ${maxFiles} 个文件` });
      } else if (!matchesAccept(file, accept)) {
        rejected.push({ file, reason: "type", message: "文件类型不受支持" });
      } else if (maxSize != null && file.size > maxSize) {
        rejected.push({ file, reason: "size", message: `文件大小不能超过 ${formatFileSize(maxSize)}` });
      } else if (multiple || index === 0) {
        accepted.push(file);
      }
    });
    if (accepted.length) onFiles(accepted);
    if (rejected.length) onRejected?.(rejected);
  };
  const runStart = async () => {
    if (!onStart || starting) return;
    setStarting(true);
    try { await onStart(); } catch (error) { onActionError?.(error, "start"); } finally { setStarting(false); }
  };
  const runRetry = async (item: FileUploadItem) => {
    if (!onRetry || retryingId) return;
    setRetryingId(item.id);
    try { await onRetry(item); } catch (error) { onActionError?.(error, "retry", item); } finally { setRetryingId(null); }
  };
  const queued = items.some((item) => item.status === "queued");
  return (
    <div data-pui-owner="FileUpload" className={cx("pui-file-upload", dragging && "is-dragging", disabled && "is-disabled", className)} aria-disabled={disabled || undefined}>
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
        <Button size="small" disabled={disabled || (maxFiles != null && items.length >= maxFiles)} onClick={() => inputRef.current?.click()}>{browseLabel}</Button>
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
        <ul className="pui-file-upload__list" aria-label="文件列表">
          {items.map((item) => {
            const progress = Math.max(0, Math.min(100, item.progress ?? (item.status === "success" ? 100 : 0)));
            return (
              <li key={item.id} className="pui-file-upload__item" data-status={item.status}>
                <span className="pui-file-upload__file-icon" aria-hidden="true">
                  {item.status === "success" ? <CircleCheck /> : item.status === "error" ? <CircleAlert /> : item.status === "uploading" ? <LoaderCircle className="pui-spinner" /> : <FileText />}
                </span>
                <span className="pui-file-upload__item-copy">
                  <strong title={item.name}>{item.name}</strong>
                  <span>{item.error ?? formatFileSize(item.size) ?? (item.status === "queued" ? "等待上传" : item.status === "uploading" ? `上传中 ${Math.round(progress)}%` : "上传完成")}</span>
                  {item.status === "uploading" ? <span className="pui-file-upload__progress"><span style={{ width: `${progress}%` }} /></span> : null}
                </span>
                <span className="pui-file-upload__item-actions">
                  {item.status === "error" && onRetry ? <IconButton aria-label={`重试 ${item.name}`} icon={<RotateCcw />} loading={retryingId === item.id} onClick={() => void runRetry(item)} /> : null}
                  {onRemove ? <IconButton aria-label={`移除 ${item.name}`} icon={<Trash2 />} disabled={disabled || item.status === "uploading"} onClick={() => onRemove(item)} /> : null}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
      {onStart && queued ? <div className="pui-file-upload__footer"><Button variant="primary" loading={starting} disabled={disabled} onClick={() => void runStart()}>{startLabel}</Button></div> : null}
      <FormValuesBridge name={name} form={form} values={items.map((item) => item.value ?? item.id)} disabled={disabled} required={required} />
    </div>
  );
}

export interface RichTextEditorProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange"> {
  value: string;
  onValueChange: (value: string) => void;
  toolbarLabel?: string;
}

export const RichTextEditor = forwardRef<HTMLTextAreaElement, RichTextEditorProps>(function RichTextEditor(
  { value, onValueChange, toolbarLabel = "文本格式", className, disabled, readOnly, ...props },
  forwardedRef,
) {
  const localRef = useRef<HTMLTextAreaElement | null>(null);
  const setRef = (node: HTMLTextAreaElement | null) => {
    localRef.current = node;
    if (typeof forwardedRef === "function") forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  };
  const replaceSelection = (before: string, after = before, fallback = "文本") => {
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
    const selected = value.slice(start, end) || "列表项";
    const replacement = selected.split("\n").map((line) => `- ${line.replace(/^[-*]\s+/, "")}`).join("\n");
    onValueChange(`${value.slice(0, start)}${replacement}${value.slice(end)}`);
    requestAnimationFrame(() => editor.focus());
  };
  return (
    <div data-pui-owner="RichTextEditor" className={cx("pui-rich-text", className)}>
      <div className="pui-rich-text__toolbar" role="toolbar" aria-label={toolbarLabel}>
        <IconButton aria-label="粗体" icon={<Bold />} disabled={disabled || readOnly} onClick={() => replaceSelection("**")} />
        <IconButton aria-label="斜体" icon={<Italic />} disabled={disabled || readOnly} onClick={() => replaceSelection("_")} />
        <IconButton aria-label="无序列表" icon={<List />} disabled={disabled || readOnly} onClick={listSelection} />
        <IconButton aria-label="插入链接" icon={<LinkIcon />} disabled={disabled || readOnly} onClick={() => replaceSelection("[", "](https://)")} />
      </div>
      <Textarea {...props} ref={setRef} value={value} disabled={disabled} readOnly={readOnly} onChange={(event) => onValueChange(event.target.value)} />
    </div>
  );
});

export interface CodeEditorProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange"> {
  value: string;
  onValueChange: (value: string) => void;
  language?: string;
  indent?: string;
}

export const CodeEditor = forwardRef<HTMLTextAreaElement, CodeEditorProps>(function CodeEditor(
  { value, onValueChange, language = "text", indent = "  ", className, onKeyDown, ...props },
  ref,
) {
  const lines = value.split("\n").length;
  return (
    <div data-pui-owner="CodeEditor" className={cx("pui-code-editor", className)}>
      <div className="pui-code-editor__meta"><span>{language}</span><span>{lines} 行</span></div>
      <Textarea
        {...props}
        ref={ref}
        className="pui-code-editor__input"
        value={value}
        spellCheck={false}
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={(event: KeyboardEvent<HTMLTextAreaElement>) => {
          if (event.key === "Tab" && !props.readOnly && !props.disabled) {
            event.preventDefault();
            const target = event.currentTarget;
            const start = target.selectionStart;
            const end = target.selectionEnd;
            onValueChange(`${value.slice(0, start)}${indent}${value.slice(end)}`);
            requestAnimationFrame(() => {
              target.focus();
              target.setSelectionRange(start + indent.length, start + indent.length);
            });
          }
          onKeyDown?.(event);
        }}
      />
    </div>
  );
});

export interface InlineEditProps {
  value: string;
  onCommit: (value: string) => void | Promise<void>;
  validate?: (value: string) => string | undefined;
  name?: string;
  form?: string;
  required?: boolean;
  disabled?: boolean;
  emptyLabel?: string;
  editLabel?: string;
  className?: string;
}

export function InlineEdit({
  value,
  onCommit,
  validate,
  name,
  form,
  required,
  disabled,
  emptyLabel = "未填写",
  editLabel = "编辑",
  className,
}: InlineEditProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  useEffect(() => { if (!editing) setDraft(value); }, [editing, value]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);
  const cancel = () => { setDraft(value); setError(undefined); setEditing(false); };
  const save = async () => {
    if (saving) return;
    const validation = validate?.(draft) ?? (required && !draft.trim() ? "此项不能为空" : undefined);
    if (validation) { setError(validation); inputRef.current?.focus(); return; }
    if (draft === value) { setEditing(false); return; }
    setSaving(true);
    try {
      await onCommit(draft);
      setError(undefined);
      setEditing(false);
    } catch (cause) {
      setError(cause instanceof Error && cause.message ? cause.message : "保存失败，请重试");
    } finally {
      setSaving(false);
    }
  };
  return (
    <div data-pui-owner="InlineEdit" className={cx("pui-inline-edit", editing && "is-editing", className)}>
      {editing ? (
        <>
          <Input ref={inputRef} value={draft} invalid={Boolean(error)} disabled={disabled || saving} aria-label={editLabel} onChange={(event) => { setDraft(event.target.value); setError(undefined); }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void save(); } else if (event.key === "Escape") cancel(); }} />
          <span className="pui-inline-edit__actions">
            <IconButton aria-label="保存" icon={<Check />} loading={saving} disabled={disabled} onClick={() => void save()} />
            <IconButton aria-label="取消" icon={<X />} disabled={disabled || saving} onClick={cancel} />
          </span>
          {error ? <span className="pui-inline-edit__error" role="alert">{error}</span> : null}
        </>
      ) : (
        <>
          <span className={cx("pui-inline-edit__value", !value && "is-empty")} title={value || undefined}>{value || emptyLabel}</span>
          <IconButton aria-label={editLabel} icon={<Pencil />} disabled={disabled} onClick={() => setEditing(true)} />
        </>
      )}
      <FormValueBridge name={name} form={form} value={value} disabled={disabled} required={required} />
    </div>
  );
}

export interface AutocompleteOption extends ComboboxOption {}

export interface AutocompleteProps {
  id?: string;
  options: readonly AutocompleteOption[];
  value?: string;
  query: string;
  onQueryChange: (query: string) => void;
  onValueChange: (value: string) => void;
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
  className?: string;
}

export function Autocomplete({
  id,
  options,
  value,
  query,
  onQueryChange,
  onValueChange,
  onOptionSelect,
  filterOptions = true,
  allowCustomValue = false,
  loading,
  emptyText = "没有匹配选项",
  placeholder,
  name,
  form,
  required,
  disabled,
  ariaLabel,
  className,
}: AutocompleteProps) {
  assertUniqueIdentities("Autocomplete", "option.value", options.map((option) => option.value), { allowEmpty: true });
  const generatedId = useId();
  const controlId = id ?? `pui-autocomplete-${generatedId}`;
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const filtered = useMemo(() => {
    if (!filterOptions || !query.trim()) return options;
    const needle = query.trim().toLocaleLowerCase();
    return options.filter((option) => `${option.label} ${option.description ?? ""} ${option.searchText ?? ""}`.toLocaleLowerCase().includes(needle));
  }, [filterOptions, options, query]);
  useOutsideDismiss(open, rootRef, () => setOpen(false));
  useEffect(() => { if (activeIndex >= filtered.length) setActiveIndex(0); }, [activeIndex, filtered.length]);
  const choose = (option: AutocompleteOption) => {
    if (option.disabled) return;
    onValueChange(option.value);
    onQueryChange(option.label);
    onOptionSelect?.(option);
    setOpen(false);
  };
  const submittedValue = allowCustomValue && !value ? query : value ?? "";
  return (
    <div ref={rootRef} data-pui-owner="Autocomplete" className={cx("pui-autocomplete", className)} data-open={open || undefined}>
      <Input
        id={controlId}
        value={query}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        role="combobox"
        aria-label={ariaLabel}
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={`${controlId}-listbox`}
        aria-activedescendant={open && filtered[activeIndex] ? `${controlId}-option-${activeIndex}` : undefined}
        startAdornment={<Search />}
        endAdornment={loading ? <LoaderCircle className="pui-spinner" /> : <ChevronDown />}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          onQueryChange(event.target.value);
          if (value) onValueChange("");
          setActiveIndex(0);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
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
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {open ? (
        <div id={`${controlId}-listbox`} className="pui-extra-popover pui-autocomplete__list" role="listbox" aria-label={ariaLabel}>
          {loading ? <div className="pui-extra-state"><Spinner label="正在加载" /></div> : filtered.map((option, index) => (
            <button key={option.value} id={`${controlId}-option-${index}`} type="button" className="pui-extra-option" role="option" aria-selected={option.value === value} data-active={index === activeIndex || undefined} disabled={option.disabled} onMouseDown={(event) => event.preventDefault()} onMouseMove={() => setActiveIndex(index)} onClick={() => choose(option)}>
              {option.leading != null ? <span className="pui-extra-option__leading" aria-hidden="true">{option.leading}</span> : null}
              <span className="pui-extra-option__copy"><strong>{option.label}</strong>{option.description ? <span>{option.description}</span> : null}</span>
              <Check aria-hidden="true" />
            </button>
          ))}
          {!loading && !filtered.length ? <div className="pui-extra-state" role="status">{emptyText}</div> : null}
        </div>
      ) : null}
      <FormValueBridge name={name} form={form} value={submittedValue} disabled={disabled} required={required} />
    </div>
  );
}

export interface SearchableSelectProps {
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
  className?: string;
}

export function SearchableSelect({ name, form, required, ...props }: SearchableSelectProps) {
  return (
    <div data-pui-owner="SearchableSelect" className="pui-form-control-bridge">
      <Combobox {...props} aria-required={required || undefined} />
      <FormValueBridge name={name} form={form} value={props.value ?? ""} disabled={props.disabled} required={required} />
    </div>
  );
}

export interface AsyncSelectOption extends ComboboxOption {}

export interface AsyncSelectProps {
  id?: string;
  options: readonly AsyncSelectOption[];
  value?: string;
  query: string;
  onQueryChange: (query: string) => void;
  onValueChange: (value: string) => void;
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
  className?: string;
}

export function AsyncSelect({
  id,
  options,
  value,
  query,
  onQueryChange,
  onValueChange,
  loading,
  loadingMore,
  error,
  onRetry,
  onLoadMore,
  onActionError,
  hasMore,
  placeholder = "请选择",
  searchPlaceholder = "搜索",
  emptyText = "没有匹配选项",
  name,
  form,
  required,
  disabled,
  ariaLabel,
  className,
}: AsyncSelectProps) {
  assertUniqueIdentities("AsyncSelect", "option.value", options.map((option) => option.value), { allowEmpty: true });
  const generatedId = useId();
  const controlId = id ?? `pui-async-select-${generatedId}`;
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [loadingMoreInternally, setLoadingMoreInternally] = useState(false);
  const [actionError, setActionError] = useState<ReactNode>();
  const [failedAction, setFailedAction] = useState<"retry" | "load-more">();
  const [activeIndex, setActiveIndex] = useState(0);
  const selected = options.find((option) => option.value === value);
  useOutsideDismiss(open, rootRef, () => setOpen(false));
  useEffect(() => { if (open) requestAnimationFrame(() => searchRef.current?.focus()); }, [open]);
  const retry = async () => {
    if (!onRetry || retrying) return;
    setRetrying(true);
    setActionError(undefined);
    try {
      await onRetry();
    } catch (cause) {
      setActionError("重试失败，请稍后再试");
      setFailedAction("retry");
      onActionError?.(cause, "retry");
    } finally {
      setRetrying(false);
    }
  };
  const loadMore = async () => {
    if (!onLoadMore || loadingMore || loadingMoreInternally) return;
    setLoadingMoreInternally(true);
    setActionError(undefined);
    try {
      await onLoadMore();
    } catch (cause) {
      setActionError("加载更多失败，请重试");
      setFailedAction("load-more");
      onActionError?.(cause, "load-more");
    } finally {
      setLoadingMoreInternally(false);
    }
  };
  const choose = (option: AsyncSelectOption) => {
    if (option.disabled) return;
    if (option.value !== value) onValueChange(option.value);
    setOpen(false);
  };
  return (
    <div ref={rootRef} data-pui-owner="AsyncSelect" className={cx("pui-async-select", className)} data-open={open || undefined}>
      <button id={controlId} type="button" className="pui-combobox__trigger" role="combobox" aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? `${controlId}-listbox` : undefined} aria-required={required || undefined} disabled={disabled} onClick={() => setOpen((current) => !current)}>
        <span className="pui-combobox__value">{selected?.leading != null ? <span className="pui-option__leading" aria-hidden="true">{selected.leading}</span> : null}<span>{selected?.label ?? placeholder}</span></span>
        {loading && !open ? <LoaderCircle className="pui-spinner" aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
      </button>
      {open ? (
        <div className="pui-extra-popover pui-async-select__popover">
          <SearchInput ref={searchRef} value={query} placeholder={searchPlaceholder} aria-label={`搜索${ariaLabel}`} onChange={(event) => { setActionError(undefined); setFailedAction(undefined); onQueryChange(event.target.value); setActiveIndex(0); }} onClear={() => { setActionError(undefined); setFailedAction(undefined); onQueryChange(""); setActiveIndex(0); }} onKeyDown={(event) => {
            if ((event.key === "ArrowDown" || event.key === "ArrowUp") && options.length) {
              event.preventDefault();
              const direction = event.key === "ArrowDown" ? 1 : -1;
              let next = activeIndex;
              for (let count = 0; count < options.length; count += 1) { next = (next + direction + options.length) % options.length; if (!options[next]?.disabled) break; }
              setActiveIndex(next);
            } else if (event.key === "Enter" && options[activeIndex]) { event.preventDefault(); choose(options[activeIndex]); }
            else if (event.key === "Escape") setOpen(false);
          }} />
          <div id={`${controlId}-listbox`} className="pui-async-select__list" role="listbox" aria-label={ariaLabel} aria-busy={loading || undefined}>
            {loading && !options.length ? <div className="pui-extra-state"><Spinner label="正在加载" /></div> : null}
            {error != null || actionError != null ? <div className="pui-extra-error" role="alert"><span>{error ?? actionError}</span>{onRetry || (failedAction === "load-more" && onLoadMore) ? <Button size="small" loading={failedAction === "load-more" ? loadingMoreInternally : retrying} onClick={() => void (failedAction === "load-more" ? loadMore() : retry())}>重试</Button> : null}</div> : null}
            {error == null && actionError == null ? options.map((option, index) => (
              <button key={option.value} type="button" className="pui-extra-option" role="option" aria-selected={option.value === value} data-active={index === activeIndex || undefined} disabled={option.disabled} onMouseMove={() => setActiveIndex(index)} onClick={() => choose(option)}>
                {option.leading != null ? <span className="pui-extra-option__leading" aria-hidden="true">{option.leading}</span> : null}
                <span className="pui-extra-option__copy"><strong>{option.label}</strong>{option.description ? <span>{option.description}</span> : null}</span>
                <Check aria-hidden="true" />
              </button>
            )) : null}
            {!loading && error == null && actionError == null && !options.length ? <div className="pui-extra-state" role="status">{emptyText}</div> : null}
          </div>
          {error == null && actionError == null && hasMore && onLoadMore ? <div className="pui-async-select__footer"><Button size="small" loading={Boolean(loadingMore || loadingMoreInternally)} onClick={() => void loadMore()}>加载更多</Button></div> : null}
        </div>
      ) : null}
      <FormValueBridge name={name} form={form} value={value ?? ""} disabled={disabled} required={required} />
    </div>
  );
}

export interface MultiSelectOption extends ComboboxOption {}

export interface MultiSelectProps {
  id?: string;
  options: readonly MultiSelectOption[];
  value: readonly string[];
  onValueChange: (value: string[]) => void;
  query?: string;
  onQueryChange?: (query: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: ReactNode;
  name?: string;
  form?: string;
  required?: boolean;
  disabled?: boolean;
  ariaLabel: string;
  className?: string;
}

export function MultiSelect({
  id,
  options,
  value,
  onValueChange,
  query,
  onQueryChange,
  placeholder = "请选择",
  searchPlaceholder = "搜索选项",
  emptyText = "没有匹配选项",
  name,
  form,
  required,
  disabled,
  ariaLabel,
  className,
}: MultiSelectProps) {
  assertUniqueIdentities("MultiSelect", "option.value", options.map((option) => option.value), { allowEmpty: true });
  assertUniqueIdentities("MultiSelect", "value", value, { allowEmpty: true });
  const unknownValues = value.filter((item) => !options.some((option) => option.value === item));
  if (unknownValues.length) {
    throw new RangeError(`MultiSelect received unknown value ${JSON.stringify(unknownValues[0])}.`);
  }
  const generatedId = useId();
  const controlId = id ?? `pui-multi-select-${generatedId}`;
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [internalQuery, setInternalQuery] = useState("");
  const search = query ?? internalQuery;
  const setSearch = (next: string) => { if (query === undefined) setInternalQuery(next); onQueryChange?.(next); };
  const selectedOptions = options.filter((option) => value.includes(option.value));
  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    return needle ? options.filter((option) => `${option.label} ${option.description ?? ""} ${option.searchText ?? ""}`.toLocaleLowerCase().includes(needle)) : options;
  }, [options, search]);
  useOutsideDismiss(open, rootRef, () => setOpen(false));
  const toggle = (option: MultiSelectOption) => {
    if (option.disabled) return;
    onValueChange(value.includes(option.value) ? value.filter((item) => item !== option.value) : [...value, option.value]);
  };
  const summary = !selectedOptions.length ? placeholder : selectedOptions.length === 1 ? selectedOptions[0].label : `${optionText(selectedOptions[0].label, selectedOptions[0].value)} +${selectedOptions.length - 1}`;
  return (
    <div ref={rootRef} data-pui-owner="MultiSelect" className={cx("pui-multi-select", className)} data-open={open || undefined}>
      <button id={controlId} type="button" className="pui-multi-select__trigger" role="combobox" aria-label={`${ariaLabel}，已选择 ${value.length} 项`} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? `${controlId}-listbox` : undefined} aria-required={required || undefined} disabled={disabled} onClick={() => setOpen((current) => !current)}>
        <span className={cx("pui-multi-select__summary", !selectedOptions.length && "is-placeholder")}>{summary}</span>
        <span className="pui-multi-select__count" aria-hidden="true">{value.length || null}</span>
        <ChevronDown aria-hidden="true" />
      </button>
      {open ? (
        <div className="pui-extra-popover pui-multi-select__popover">
          <SearchInput value={search} placeholder={searchPlaceholder} aria-label={`搜索${ariaLabel}`} onChange={(event) => setSearch(event.target.value)} onClear={() => setSearch("")} />
          <div id={`${controlId}-listbox`} className="pui-multi-select__list" role="listbox" aria-label={ariaLabel} aria-multiselectable="true">
            {filtered.map((option) => (
              <button key={option.value} type="button" className="pui-extra-option" role="option" aria-selected={value.includes(option.value)} disabled={option.disabled} onClick={() => toggle(option)}>
                <span className="pui-multi-select__check" aria-hidden="true">{value.includes(option.value) ? <Check /> : null}</span>
                {option.leading != null ? <span className="pui-extra-option__leading" aria-hidden="true">{option.leading}</span> : null}
                <span className="pui-extra-option__copy"><strong>{option.label}</strong>{option.description ? <span>{option.description}</span> : null}</span>
              </button>
            ))}
            {!filtered.length ? <div className="pui-extra-state" role="status">{emptyText}</div> : null}
          </div>
          <div className="pui-multi-select__footer"><Button size="small" disabled={!value.length} onClick={() => onValueChange([])}>清空</Button><Button size="small" variant="primary" onClick={() => setOpen(false)}>完成</Button></div>
        </div>
      ) : null}
      <FormValuesBridge name={name} form={form} values={value} disabled={disabled} required={required} />
    </div>
  );
}

export interface TagSuggestion {
  value: string;
  label?: ReactNode;
  leading?: ReactNode;
  disabled?: boolean;
}

export interface TagInputProps {
  id?: string;
  value: readonly string[];
  inputValue: string;
  onInputValueChange: (value: string) => void;
  onValueChange: (value: string[]) => void;
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
  className?: string;
}

export function TagInput({
  id,
  value,
  inputValue,
  onInputValueChange,
  onValueChange,
  suggestions = [],
  normalizeValue = (candidate) => candidate.trim(),
  validateValue,
  maxTags,
  allowDuplicates = false,
  placeholder = "输入后按 Enter",
  name,
  form,
  required,
  disabled,
  ariaLabel = "标签输入",
  className,
}: TagInputProps) {
  if (!allowDuplicates) assertUniqueIdentities("TagInput", "value", value);
  assertUniqueIdentities("TagInput", "suggestion.value", suggestions.map((item) => item.value));
  const generatedId = useId();
  const controlId = id ?? `pui-tag-input-${generatedId}`;
  const [error, setError] = useState<string>();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  useOutsideDismiss(open, rootRef, () => setOpen(false));
  const add = (candidate: string) => {
    const normalized = normalizeValue(candidate);
    const validation = !normalized ? "标签不能为空" : validateValue?.(normalized);
    if (validation) { setError(validation); return; }
    if (!allowDuplicates && value.includes(normalized)) { setError("标签已存在"); return; }
    if (maxTags != null && value.length >= maxTags) { setError(`最多添加 ${maxTags} 个标签`); return; }
    onValueChange([...value, normalized]);
    onInputValueChange("");
    setError(undefined);
    setOpen(false);
  };
  const needle = inputValue.trim().toLocaleLowerCase();
  const visibleSuggestions = needle ? suggestions.filter((item) => `${item.label ?? ""} ${item.value}`.toLocaleLowerCase().includes(needle) && !value.includes(item.value)) : [];
  return (
    <div ref={rootRef} data-pui-owner="TagInput" className={cx("pui-tag-input", error && "is-invalid", disabled && "is-disabled", className)}>
      <div className="pui-tag-input__control" onClick={() => document.getElementById(controlId)?.focus()}>
        {value.map((tag, index) => <Tag key={`${tag}-${index}`} onRemove={disabled ? undefined : () => onValueChange(value.filter((_, itemIndex) => itemIndex !== index))}>{tag}</Tag>)}
        <input id={controlId} className="pui-tag-input__input" value={inputValue} placeholder={!value.length ? placeholder : undefined} disabled={disabled || (maxTags != null && value.length >= maxTags)} aria-label={ariaLabel} aria-invalid={Boolean(error) || undefined} aria-required={required || undefined} onFocus={() => setOpen(true)} onChange={(event) => { onInputValueChange(event.target.value); setError(undefined); setOpen(true); }} onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === ",") { event.preventDefault(); add(inputValue); }
          else if (event.key === "Backspace" && !inputValue && value.length) onValueChange(value.slice(0, -1));
        }} />
      </div>
      {open && visibleSuggestions.length ? <div className="pui-extra-popover pui-tag-input__suggestions" role="listbox" aria-label="标签建议">{visibleSuggestions.map((item) => <button key={item.value} type="button" className="pui-extra-option" role="option" aria-selected="false" disabled={item.disabled} onMouseDown={(event) => event.preventDefault()} onClick={() => add(item.value)}>{item.leading != null ? <span className="pui-extra-option__leading">{item.leading}</span> : null}<span className="pui-extra-option__copy"><strong>{item.label ?? item.value}</strong></span></button>)}</div> : null}
      {error ? <span className="pui-tag-input__error" role="alert">{error}</span> : null}
      <FormValuesBridge name={name} form={form} values={value} disabled={disabled} required={required} />
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

export interface CascaderProps {
  options: readonly CascaderOption[];
  value: readonly string[];
  onValueChange: (value: string[]) => void;
  ariaLabel: string;
  levelLabels?: readonly string[];
  placeholder?: string;
  name?: string;
  form?: string;
  required?: boolean;
  disabled?: boolean;
  submitValue?: "leaf" | "path";
  className?: string;
}

function flattenCascader(options: readonly CascaderOption[]): CascaderOption[] {
  return options.flatMap((option) => [option, ...flattenCascader(option.children ?? [])]);
}

export function Cascader({ options, value, onValueChange, ariaLabel, levelLabels = [], placeholder = "请选择", name, form, required, disabled, submitValue = "leaf", className }: CascaderProps) {
  assertUniqueIdentities("Cascader", "option.value", flattenCascader(options).map((option) => option.value));
  const levels: Array<{ options: readonly CascaderOption[]; selected?: string }> = [];
  let current = options;
  let index = 0;
  while (current.length) {
    const selected = value[index];
    levels.push({ options: current, selected });
    const selectedOption = current.find((option) => option.value === selected);
    if (!selectedOption?.children?.length) break;
    current = selectedOption.children;
    index += 1;
  }
  const submitted = submitValue === "path" ? JSON.stringify(value) : value[value.length - 1] ?? "";
  return (
    <div data-pui-owner="Cascader" className={cx("pui-cascader", className)} role="group" aria-label={ariaLabel}>
      {levels.map((level, levelIndex) => (
        <Select key={levelIndex} options={level.options.map((option): SelectOption => ({ value: option.value, label: option.label, leading: option.leading, disabled: option.disabled, textValue: optionText(option.label, option.value) }))} value={level.selected} placeholder={levelLabels[levelIndex] ?? placeholder} ariaLabel={levelLabels[levelIndex] ?? `${ariaLabel}第 ${levelIndex + 1} 级`} disabled={disabled} aria-required={required && levelIndex === 0 || undefined} onValueChange={(next) => onValueChange([...value.slice(0, levelIndex), next])} />
      ))}
      <FormValueBridge name={name} form={form} value={submitted} disabled={disabled} required={required} />
    </div>
  );
}

export interface TreeSelectOption {
  value: string;
  label: ReactNode;
  leading?: ReactNode;
  disabled?: boolean;
  children?: readonly TreeSelectOption[];
}

export interface TreeSelectProps {
  id?: string;
  options: readonly TreeSelectOption[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: ReactNode;
  name?: string;
  form?: string;
  required?: boolean;
  disabled?: boolean;
  ariaLabel: string;
  className?: string;
}

function flattenTree(options: readonly TreeSelectOption[]): TreeSelectOption[] {
  return options.flatMap((option) => [option, ...flattenTree(option.children ?? [])]);
}

export function TreeSelect({ id, options, value, onValueChange, placeholder = "请选择", name, form, required, disabled, ariaLabel, className }: TreeSelectProps) {
  const flat = flattenTree(options);
  assertUniqueIdentities("TreeSelect", "option.value", flat.map((option) => option.value), { allowEmpty: true });
  const generatedId = useId();
  const controlId = id ?? `pui-tree-select-${generatedId}`;
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const selected = flat.find((option) => option.value === value);
  useOutsideDismiss(open, rootRef, () => setOpen(false));
  const toggleExpanded = (itemValue: string) => setExpanded((current) => { const next = new Set(current); if (next.has(itemValue)) next.delete(itemValue); else next.add(itemValue); return next; });
  const renderNodes = (nodes: readonly TreeSelectOption[], depth = 0): ReactNode => nodes.map((option) => {
    const hasChildren = Boolean(option.children?.length);
    const isExpanded = expanded.has(option.value);
    return (
      <div key={option.value} role="none">
        <div className="pui-tree-select__row" style={{ paddingInlineStart: `${8 + depth * 20}px` }}>
          {hasChildren ? <IconButton aria-label={isExpanded ? `折叠${optionText(option.label, option.value)}` : `展开${optionText(option.label, option.value)}`} icon={isExpanded ? <ChevronDown /> : <ChevronRight />} onClick={() => toggleExpanded(option.value)} /> : <span className="pui-tree-select__spacer" />}
          <button type="button" role="treeitem" aria-selected={option.value === value} aria-expanded={hasChildren ? isExpanded : undefined} disabled={option.disabled} onClick={() => { onValueChange(option.value); setOpen(false); }}>
            {option.leading != null ? <span aria-hidden="true">{option.leading}</span> : null}<span>{option.label}</span>{option.value === value ? <Check aria-hidden="true" /> : null}
          </button>
        </div>
        {hasChildren && isExpanded ? <div role="group">{renderNodes(option.children ?? [], depth + 1)}</div> : null}
      </div>
    );
  });
  return (
    <div ref={rootRef} data-pui-owner="TreeSelect" className={cx("pui-tree-select", className)} data-open={open || undefined}>
      <button id={controlId} type="button" className="pui-combobox__trigger" role="combobox" aria-label={ariaLabel} aria-haspopup="tree" aria-expanded={open} aria-controls={open ? `${controlId}-tree` : undefined} aria-required={required || undefined} disabled={disabled} onClick={() => setOpen((currentOpen) => !currentOpen)}><span className="pui-combobox__value">{selected?.leading != null ? <span className="pui-option__leading">{selected.leading}</span> : null}<span>{selected?.label ?? placeholder}</span></span><ChevronDown /></button>
      {open ? <div id={`${controlId}-tree`} className="pui-extra-popover pui-tree-select__tree" role="tree" aria-label={ariaLabel}>{renderNodes(options)}</div> : null}
      <FormValueBridge name={name} form={form} value={value ?? ""} disabled={disabled} required={required} />
    </div>
  );
}

export interface TransferOption {
  value: string;
  label: ReactNode;
  textValue?: string;
  disabled?: boolean;
}

export interface TransferProps {
  options: readonly TransferOption[];
  value: readonly string[];
  onValueChange: (value: string[]) => void;
  sourceTitle?: string;
  targetTitle?: string;
  name?: string;
  form?: string;
  required?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
}

export function Transfer({ options, value, onValueChange, sourceTitle = "可选项", targetTitle = "已选择", name, form, required, disabled, ariaLabel = "穿梭框", className }: TransferProps) {
  assertUniqueIdentities("Transfer", "option.value", options.map((option) => option.value), { allowEmpty: true });
  assertUniqueIdentities("Transfer", "value", value, { allowEmpty: true });
  const [sourceSelection, setSourceSelection] = useState<string[]>([]);
  const [targetSelection, setTargetSelection] = useState<string[]>([]);
  const source = options.filter((option) => !value.includes(option.value));
  const target = options.filter((option) => value.includes(option.value));
  useEffect(() => {
    setSourceSelection((current) => current.filter((item) => source.some((option) => option.value === item)));
    setTargetSelection((current) => current.filter((item) => target.some((option) => option.value === item)));
  }, [options, value]);
  const readSelection = (event: ChangeEvent<HTMLSelectElement>) => Array.from(event.target.selectedOptions, (option) => option.value);
  return (
    <div data-pui-owner="Transfer" className={cx("pui-transfer", className)} role="group" aria-label={ariaLabel} aria-disabled={disabled || undefined}>
      <label className="pui-transfer__panel"><span>{sourceTitle}<small>{source.length}</small></span><select multiple value={sourceSelection} disabled={disabled} aria-label={sourceTitle} onChange={(event) => setSourceSelection(readSelection(event))}>{source.map((option) => <option key={option.value} value={option.value} disabled={option.disabled}>{option.textValue ?? optionText(option.label, option.value)}</option>)}</select></label>
      <div className="pui-transfer__actions">
        <IconButton aria-label="添加选中项" icon={<ChevronRight />} disabled={disabled || !sourceSelection.length} onClick={() => { onValueChange([...value, ...sourceSelection.filter((item) => !value.includes(item))]); setSourceSelection([]); }} />
        <IconButton aria-label="移除选中项" icon={<ChevronLeft />} disabled={disabled || !targetSelection.length} onClick={() => { onValueChange(value.filter((item) => !targetSelection.includes(item))); setTargetSelection([]); }} />
      </div>
      <label className="pui-transfer__panel"><span>{targetTitle}<small>{target.length}</small></span><select multiple value={targetSelection} disabled={disabled} aria-label={targetTitle} onChange={(event) => setTargetSelection(readSelection(event))}>{target.map((option) => <option key={option.value} value={option.value} disabled={option.disabled}>{option.textValue ?? optionText(option.label, option.value)}</option>)}</select></label>
      <FormValuesBridge name={name} form={form} values={value} disabled={disabled} required={required} />
    </div>
  );
}
