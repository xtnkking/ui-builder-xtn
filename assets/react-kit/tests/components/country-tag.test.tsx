import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Tag, type TagProps } from "../../src/ui";

describe("country Tag", () => {
  it("normalizes the code and keeps calling data consumer-owned", () => {
    const { container } = render(<Tag country={{ code: " gb ", name: "英国", callingCode: "+44" }} />);
    expect(screen.getByText("GB")).toBeVisible();
    expect(screen.getByText("英国")).toBeVisible();
    expect(screen.getByText("+44")).toBeVisible();
    expect(container.querySelector("img")).toHaveAttribute("src", "https://flagcdn.com/w40/gb.png");
    expect(container.firstChild).toHaveAttribute("title", "GB 英国 +44");
    expect(container.firstChild).toHaveAttribute("data-ui-owner", "Tag");
  });

  it("reserves a decorative fallback through loading and image failure", () => {
    const { container } = render(<Tag country={{ code: "AS", name: "美属萨摩亚" }} />);
    const flag = container.querySelector(".ui-tag__flag")!;
    const img = container.querySelector("img")!;
    expect(flag).toHaveAttribute("data-flag-state", "loading");
    expect(flag).toHaveAttribute("aria-hidden", "true");
    expect(img).toHaveAttribute("alt", "");
    expect(img).not.toBeVisible();
    fireEvent.error(img);
    expect(flag).toHaveAttribute("data-flag-state", "error");
    expect(flag.querySelector("svg")).not.toBeNull();
    expect(container.firstChild).toHaveAttribute("title", "AS 美属萨摩亚");
    expect(container.querySelector(".ui-tag__calling-code")).toBeNull();
  });

  it("resets flag state for new sources and ignores an old detached image", () => {
    const { container, rerender } = render(<Tag country={{ code: "GB", name: "英国" }} />);
    const oldImage = container.querySelector("img")!;
    fireEvent.load(oldImage);
    expect(oldImage).toBeVisible();
    rerender(<Tag country={{ code: "DE", name: "德国", flagSrc: "/flags/de.svg" }} />);
    const image = container.querySelector("img")!;
    expect(image).not.toBe(oldImage);
    expect(image).toHaveAttribute("src", "/flags/de.svg");
    expect(container.querySelector(".ui-tag__flag")).toHaveAttribute("data-flag-state", "loading");
    fireEvent.error(oldImage);
    fireEvent.load(image);
    expect(container.querySelector(".ui-tag__flag")).toHaveAttribute("data-flag-state", "loaded");
    expect(image).toBeVisible();
  });

  it("uses the country identity for removal and keeps selection decoration hidden", () => {
    const remove = vi.fn();
    const { container, rerender } = render(<Tag country={{ code: "GB", name: "英国", callingCode: "+44" }} onRemove={remove} />);
    const label = container.querySelector(".ui-tag__country")!.textContent;
    rerender(<Tag selected country={{ code: "GB", name: "英国", callingCode: "+44" }} onRemove={remove} />);
    expect(container.querySelector(".ui-tag__country")!.textContent).toBe(label);
    expect(container.querySelector(".ui-tag__leading")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /GB 英国 \+44/ }));
    expect(remove).toHaveBeenCalledOnce();
  });

  it("preserves ordinary tags and custom removal labels", () => {
    const remove = vi.fn();
    const { container } = render(<Tag leading={<span>★</span>} onRemove={remove} removeLabel="移除工作区">工作区</Tag>);
    expect(screen.getByText("工作区")).toBeVisible();
    expect(container.querySelector(".ui-tag__flag")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "移除工作区" }));
    expect(remove).toHaveBeenCalledOnce();
  });

  it("rejects malformed country data and contradictory JavaScript props", () => {
    const warn = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(() => render(<Tag country={{ code: "GBR", name: "英国" }} />)).toThrow(/two-letter/);
      expect(() => render(<Tag country={{ code: "GB", name: " " }} />)).toThrow(/non-empty/);
      const conflict = { country: { code: "GB", name: "英国" }, children: "duplicate" } as unknown as TagProps;
      expect(() => render(<Tag {...conflict} />)).toThrow(/cannot be combined/);
    } finally { warn.mockRestore(); }
  });
});
