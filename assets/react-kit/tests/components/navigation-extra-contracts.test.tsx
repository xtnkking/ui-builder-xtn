// @personal-ui-coverage {"kind":"unit","runner":"components","exports":["AnchorNavigation","AppNavigation","BottomNavigation","CommandPalette","InfiniteScroll","LoadMore","Menu","SideNavigation","Stepper","TopNavigation"]}
import { createElement, useState, type ReactElement } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  AnchorNavigation,
  AppNavigation,
  BottomNavigation,
  CommandPalette,
  InfiniteScroll,
  LoadMore,
  Menu,
  SideNavigation,
  Stepper,
  TopNavigation,
  type AnchorNavigationProps,
  type AppNavigationProps,
  type CommandPaletteProps,
  type InfiniteScrollProps,
  type LoadMoreProps,
  type MenuProps,
  type NavigationVariantProps,
  type StepperProps,
} from "../../src/personal-ui";

const navigationItems = [{ id: "home", label: "Home", onSelect: () => undefined }];
const steps = [{ id: "details", label: "Details" }];
const commands = [
  { id: "accounts", label: "Accounts", textValue: "accounts", onSelect: vi.fn() },
  { id: "billing", label: "Billing", textValue: "billing", onSelect: vi.fn() },
];
const anchors = [{ id: "overview", label: "Overview", href: "#overview" as const }];

function forcedEscapes(testId: string) {
  return {
    className: "foreign-navigation",
    style: { color: "red", background: "magenta" },
    css: "foreign-css",
    sx: "foreign-sx",
    tw: "foreign-tw",
    dangerouslySetInnerHTML: { __html: "<b>unsafe navigation</b>" },
    "data-pui-owner": "Consumer",
    "data-pui-slot": "foreign",
    "data-pui-private": "foreign",
    "data-testid": testId,
    "data-track": "preserved",
  };
}

function expectEscapesRemoved(element: HTMLElement, owner: string) {
  expect(element).toHaveAttribute("data-pui-owner", owner);
  expect(element).not.toHaveClass("foreign-navigation");
  expect(element).not.toHaveAttribute("style");
  expect(element).not.toHaveAttribute("css");
  expect(element).not.toHaveAttribute("sx");
  expect(element).not.toHaveAttribute("tw");
  expect(element).not.toHaveAttribute("data-pui-slot");
  expect(element).not.toHaveAttribute("data-pui-private");
  expect(element).not.toHaveTextContent("unsafe navigation");
}

function expectDevelopmentError(run: () => void, message: RegExp) {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
  try {
    expect(run).toThrow(message);
  } finally {
    consoleError.mockRestore();
  }
}

