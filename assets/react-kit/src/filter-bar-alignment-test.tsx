import { useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import { Button, FilterBar, SearchInput } from "./personal-ui";
import "./personal-ui/styles.css";

function FilterBarAlignmentTest() {
  const [query, setQuery] = useState("");
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => event.preventDefault();

  return (
    <main className="pui-root">
      <FilterBar
        ariaLabel="权限筛选"
        onSubmit={handleSubmit}
        actions={<Button type="submit" variant="primary">查询</Button>}
      >
        <SearchInput
          aria-label="搜索权限键或说明"
          placeholder="搜索权限键或说明"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
        />
      </FilterBar>
      <Button>普通操作</Button>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<FilterBarAlignmentTest />);
