import { useEffect, useMemo, useState } from "react";
import { Grid2X2, Menu, SearchX } from "lucide-react";
import {
  bundledExplorerCases,
  mergeExplorerCases,
  type ExplorerCase,
  type ExplorerCases,
} from "./cases";
import {
  AppNavigation,
  Button,
  CodeBlock,
  Drawer,
  EmptyState,
  PageHeading,
  SearchInput,
  Tag,
  Tabs,
  type NavigationItem,
} from "../personal-ui";
import {
  defaultExplorerFamilyId,
  explorerCategories,
  explorerFamilies,
  explorerFamilyById,
  explorerFamilyFromHash,
  filterExplorerFamilies,
  type ExplorerFamily,
} from "./registry";
import { formatStateLabel } from "./labels";

export type { ExplorerCase, ExplorerCases } from "./cases";

function currentFamily(): ExplorerFamily {
  if (typeof window !== "undefined") {
    const family = explorerFamilyFromHash(window.location.hash);
    if (family) return family;
  }
  const fallback = explorerFamilyById.get(defaultExplorerFamilyId);
  if (!fallback) throw new Error(`Explorer default family ${defaultExplorerFamilyId} is not registered.`);
  return fallback;
}

function Directory({ families, activeFamilyId, onNavigate }: {
  families: readonly ExplorerFamily[];
  activeFamilyId: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="demo-explorer-directory" data-testid="explorer-directory">
      {explorerCategories.map((category) => {
        const categoryFamilies = families.filter((family) => family.category === category.id);
        if (categoryFamilies.length === 0) return null;
        const items: NavigationItem[] = categoryFamilies.map((family) => ({
          id: family.id,
          label: <span className="demo-explorer-directory__label"><span>{family.chineseLabel}</span><small title={family.englishLabel}>{family.englishLabel}</small></span>,
          href: family.href,
          active: family.id === activeFamilyId,
          onSelect: onNavigate,
        }));
        return (
          <section key={category.id} className="demo-explorer-directory__group">
            <h2>{category.label}</h2>
            <AppNavigation variant="side" ariaLabel={`${category.label}组件`} items={items} />
          </section>
        );
      })}
    </div>
  );
}

const compactFamilies = new Set(["button", "icon-button", "button-group", "split-button", "toggle-button", "link", "clipboard", "tag", "badge", "status", "spinner", "rating", "radio", "checkbox", "switch"]);

function PreviewFrame({ example, family, children }: { example: ExplorerCase; family: ExplorerFamily; children: React.ReactNode }) {
  const size = example.previewLayout === "page" || family.category === "pattern" || family.id === "data-table"
    ? "wide" : compactFamilies.has(family.id) ? "compact" : "regular";
  return <div className="demo-explorer-preview" data-preview-size={size} data-preview-layout={example.previewLayout ?? "contained"}>{children}</div>;
}

function CasePreviewExample({ example, family }: { example: ExplorerCase; family: ExplorerFamily }) {
  const [activeState, setActiveState] = useState("overview");
  const stateCounts = new Map<string, number>();
  for (const item of example.stateExamples ?? []) stateCounts.set(item.state, (stateCounts.get(item.state) ?? 0) + 1);
  const stateItems = [{
    id: "overview",
    label: "总览",
    content: activeState === "overview"
      ? <PreviewFrame example={example} family={family}>{example.content}</PreviewFrame>
      : null,
  }, ...(example.stateExamples ?? []).map((stateExample, index) => ({
    id: `state-${index}`,
    label: (stateCounts.get(stateExample.state) ?? 0) > 1
      ? `${formatStateLabel(stateExample.state)} · ${stateExample.exports.join(" / ")}`
      : formatStateLabel(stateExample.state),
    content: activeState === `state-${index}` ? (
      <section data-state-example={stateExample.state} data-state-exports={stateExample.exports.join(",")}>
        <p className="demo-explorer-state-note">{stateExample.exports.length ? `适用组件：${stateExample.exports.join(" / ")}` : "基础规范演示"}{stateExample.instructions && <><br />{stateExample.instructions}</>}</p>
        <PreviewFrame example={example} family={family}>{stateExample.content}</PreviewFrame>
      </section>
    ) : null,
  }))];
  return (
    <section className="demo-explorer-case">
      <div className="demo-explorer-case__summary">
        <h2>{example.label}</h2>
        <p>{example.summary}</p>
        <div className="demo-explorer-case__states" aria-label="适用状态，不表示已演示">
          {example.states.map((state) => <Tag key={state}>{formatStateLabel(state)}</Tag>)}
        </div>
      </div>
      {example.stateExamples?.length ? (
        <Tabs ariaLabel={`${example.label}状态案例`} value={activeState} onValueChange={setActiveState} items={stateItems} />
      ) : (
        <>
          <PreviewFrame example={example} family={family}>{example.content}</PreviewFrame>
          <p data-state-coverage="pending">状态案例尚未逐项绑定；以上标签仅表示适用范围。</p>
        </>
      )}
    </section>
  );
}

