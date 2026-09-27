// @personal-ui-coverage {"kind":"unit","runner":"components","exports":["Attachment","Avatar","AvatarGroup","Badge","Card","CodeBlock","DescriptionList","Gallery","List","Media","Meter","Statistic","StatusIndicator","Timeline"]}
import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  Attachment,
  Avatar,
  AvatarGroup,
  Badge,
  Card,
  CodeBlock,
  DescriptionList,
  Gallery,
  List,
  Media,
  Meter,
  Statistic,
  StatusIndicator,
  Timeline,
  type AttachmentProps,
  type AvatarGroupProps,
  type AvatarProps,
  type BadgeProps,
  type CardProps,
  type CodeBlockProps,
  type DescriptionListProps,
  type GalleryProps,
  type ListProps,
  type MediaProps,
  type MeterProps,
  type StatisticProps,
  type StatusIndicatorProps,
  type TimelineProps,
} from "../../src/personal-ui";

function escapedProps(testId: string) {
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
  };
}

function expectClosedRoot(element: HTMLElement, owner: string) {
  expect(element).not.toHaveClass("foreign-control");
  expect(element).not.toHaveStyle({ color: "red", background: "magenta" });
  expect(element).not.toHaveAttribute("css");
  expect(element).not.toHaveAttribute("sx");
  expect(element).not.toHaveAttribute("tw");
  expect(element).not.toHaveAttribute("data-pui-slot");
  expect(element).toHaveAttribute("data-pui-owner", owner);
  expect(element).toHaveAttribute("data-track", "preserved");
}

describe("display fixed-control contracts", () => {
  it("exposes a dot badge label as text without naming a generic span", () => {
    const { container } = render(<Badge dot label="Service online" />);
    const indicator = container.querySelector(".pui-badge__indicator--dot");

    expect(indicator).not.toHaveAttribute("aria-label");
    expect(indicator?.querySelector(".pui-sr-only")).toHaveTextContent("Service online");
  });

  it("filters escape props from every display root", () => {
    render(createElement(List, { ...escapedProps("list"), items: [{ id: "one" }], itemKey: (item: { id: string }) => item.id, renderItem: (item: { id: string }) => item.id } as unknown as ListProps<{ id: string }>));
    render(createElement(DescriptionList, { ...escapedProps("description"), items: [{ id: "one", term: "Name", description: "Northstar" }] } as unknown as DescriptionListProps));
    render(createElement(Card, { ...escapedProps("card"), heading: "Account", children: "Content" } as unknown as CardProps));
    render(createElement(Avatar, { ...escapedProps("avatar"), name: "Ada Lovelace" } as unknown as AvatarProps));
    render(createElement(AvatarGroup, { ...escapedProps("avatar-group"), ariaLabel: "Team", children: createElement(Avatar, { name: "Ada Lovelace" }) } as unknown as AvatarGroupProps));
    render(createElement(Badge, { ...escapedProps("badge"), count: 3, children: "Inbox" } as unknown as BadgeProps));
    render(createElement(StatusIndicator, { ...escapedProps("status"), label: "Active" } as unknown as StatusIndicatorProps));
    render(createElement(Statistic, { ...escapedProps("statistic"), label: "Revenue", value: "42" } as unknown as StatisticProps));
    render(createElement(CodeBlock, { ...escapedProps("code"), code: "const answer = 42;", copyable: false } as unknown as CodeBlockProps));
    render(createElement(Media, { ...escapedProps("media"), src: "/photo.png", alt: "Preview" } as unknown as MediaProps));
    render(createElement(Attachment, { ...escapedProps("attachment"), name: "report.pdf" } as unknown as AttachmentProps));
    render(createElement(Gallery, { ...escapedProps("gallery"), items: [{ id: "one", src: "/photo.png", alt: "Preview" }], ariaLabel: "Gallery" } as unknown as GalleryProps));
    render(createElement(Meter, { ...escapedProps("meter"), label: "Storage", ariaLabel: "Storage used", value: 42 } as unknown as MeterProps));
    render(createElement(Timeline, { ...escapedProps("timeline"), items: [{ id: "one", title: "Created" }] } as unknown as TimelineProps));

    const roots = [
      ["list", "List"],
      ["description", "DescriptionList"],
      ["card", "Card"],
      ["avatar", "Avatar"],
      ["avatar-group", "AvatarGroup"],
      ["badge", "Badge"],
      ["status", "StatusIndicator"],
      ["statistic", "Statistic"],
      ["code", "CodeBlock"],
      ["media", "Media"],
      ["attachment", "Attachment"],
      ["gallery", "Gallery"],
      ["timeline", "Timeline"],
    ] as const;
    roots.forEach(([testId, owner]) => expectClosedRoot(screen.getByTestId(testId), owner));

    const meter = screen.getByTestId("meter");
    expect(meter).not.toHaveClass("foreign-control");
    expect(meter).not.toHaveAttribute("style");
    expect(meter).not.toHaveAttribute("data-pui-owner");
    expect(meter).toHaveAttribute("data-track", "preserved");
    expect(meter.closest('[data-pui-owner="Meter"]')).not.toBeNull();
  });

  it("filters nested Avatar and Media element escape props", () => {
    const nestedEscape = {
      ...escapedProps("nested-image"),
      onMouseEnter: vi.fn(),
    };
    render(
      <Avatar
        name="Ada Lovelace"
        src="/ada.png"
        imageProps={nestedEscape as unknown as NonNullable<AvatarProps["imageProps"]>}
      />,
    );
    const avatarImage = screen.getByTestId("nested-image");
    expect(avatarImage).not.toHaveClass("foreign-control");
    expect(avatarImage).not.toHaveAttribute("style");
    expect(avatarImage).not.toHaveAttribute("data-pui-owner");
    expect(avatarImage).not.toHaveAttribute("data-pui-slot");
    fireEvent.mouseEnter(avatarImage);
    expect(nestedEscape.onMouseEnter).toHaveBeenCalledTimes(1);

    render(
      <Media
        src="/photo.png"
        alt="Preview"
        imageProps={{ ...nestedEscape, "data-testid": "media-image" } as unknown as NonNullable<MediaProps["imageProps"]>}
      />,
    );
    const mediaImage = screen.getByTestId("media-image");
    expect(mediaImage).not.toHaveClass("foreign-control");
    expect(mediaImage).not.toHaveAttribute("style");
    expect(mediaImage).not.toHaveAttribute("data-pui-owner");
    expect(mediaImage).not.toHaveAttribute("data-pui-slot");
  });

  it("keeps Gallery selection interactive while filtering root escape props", () => {
    const onSelect = vi.fn();
    const item = { id: "dashboard", src: "/dashboard.png", alt: "Dashboard" };
    render(
      <Gallery
        {...escapedProps("interactive-gallery") as unknown as GalleryProps}
        items={[item]}
        ariaLabel="Product gallery"
        selectedId={item.id}
        onSelect={onSelect}
      />,
    );

    const option = screen.getByRole("button", { name: "Dashboard" });
    expect(option).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(option);
    expect(onSelect).toHaveBeenCalledWith(item);
    expectClosedRoot(screen.getByTestId("interactive-gallery"), "Gallery");
  });
});
