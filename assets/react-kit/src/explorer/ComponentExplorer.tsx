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
          label: family.label,
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

function FamilyCases({ family, cases }: { family: ExplorerFamily; cases?: readonly ExplorerCase[] }) {
  if (!cases?.length) {
    return (
      <div className="demo-explorer-pending" data-example-status="pending-m6-03">
        <EmptyState
          icon={<SearchX aria-hidden="true" />}
          title="案例将在 M6-03 补齐"
          description="当前路由、公开导出和检索信息已经可用；这里不会用占位代码冒充真实组件案例。"
        />
      </div>
    );
  }

  const items = cases.flatMap((example) => [
    {
      id: `${example.id}-preview`,
      label: cases.length === 1 ? "预览" : `${example.label}预览`,
      content: (
        <section className="demo-explorer-case">
          <div className="demo-explorer-case__summary">
            <h2>{example.label}</h2>
            <p>{example.summary}</p>
            <div className="demo-explorer-case__states" aria-label="案例覆盖状态">
              {example.states.map((state) => <Tag key={state}>{state}</Tag>)}
            </div>
          </div>
          <div className="demo-explorer-preview">{example.content}</div>
        </section>
      ),
    },
    {
      id: `${example.id}-code`,
      label: cases.length === 1 ? "代码" : `${example.label}代码`,
      content: <CodeBlock code={example.code} language="tsx" copyable />,
    },
  ]);

  return (
    <div className="demo-explorer-cases" data-example-status="runnable">
      <Tabs
        key={family.id}
        ariaLabel={`${family.label}案例`}
        defaultValue={`${cases[0].id}-preview`}
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
            title={family.label}
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
