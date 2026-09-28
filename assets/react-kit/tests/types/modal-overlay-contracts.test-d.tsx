import { createRef } from "react";
import {
  ConfirmDialog,
  ContextMenu,
  Dialog,
  Drawer,
  GuidedTour,
  Lightbox,
  Popconfirm,
} from "../../src/personal-ui";

const menuItems = [{ id: "edit", label: "Edit", onSelect: () => undefined }];
const lightboxItems = [{ id: "first", src: "/first.png", alt: "First" }];
const tourSteps = [{ id: "intro", title: "Intro", description: "Welcome" }];

const allowedModalOverlays = (
  <>
    <Dialog open={false} onOpenChange={() => undefined} title="Dialog">Content</Dialog>
    <Drawer open={false} onOpenChange={() => undefined} title="Drawer">Content</Drawer>
    <ConfirmDialog open={false} onOpenChange={() => undefined} title="Confirm" onConfirm={() => undefined} />
    <Popconfirm triggerLabel="Delete" ariaLabel="Delete record" title="Delete?" onConfirm={() => undefined} />
    <ContextMenu ariaLabel="Record actions" items={menuItems}><span>Record</span></ContextMenu>
    <Lightbox open={false} onOpenChange={() => undefined} items={lightboxItems} value="first" onValueChange={() => undefined} />
    <GuidedTour open={false} onOpenChange={() => undefined} steps={tourSteps} currentId="intro" onCurrentChange={() => undefined} />
  </>
);
void allowedModalOverlays;

// @ts-expect-error Dialog no longer accepts the legacy onClose API
const dialogOnClose = <Dialog open onClose={() => undefined} title="Dialog">Content</Dialog>;
// @ts-expect-error Dialog controlled open requires onOpenChange
const dialogMissingChange = <Dialog open title="Dialog">Content</Dialog>;
// @ts-expect-error Dialog is controlled-only and cannot accept defaultOpen
const dialogDefaultOpen = <Dialog open defaultOpen onOpenChange={() => undefined} title="Dialog">Content</Dialog>;
// @ts-expect-error Dialog does not expose className
const dialogClassName = <Dialog open={false} onOpenChange={() => undefined} title="Dialog" className="foreign">Content</Dialog>;
// @ts-expect-error Dialog does not expose raw HTML injection
const dialogHtml = <Dialog open={false} onOpenChange={() => undefined} title="Dialog" dangerouslySetInnerHTML={{ __html: "unsafe" }}>Content</Dialog>;

// @ts-expect-error Drawer no longer accepts the legacy onClose API
const drawerOnClose = <Drawer open onClose={() => undefined} title="Drawer">Content</Drawer>;
// @ts-expect-error Drawer does not expose style
const drawerStyle = <Drawer open={false} onOpenChange={() => undefined} title="Drawer" style={{ color: "red" }}>Content</Drawer>;
// @ts-expect-error Drawer does not expose raw DOM refs
const drawerRef = <Drawer open={false} onOpenChange={() => undefined} title="Drawer" ref={createRef<HTMLElement>()}>Content</Drawer>;

// @ts-expect-error ConfirmDialog controlled open requires onOpenChange
const confirmMissingChange = <ConfirmDialog open title="Confirm" onConfirm={() => undefined} />;
// @ts-expect-error ConfirmDialog does not expose reserved ownership markers
const confirmOwner = <ConfirmDialog open={false} onOpenChange={() => undefined} title="Confirm" onConfirm={() => undefined} data-pui-owner="Consumer" />;

// @ts-expect-error Popconfirm owns its open state internally
const popconfirmOpen = <Popconfirm open triggerLabel="Delete" ariaLabel="Delete record" title="Delete?" onConfirm={() => undefined} />;
// @ts-expect-error Popconfirm does not expose utility-class props
const popconfirmTw = <Popconfirm tw="foreign" triggerLabel="Delete" ariaLabel="Delete record" title="Delete?" onConfirm={() => undefined} />;
// @ts-expect-error legacy arbitrary trigger nodes must migrate to triggerLabel
const popconfirmLegacyTrigger = <Popconfirm trigger="Delete" ariaLabel="Delete record" title="Delete?" onConfirm={() => undefined} />;
// @ts-expect-error triggerLabel is intentionally plain text
const popconfirmRichTrigger = <Popconfirm triggerLabel={<button type="button">Nested</button>} ariaLabel="Delete record" title="Delete?" onConfirm={() => undefined} />;

// @ts-expect-error ContextMenu does not expose className
const contextClassName = <ContextMenu className="foreign" ariaLabel="Actions" items={menuItems}><span>Record</span></ContextMenu>;
// @ts-expect-error ContextMenu does not expose reserved internal markers
const contextSlot = <ContextMenu data-pui-slot="foreign" ariaLabel="Actions" items={menuItems}><span>Record</span></ContextMenu>;

// @ts-expect-error Lightbox controlled open requires onOpenChange
const lightboxMissingOpenChange = <Lightbox open items={lightboxItems} value="first" onValueChange={() => undefined} />;
// @ts-expect-error Lightbox controlled value requires onValueChange
const lightboxMissingValueChange = <Lightbox open={false} onOpenChange={() => undefined} items={lightboxItems} value="first" />;
// @ts-expect-error Lightbox is controlled-only and cannot accept defaultValue
const lightboxDefaultValue = <Lightbox open={false} onOpenChange={() => undefined} items={lightboxItems} value="first" defaultValue="first" onValueChange={() => undefined} />;
// @ts-expect-error Lightbox does not expose className
const lightboxClassName = <Lightbox open={false} onOpenChange={() => undefined} items={lightboxItems} value="first" onValueChange={() => undefined} className="foreign" />;

// @ts-expect-error GuidedTour no longer accepts the legacy onClose API
const tourOnClose = <GuidedTour open onClose={() => undefined} steps={tourSteps} currentId="intro" onCurrentChange={() => undefined} />;
// @ts-expect-error GuidedTour controlled open requires onOpenChange
const tourMissingOpenChange = <GuidedTour open steps={tourSteps} currentId="intro" onCurrentChange={() => undefined} />;
// @ts-expect-error GuidedTour currentId requires onCurrentChange
const tourMissingCurrentChange = <GuidedTour open={false} onOpenChange={() => undefined} steps={tourSteps} currentId="intro" />;
// @ts-expect-error GuidedTour does not expose internal ownership markers
const tourOwner = <GuidedTour open={false} onOpenChange={() => undefined} steps={tourSteps} currentId="intro" onCurrentChange={() => undefined} data-pui-owner="Consumer" />;

void dialogOnClose;
void dialogMissingChange;
void dialogDefaultOpen;
void dialogClassName;
void dialogHtml;
void drawerOnClose;
void drawerStyle;
void drawerRef;
void confirmMissingChange;
void confirmOwner;
void popconfirmOpen;
void popconfirmTw;
void popconfirmLegacyTrigger;
void popconfirmRichTrigger;
void contextClassName;
void contextSlot;
void lightboxMissingOpenChange;
void lightboxMissingValueChange;
void lightboxDefaultValue;
void lightboxClassName;
void tourOnClose;
void tourMissingOpenChange;
void tourMissingCurrentChange;
void tourOwner;
