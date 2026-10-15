import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button, FilterBar, FilterField, SearchInput, Select } from "../../../ui";
import { StatePreview } from "../state-preview";
import type { ExplorerCase } from "../types";

interface TaskFilters {
  task: string;
  status: string;
  type: string;
  country: string;
  phone: string;
}

const emptyFilters: TaskFilters = { task: "", status: "all", type: "", country: "", phone: "" };
const tasks = [
  { id: "260901711381751879", status: "queued", type: "tgActive", country: "CA", phone: "15145034912" },
  { id: "260902711381751879", status: "running", type: "smsVerify", country: "GB", phone: "447700900123" },
  { id: "260903711381751879", status: "queued", type: "tgActive", country: "DE", phone: "4915123456789" },
];

function TaskFilterExample({ english = false, longContent = false }: { english?: boolean; longContent?: boolean }) {
  const [draft, setDraft] = useState<TaskFilters>({ ...emptyFilters });
  const [applied, setApplied] = useState<TaskFilters>({ ...emptyFilters });
  const [loading, setLoading] = useState(false);
  const [queryCount, setQueryCount] = useState(0);
  const pending = useRef(false);
  const revision = useRef(0);
  useEffect(() => () => { revision.current += 1; }, []);
  const update = (key: keyof TaskFilters, value: string) => setDraft((current) => ({ ...current, [key]: value }));
  const results = tasks.filter((task) => (
    task.id.includes(applied.task)
    && (applied.status === "all" || task.status === applied.status)
    && task.type.toLocaleLowerCase().includes(applied.type.toLocaleLowerCase())
    && task.country.toLocaleLowerCase().includes(applied.country.toLocaleLowerCase())
    && task.phone.includes(applied.phone)
  ));
  const applyFilters = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    const requestRevision = revision.current;
    const snapshot: TaskFilters = {
      task: draft.task.trim(), status: draft.status, type: draft.type.trim(),
      country: draft.country.trim(), phone: draft.phone.trim(),
    };
    setLoading(true);
    try {
      await new Promise<void>((resolve) => window.setTimeout(resolve, 500));
      if (requestRevision !== revision.current) return;
      setApplied(snapshot);
      setQueryCount((count) => count + 1);
    } finally {
      if (requestRevision === revision.current) {
        pending.current = false;
        setLoading(false);
      }
    }
  };
  const reset = () => {
    if (pending.current) return;
    setDraft({ ...emptyFilters });
    setApplied({ ...emptyFilters });
    setQueryCount(0);
  };
  const resultStatus = english
    ? `${loading ? "Searching; " : ""}${queryCount} completed searches; ${results.length} results; applied task: ${applied.task || "all"}`
    : `${loading ? "正在查询；" : ""}已完成 ${queryCount} 次查询；共 ${results.length} 条结果；已应用任务编号：${applied.task || "全部"}`;
  return <FilterBar
    ariaLabel={english ? "Task archive filters" : "任务档案多字段筛选"}
    onSubmit={applyFilters}
    actions={<><Button type="submit" size="field" variant="primary" loading={loading} loadingLabel={english ? "Search" : "查询"}>{english ? "Search" : "查询"}</Button><Button type="button" size="field" disabled={loading} onClick={reset}>{english ? "Reset" : "重置"}</Button></>}
    status={resultStatus}
  >
    <FilterField width={220}><SearchInput aria-label={english ? "Task ID" : "任务编号"} placeholder={english ? "Task ID" : "输入任务编号"} value={draft.task} onChange={(event) => update("task", event.currentTarget.value)} onClear={() => update("task", "")} /></FilterField>
    <FilterField width="short"><Select ariaLabel={english ? "Task status" : "任务状态"} value={draft.status} onValueChange={(value) => update("status", value)} options={[
      { value: "all", label: english ? "All statuses" : "全部状态" },
      { value: "queued", label: english ? "Queued" : "排队中" },
      { value: "running", label: english ? "Running" : longContent ? "正在处理跨区域任务与后续通知" : "执行中" },
    ]} /></FilterField>
    <FilterField width={180}><SearchInput aria-label={english ? "Task type" : "任务类型"} placeholder={english ? "Task type" : "输入任务类型"} value={draft.type} onChange={(event) => update("type", event.currentTarget.value)} onClear={() => update("type", "")} /></FilterField>
    <FilterField width="short"><SearchInput aria-label={english ? "Country code" : "国家代码"} placeholder={english ? "Enter country code" : "输入国家代码"} value={draft.country} onChange={(event) => update("country", event.currentTarget.value)} onClear={() => update("country", "")} /></FilterField>
    <FilterField><SearchInput aria-label={english ? "Phone number" : "号码"} placeholder={english ? "Phone or partial number" : longContent ? "输入完整号码或任意一段号码以搜索匹配记录" : "号码或部分号码"} value={draft.phone} onChange={(event) => update("phone", event.currentTarget.value)} onClear={() => update("phone", "")} /></FilterField>
  </FilterBar>;
}

