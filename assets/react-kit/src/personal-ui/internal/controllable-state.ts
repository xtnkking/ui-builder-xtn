import {
  useCallback,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

export interface ControllableStateOptions<Value> {
  componentName: string;
  controlled: boolean;
  controlledOnly?: boolean;
  value: Value | undefined;
  defaultValue: Value;
  defaultValueProvided: boolean;
  onChange?: (value: Value) => void;
  valuePropName?: string;
  defaultValuePropName?: string;
  changePropName?: string;
}

export interface ControllableModeOptions {
  componentName: string;
  controlled: boolean;
  controlledOnly?: boolean;
  defaultValueProvided: boolean;
  onChangeProvided: boolean;
  valuePropName?: string;
  defaultValuePropName?: string;
  changePropName?: string;
}

export type ControllableStateResult<Value> = [
  Value,
  Dispatch<SetStateAction<Value>>,
  () => void,
];

function developmentChecksEnabled(): boolean {
  const processValue = (
    globalThis as typeof globalThis & {
      process?: { env?: { NODE_ENV?: string } };
    }
  ).process;
  return processValue?.env?.NODE_ENV !== "production";
}

export function useControllableMode({
  componentName,
  controlled,
  controlledOnly = false,
  defaultValueProvided,
  onChangeProvided,
  valuePropName = "value",
  defaultValuePropName = "defaultValue",
  changePropName = "onValueChange",
}: ControllableModeOptions): void {
  const initialMode = useRef(controlled ? "controlled" : "uncontrolled");

  if (!developmentChecksEnabled()) return;
  if (controlledOnly && !controlled) {
    throw new Error(
      `${componentName} requires ${valuePropName}; uncontrolled mode is not supported.`,
    );
  }
  if (controlled && defaultValueProvided) {
    throw new Error(
      `${componentName} cannot receive both ${valuePropName} and ${defaultValuePropName}.`,
    );
  }
  if (controlled && !onChangeProvided) {
    throw new Error(
      `${componentName} requires ${changePropName} when ${valuePropName} is controlled.`,
    );
  }
  const currentMode = controlled ? "controlled" : "uncontrolled";
  if (initialMode.current !== currentMode) {
    throw new Error(
      `${componentName} cannot switch from ${initialMode.current} to ${currentMode} mode after mounting.`,
    );
  }
}

export function useControllableState<Value>({
  componentName,
  controlled,
  controlledOnly = false,
  value,
  defaultValue,
  defaultValueProvided,
  onChange,
  valuePropName = "value",
  defaultValuePropName = "defaultValue",
  changePropName = "onValueChange",
}: ControllableStateOptions<Value>): ControllableStateResult<Value> {
  useControllableMode({
    componentName,
    controlled,
    controlledOnly,
    defaultValueProvided,
    onChangeProvided: typeof onChange === "function",
    valuePropName,
    defaultValuePropName,
    changePropName,
  });
  const [internalValue, setInternalValue] = useState(defaultValue);
  const resolvedValue = controlled ? value as Value : internalValue;
  const currentValue = useRef(resolvedValue);
  currentValue.current = resolvedValue;

  const setValue = useCallback<Dispatch<SetStateAction<Value>>>((nextValue) => {
    const resolvedNext = typeof nextValue === "function"
      ? (nextValue as (current: Value) => Value)(currentValue.current)
      : nextValue;
    if (!controlled) {
      currentValue.current = resolvedNext;
      setInternalValue(resolvedNext);
    }
    onChange?.(resolvedNext);
  }, [controlled, onChange]);

  const resetValue = useCallback(() => {
    if (controlled) {
      onChange?.(defaultValue);
      return;
    }
    currentValue.current = defaultValue;
    setInternalValue(defaultValue);
  }, [controlled, defaultValue, onChange]);

  return [resolvedValue, setValue, resetValue];
}
