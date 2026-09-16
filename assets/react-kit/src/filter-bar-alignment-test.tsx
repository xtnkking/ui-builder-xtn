import { useEffect, useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import { Button, FilterBar, Inline, SearchInput } from "./personal-ui";
import "./personal-ui/styles.css";

function FilterBarAlignmentTest() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!loading) return;
    const timer = window.setTimeout(() => setLoading(false), 500);
    return () => window.clearTimeout(timer);
  }, [loading]);
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
  };

  return (
    <main className="pui-root">
      <FilterBar
        ariaLabel="权限筛选"
        onSubmit={handleSubmit}
        actions={(
          <Inline gap="small">
            <Button size="field" type="button">重置</Button>
            <Button size="field" type="submit" variant="primary" loading={loading} loadingLabel="查询中">查询</Button>
          </Inline>
        )}
      >
        <SearchInput
          aria-label="搜索权限键或说明"
          placeholder="搜索权限键或说明"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
      </FilterBar>
      <FilterBar ariaLabel="内联权限筛选" onSubmit={(event) => event.preventDefault()} actions={null}>
        <Inline gap="small" align="center">
          <SearchInput aria-label="内联搜索" placeholder="内联搜索" value={query} onChange={(event) => setQuery(event.currentTarget.value)} />
          <Button type="submit" variant="primary">内联查询</Button>
        </Inline>
      </FilterBar>
      <Inline gap="small" align="center">
        <SearchInput aria-label="独立搜索" placeholder="独立搜索" value={query} onChange={(event) => setQuery(event.currentTarget.value)} />
        <Button size="field" variant="primary">独立查询</Button>
      </Inline>
      <Inline gap="small">
        <Button>普通操作</Button>
        <Button size="small">紧凑操作</Button>
      </Inline>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<FilterBarAlignmentTest />);