describe("extra navigation public contracts", () => {
  it("gates observer requests by cursor and observes the next cursor after an in-flight request settles", async () => {
    const observers: Array<{ callback: IntersectionObserverCallback; target?: Element }> = [];
    class ControlledObserver {
      private entry: (typeof observers)[number];
      constructor(callback: IntersectionObserverCallback) {
        this.entry = { callback };
        observers.push(this.entry);
      }
      observe(target: Element) { this.entry.target = target; }
      disconnect() { this.entry.target = undefined; }
    }
    vi.stubGlobal("IntersectionObserver", ControlledObserver);
    let finishFirst!: () => void;
    const onLoadMore = vi.fn()
      .mockImplementationOnce(() => new Promise<void>((resolve) => { finishFirst = resolve; }))
      .mockResolvedValue(undefined);
    const intersect = () => observers.forEach(({ callback, target }) => {
      if (target) callback([{ isIntersecting: true, target } as IntersectionObserverEntry], {} as IntersectionObserver);
    });
    try {
      const rendered = render(<InfiniteScroll loadKey="first" hasMore onLoadMore={onLoadMore}>Items</InfiniteScroll>);
      expect(observers.length).toBe(1);
      expect(observers[0].target).toBeTruthy();
      act(intersect);
      expect(observers[0].target).toBeUndefined();
      await Promise.resolve();
      await waitFor(() => expect(onLoadMore).toHaveBeenCalledTimes(1));
      rendered.rerender(<InfiniteScroll loadKey="second" hasMore onLoadMore={onLoadMore}>More items</InfiniteScroll>);
      act(intersect);
      expect(onLoadMore).toHaveBeenCalledTimes(1);
      await act(async () => { finishFirst(); });
      await waitFor(() => expect(observers.some((observer) => observer.target)).toBe(true));
      act(intersect);
      await waitFor(() => expect(onLoadMore).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(observers.some((observer) => observer.target)).toBe(true));
      act(intersect);
      expect(onLoadMore).toHaveBeenCalledTimes(2);
      rendered.unmount();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("filters forced escape props from every fixed navigation owner", () => {
    const cases = [
      {
        owner: "AppNavigation",
        props: { ...forcedEscapes("app-navigation"), items: navigationItems, ariaLabel: "Primary" },
        renderComponent: (props: Record<string, unknown>) => createElement(AppNavigation, props as unknown as AppNavigationProps),
      },
      {
        owner: "TopNavigation",
        props: { ...forcedEscapes("top-navigation"), items: navigationItems, ariaLabel: "Top", variant: "side" },
        renderComponent: (props: Record<string, unknown>) => createElement(TopNavigation, props as unknown as NavigationVariantProps),
      },
      {
        owner: "SideNavigation",
        props: { ...forcedEscapes("side-navigation"), items: navigationItems, ariaLabel: "Side" },
        renderComponent: (props: Record<string, unknown>) => createElement(SideNavigation, props as unknown as NavigationVariantProps),
      },
      {
        owner: "BottomNavigation",
        props: { ...forcedEscapes("bottom-navigation"), items: navigationItems, ariaLabel: "Bottom" },
        renderComponent: (props: Record<string, unknown>) => createElement(BottomNavigation, props as unknown as NavigationVariantProps),
      },
      {
        owner: "Menu",
        props: {
          ...forcedEscapes("menu"),
          items: navigationItems,
          ariaLabel: "Menu",
          brand: "Injected brand",
          actions: "Injected actions",
          variant: "bottom",
        },
        renderComponent: (props: Record<string, unknown>) => createElement(Menu, props as unknown as MenuProps),
      },
      {
        owner: "LoadMore",
        props: { ...forcedEscapes("load-more"), onLoadMore: () => undefined },
        renderComponent: (props: Record<string, unknown>) => createElement(LoadMore, props as unknown as LoadMoreProps),
      },
      {
        owner: "InfiniteScroll",
        props: {
          ...forcedEscapes("infinite-scroll"),
          children: <span>Items</span>,
          hasMore: false,
          loadKey: "first-page",
          onLoadMore: () => undefined,
        },
        renderComponent: (props: Record<string, unknown>) => createElement(InfiniteScroll, props as unknown as InfiniteScrollProps),
      },
      {
        owner: "Stepper",
        props: { ...forcedEscapes("stepper"), steps, currentId: "details", ariaLabel: "Setup" },
        renderComponent: (props: Record<string, unknown>) => createElement(Stepper, props as unknown as StepperProps),
      },
      {
        owner: "AnchorNavigation",
        props: { ...forcedEscapes("anchor-navigation"), items: anchors },
        renderComponent: (props: Record<string, unknown>) => createElement(AnchorNavigation, props as unknown as AnchorNavigationProps),
      },
    ] satisfies Array<{
      owner: string;
      props: Record<string, unknown>;
      renderComponent: (props: Record<string, unknown>) => ReactElement;
    }>;

    cases.forEach(({ owner, renderComponent, props }) => {
      const originalProps = { ...props };
      const result = render(renderComponent(props));
      const element = screen.getByTestId(props["data-testid"] as string);
      expectEscapesRemoved(element, owner);
      expect(element).toHaveAttribute("data-track", "preserved");
      if (owner === "TopNavigation") expect(element).toHaveAttribute("data-variant", "top");
      if (owner === "Menu") {
        expect(element).toHaveAttribute("data-variant", "side");
        expect(element).not.toHaveTextContent("Injected brand");
        expect(element).not.toHaveTextContent("Injected actions");
      }
      expect(props).toEqual(originalProps);
      result.unmount();
    });

    const commandProps = {
      ...forcedEscapes("command-palette"),
      commands,
      defaultOpen: true,
      defaultQuery: "acc",
    };
    const originalCommandProps = { ...commandProps };
    render(createElement(CommandPalette, commandProps as unknown as CommandPaletteProps));
    const commandOwner = document.querySelector<HTMLElement>("[data-pui-owner='CommandPalette']")!;
    expectEscapesRemoved(commandOwner, "CommandPalette");
    expect(commandProps).toEqual(originalCommandProps);
    expect(document.querySelector("[data-pui-owner='Consumer']")).toBeNull();
  });

  it("owns uncontrolled open and query state while reporting changes", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onQueryChange = vi.fn();
    render(
      <CommandPalette
        commands={commands}
        defaultOpen
        defaultQuery="acc"
        onOpenChange={onOpenChange}
        onQueryChange={onQueryChange}
        placeholder="Search commands"
      />,
    );

    const search = screen.getByRole("combobox", { name: "Search commands" });
    expect(search).toHaveValue("acc");
    fireEvent.change(search, { target: { value: "bill" } });
    expect(search).toHaveValue("bill");
    expect(onQueryChange).toHaveBeenLastCalledWith("bill");

    await user.click(screen.getByRole("option", { name: /Billing/ }));
    expect(commands[1].onSelect).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByRole("dialog", { name: "命令面板" })).not.toBeInTheDocument();
  });

  it("reports controlled changes without mutating controlled state", () => {
    const onOpenChange = vi.fn();
    const onQueryChange = vi.fn();
    render(
      <CommandPalette
        commands={commands}
        open
        onOpenChange={onOpenChange}
        query="acc"
        onQueryChange={onQueryChange}
        placeholder="Search commands"
      />,
    );

    const search = screen.getByRole("combobox", { name: "Search commands" });
    fireEvent.change(search, { target: { value: "bill" } });
    expect(onQueryChange).toHaveBeenCalledWith("bill");
    expect(search).toHaveValue("acc");

    fireEvent.click(screen.getByRole("button", { name: "关闭对话框" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.getByRole("dialog", { name: "命令面板" })).toBeInTheDocument();
  });

  it("rejects contradictory or incomplete JavaScript state contracts", () => {
    expectDevelopmentError(
      () => render(createElement(InfiniteScroll, {
        children: "Items",
        hasMore: true,
        onLoadMore: () => undefined,
      } as unknown as InfiniteScrollProps)),
      /InfiniteScroll requires loadKey/,
    );
    expectDevelopmentError(
      () => render(createElement(CommandPalette, {
        commands,
        open: true,
      } as unknown as CommandPaletteProps)),
      /CommandPalette requires onOpenChange when open is controlled/,
    );
    expectDevelopmentError(
      () => render(createElement(CommandPalette, {
        commands,
        open: true,
        defaultOpen: false,
        onOpenChange: () => undefined,
      } as unknown as CommandPaletteProps)),
      /CommandPalette cannot receive both open and defaultOpen/,
    );
    expectDevelopmentError(
      () => render(createElement(CommandPalette, {
        commands,
        query: "acc",
      } as unknown as CommandPaletteProps)),
      /CommandPalette query requires onQueryChange when query is controlled/,
    );
    expectDevelopmentError(
      () => render(createElement(CommandPalette, {
        commands,
        query: "acc",
        defaultQuery: "accounts",
        onQueryChange: () => undefined,
      } as unknown as CommandPaletteProps)),
      /CommandPalette query cannot receive both query and defaultQuery/,
    );
  });

  it("rejects open and query mode switching after mount", () => {
    function SwitchingOpen() {
      const [controlled, setControlled] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setControlled(true)}>control open</button>
          {controlled
            ? <CommandPalette commands={commands} open={false} onOpenChange={() => undefined} />
            : <CommandPalette commands={commands} defaultOpen={false} />}
        </>
      );
    }
    const openSwitch = render(<SwitchingOpen />);
    expectDevelopmentError(
      () => fireEvent.click(screen.getByRole("button", { name: "control open" })),
      /CommandPalette cannot switch from uncontrolled to controlled mode/,
    );
    openSwitch.unmount();

    function SwitchingQuery() {
      const [controlled, setControlled] = useState(true);
      return (
        <>
          <button type="button" onClick={() => setControlled(false)}>uncontrol query</button>
          {controlled
            ? (
              <CommandPalette
                commands={commands}
                open={false}
                onOpenChange={() => undefined}
                query=""
                onQueryChange={() => undefined}
              />
            )
            : (
              <CommandPalette
                commands={commands}
                open={false}
                onOpenChange={() => undefined}
                defaultQuery=""
              />
            )}
        </>
      );
    }
    render(<SwitchingQuery />);
    expectDevelopmentError(
      () => fireEvent.click(screen.getByRole("button", { name: "uncontrol query" })),
      /CommandPalette query cannot switch from controlled to uncontrolled mode/,
    );
  });
});
