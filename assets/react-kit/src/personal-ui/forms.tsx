import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  type TextareaHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Eye, EyeOff, LoaderCircle, Search, X } from "lucide-react";
import { observeComputedStyleChanges } from "./portal-tokens";
import { assertUniqueIdentities, cx, getTabStops } from "./utils";

const useClientLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

type FieldControlAriaProps = Pick<
  InputHTMLAttributes<HTMLInputElement>,
  "id" | "aria-describedby" | "aria-disabled" | "aria-invalid" | "aria-required"
>;

interface FieldContextValue {
  controlId?: string;
  groupName?: string;
  describedBy?: string;
  invalid: boolean;
  required: boolean;
  group: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

function mergeAriaIds(...values: Array<string | undefined>): string | undefined {
  const ids = Array.from(new Set(values.flatMap((value) => value?.split(/\s+/).filter(Boolean) ?? [])));
  return ids.length ? ids.join(" ") : undefined;
}

function isAriaTrue(value: boolean | "true" | "false" | undefined): boolean {
  return value === true || value === "true";
}

function useFieldControl(
  id: string | undefined,
  describedBy: string | undefined,
  invalid: InputHTMLAttributes<HTMLInputElement>["aria-invalid"],
  required?: InputHTMLAttributes<HTMLInputElement>["aria-required"],
) {
  const field = useContext(FieldContext);
  const generatedId = useId();
  return {
    id: id ?? (field?.group ? generatedId : field?.controlId),
    groupName: field?.groupName,
    describedBy: mergeAriaIds(describedBy, field?.describedBy),
    invalid: field?.invalid ? true : invalid,
    fieldInvalid: field?.invalid ?? false,
    required: field?.required ? true : required,
    group: field?.group ?? false,
  };
}

function firstEnabledIndex<T extends { disabled?: boolean }>(options: readonly T[], fromEnd = false): number {
  if (fromEnd) {
    for (let index = options.length - 1; index >= 0; index -= 1) {
      if (!options[index].disabled) return index;
    }
    return -1;
  }
  return options.findIndex((option) => !option.disabled);
}

function nextEnabledIndex<T extends { disabled?: boolean }>(
  options: readonly T[],
  current: number,
  direction: 1 | -1,
): number {
  if (!options.length) return -1;
  let next = current >= 0 && current < options.length
    ? current
    : direction === 1 ? -1 : 0;
  for (let count = 0; count < options.length; count += 1) {
    next = (next + direction + options.length) % options.length;
    if (!options[next].disabled) return next;
  }
  return -1;
}

function focusAdjacentTabStop(trigger: HTMLElement, root: HTMLElement, backwards: boolean) {
  const modalBoundary = trigger.closest<HTMLElement>("[role='dialog'][aria-modal='true']");
  const withinBoundary = (element: HTMLElement) => !modalBoundary || modalBoundary.contains(element);
  const candidates = getTabStops(document, withinBoundary);
  const triggerIndex = candidates.indexOf(trigger);
  const direction = backwards ? -1 : 1;

  for (
    let index = triggerIndex + direction;
    index >= 0 && index < candidates.length;
    index += direction
  ) {
    if (!root.contains(candidates[index]) && withinBoundary(candidates[index])) {
      candidates[index].focus();
      return;
    }
  }

  if (modalBoundary) {
    const wrappedCandidates = candidates.filter((candidate) => (
      !root.contains(candidate) && modalBoundary.contains(candidate)
    ));
    const wrapped = backwards ? wrappedCandidates[wrappedCandidates.length - 1] : wrappedCandidates[0];
    (wrapped ?? trigger).focus();
    return;
  }

  trigger.blur();
}

const FLOATING_GUTTER = 12;
const FLOATING_GAP = 6;

function copyPersonalUiTokens(
  source: HTMLElement,
  target: HTMLElement,
  previous: Set<string>,
): Set<string> {
  const computed = window.getComputedStyle(source);
  const copied = new Set<string>();
  for (let index = 0; index < computed.length; index += 1) {
    const property = computed.item(index);
    if (!property.startsWith("--pui-")) continue;
    copied.add(property);
    target.style.setProperty(property, computed.getPropertyValue(property));
  }
  previous.forEach((property) => {
    if (!copied.has(property)) target.style.removeProperty(property);
  });
  return copied;
}

function floatingViewportBounds() {
  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = document.documentElement.clientHeight;
  return {
    left: FLOATING_GUTTER,
    right: Math.max(FLOATING_GUTTER + 1, viewportWidth - FLOATING_GUTTER),
    top: FLOATING_GUTTER,
    bottom: Math.max(FLOATING_GUTTER + 1, viewportHeight - FLOATING_GUTTER),
  };
}

function usePopoverPosition(
  open: boolean,
  placement: "bottom" | "top",
  rootRef: RefObject<HTMLElement>,
  popoverRef: RefObject<HTMLElement>,
) {
  useClientLayoutEffect(() => {
    const root = rootRef.current;
    const popover = popoverRef.current;
    if (!open || !root || !popover) return;

    let animationFrame = 0;
    let copiedTokens = new Set<string>();
    const update = () => {
      const { left, right, top, bottom } = floatingViewportBounds();
      const availableWidth = Math.max(1, Math.floor(right - left));
      const availableHeight = Math.max(1, Math.floor(bottom - top));
      copiedTokens = copyPersonalUiTokens(root, popover, copiedTokens);
      popover.removeAttribute("data-positioned");
      popover.style.setProperty("--pui-floating-anchor-width", `${Math.max(1, root.getBoundingClientRect().width)}px`);
      popover.style.setProperty("--pui-floating-max-width", `${availableWidth}px`);
      popover.style.setProperty("--pui-floating-max-height", `${availableHeight}px`);
      popover.style.left = `${left}px`;
      popover.style.top = `${top}px`;

      const rootRect = root.getBoundingClientRect();
      const initialRect = popover.getBoundingClientRect();
      const roomBelow = Math.max(1, bottom - rootRect.bottom - FLOATING_GAP);
      const roomAbove = Math.max(1, rootRect.top - FLOATING_GAP - top);
      const preferredRoom = placement === "bottom" ? roomBelow : roomAbove;
      const alternateRoom = placement === "bottom" ? roomAbove : roomBelow;
      const resolvedPlacement = initialRect.height > preferredRoom && alternateRoom > preferredRoom
        ? placement === "bottom" ? "top" : "bottom"
        : placement;
      const resolvedRoom = resolvedPlacement === "bottom" ? roomBelow : roomAbove;
      popover.style.setProperty("--pui-floating-max-height", `${Math.max(1, Math.floor(resolvedRoom))}px`);

      const renderedRect = popover.getBoundingClientRect();
      const unclampedLeft = rootRect.left;
      const maxLeft = Math.max(left, right - renderedRect.width);
      const resolvedLeft = Math.min(Math.max(unclampedLeft, left), maxLeft);
      const unclampedTop = resolvedPlacement === "bottom"
        ? rootRect.bottom + FLOATING_GAP
        : rootRect.top - FLOATING_GAP - renderedRect.height;
      const maxTop = Math.max(top, bottom - renderedRect.height);
      const resolvedTop = Math.min(Math.max(unclampedTop, top), maxTop);
      const alignedToEnd = Math.abs(resolvedLeft + renderedRect.width - rootRect.right) <= 1;
      const horizontalAlign = Math.abs(resolvedLeft - rootRect.left) <= 1
        ? "start"
        : alignedToEnd ? "end" : "clamped";

      popover.style.left = `${Math.round(resolvedLeft * 100) / 100}px`;
      popover.style.top = `${Math.round(resolvedTop * 100) / 100}px`;
      popover.dataset.horizontalAlign = horizontalAlign;
      popover.dataset.verticalAlign = resolvedPlacement;
      popover.dataset.positioned = "true";
    };
    const scheduleUpdate = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("scroll", scheduleUpdate, true);

    const resizeObserver = typeof ResizeObserver === "function" ? new ResizeObserver(scheduleUpdate) : null;
    resizeObserver?.observe(popover);

    const mutationObserver = typeof MutationObserver === "function" ? new MutationObserver(scheduleUpdate) : null;
    mutationObserver?.observe(popover, { childList: true, characterData: true, subtree: true });
    const stopObservingComputedStyles = observeComputedStyleChanges(root, scheduleUpdate, {
      ignoredMutationRoot: popover,
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("scroll", scheduleUpdate, true);
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      stopObservingComputedStyles();
      popover.removeAttribute("data-positioned");
    };
  }, [open, placement, popoverRef, rootRef]);
}

interface FieldBaseProps {
  label: ReactNode;
  required?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  className?: string;
}

export type FieldProps = FieldBaseProps & (
  | { group: true; htmlFor?: string }
  | { group?: false; htmlFor: string }
);

export function Field({ label, htmlFor, group = false, required, hint, error, children, className }: FieldProps) {
  const generatedId = useId();
  if (!group && (!htmlFor || !htmlFor.trim())) {
    throw new TypeError("Field htmlFor must be a non-empty string unless group is true.");
  }
  const fieldId = htmlFor?.trim() || generatedId;
  const invalid = Boolean(error);
  const describedBy = invalid
    ? `${fieldId}-error`
    : hint ? `${fieldId}-hint` : undefined;
  const context = useMemo<FieldContextValue>(() => ({
    controlId: group ? undefined : fieldId,
    groupName: group ? fieldId : undefined,
    describedBy,
    invalid,
    required: Boolean(required),
    group,
  }), [describedBy, fieldId, group, invalid, required]);

  const labelContent = (
    <>
      <span>{label}</span>
      {required ? <span className="pui-label__required">必填</span> : null}
    </>
  );
  const messages = (
    <>
      {error ? <div id={`${fieldId}-error`} className="pui-field__error" role="alert">{error}</div> : null}
      {!error && hint ? <div id={`${fieldId}-hint`} className="pui-field__hint">{hint}</div> : null}
    </>
  );

  if (group) {
    return (
      <fieldset
        className={cx("pui-field", "pui-field--group", className)}
        data-invalid={invalid || undefined}
        data-pui-owner="Field"
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
      >
        <legend className="pui-label">{labelContent}</legend>
        <FieldContext.Provider value={context}>{children}</FieldContext.Provider>
        {messages}
      </fieldset>
    );
  }

  return (
    <div className={cx("pui-field", className)} data-invalid={invalid || undefined} data-pui-owner="Field">
      <label className="pui-label" htmlFor={fieldId}>{labelContent}</label>
      <FieldContext.Provider value={context}>{children}</FieldContext.Provider>
      {messages}
    </div>
  );
}

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  startAdornment?: ReactNode;
  endAdornment?: ReactNode;
  invalid?: boolean;
  "data-pui-owner"?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    startAdornment,
    endAdornment,
    invalid,
    className,
    id,
    required,
    readOnly,
    "aria-disabled": ariaDisabled,
    "aria-describedby": ariaDescribedBy,
    "aria-invalid": ariaInvalid,
    "data-pui-owner": owner = "Input",
    onChange,
    onClick,
    onKeyDown,
    ...props
  },
  ref,
) {
  const fieldControl = useFieldControl(id, ariaDescribedBy, invalid ? true : ariaInvalid, required);
  const isInvalid = fieldControl.fieldInvalid || invalid || fieldControl.invalid === true || fieldControl.invalid === "true";
  const interactionDisabled = isAriaTrue(ariaDisabled);
  if (!startAdornment && !endAdornment) {
    return (
      <input
        {...props}
        ref={ref}
        id={fieldControl.id}
        required={Boolean(fieldControl.required)}
        readOnly={Boolean(readOnly || interactionDisabled)}
        className={cx("pui-input", className)}
        aria-disabled={ariaDisabled}
        aria-describedby={fieldControl.describedBy}
        aria-invalid={fieldControl.invalid}
        data-pui-owner={owner}
        onChange={(event) => {
          if (interactionDisabled) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          onChange?.(event);
        }}
        onClick={(event) => {
          if (interactionDisabled) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          onClick?.(event);
        }}
        onKeyDown={(event) => {
          if (interactionDisabled && event.key !== "Tab") {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          onKeyDown?.(event);
        }}
      />
    );
  }
  return (
    <span className={cx("pui-input-shell", isInvalid && "is-invalid", className)} data-pui-owner={owner}>
      {startAdornment ? <span className="pui-input-shell__start">{startAdornment}</span> : null}
      <input
        {...props}
        ref={ref}
        id={fieldControl.id}
        required={Boolean(fieldControl.required)}
        readOnly={Boolean(readOnly || interactionDisabled)}
        className="pui-input pui-input--embedded"
        aria-disabled={ariaDisabled}
        aria-describedby={fieldControl.describedBy}
        aria-invalid={fieldControl.invalid}
        onChange={(event) => {
          if (interactionDisabled) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          onChange?.(event);
        }}
        onClick={(event) => {
          if (interactionDisabled) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          onClick?.(event);
        }}
        onKeyDown={(event) => {
          if (interactionDisabled && event.key !== "Tab") {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          onKeyDown?.(event);
        }}
      />
      {endAdornment ? <span className="pui-input-shell__end">{endAdornment}</span> : null}
    </span>
  );
});

export interface PasswordInputProps extends Omit<InputProps, "type" | "endAdornment"> {
  showLabel?: string;
  hideLabel?: string;
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(function PasswordInput(
  {
    showLabel = "显示密码",
    hideLabel = "隐藏密码",
    disabled,
    "aria-disabled": ariaDisabled,
    ...props
  },
  ref,
) {
  const [visible, setVisible] = useState(false);
  const interactionDisabled = isAriaTrue(ariaDisabled);
  return (
    <Input
      {...props}
      data-pui-owner="PasswordInput"
      ref={ref}
      disabled={disabled}
      aria-disabled={ariaDisabled}
      type={visible ? "text" : "password"}
      endAdornment={(
        <button
          type="button"
          className="pui-input-action"
          aria-label={visible ? hideLabel : showLabel}
          aria-pressed={visible}
          disabled={disabled}
          aria-disabled={interactionDisabled || undefined}
          onClick={(event) => {
            if (interactionDisabled) {
              event.preventDefault();
              event.stopPropagation();
              return;
            }
            setVisible((current) => !current);
          }}
        >
          {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        </button>
      )}
    />
  );
});

export interface SearchInputProps extends Omit<InputProps, "type" | "startAdornment" | "endAdornment"> {
  value: string;
  onClear?: () => void;
  clearLabel?: string;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
  {
    value,
    onClear,
    clearLabel = "清除搜索",
    className,
    disabled,
    readOnly,
    "aria-disabled": ariaDisabled,
    ...props
  },
  ref,
) {
  const interactionDisabled = isAriaTrue(ariaDisabled);
  return (
    <Input
      {...props}
      data-pui-owner="SearchInput"
      ref={ref}
      type="search"
      value={value}
      className={className}
      disabled={disabled}
      readOnly={readOnly}
      aria-disabled={ariaDisabled}
      startAdornment={<Search aria-hidden="true" />}
      endAdornment={onClear ? (
        <button
          type="button"
          className="pui-input-action"
          aria-label={clearLabel}
          aria-hidden={!value}
          tabIndex={value ? 0 : -1}
          data-visible={Boolean(value) || undefined}
          disabled={disabled || readOnly}
          aria-disabled={interactionDisabled || undefined}
          onClick={(event) => {
            if (interactionDisabled) {
              event.preventDefault();
              event.stopPropagation();
              return;
            }
            const input = event.currentTarget.closest(".pui-input-shell")?.querySelector<HTMLInputElement>("input");
            onClear();
            input?.focus();
          }}
        >
          <X aria-hidden="true" />
        </button>
      ) : undefined}
    />
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({
    className,
    id,
    required,
    readOnly,
    "aria-disabled": ariaDisabled,
    "aria-describedby": ariaDescribedBy,
    "aria-invalid": ariaInvalid,
    onChange,
    onClick,
    onKeyDown,
    ...props
  }, ref) {
    const fieldControl = useFieldControl(id, ariaDescribedBy, ariaInvalid, required);
    const interactionDisabled = isAriaTrue(ariaDisabled);
    return (
      <textarea
        {...props}
        ref={ref}
        id={fieldControl.id}
        required={Boolean(fieldControl.required)}
        readOnly={Boolean(readOnly || interactionDisabled)}
        className={cx("pui-textarea", className)}
        aria-disabled={ariaDisabled}
        aria-describedby={fieldControl.describedBy}
        aria-invalid={fieldControl.invalid}
        data-pui-owner="Textarea"
        onChange={(event) => {
          if (interactionDisabled) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          onChange?.(event);
        }}
        onClick={(event) => {
          if (interactionDisabled) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          onClick?.(event);
        }}
        onKeyDown={(event) => {
          if (interactionDisabled && event.key !== "Tab") {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          onKeyDown?.(event);
        }}
      />
    );
  },
);

export interface SelectOption {
  value: string;
  label: ReactNode;
  leading?: ReactNode;
  disabled?: boolean;
  textValue?: string;
}

export interface SelectProps extends FieldControlAriaProps {
  options: readonly SelectOption[];
  value?: string;
  onValueChange: (value: string) => void;
  ariaLabel: string;
  placeholder?: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  placement?: "bottom" | "top";
  className?: string;
}

function selectOptionText(option: SelectOption): string {
  if (option.textValue) return option.textValue;
  if (typeof option.label === "string" || typeof option.label === "number") return String(option.label);
  return option.value;
}

export function Select({
  options,
  value,
  onValueChange,
  ariaLabel,
  placeholder = "请选择",
  disabled,
  loading = false,
  loadingLabel = "正在加载",
  placement = "bottom",
  className,
  id: providedId,
  "aria-disabled": ariaDisabled,
  "aria-required": ariaRequired,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
}: SelectProps) {
  assertUniqueIdentities("Select", "option.value", options.map((option) => option.value), { allowEmpty: true });
  const generatedId = useId();
  const fieldControl = useFieldControl(providedId, ariaDescribedBy, ariaInvalid, ariaRequired);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const typeaheadRef = useRef("");
  const typeaheadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const hasLeading = options.some((option) => option.leading != null);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const [activeValue, setActiveValue] = useState<string | null>(() => (
    selectedIndex >= 0 && !options[selectedIndex].disabled
      ? options[selectedIndex].value
      : options[firstEnabledIndex(options)]?.value ?? null
  ));
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;
  const interactionDisabled = ariaDisabled === true || ariaDisabled === "true" || loading;
  const unavailable = Boolean(disabled || interactionDisabled || options.length === 0);
  const triggerAriaLabel = selected
    ? `${ariaLabel}，当前值：${selectOptionText(selected)}`
    : `${ariaLabel}，未选择`;
  const resolvedTriggerAriaLabel = loading
    ? `${triggerAriaLabel}，${loadingLabel}`
    : triggerAriaLabel;
  const preferredActiveValue = selectedIndex >= 0 && !options[selectedIndex].disabled
    ? options[selectedIndex].value
    : options[firstEnabledIndex(options)]?.value ?? null;
  const activeIndex = options.findIndex((option) => option.value === activeValue);
  const activeOptionIsValid = activeIndex >= 0
    && activeIndex < options.length
    && !options[activeIndex].disabled;
  usePopoverPosition(open, placement, rootRef, popoverRef);

  useEffect(() => {
    setPortalTarget(document.body);
  }, []);

  const openMenu = () => {
    if (unavailable) return;
    setActiveValue(preferredActiveValue);
    setOpen(true);
  };

  const closeMenu = (restoreFocus = false) => {
    if (restoreFocus) triggerRef.current?.focus();
    setOpen(false);
  };

  const moveActive = (direction: 1 | -1) => {
    setActiveValue((current) => {
      const currentIndex = options.findIndex((option) => option.value === current);
      const nextIndex = nextEnabledIndex(options, currentIndex, direction);
      return options[nextIndex]?.value ?? null;
    });
  };

  const choose = (index: number) => {
    const option = options[index];
    if (unavailable || !option || option.disabled) return;
    if (option.value !== value) onValueChange(option.value);
    closeMenu(true);
  };

  useEffect(() => {
    if (!open) return;
    const handlePointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !popoverRef.current?.contains(target)) closeMenu();
    };
    document.addEventListener("mousedown", handlePointer);
    return () => document.removeEventListener("mousedown", handlePointer);
  }, [open]);

  useEffect(() => {
    if (unavailable) setOpen(false);
    if (!options.length) setActiveValue(null);
  }, [options.length, unavailable]);

  useEffect(() => {
    if (open && !activeOptionIsValid && activeValue !== preferredActiveValue) {
      setActiveValue(preferredActiveValue);
    }
  }, [activeOptionIsValid, activeValue, open, preferredActiveValue]);

  useEffect(() => {
    if (!open || !activeOptionIsValid) return;
    optionRefs.current[activeIndex]?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeIndex, activeOptionIsValid, open, options]);

  useEffect(() => () => {
    if (typeaheadTimerRef.current) clearTimeout(typeaheadTimerRef.current);
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (unavailable) return;
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (event.key === "Escape" && open) {
      event.preventDefault();
      closeMenu(true);
      return;
    }
    if (event.key === "Tab") {
      closeMenu();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        openMenu();
      } else {
        moveActive(event.key === "ArrowDown" ? 1 : -1);
      }
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      if (!open) openMenu();
      const edgeIndex = firstEnabledIndex(options, event.key === "End");
      setActiveValue(options[edgeIndex]?.value ?? null);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (open) choose(activeIndex);
      else openMenu();
      return;
    }
    if (event.key.length !== 1 || event.altKey || event.ctrlKey || event.metaKey) return;
    const character = event.key.toLocaleLowerCase();
    const previousBuffer = typeaheadRef.current;
    const nextBuffer = `${previousBuffer}${character}`;
    const repeatedCharacter = previousBuffer.length > 0
      && Array.from(previousBuffer).every((entry) => entry === character);
    const searchText = repeatedCharacter ? character : nextBuffer;
    typeaheadRef.current = nextBuffer;
    if (typeaheadTimerRef.current) clearTimeout(typeaheadTimerRef.current);
    typeaheadTimerRef.current = setTimeout(() => { typeaheadRef.current = ""; }, 500);
    const currentIndex = open ? activeIndex : selectedIndex;
    let matchIndex = -1;
    for (let offset = 1; offset <= options.length; offset += 1) {
      const index = (Math.max(currentIndex, -1) + offset) % options.length;
      const option = options[index];
      if (!option.disabled && selectOptionText(option).toLocaleLowerCase().startsWith(searchText)) {
        matchIndex = index;
        break;
      }
    }
    if (matchIndex >= 0) {
      event.preventDefault();
      if (open) setActiveValue(options[matchIndex].value);
      else choose(matchIndex);
    }
  };

  const menu = open ? (
    <div
      ref={popoverRef}
      id={`${generatedId}-listbox`}
      className="pui-select__popover pui-portal"
      role="listbox"
      aria-label={ariaLabel}
      data-pui-floating-root="true"
      data-has-leading={hasLeading || undefined}
    >
      {options.map((option, index) => (
        <button
          ref={(node) => { optionRefs.current[index] = node; }}
          id={`${generatedId}-option-${index}`}
          key={option.value}
          type="button"
          role="option"
          className="pui-select__option"
          aria-selected={option.value === value}
          data-active={activeOptionIsValid && option.value === activeValue || undefined}
          disabled={option.disabled}
          tabIndex={-1}
          onMouseMove={() => {
            if (!option.disabled && activeValue !== option.value) setActiveValue(option.value);
          }}
          onClick={() => choose(index)}
        >
          {hasLeading ? <span className="pui-option__leading" aria-hidden="true">{option.leading ?? null}</span> : null}
          <span className="pui-select__option-label">{option.label}</span>
          <Check aria-hidden="true" />
        </button>
      ))}
    </div>
  ) : null;

  return (
    <div
      ref={rootRef}
      className={cx("pui-select-shell", className)}
      data-open={open || undefined}
      data-placement={placement}
      data-has-leading={hasLeading || undefined}
      data-loading={loading || undefined}
      data-pui-owner="Select"
    >
      <button
        ref={triggerRef}
        id={fieldControl.id}
        type="button"
        className="pui-select"
        role="combobox"
        aria-label={resolvedTriggerAriaLabel}
        aria-describedby={fieldControl.describedBy}
        aria-invalid={fieldControl.invalid}
        aria-required={fieldControl.required || undefined}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${generatedId}-listbox` : undefined}
        aria-activedescendant={open && activeOptionIsValid ? `${generatedId}-option-${activeIndex}` : undefined}
        aria-busy={loading || undefined}
        disabled={Boolean(disabled || options.length === 0)}
        aria-disabled={interactionDisabled || undefined}
        onClick={() => {
          if (unavailable) return;
          if (open) closeMenu();
          else openMenu();
        }}
        onKeyDown={handleKeyDown}
      >
        <span className="pui-select__value">
          {hasLeading ? <span className="pui-option__leading" aria-hidden="true">{selected?.leading ?? null}</span> : null}
          <span>{selected?.label ?? placeholder}</span>
        </span>
        <span className="pui-select__indicator" aria-hidden="true">
          {loading ? <LoaderCircle className="pui-spinner" /> : <ChevronDown />}
        </span>
      </button>
      {menu && portalTarget ? createPortal(menu, portalTarget) : menu}
    </div>
  );
}

export interface ComboboxOption {
  value: string;
  label: string;
  description?: string;
  leading?: ReactNode;
  searchText?: string;
  disabled?: boolean;
}

export interface ComboboxProps extends FieldControlAriaProps {
  options: readonly ComboboxOption[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  ariaLabel: string;
  disabled?: boolean;
  placement?: "bottom" | "top";
  className?: string;
}

export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = "请选择",
  searchPlaceholder = "搜索选项",
  emptyText = "没有匹配选项",
  ariaLabel,
  disabled,
  placement = "bottom",
  className,
  id: providedId,
  "aria-disabled": ariaDisabled,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  "aria-required": ariaRequired,
}: ComboboxProps) {
  assertUniqueIdentities("Combobox", "option.value", options.map((option) => option.value), { allowEmpty: true });
  const generatedId = useId();
  const fieldControl = useFieldControl(providedId, ariaDescribedBy, ariaInvalid, ariaRequired);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const hasLeading = options.some((option) => option.leading != null);
  const [activeValue, setActiveValue] = useState<string | null>(() => {
    const initialSelectedIndex = options.findIndex((option) => option.value === value);
    return initialSelectedIndex >= 0 && !options[initialSelectedIndex].disabled
      ? options[initialSelectedIndex].value
      : options[firstEnabledIndex(options)]?.value ?? null;
  });
  const selected = options.find((option) => option.value === value);
  const triggerAriaLabel = selected
    ? `${ariaLabel}，当前值：${selected.label}`
    : `${ariaLabel}，未选择`;
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return options;
    return options.filter((option) => `${option.label} ${option.description ?? ""} ${option.searchText ?? ""}`.toLocaleLowerCase().includes(needle));
  }, [options, query]);
  const filteredSelectedIndex = filtered.findIndex((option) => option.value === value);
  const preferredActiveValue = filteredSelectedIndex >= 0 && !filtered[filteredSelectedIndex].disabled
    ? filtered[filteredSelectedIndex].value
    : filtered[firstEnabledIndex(filtered)]?.value ?? null;
  const activeIndex = filtered.findIndex((option) => option.value === activeValue);
  const activeOptionIsValid = activeIndex >= 0
    && activeIndex < filtered.length
    && !filtered[activeIndex].disabled;
  const interactionDisabled = ariaDisabled === true || ariaDisabled === "true";
  const menuOpen = open && !disabled && !interactionDisabled;
  usePopoverPosition(menuOpen, placement, rootRef, popoverRef);

  useEffect(() => {
    setPortalTarget(document.body);
  }, []);

  const openMenu = () => {
    if (disabled || interactionDisabled) return;
    const selectedIndex = options.findIndex((option) => option.value === value);
    setQuery("");
    setActiveValue(
      selectedIndex >= 0 && !options[selectedIndex].disabled
        ? options[selectedIndex].value
        : options[firstEnabledIndex(options)]?.value ?? null,
    );
    setOpen(true);
  };

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    if (disabled || interactionDisabled) return;
    openMenu();
    if (event.key === "ArrowUp") {
      const lastIndex = firstEnabledIndex(options, true);
      setActiveValue(options[lastIndex]?.value ?? null);
    }
  };

  const closeMenu = (restoreFocus = false) => {
    if (restoreFocus) triggerRef.current?.focus();
    setOpen(false);
  };

  useEffect(() => {
    if (!menuOpen) return;
    const handlePointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !popoverRef.current?.contains(target)) closeMenu();
    };
    document.addEventListener("mousedown", handlePointer);
    return () => document.removeEventListener("mousedown", handlePointer);
  }, [menuOpen]);

  useClientLayoutEffect(() => {
    if (!menuOpen) return;
    searchRef.current?.focus();
  }, [menuOpen]);

  useClientLayoutEffect(() => {
    if (!open || (!disabled && !interactionDisabled)) return;
    setOpen(false);
    if (!disabled && interactionDisabled) triggerRef.current?.focus();
  }, [disabled, interactionDisabled, open]);

  useEffect(() => {
    if (menuOpen && !activeOptionIsValid && activeValue !== preferredActiveValue) {
      setActiveValue(preferredActiveValue);
    }
  }, [activeOptionIsValid, activeValue, menuOpen, preferredActiveValue]);

  useEffect(() => {
    if (!menuOpen || !activeOptionIsValid) return;
    optionRefs.current[activeIndex]?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeIndex, activeOptionIsValid, filtered, menuOpen]);

  const choose = (option: ComboboxOption) => {
    if (disabled || interactionDisabled || option.disabled) return;
    if (option.value !== value) onValueChange(option.value);
    closeMenu(true);
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (disabled || interactionDisabled) {
      event.preventDefault();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu(true);
      return;
    }
    if (event.key === "Tab") {
      event.preventDefault();
      closeMenu();
      const trigger = triggerRef.current;
      const root = rootRef.current;
      if (trigger && root) {
        window.requestAnimationFrame(() => focusAdjacentTabStop(trigger, root, event.shiftKey));
      }
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setActiveValue((current) => {
        const currentIndex = filtered.findIndex((option) => option.value === current);
        const nextIndex = nextEnabledIndex(filtered, currentIndex, direction);
        return filtered[nextIndex]?.value ?? null;
      });
      return;
    }
    if (event.key === "PageUp" || event.key === "PageDown") {
      event.preventDefault();
      const edgeIndex = firstEnabledIndex(filtered, event.key === "PageDown");
      setActiveValue(filtered[edgeIndex]?.value ?? null);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (activeOptionIsValid) choose(filtered[activeIndex]);
    }
  };

  const menu = menuOpen ? (
    <div ref={popoverRef} className="pui-combobox__popover pui-portal" data-pui-floating-root="true">
      <div className="pui-combobox__search">
        <Search aria-hidden="true" />
        <input
          ref={searchRef}
          value={query}
          role="combobox"
          aria-label={`搜索${ariaLabel}`}
          aria-autocomplete="list"
          aria-expanded="true"
          aria-controls={`${generatedId}-listbox`}
          aria-activedescendant={activeOptionIsValid ? `${generatedId}-option-${activeIndex}` : undefined}
          aria-describedby={mergeAriaIds(fieldControl.describedBy, !filtered.length ? `${generatedId}-empty` : undefined)}
          aria-invalid={fieldControl.invalid}
          aria-required={fieldControl.required || undefined}
          placeholder={searchPlaceholder}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            if (disabled || interactionDisabled) return;
            const nextQuery = event.target.value;
            const needle = nextQuery.trim().toLocaleLowerCase();
            const nextOptions = needle
              ? options.filter((option) => (
                `${option.label} ${option.description ?? ""} ${option.searchText ?? ""}`
                  .toLocaleLowerCase()
                  .includes(needle)
              ))
              : options;
            setQuery(nextQuery);
            const firstIndex = firstEnabledIndex(nextOptions);
            setActiveValue(nextOptions[firstIndex]?.value ?? null);
          }}
          onKeyDown={handleSearchKeyDown}
        />
      </div>
      <div id={`${generatedId}-listbox`} className="pui-combobox__list" role="listbox" aria-label={ariaLabel}>
        {filtered.map((option, index) => (
          <button
            ref={(node) => { optionRefs.current[index] = node; }}
            id={`${generatedId}-option-${index}`}
            key={option.value}
            type="button"
            role="option"
            className="pui-option"
            aria-selected={option.value === value}
            data-active={activeOptionIsValid && option.value === activeValue || undefined}
            disabled={option.disabled}
            tabIndex={-1}
            onMouseMove={() => {
              if (!disabled && !interactionDisabled && !option.disabled && activeValue !== option.value) {
                setActiveValue(option.value);
              }
            }}
            onClick={() => choose(option)}
          >
            {hasLeading ? <span className="pui-option__leading" aria-hidden="true">{option.leading ?? null}</span> : null}
            <span className="pui-option__copy">
              <strong>{option.label}</strong>
              {option.description ? <span>{option.description}</span> : null}
            </span>
            <Check className="pui-option__check" aria-hidden="true" />
          </button>
        ))}
        {!filtered.length ? (
          <div
            id={`${generatedId}-empty`}
            className="pui-combobox__empty"
            role="status"
            aria-live="polite"
          >
            {emptyText}
          </div>
        ) : null}
      </div>
    </div>
  ) : null;

  return (
    <div
      ref={rootRef}
      className={cx("pui-combobox", className)}
      data-open={menuOpen || undefined}
      data-placement={placement}
      data-has-leading={hasLeading || undefined}
      data-pui-owner="Combobox"
    >
      <button
        ref={triggerRef}
        id={fieldControl.id}
        type="button"
        className="pui-combobox__trigger"
        role={menuOpen ? undefined : "combobox"}
        aria-label={triggerAriaLabel}
        aria-describedby={fieldControl.describedBy}
        aria-invalid={fieldControl.invalid}
        aria-required={!menuOpen && fieldControl.required || undefined}
        aria-haspopup="listbox"
        aria-expanded={menuOpen}
        aria-controls={menuOpen ? `${generatedId}-listbox` : undefined}
        disabled={disabled}
        aria-disabled={interactionDisabled || undefined}
        onClick={() => {
          if (disabled || interactionDisabled) return;
          if (menuOpen) closeMenu();
          else openMenu();
        }}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className="pui-combobox__value">
          {hasLeading ? <span className="pui-option__leading" aria-hidden="true">{selected?.leading ?? null}</span> : null}
          <span>{selected?.label ?? placeholder}</span>
        </span>
        <ChevronDown aria-hidden="true" />
      </button>
      {menu && portalTarget ? createPortal(menu, portalTarget) : menu}
    </div>
  );
}

interface ChoiceProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "readOnly"> {
  label: ReactNode;
}

export function Checkbox({
  label,
  className,
  id,
  required,
  disabled,
  "aria-disabled": ariaDisabled,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  "aria-required": ariaRequired,
  onChange,
  onClick,
  onKeyDown,
  ...props
}: ChoiceProps) {
  const fieldControl = useFieldControl(id, ariaDescribedBy, ariaInvalid, required);
  const interactionDisabled = isAriaTrue(ariaDisabled);
  const resolvedRequired = fieldControl.group
    ? Boolean(required)
    : fieldControl.required === true || fieldControl.required === "true";
  const resolvedAriaRequired = fieldControl.group
    ? Boolean(required || ariaRequired === true || ariaRequired === "true")
    : Boolean(resolvedRequired || ariaRequired === true || ariaRequired === "true");
  return (
    <label className={cx("pui-choice", className)} data-pui-owner="Checkbox">
      <input
        {...props}
        id={fieldControl.id}
        type="checkbox"
        disabled={disabled}
        aria-disabled={interactionDisabled || undefined}
        required={resolvedRequired}
        aria-required={resolvedAriaRequired || undefined}
        aria-describedby={fieldControl.describedBy}
        aria-invalid={fieldControl.invalid}
        onChange={(event) => {
          if (interactionDisabled) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          onChange?.(event);
        }}
        onClick={(event) => {
          if (interactionDisabled) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          onClick?.(event);
        }}
        onKeyDown={(event) => {
          if (interactionDisabled && event.key !== "Tab") {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          onKeyDown?.(event);
        }}
      />
      <span>{label}</span>
    </label>
  );
}

export function Radio({
  label,
  className,
  id,
  name,
  required,
  disabled,
  "aria-disabled": ariaDisabled,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  "aria-required": ariaRequired,
  onChange,
  onClick,
  onKeyDown,
  ...props
}: ChoiceProps) {
  const fieldControl = useFieldControl(id, ariaDescribedBy, ariaInvalid, required);
  const interactionDisabled = isAriaTrue(ariaDisabled);
  const resolvedRequired = fieldControl.required === true || fieldControl.required === "true";
  const resolvedAriaRequired = Boolean(
    resolvedRequired || ariaRequired === true || ariaRequired === "true",
  );
  return (
    <label className={cx("pui-choice", className)} data-pui-owner="Radio">
      <input
        {...props}
        id={fieldControl.id}
        type="radio"
        name={name ?? fieldControl.groupName}
        disabled={disabled}
        aria-disabled={interactionDisabled || undefined}
        required={resolvedRequired}
        aria-required={resolvedAriaRequired || undefined}
        aria-describedby={fieldControl.describedBy}
        aria-invalid={fieldControl.invalid}
        onChange={(event) => {
          if (interactionDisabled) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          onChange?.(event);
        }}
        onClick={(event) => {
          if (interactionDisabled) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          onClick?.(event);
        }}
        onKeyDown={(event) => {
          if (interactionDisabled && event.key !== "Tab") {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          onKeyDown?.(event);
        }}
      />
      <span>{label}</span>
    </label>
  );
}

export function Switch({
  label,
  className,
  id,
  required,
  disabled,
  "aria-disabled": ariaDisabled,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  "aria-required": ariaRequired,
  onChange,
  onClick,
  onKeyDown,
  ...props
}: ChoiceProps) {
  const fieldControl = useFieldControl(id, ariaDescribedBy, ariaInvalid, required);
  const interactionDisabled = isAriaTrue(ariaDisabled);
  const resolvedRequired = fieldControl.group
    ? Boolean(required)
    : fieldControl.required === true || fieldControl.required === "true";
  const resolvedAriaRequired = fieldControl.group
    ? Boolean(required || ariaRequired === true || ariaRequired === "true")
    : Boolean(resolvedRequired || ariaRequired === true || ariaRequired === "true");
  return (
    <label className={cx("pui-switch", className)} data-pui-owner="Switch">
      <input
        {...props}
        id={fieldControl.id}
        type="checkbox"
        role="switch"
        disabled={disabled}
        aria-disabled={interactionDisabled || undefined}
        required={resolvedRequired}
        aria-required={resolvedAriaRequired || undefined}
        aria-describedby={fieldControl.describedBy}
        aria-invalid={fieldControl.invalid}
        onChange={(event) => {
          if (interactionDisabled) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          onChange?.(event);
        }}
        onClick={(event) => {
          if (interactionDisabled) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          onClick?.(event);
        }}
        onKeyDown={(event) => {
          if (interactionDisabled && event.key !== "Tab") {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
          onKeyDown?.(event);
        }}
      />
      <span className="pui-switch__track" aria-hidden="true"><span /></span>
      <span>{label}</span>
    </label>
  );
}

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string> {
  value: T;
  options: SegmentedOption<T>[];
  onValueChange: (value: T) => void;
  ariaLabel: string;
  disabled?: boolean;
  fill?: boolean | "mobile";
  className?: string;
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onValueChange,
  ariaLabel,
  disabled = false,
  fill = false,
  className,
}: SegmentedControlProps<T>) {
  assertUniqueIdentities("SegmentedControl", "option.value", options.map((option) => option.value), { allowEmpty: true });
  if (options.length > 0 && !options.some((option) => option.value === value)) {
    throw new RangeError(
      `SegmentedControl received value ${JSON.stringify(value)}, but no option has that value.`,
    );
  }
  return (
    <div
      className={cx(
        "pui-segmented",
        fill === true && "pui-segmented--fill",
        fill === "mobile" && "pui-segmented--mobile-fill",
        className,
      )}
      role="group"
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      data-pui-owner="SegmentedControl"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          title={typeof option.label === "string" || typeof option.label === "number" ? String(option.label) : undefined}
          disabled={disabled || option.disabled}
          onClick={() => {
            if (option.value !== value) onValueChange(option.value);
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