const explorerCase = {
  id: "filter-bar/field-sizing",
  label: "字段宽度与响应式",
  summary: "预设宽度会为输入提示与图标留足空间，最长扩展到 360px；明确的像素数值保持固定。桌面字段不平均拉长，窄容器自动纵排，宽度不随输入文字变化。",
  previewLayout: "page",
  states: ["default", "longContent", "keyboard", "mobile", "dark", "locale"],
  stateExamples: [
    { state: "default", exports: ["FilterField"], content: <TaskFilterExample />, instructions: "任务编号固定 220px、任务类型固定 180px；国家使用 short 基线 140px，自动容纳完整提示与搜索、清除槽位。预设不会填满整行，也不随输入值变化。输入 260901 后查询，500ms 后应用一个匹配结果。" },
    { state: "longContent", exports: ["FilterField"], content: <TaskFilterExample longContent />, instructions: "号码的长提示最多扩宽到 360px，超出部分仍会截断；更长的说明应放在 Field 的标签或提示中，而不是全部塞入占位文字。状态下拉打开后仍可阅读完整选项。" },
    { state: "keyboard", exports: ["FilterField"], content: <TaskFilterExample />, instructions: "Tab 顺序跟随字段和操作；在搜索框按 Enter 提交。查询中继续输入只修改草稿，重复提交不会替换进行中的请求。" },
    { state: "mobile", exports: ["FilterField"], content: <StatePreview state="mobile"><TaskFilterExample /></StatePreview>, instructions: "容器宽度 320px 时五个字段各占一行，控件恢复 44px；查询和重置保持可用，无页面横向滚动。" },
    { state: "dark", exports: ["FilterField"], content: <StatePreview state="dark"><TaskFilterExample /></StatePreview> },
    { state: "locale", exports: ["FilterField"], content: <StatePreview state="locale"><TaskFilterExample english /></StatePreview> },
  ],
  content: <div style={{ padding: 20 }}><TaskFilterExample /></div>,
  code: `<FilterBar ariaLabel="任务档案筛选" onSubmit={applyFilters}
  actions={<><Button type="submit" size="field" variant="primary" loading={querying}>查询</Button><Button type="button" size="field" disabled={querying} onClick={resetFilters}>重置</Button></>}>
  <FilterField width={220}><SearchInput aria-label="任务编号" value={draft.task} onChange={changeTask} /></FilterField>
  <FilterField width="short"><Select ariaLabel="任务状态" value={draft.status} onValueChange={changeStatus} options={statuses} /></FilterField>
  <FilterField width={180}><SearchInput aria-label="任务类型" value={draft.type} onChange={changeType} /></FilterField>
  <FilterField width="short"><SearchInput aria-label="国家代码" placeholder="输入国家代码" value={draft.country} onChange={changeCountry} onClear={clearCountry} /></FilterField>
  <FilterField><SearchInput aria-label="号码" value={draft.phone} onChange={changePhone} /></FilterField>
</FilterBar>`,
} satisfies ExplorerCase;

export default explorerCase;
