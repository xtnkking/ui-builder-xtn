import { createRef } from "react";
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
  type AppNavigationProps,
} from "../../src/personal-ui";

const navigationItems = [{ id: "home", label: "Home", onSelect: () => undefined }];
const steps = [{ id: "details", label: "Details" }];
const commands = [{
  id: "accounts",
  label: "Accounts",
  textValue: "accounts",
  onSelect: () => undefined,
}];
const anchors = [{ id: "overview", label: "Overview", href: "#overview" as const }];

const allowedNavigation = (
  <>
    <AppNavigation items={navigationItems} ariaLabel="Primary" id="primary" data-track="primary" />
    <TopNavigation items={navigationItems} ariaLabel="Top" aria-describedby="top-help" />
    <SideNavigation items={navigationItems} ariaLabel="Side" onMouseEnter={() => undefined} />
    <BottomNavigation items={navigationItems} ariaLabel="Bottom" title="Bottom navigation" />
    <Menu items={navigationItems} ariaLabel="Menu" orientation="horizontal" data-track="menu" />
    <LoadMore onLoadMore={() => undefined} aria-label="Load more accounts" data-track="load-more" />
    <InfiniteScroll hasMore={false} loadKey="first-page" onLoadMore={() => undefined} aria-label="Account results">
      <span>Accounts</span>
    </InfiniteScroll>
    <Stepper steps={steps} currentId="details" ariaLabel="Setup" data-track="stepper" />
    <CommandPalette commands={commands} defaultOpen defaultQuery="acc" />
    <CommandPalette
      commands={commands}
      open={false}
      onOpenChange={() => undefined}
      query="acc"
      onQueryChange={() => undefined}
    />
    <CommandPalette
      commands={commands}
      open={false}
      onOpenChange={() => undefined}
      defaultQuery="acc"
    />
    <AnchorNavigation items={anchors} activeId="overview" data-track="anchors" />
  </>
);
void allowedNavigation;

// @ts-expect-error fixed navigation does not expose className
const appNavigationClassName = <AppNavigation className="foreign" items={navigationItems} ariaLabel="Primary" />;
// @ts-expect-error fixed navigation does not expose style
const topNavigationStyle = <TopNavigation style={{ color: "red" }} items={navigationItems} ariaLabel="Top" />;
// @ts-expect-error fixed navigation does not expose raw DOM refs
const sideNavigationRef = <SideNavigation ref={createRef<HTMLElement>()} items={navigationItems} ariaLabel="Side" />;
// @ts-expect-error fixed navigation does not expose internal ownership markers
const bottomNavigationOwner = <BottomNavigation data-pui-owner="Consumer" items={navigationItems} ariaLabel="Bottom" />;
// @ts-expect-error Menu styling remains privately owned
const menuClassName = <Menu className="foreign" items={navigationItems} ariaLabel="Menu" />;
// @ts-expect-error Menu cannot reopen AppNavigation's brand slot
const menuBrand = <Menu brand="Foreign" items={navigationItems} ariaLabel="Menu" />;
// @ts-expect-error fixed controls do not expose raw HTML injection
const loadMoreHtml = <LoadMore dangerouslySetInnerHTML={{ __html: "unsafe" }} onLoadMore={() => undefined} />;
// @ts-expect-error InfiniteScroll does not expose style
const infiniteScrollStyle = <InfiniteScroll style={{ color: "red" }} hasMore={false} loadKey="first-page" onLoadMore={() => undefined}>Items</InfiniteScroll>;
// @ts-expect-error a caller-owned cursor identity is required for each request batch
const infiniteScrollWithoutKey = <InfiniteScroll hasMore onLoadMore={() => undefined}>Items</InfiniteScroll>;
// @ts-expect-error Stepper does not expose utility-class props
const stepperTw = <Stepper tw="foreign" steps={steps} currentId="details" ariaLabel="Setup" />;
// @ts-expect-error CommandPalette follows the protected public-control contract
const commandClassName = <CommandPalette className="foreign" commands={commands} />;
// @ts-expect-error CommandPalette cannot accept reserved internal markers
const commandSlot = <CommandPalette data-pui-slot="foreign" commands={commands} />;
// @ts-expect-error AnchorNavigation does not expose raw DOM refs
const anchorRef = <AnchorNavigation ref={createRef<HTMLElement>()} items={anchors} />;
const privateNavigationData: AppNavigationProps = {
  items: navigationItems,
  ariaLabel: "Primary",
  // @ts-expect-error wildcard reserved ownership keys are forbidden in object props
  "data-pui-private": "foreign",
};

// @ts-expect-error controlled open requires onOpenChange
const commandOpenWithoutChange = <CommandPalette commands={commands} open />;
// @ts-expect-error controlled and uncontrolled open props are mutually exclusive
const contradictoryCommandOpen = <CommandPalette commands={commands} open defaultOpen onOpenChange={() => undefined} />;
// @ts-expect-error controlled query requires onQueryChange
const commandQueryWithoutChange = <CommandPalette commands={commands} query="acc" />;
const contradictoryCommandQuery = (
  // @ts-expect-error controlled and uncontrolled query props are mutually exclusive
  <CommandPalette commands={commands} query="acc" defaultQuery="accounts" onQueryChange={() => undefined} />
);

void appNavigationClassName;
void topNavigationStyle;
void sideNavigationRef;
void bottomNavigationOwner;
void menuClassName;
void menuBrand;
void loadMoreHtml;
void infiniteScrollStyle;
void infiniteScrollWithoutKey;
void stepperTw;
void commandClassName;
void commandSlot;
void anchorRef;
void privateNavigationData;
void commandOpenWithoutChange;
void contradictoryCommandOpen;
void commandQueryWithoutChange;
void contradictoryCommandQuery;
