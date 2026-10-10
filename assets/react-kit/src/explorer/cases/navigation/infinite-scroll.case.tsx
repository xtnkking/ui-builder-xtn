// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"infinite-scroll/overview","exports":["InfiniteScroll"]}
import { useCallback, useRef, useState } from "react";
import { Alert, InfiniteScroll, LoadMore, Stack } from "../../../personal-ui";
import { StatePreview } from "../state-preview";
import type { ExplorerCase } from "../types";

export type InfiniteRecordExample = { id: string; label: string };
export type InfinitePageExample = { records: InfiniteRecordExample[]; cursor: number; hasMore: boolean };
type InfiniteSnapshotExample = InfinitePageExample & { loading: boolean; error: string | null };
type InfiniteScrollExampleProps = {
  fetchPage?: (cursor: number) => Promise<InfinitePageExample>;
  initialRecords?: InfiniteRecordExample[];
  initialCursor?: number;
  initialHasMore?: boolean;
  disabled?: boolean;
};

const recordSourceExample = Array.from({ length: 6 }, (_, index) => ({ id: `record-${index + 1}`, label: `审核记录 ${index + 1}` }));

async function fetchRecordsExample(cursor: number): Promise<InfinitePageExample> {
  await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 650));
  const nextCursor = Math.min(cursor + 2, recordSourceExample.length);
  return { records: recordSourceExample.slice(cursor, nextCursor), cursor: nextCursor, hasMore: recordSourceExample.length > nextCursor };
}

