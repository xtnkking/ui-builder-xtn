// @personal-ui-coverage {"kind":"unit","runner":"components","exports":["LocaleProvider","usePersonalUILocale","Dialog","Drawer","ToastProvider","useToast","FamilyLoginPage","MemberManagementPage"]}
import { useState, type ReactNode } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  Button,
  Calendar,
  DateField,
  Dialog,
  Drawer,
  FamilyLoginPage,
  LocaleProvider,
  MemberManagementPage,
  Pagination,
  Scheduler,
  Select,
  ToastProvider,
  usePersonalUILocale,
  useToast,
  type PersonalUILocale,
} from "../../src/personal-ui";

function LocaleProbe({ id, count = 2 }: { id: string; count?: number }) {
  const { formatDate, formatNumber, locale, message, plural, timeZone } = usePersonalUILocale();
  return (
    <output
      data-testid={id}
      data-locale={locale}
      data-time-zone={timeZone}
      data-date={formatDate(Date.UTC(2026, 8, 22), { dateStyle: "long", timeZone: "UTC" })}
      data-number={formatNumber(1234.5, { minimumFractionDigits: 1 })}
    >
      {message("common.retry")}|{plural("pagination.results", count)}
    </output>
  );
}

describe("LocaleProvider contracts", () => {
  it("rejects unsupported runtime locales and invalid explicit time zones", () => {
    expect(() => renderToString(
      <LocaleProvider locale={"fr-FR" as PersonalUILocale}><span /></LocaleProvider>,
    )).toThrowError('LocaleProvider locale must be "zh-CN" or "en-US".');

    for (const timeZone of ["", "Mars/Olympus", null] as const) {
      expect(() => renderToString(
        <LocaleProvider timeZone={timeZone as unknown as string}><span /></LocaleProvider>,
      )).toThrowError("LocaleProvider timeZone must be a non-empty time zone accepted by Intl.DateTimeFormat.");
    }

    expect(() => renderToString(
      <LocaleProvider timeZone="UTC">
        <Scheduler date={new Date("2026-09-22T12:00:00Z")} events={[]} timeZone={undefined} />
      </LocaleProvider>,
    )).not.toThrow();
    expect(() => renderToString(
      <Scheduler date={new Date("2026-09-22T12:00:00Z")} events={[]} timeZone={""} />,
    )).toThrowError("Scheduler timeZone must be a non-empty time zone accepted by Intl.DateTimeFormat.");
  });

  it("defaults to zh-CN and switches messages, dates, numbers, and plurals with Intl", () => {
    const { rerender } = render(<LocaleProbe id="probe" count={1} />);
    let probe = screen.getByTestId("probe");
    expect(probe).toHaveAttribute("data-locale", "zh-CN");
    expect(probe).toHaveTextContent("重试|1 条结果");
    expect(probe).toHaveAttribute(
      "data-date",
      new Intl.DateTimeFormat("zh-CN", { dateStyle: "long", timeZone: "UTC" }).format(Date.UTC(2026, 8, 22)),
    );

    rerender(<LocaleProvider locale="en-US"><LocaleProbe id="probe" count={2} /></LocaleProvider>);
    probe = screen.getByTestId("probe");
    expect(probe).toHaveAttribute("data-locale", "en-US");
    expect(probe).toHaveTextContent("Retry|2 results");
    expect(probe).toHaveAttribute(
      "data-date",
      new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(Date.UTC(2026, 8, 22)),
    );
    expect(probe).toHaveAttribute(
      "data-number",
      new Intl.NumberFormat("en-US", { minimumFractionDigits: 1 }).format(1234.5),
    );
  });

  it("inherits locale and timeZone independently through nested providers without adding DOM", () => {
    const html = renderToString(
      <LocaleProvider locale="en-US" timeZone="UTC">
        <span>first</span><span>second</span>
      </LocaleProvider>,
    );
    expect(html).toBe("<span>first</span><span>second</span>");

    render(
      <LocaleProvider locale="en-US" timeZone="UTC">
        <LocaleProbe id="outer" />
        <LocaleProvider timeZone="Asia/Shanghai"><LocaleProbe id="time-zone-only" /></LocaleProvider>
        <LocaleProvider locale="zh-CN"><LocaleProbe id="locale-only" /></LocaleProvider>
      </LocaleProvider>,
    );

    expect(screen.getByTestId("outer")).toHaveAttribute("data-locale", "en-US");
    expect(screen.getByTestId("outer")).toHaveAttribute("data-time-zone", "UTC");
    expect(screen.getByTestId("time-zone-only")).toHaveAttribute("data-locale", "en-US");
    expect(screen.getByTestId("time-zone-only")).toHaveAttribute("data-time-zone", "Asia/Shanghai");
    expect(screen.getByTestId("locale-only")).toHaveAttribute("data-locale", "zh-CN");
    expect(screen.getByTestId("locale-only")).toHaveAttribute("data-time-zone", "UTC");
  });

  it("changes component and ARIA text without changing submitted machine values", () => {
    const renderSurface = (locale: PersonalUILocale) => (
      <LocaleProvider locale={locale}>
        <form data-testid="machine-values">
          <DateField
            aria-label="Effective date"
            name="effectiveDate"
            precision="day"
            value="2026-09-22"
            onChange={() => undefined}
          />
          <Pagination page={2} pageCount={5} total={42} pageSize={10} onPageChange={() => undefined} />
        </form>
      </LocaleProvider>
    );
    const { rerender } = render(renderSurface("zh-CN"));
    const form = screen.getByTestId("machine-values") as HTMLFormElement;
    expect(screen.getByRole("navigation", { name: "数据分页" })).toBeInTheDocument();
    expect(new FormData(form).get("effectiveDate")).toBe("2026-09-22");

    rerender(renderSurface("en-US"));
    expect(screen.getByRole("navigation", { name: "Data pagination" })).toBeInTheDocument();
    expect(new FormData(form).get("effectiveDate")).toBe("2026-09-22");
  });

  it("localizes punctuation that joins Select and Calendar ARIA labels", () => {
    render(
      <LocaleProvider locale="en-US">
        <Select
          ariaLabel="Account status"
          value=""
          onValueChange={() => undefined}
          options={[{ value: "active", label: "Active" }]}
          loading
          loadingLabel="Loading options"
        />
        <Calendar month={new Date(2026, 8, 1)} ariaLabel="Release calendar" />
      </LocaleProvider>,
    );

    expect(screen.getByRole("combobox", { name: "Account status, no selection, Loading options" })).toBeInTheDocument();
    expect(screen.getByRole("grid", { name: "Release calendar, September 2026" })).toBeInTheDocument();
  });

  it.each([
    ["Dialog", (children: ReactNode) => <Dialog open onOpenChange={() => undefined} title="Account">{children}</Dialog>, "Close dialog"],
    ["Drawer", (children: ReactNode) => <Drawer open onOpenChange={() => undefined} title="Account">{children}</Drawer>, "Close drawer"],
  ] as const)("keeps en-US context in the %s portal", async (_name, renderOverlay, closeLabel) => {
    render(<LocaleProvider locale="en-US">{renderOverlay(<span>Details</span>)}</LocaleProvider>);
    const panel = await screen.findByRole("dialog", { name: "Account" });
    expect(within(panel).getByRole("button", { name: closeLabel })).toBeInTheDocument();
  });

  it("captures the nested call-site locale for Toast portals", async () => {
    const user = userEvent.setup();

    function ToastTrigger() {
      const { toast } = useToast();
      return <Button onClick={() => toast({ title: "Saved", duration: null })}>Create toast</Button>;
    }

    render(
      <ToastProvider>
        <LocaleProvider locale="en-US"><ToastTrigger /></LocaleProvider>
      </ToastProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Create toast" }));
    expect(await screen.findByRole("button", { name: "Close notification: Saved" })).toBeInTheDocument();
  });

  it("hydrates with the same initial locale without recoverable errors", async () => {
    const app = <LocaleProvider locale="en-US" timeZone="UTC"><LocaleProbe id="hydrated" /></LocaleProvider>;
    const host = document.createElement("div");
    const recoverableErrors: unknown[] = [];
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    host.innerHTML = renderToString(app);
    document.body.append(host);
    let root: ReturnType<typeof hydrateRoot> | undefined;

    try {
      await act(async () => {
        root = hydrateRoot(host, app, { onRecoverableError: (error) => recoverableErrors.push(error) });
      });
      expect(within(host).getByTestId("hydrated")).toHaveTextContent("Retry|2 results");
      expect(recoverableErrors).toEqual([]);
      expect(consoleError.mock.calls.flat().join(" ")).not.toMatch(/hydration|did not match|server html/i);
    } finally {
      await act(async () => root?.unmount());
      host.remove();
      consoleError.mockRestore();
    }
  });

  it("localizes bundled page defaults while leaving supplied business copy untouched", async () => {
    render(
      <LocaleProvider locale="en-US">
        <FamilyLoginPage companyName="Northstar" products={[]} onSubmit={() => undefined} />
        <MemberManagementPage
          title="Workspace people"
          fetchMembers={async () => ({ items: [], total: 0 })}
        />
      </LocaleProvider>,
    );

    expect(screen.getByText("Sign-in unavailable")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Workspace people" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("No matching members")).toBeInTheDocument());
    expect(screen.getByRole("searchbox", { name: "Search by name or email" })).toBeInTheDocument();
  });

  it("re-derives built-in login errors after locale changes and preserves business errors", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn()
      .mockRejectedValueOnce(new Error(" "))
      .mockRejectedValueOnce(new Error("Account locked"));
    const products = [{
      id: "docs",
      name: "Docs",
      accent: "#1769d2",
      headline: "Docs",
      visual: <span />,
    }];
    const login = (locale: PersonalUILocale) => (
      <LocaleProvider locale={locale}>
        <FamilyLoginPage companyName="Northstar" products={products} onSubmit={onSubmit} />
      </LocaleProvider>
    );

    const view = render(login("zh-CN"));
    await user.click(screen.getByRole("button", { name: "登录" }));
    expect(screen.getByText("请输入有效的邮箱地址")).toBeInTheDocument();
    expect(screen.getByText("请输入密码")).toBeInTheDocument();

    view.rerender(login("en-US"));
    expect(screen.getByText("Enter a valid email address")).toBeInTheDocument();
    expect(screen.getByText("Enter your password")).toBeInTheDocument();

    await user.type(screen.getByRole("textbox", { name: /Email/ }), "person@example.com");
    await user.type(screen.getByLabelText(/Password/, { selector: "input" }), "secret");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Unable to sign in. Try again later.")).toBeInTheDocument();

    view.rerender(login("zh-CN"));
    expect(screen.getByText("暂时无法登录，请稍后重试")).toBeInTheDocument();
    await user.type(screen.getByLabelText(/密码/, { selector: "input" }), "x");
    await user.click(screen.getByRole("button", { name: "登录" }));
    expect(await screen.findByText("Account locked")).toBeInTheDocument();

    view.rerender(login("en-US"));
    expect(screen.getByText("Account locked")).toBeInTheDocument();
    expect(screen.getByText("Sign-in failed")).toBeInTheDocument();
  });
});
