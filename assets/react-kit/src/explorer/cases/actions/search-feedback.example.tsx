import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Button,
  DataTable,
  FilterBar,
  FilterField,
  Inline,
  SearchInput,
  Stack,
  Switch,
  TableCellText,
  ToastProvider,
  useToast,
  type DataColumn,
  type DataTableState,
} from "../../../ui";
import { StatePreview } from "../state-preview";
import type { ExplorerCase } from "../types";
import sourceCode from "./search-feedback.example.tsx?raw";

interface MemberRow {
  id: string;
  name: string;
  email: string;
  team: string;
}

interface SearchSnapshot {
  query: string;
  page: number;
}

interface SearchResult extends SearchSnapshot {
  rows: MemberRow[];
  total: number;
}

type RequestReason = "initial" | "search" | "reset" | "page" | "retry";

const pageSize = 3;
const members: MemberRow[] = [
  { id: "member-lin", name: "林夏", email: "linxia@example.com", team: "产品设计组" },
  { id: "member-chen", name: "陈屿", email: "chenyu@example.com", team: "前端研发组" },
  { id: "member-wang", name: "王宁", email: "wangning@example.com", team: "客户服务组" },
  { id: "member-zhao", name: "赵舒", email: "zhaoshu@example.com", team: "产品设计组" },
  { id: "member-zhou", name: "周远", email: "zhouyuan@example.com", team: "前端研发组" },
  { id: "member-xu", name: "许言", email: "xuyan@example.com", team: "客户服务组" },
];

const columns: DataColumn<MemberRow>[] = [
  { id: "member", header: "成员", minWidth: 240, cell: (row) => <TableCellText secondary={row.email}>{row.name}</TableCellText> },
  { id: "team", header: "所属团队", minWidth: 160, cell: (row) => row.team },
];

async function queryMembers(snapshot: SearchSnapshot, simulateFailure: boolean, signal: AbortSignal): Promise<SearchResult> {
  await new Promise<void>((resolve, reject) => {
    const cancel = () => {
      window.clearTimeout(timer);
      reject(new Error("查询已取消"));
    };
    const timer = window.setTimeout(() => {
      signal.removeEventListener("abort", cancel);
      resolve();
    }, 500);
    signal.addEventListener("abort", cancel, { once: true });
  });
  if (signal.aborted) throw new Error("查询已取消");
  if (simulateFailure) throw new Error("模拟查询失败");
  const keyword = snapshot.query.toLocaleLowerCase();
  const matched = members.filter((member) => `${member.name} ${member.email}`.toLocaleLowerCase().includes(keyword));
  const page = Math.min(snapshot.page, Math.max(1, Math.ceil(matched.length / pageSize)));
  return { query: snapshot.query, page, total: matched.length, rows: matched.slice((page - 1) * pageSize, page * pageSize) };
}