function FamilyCases({ family, cases }: { family: ExplorerFamily; cases?: readonly ExplorerCase[] }) {
  const [activeCase, setActiveCase] = useState(`${cases?.[0]?.id ?? ""}-preview`);
  if (!cases?.length) {
    return (
      <div className="demo-explorer-pending" data-example-status="missing">
        <EmptyState
          icon={<SearchX aria-hidden="true" />}
          title="此目录缺少可运行案例"
          description="该入口的案例未正确注册，请反馈此页面地址以便修复。"
        />
      </div>
    );
  }

  const items = cases.flatMap((example) => [
    {
      id: `${example.id}-preview`,
      label: cases.length === 1 ? "预览" : `${example.label}预览`,
      content: activeCase === `${example.id}-preview` ? <CasePreviewExample example={example} family={family} /> : null,
    },
    {
      id: `${example.id}-code`,
      label: cases.length === 1 ? "代码" : `${example.label}代码`,
      content: activeCase === `${example.id}-code` ? <CodeBlock code={example.code} language="tsx" copyable /> : null,
    },
  ]);

  return (
    <div className="demo-explorer-cases" data-example-status="runnable">
      <Tabs
        key={family.id}
        ariaLabel={`${family.label}案例`}
        value={activeCase}
        onValueChange={setActiveCase}
        items={items}
      />
    </div>
  );
}

export function ComponentExplorer({ cases: additionalCases = {} }: { cases?: ExplorerCases }) {
  const [family, setFamily] = useState(currentFamily);
  const [query, setQuery] = useState("");
  const [mobileDirectoryOpen, setMobileDirectoryOpen] = useState(false);
  const filteredFamilies = useMemo(() => filterExplorerFamilies(query), [query]);
  const cases = useMemo(
    () => mergeExplorerCases(bundledExplorerCases, additionalCases),
    [additionalCases],
  );

  useEffect(() => {
    const synchronizeRoute = () => {
      const nextFamily = explorerFamilyFromHash(window.location.hash);
      if (nextFamily) {
        setFamily(nextFamily);
        return;
      }
      const fallback = explorerFamilyById.get(defaultExplorerFamilyId);
      if (!fallback) return;
      window.history.replaceState(null, "", fallback.href);
      setFamily(fallback);
    };
    synchronizeRoute();
    window.addEventListener("hashchange", synchronizeRoute);
    return () => window.removeEventListener("hashchange", synchronizeRoute);
  }, []);

  return (
    <div className="demo-shell demo-explorer-shell pui-root">
      <header className="demo-topbar">
        <div className="demo-brand"><span><Grid2X2 className="demo-brand__icon" aria-hidden="true" /></span><strong>Personal UI</strong></div>
        <span>{explorerFamilies.length} 个组件家族</span>
      </header>
      <div className="demo-explorer-layout">
        <aside className="demo-explorer-sidebar" aria-label="组件目录">
          <div className="demo-explorer-search">
            <SearchInput
              aria-label="搜索组件"
              placeholder="搜索名称、别名或用途"
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              onClear={() => setQuery("")}
            />
            <span role="status">{filteredFamilies.length} 个结果</span>
          </div>
          {filteredFamilies.length ? (
            <Directory families={filteredFamilies} activeFamilyId={family.id} />
          ) : (
            <EmptyState compact title="没有匹配的组件" description="尝试搜索组件名、别名或用途。" />
          )}
        </aside>

        <main className="demo-explorer-main" id="component-example">
          <div className="demo-explorer-mobile-command">
            <Button icon={<Menu aria-hidden="true" />} onClick={() => setMobileDirectoryOpen(true)}>组件目录</Button>
          </div>
          <PageHeading
            eyebrow={explorerCategories.find((category) => category.id === family.category)?.label}
            title={<span className="demo-explorer-heading"><span>{family.chineseLabel}</span><small>{family.englishLabel}</small></span>}
            description={family.exports.length
              ? `公开导出：${family.exports.join("、")}`
              : "基础规范，无独立 runtime export"}
            actions={family.aliases.length ? <Tag tone="blue">{family.aliases.join(" · ")}</Tag> : undefined}
          />
          <FamilyCases key={family.id} family={family} cases={cases[family.id]} />
        </main>
      </div>

      <Drawer
        open={mobileDirectoryOpen}
        onOpenChange={setMobileDirectoryOpen}
        title="组件目录"
        description="按名称、别名或用途查找组件。"
      >
        <div className="demo-explorer-mobile-directory">
          <SearchInput
            aria-label="搜索移动端组件目录"
            placeholder="搜索名称、别名或用途"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            onClear={() => setQuery("")}
          />
          {filteredFamilies.length ? (
            <Directory families={filteredFamilies} activeFamilyId={family.id} onNavigate={() => setMobileDirectoryOpen(false)} />
          ) : (
            <EmptyState compact title="没有匹配的组件" description="尝试搜索组件名、别名或用途。" />
          )}
        </div>
      </Drawer>
    </div>
  );
}
