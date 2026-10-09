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
    <InfiniteScroll hasMore={snapshot.hasMore} loadKey={snapshot.cursor} loading={snapshot.loading} disabled={disabled || snapshot.error !== null} onLoadMore={loadNext}>
      <ul aria-label="已加载记录">{snapshot.records.map((record) => <li key={record.id}>{record.label}</li>)}</ul>
    </InfiniteScroll>
    <p role="status" aria-label="加载状态">已加载 {snapshot.records.length} 条记录，cursor {snapshot.cursor}</p>
    {snapshot.error ? <Alert tone="danger" title="加载失败">{snapshot.error} 已有记录保留，请通过下方按钮重试。</Alert> : null}
    <LoadMore hasMore={snapshot.hasMore} loading={snapshot.loading} disabled={disabled} onLoadMore={loadNext} label="手动加载下一页" loadingLabel="正在加载下一页" />
  </Stack>;
}
const explorerCase = {
  id: "infinite-scroll/overview", label: "连续加载与键盘替代入口", summary: "官方 InfiniteScroll 与 LoadMore 共用同步请求锁、实际记录和 cursor；失败保留数据并支持手动重试，组件分别管理观察器与键盘入口。",
  states: ["default", "disabled", "loading", "longContent", "keyboard", "overlay", "dark", "locale"],
  content: <InfiniteScrollExample />,
  stateExamples: [
    { state: "default", exports: ["InfiniteScroll"], content: <InfiniteScrollExample /> },
    { state: "disabled", exports: ["InfiniteScroll"], instructions: "disabled 禁止观察器发起加载；本例同时禁用配套的手动按钮。", content: <Stack><InfiniteScroll hasMore disabled loadKey="disabled" onLoadMore={() => undefined}><p>已有记录。</p></InfiniteScroll><LoadMore hasMore disabled onLoadMore={() => undefined} /></Stack> },
    { state: "loading", exports: ["InfiniteScroll"], content: <Stack><InfiniteScroll hasMore loading loadKey="pending" onLoadMore={() => undefined}><p>当前记录仍保留；下方哨兵显示加载。</p></InfiniteScroll><LoadMore hasMore loading onLoadMore={() => undefined} /></Stack> },
    { state: "longContent", exports: ["InfiniteScroll"], content: <InfiniteScroll hasMore={false} loadKey="long" onLoadMore={() => undefined}><p>跨区域基础设施迁移项目的全部成员权限、数据访问范围与安全策略审核记录需要完整显示，并保留容器中的滚动和换行布局。</p></InfiniteScroll> },
    { state: "keyboard", exports: ["InfiniteScroll"], instructions: "InfiniteScroll 的观察器本身没有键盘激活动作；Tab 到官方配套 LoadMore，再用 Enter/Space 请求下一页。此例不改变 M5 的组合使用契约。", content: <InfiniteScrollExample /> },
    { state: "overlay", exports: ["InfiniteScroll"], content: <StatePreview state="overlay"><InfiniteScrollExample /></StatePreview> },
    { state: "dark", exports: ["InfiniteScroll"], content: <StatePreview state="dark"><InfiniteScrollExample /></StatePreview> },
    { state: "locale", exports: ["InfiniteScroll"], content: <StatePreview state="locale"><InfiniteScrollExample /></StatePreview> },
  ],
  code: `import { useCallback, useRef, useState } from "react";
import { Alert, InfiniteScroll, LoadMore, Stack } from "./personal-ui";

type RecordItem = { id: string; label: string };
type Page = { records: RecordItem[]; cursor: number; hasMore: boolean };
type Snapshot = Page & { loading: boolean; error: string | null };
const source = Array.from({ length: 6 }, (_, index) => ({ id: String(index + 1), label: "审核记录 " + (index + 1) }));
async function fetchPage(cursor: number): Promise<Page> {
  await new Promise<void>((resolve) => setTimeout(resolve, 650));
  const next = Math.min(cursor + 2, source.length);
  return { records: source.slice(cursor, next), cursor: next, hasMore: next < source.length };
}

export function RecordsExample({ disabled = false }: { disabled?: boolean }) {
  const [state, setState] = useState<Snapshot>({ records: source.slice(0, 2), cursor: 2, hasMore: true, loading: false, error: null });
  const current = useRef(state);
  const pending = useRef<Promise<void> | null>(null);
  const blocked = useRef(disabled);
  blocked.current = disabled;
  const loadNext = useCallback((): Promise<void> => {
    if (pending.current) return pending.current;
    if (blocked.current || !current.current.hasMore) return Promise.resolve();
    const cursor = current.current.cursor;
    const commit = (next: Snapshot) => { current.current = next; setState(next); };
    const request = Promise.resolve().then(() => fetchPage(cursor)).then(
      (page) => commit({ records: [...current.current.records, ...page.records], cursor: page.cursor, hasMore: page.hasMore, loading: true, error: null }),
      (error: unknown) => commit({ ...current.current, error: error instanceof Error ? error.message : "加载失败" }),
    ).finally(() => { pending.current = null; commit({ ...current.current, loading: false }); });
    pending.current = request;
    commit({ ...current.current, loading: true, error: null });
    return request;
  }, []);
  return <Stack>
    <InfiniteScroll hasMore={state.hasMore} loadKey={state.cursor} loading={state.loading} disabled={disabled || state.error !== null} onLoadMore={loadNext}>
      <ul>{state.records.map((record) => <li key={record.id}>{record.label}</li>)}</ul>
    </InfiniteScroll>
    <p role="status">已加载 {state.records.length} 条记录，cursor {state.cursor}</p>
    {state.error ? <Alert tone="danger" title="加载失败">{state.error} 已有记录保留，请通过下方按钮重试。</Alert> : null}
    <LoadMore hasMore={state.hasMore} loading={state.loading} disabled={disabled} onLoadMore={loadNext} label="手动加载下一页" />
  </Stack>;
}`,
} satisfies ExplorerCase;
export default explorerCase;