function MemberSearch({ defaultSuccessFeedback = true }: { defaultSuccessFeedback?: boolean }) {
  const { toast } = useToast();
  const [draft, setDraft] = useState("");
  const [successFeedback, setSuccessFeedback] = useState(defaultSuccessFeedback);
  const [result, setResult] = useState<SearchResult>({ query: "", page: 1, rows: [], total: 0 });
  const [tableState, setTableState] = useState<DataTableState>("loading");
  const [querying, setQuerying] = useState(false);
  const [failedSnapshot, setFailedSnapshot] = useState<SearchSnapshot | null>(null);
  const [failureArmed, setFailureArmed] = useState(false);
  const pending = useRef(false);
  const nextFailure = useRef(false);
  const revision = useRef(0);
  const activeRequest = useRef<AbortController | null>(null);

  const runRequest = async (snapshot: SearchSnapshot, reason: RequestReason) => {
    // Lock synchronously; a second click or Enter cannot race React's loading render.
    if (pending.current) return;
    pending.current = true;
    const requestRevision = ++revision.current;
    const controller = new AbortController();
    activeRequest.current = controller;
    const simulateFailure = nextFailure.current;
    const notifyOnSuccess = reason === "search" && successFeedback;
    nextFailure.current = false;
    setFailureArmed(false);
    setQuerying(true);
    if (reason !== "retry") setTableState("loading");
    try {
      const response = await queryMembers(snapshot, simulateFailure, controller.signal);
      if (controller.signal.aborted || requestRevision !== revision.current) return;
      setResult(response);
      setFailedSnapshot(null);
      setTableState(response.total === 0 ? "empty" : "ready");
      if (notifyOnSuccess) {
        toast({
          tone: response.total === 0 ? "info" : "success",
          title: response.total === 0 ? "未找到匹配结果" : "查询完成",
          description: response.total === 0 ? "请调整关键词后重新查询。" : "结果已更新，可继续查看成员列表。",
          duration: 2500,
        });
      }
    } catch {
      if (controller.signal.aborted || requestRevision !== revision.current) return;
      // DataTable owns the error Toast and retry UI. Keep the last successful rows,
      // applied query and page; do not send a second error notification here.
      setFailedSnapshot(snapshot);
      setTableState("error");
    } finally {
      if (requestRevision === revision.current) {
        pending.current = false;
        activeRequest.current = null;
        setQuerying(false);
      }
    }
  };

  useEffect(() => {
    void runRequest({ query: "", page: 1 }, "initial");
    return () => {
      revision.current += 1;
      activeRequest.current?.abort();
      pending.current = false;
    };
    // Initial loading is intentionally silent. Subsequent requests come only
    // from the explicit handlers below, not draft or notification-setting edits.
  }, []);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void runRequest({ query: draft.trim(), page: 1 }, "search");
  };
  const reset = () => {
    if (pending.current) return;
    setDraft("");
    void runRequest({ query: "", page: 1 }, "reset");
  };
  const retry = () => {
    if (failedSnapshot) void runRequest(failedSnapshot, "retry");
  };

  return <Stack gap="medium">
    <Inline gap="medium">
      <Switch label="搜索完成后轻提示" checked={successFeedback} disabled={querying} onChange={(event) => setSuccessFeedback(event.currentTarget.checked)} />
      <Button type="button" size="small" disabled={querying || failureArmed} onClick={() => {
        nextFailure.current = true;
        setFailureArmed(true);
      }}>模拟下次查询失败</Button>
    </Inline>
    <FilterBar ariaLabel="成员查询" onSubmit={submit} actions={<>
      <Button type="submit" size="field" variant="primary" loading={querying} loadingLabel="查询">查询</Button>
      <Button type="button" size="field" disabled={querying} onClick={reset}>重置</Button>
    </>}>
      <FilterField><SearchInput aria-label="成员关键词" placeholder="输入姓名或邮箱" value={draft} onChange={(event) => setDraft(event.currentTarget.value)} onClear={() => setDraft("")} /></FilterField>
    </FilterBar>
    <p>已应用关键词：{result.query || "全部成员"}</p>
    <DataTable
      ariaLabel="成员列表"
      columns={columns}
      rows={result.rows}
      rowKey={(row) => row.id}
      state={tableState}
      viewportRows={3}
      loadingRows={3}
      emptyTitle="没有匹配的成员"
      emptyDescription="请调整姓名或邮箱关键词后重新查询。"
      errorTitle="查询失败"
      errorDescription="已保留上次结果，请重试。"
      onRetry={retry}
      retrying={querying && tableState === "error"}
      mobileRow={(row) => <TableCellText secondary={`${row.email} · ${row.team}`}>{row.name}</TableCellText>}
      pagination={{
        page: result.page,
        pageCount: Math.max(1, Math.ceil(result.total / pageSize)),
        pageSize,
        total: result.total,
        disabled: querying,
        onPageChange: (page) => { void runRequest({ query: result.query, page }, "page"); },
      }}
    />
  </Stack>;
}

export function MemberSearchFeedbackExample({ defaultSuccessFeedback = true }: { defaultSuccessFeedback?: boolean }) {
  return <ToastProvider><MemberSearch defaultSuccessFeedback={defaultSuccessFeedback} /></ToastProvider>;
}

const explorerCase = {
  id: "filter-bar/search-feedback",
  label: "搜索反馈",
  summary: "显式查询完成后可使用短轻提示；先等待请求成功，再通知结果已更新。首次加载、重置、翻页和重试成功保持安静；查询失败由表格统一通知并保留上次结果。",
  previewLayout: "page",
  states: ["default", "controlled", "keyboard", "mobile"],
  content: <MemberSearchFeedbackExample />,
  stateExamples: [
    { state: "default", exports: ["FilterBar", "FilterField", "SearchInput", "DataTable", "ToastProvider", "useToast"], content: <MemberSearchFeedbackExample />, instructions: "输入林夏后点击查询，500ms 请求成功才出现“查询完成”。编辑关键词不自动查询。模拟下次失败后提交，表格只通知一次，并保留上次结果；重试使用失败时的关键词。" },
    { state: "controlled", exports: ["Switch"], content: <MemberSearchFeedbackExample defaultSuccessFeedback={false} />, instructions: "此示例关闭成功轻提示，只用表格结果反馈查询完成；开启开关后，下次显式查询才弹出成功或空结果轻提示。" },
    { state: "keyboard", exports: ["FilterBar", "SearchInput"], content: <MemberSearchFeedbackExample />, instructions: "在成员关键词输入框按 Enter 提交。请求期间重复点击或 Enter 不会增加请求；修改草稿不会改变当前请求快照。" },
    { state: "mobile", exports: ["FilterField", "DataTable"], content: <StatePreview state="mobile"><MemberSearchFeedbackExample /></StatePreview>, instructions: "320px 使用官方筛选字段和表格移动行，不缩小控件或覆盖样式；查询、重置、分页与重试仍可用。" },
  ],
  code: sourceCode,
} satisfies ExplorerCase;

export default explorerCase;
