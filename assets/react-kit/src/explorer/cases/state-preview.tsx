import { useState as useStateForPreview, type ReactNode as PreviewNode } from "react";
import { Box as PreviewBox, Button as PreviewButton, Dialog as PreviewDialog, LocaleProvider as PreviewLocaleProvider, ThemeProvider as PreviewThemeProvider } from "../../personal-ui";

/** Runnable host contexts, not certificates of keyboard or viewport behavior. */
export function StatePreview({ state, children }: {
  state: "dark" | "locale" | "mobile" | "overlay";
  children: PreviewNode;
}) {
  const [open, setOpen] = useStateForPreview(false);
  if (state === "dark") {
    return <PreviewThemeProvider mode="dark"><PreviewBox padding="medium" surface="default">{children}</PreviewBox></PreviewThemeProvider>;
  }
  if (state === "locale") {
    return <PreviewLocaleProvider locale="en-US"><PreviewBox lang="en" padding="medium" surface="default">{children}</PreviewBox></PreviewLocaleProvider>;
  }
  if (state === "mobile") {
    return <div style={{ width: "min(320px, 100%)", minWidth: 0, overflow: "auto" }}>{children}</div>;
  }
  return <>
    <PreviewButton onClick={() => setOpen(true)}>在弹窗中查看此状态</PreviewButton>
    <PreviewDialog open={open} onOpenChange={setOpen} title="浮层内的组件" description="测试组件与浮层的焦点、弹出内容及关闭后返回焦点。">
      {children}
    </PreviewDialog>
  </>;
}