export function InfiniteScrollExample({ fetchPage = fetchRecordsExample, initialRecords = recordSourceExample.slice(0, 2), initialCursor = 2, initialHasMore = true, disabled = false }: InfiniteScrollExampleProps = {}) {
  const [snapshot, setSnapshot] = useState<InfiniteSnapshotExample>({ records: initialRecords, cursor: initialCursor, hasMore: initialHasMore, loading: false, error: null });
  const current = useRef(snapshot);
  const pending = useRef<Promise<void> | null>(null);
  const blocked = useRef(disabled);
  blocked.current = disabled;

  const loadNext = useCallback((): Promise<void> => {
    if (pending.current) return pending.current;
    if (blocked.current || !current.current.hasMore) return Promise.resolve();
    const cursor = current.current.cursor;
    const commit = (next: InfiniteSnapshotExample) => { current.current = next; setSnapshot(next); };
    const request = Promise.resolve().then(() => fetchPage(cursor)).then(
      (page) => commit({ records: [...current.current.records, ...page.records], cursor: page.cursor, hasMore: page.hasMore, loading: true, error: null }),
      (error: unknown) => commit({ ...current.current, error: error instanceof Error ? error.message : "加载失败，请通过下方按钮重试。" }),
    ).finally(() => {
      pending.current = null;
      commit({ ...current.current, loading: false });
    });
    // Establish request ownership before any callback or await can run.
    pending.current = request;
    commit({ ...current.current, loading: true, error: null });
    return request;
  }, [fetchPage]);

  return <Stack>
    <InfiniteScroll showLoadMoreButton={false} hasMore={snapshot.hasMore} loadKey={snapshot.cursor} loading={snapshot.loading} disabled={disabled || snapshot.error !== null} onLoadMore={loadNext}>
      <ul aria-label="已加载记录">{snapshot.records.map((record) => <li key={record.id}>{record.label}</li>)}</ul>
    </InfiniteScroll>
    <p role="status" aria-label="加载状态">已加载 {snapshot.records.length} 条记录，cursor {snapshot.cursor}</p>
    {snapshot.error ? <Alert tone="danger" title="加载失败">{snapshot.error} 已有记录保留，请通过下方按钮重试。</Alert> : null}
    <LoadMore hasMore={snapshot.hasMore} loading={snapshot.loading} disabled={disabled} onLoadMore={loadNext} label="手动加载下一页" loadingLabel="正在加载下一页" />
  </Stack>;
}
export function StandaloneInfiniteScrollExample() {
  const [records, setRecords] = useState(recordSourceExample.slice(0, 2));
  const [cursor, setCursor] = useState(2);
  const [hasMore, setHasMore] = useState(true);
  return <InfiniteScroll hasMore={hasMore} loadKey={cursor} onLoadMore={async () => {
    const page = await fetchRecordsExample(cursor);
    setRecords((current) => [...current, ...page.records]);
    setCursor(page.cursor);
    setHasMore(page.hasMore);
  }}>
    <ul aria-label="已加载记录">{records.map((record) => <li key={record.id}>{record.label}</li>)}</ul>
  </InfiniteScroll>;
}
const explorerCase = {
  id: "infinite-scroll/overview", label: "连续加载与手动加载", summary: "InfiniteScroll默认自带键盘加载与重试按钮，观察器和按钮共享同步请求锁；已有数据与焦点保持稳定。",
  states: ["default", "disabled", "loading", "error", "longContent", "keyboard", "overlay", "dark", "locale"],
  content: <StandaloneInfiniteScrollExample />,
  stateExamples: [
    { state: "default", exports: ["InfiniteScroll"], content: <StandaloneInfiniteScrollExample /> },
    { state: "disabled", exports: ["InfiniteScroll"], instructions: "disabled同时禁止观察器和内置按钮。", content: <InfiniteScroll hasMore disabled loadKey="disabled" onLoadMore={() => undefined}><p>已有记录。</p></InfiniteScroll> },
    { state: "loading", exports: ["InfiniteScroll"], content: <InfiniteScroll hasMore loading loadKey="pending" onLoadMore={() => undefined}><p>当前记录仍保留；按钮和哨兵显示加载。</p></InfiniteScroll> },
    { state: "error", exports: ["InfiniteScroll"], instructions: "自动观察或内置按钮加载失败后保留已有记录；同一按钮提供手动重试，不自动循环请求失败游标。", content: <InfiniteScroll hasMore loadKey="failure" onLoadMore={async () => { throw new Error("示例请求失败"); }}><p>已有审核记录保留。</p></InfiniteScroll> },
    { state: "longContent", exports: ["InfiniteScroll"], content: <InfiniteScroll hasMore={false} loadKey="long" onLoadMore={() => undefined}><p>跨区域基础设施迁移项目的全部成员权限、数据访问范围与安全策略审核记录需要完整显示，并保留容器中的滚动和换行布局。</p></InfiniteScroll> },
    { state: "keyboard", exports: ["InfiniteScroll"], instructions: "Tab进入内置加载按钮，Enter或Space加载；失败后同一按钮变为重试。加载和结束不移除当前焦点节点。", content: <StandaloneInfiniteScrollExample /> },
    { state: "overlay", exports: ["InfiniteScroll"], content: <StatePreview state="overlay"><InfiniteScrollExample /></StatePreview> },
    { state: "dark", exports: ["InfiniteScroll"], content: <StatePreview state="dark"><InfiniteScrollExample /></StatePreview> },
    { state: "locale", exports: ["InfiniteScroll"], content: <StatePreview state="locale"><InfiniteScrollExample /></StatePreview> },
  ],
  code: `import { useState } from "react";
import { InfiniteScroll } from "./personal-ui";

type RecordItem = { id: string; label: string };
type Page = { records: RecordItem[]; cursor: number; hasMore: boolean };
const source = Array.from({ length: 6 }, (_, index) => ({ id: String(index + 1), label: "审核记录 " + (index + 1) }));
async function fetchPage(cursor: number): Promise<Page> {
  await new Promise<void>((resolve) => setTimeout(resolve, 650));
  const next = Math.min(cursor + 2, source.length);
  return { records: source.slice(cursor, next), cursor: next, hasMore: next < source.length };
}

export function RecordsExample({ disabled = false }: { disabled?: boolean }) {
  const [state, setState] = useState<Page>({ records: source.slice(0, 2), cursor: 2, hasMore: true });
  return <InfiniteScroll disabled={disabled} hasMore={state.hasMore} loadKey={state.cursor} onLoadMore={async () => {
    const page = await fetchPage(state.cursor);
    setState((current) => ({ ...page, records: [...current.records, ...page.records] }));
  }}>
    <ul>{state.records.map((record) => <li key={record.id}>{record.label}</li>)}</ul>
  </InfiniteScroll>;
}`,
} satisfies ExplorerCase;
export default explorerCase;
