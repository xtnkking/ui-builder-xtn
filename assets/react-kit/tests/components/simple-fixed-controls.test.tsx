// @personal-ui-coverage {"kind":"unit","runner":"components","exports":["Skeleton","Spinner","Tag"]}
import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  Skeleton,
  Spinner,
  Tag,
  type SkeletonProps,
  type SpinnerProps,
  type TagProps,
} from "../../src/personal-ui";

function escapedProps(testId: string, onMouseEnter: () => void) {
  return {
    className: "foreign-control",
    style: { color: "red", background: "magenta" },
    css: "foreign-css",
    sx: "foreign-sx",
    tw: "foreign-tw",
    dangerouslySetInnerHTML: { __html: "<b>unsafe</b>" },
    "data-pui-owner": "Consumer",
    "data-pui-slot": "foreign",
    "data-testid": testId,
    "data-track": "preserved",
    "aria-label": `${testId} label`,
    children: "Injected child",
    onMouseEnter,
  };
}

function expectEscapePropsRemoved(element: HTMLElement, owner: string) {
  expect(element).not.toHaveClass("foreign-control");
  expect(element).not.toHaveAttribute("css");
  expect(element).not.toHaveAttribute("sx");
  expect(element).not.toHaveAttribute("tw");
  expect(element).not.toHaveAttribute("data-pui-slot");
  expect(element).toHaveAttribute("data-pui-owner", owner);
  expect(element).toHaveAttribute("data-track", "preserved");
}

describe("simple fixed-control contracts", () => {
  it("keeps Spinner ownership closed while preserving public DOM semantics", () => {
    const onMouseEnter = vi.fn();
    const rawProps = { ...escapedProps("spinner", onMouseEnter), label: "Loading accounts" };
    const originalProps = { ...rawProps };

    render(createElement(Spinner, rawProps as unknown as SpinnerProps));

    const spinner = screen.getByTestId("spinner");
    expect(spinner).toHaveClass("pui-spinner-wrap");
    expect(spinner).not.toHaveAttribute("style");
    expect(spinner).toHaveAttribute("aria-label", "spinner label");
    expect(spinner).not.toHaveTextContent("Injected child");
    expectEscapePropsRemoved(spinner, "Spinner");
    fireEvent.mouseEnter(spinner);
    expect(onMouseEnter).toHaveBeenCalledTimes(1);
    expect(rawProps).toEqual(originalProps);
  });

  it("uses only Skeleton's reviewed width prop for internal geometry", () => {
    const onMouseEnter = vi.fn();
    const rawProps = { ...escapedProps("skeleton", onMouseEnter), width: "12rem" };
    const originalProps = { ...rawProps };

    render(createElement(Skeleton, rawProps as unknown as SkeletonProps));

    const skeleton = screen.getByTestId("skeleton");
    expect(skeleton).toHaveClass("pui-skeleton");
    expect(skeleton).toHaveStyle({ width: "100%", maxWidth: "12rem" });
    expect(skeleton).not.toHaveStyle({ color: "red", background: "magenta" });
    expect(skeleton).toHaveAttribute("aria-hidden", "true");
    expect(skeleton).not.toHaveTextContent("Injected child");
    expectEscapePropsRemoved(skeleton, "Skeleton");
    fireEvent.mouseEnter(skeleton);
    expect(onMouseEnter).toHaveBeenCalledTimes(1);
    expect(rawProps).toEqual(originalProps);
  });

  it("keeps Tag styling closed while preserving metadata and removal behavior", () => {
    const onMouseEnter = vi.fn();
    const onRemove = vi.fn();
    const rawProps = {
      ...escapedProps("tag", onMouseEnter),
      tone: "success" as const,
      selected: true,
      onRemove,
      removeLabel: "Remove active status",
    };
    const originalProps = { ...rawProps };

    render(createElement(Tag, rawProps as unknown as TagProps, "Active"));

    const tag = screen.getByTestId("tag");
    expect(tag).toHaveClass("pui-tag", "pui-tag--success", "is-selected");
    expect(tag).not.toHaveAttribute("style");
    expect(tag).toHaveAttribute("aria-label", "tag label");
    expectEscapePropsRemoved(tag, "Tag");
    fireEvent.mouseEnter(tag);
    fireEvent.click(screen.getByRole("button", { name: "Remove active status" }));
    expect(onMouseEnter).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(rawProps).toEqual(originalProps);
  });
});
