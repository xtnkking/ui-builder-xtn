import { useEffect, useRef, useState } from "react";
import { Download, FolderKanban, RotateCcw, UsersRound } from "lucide-react";
import {
  Button, Inline, InlineMessage, StatusIndicator, Tag, TreeTable,
  type TreeTableColumn, type TreeTableNode,
} from "../../../ui";
import { StatePreview } from "../state-preview";
import type { ExplorerCase } from "../types";

type ProjectRow = {
  name: string;
  kind: "项目" | "项目组" | "成员";
  owner: string;
};
type Node = TreeTableNode<ProjectRow>;
type LoadState = { status: "pending" | "success" | "error"; count?: number };

function branch(id: string, name: string, kind: "项目" | "项目组", owner: string): Node {
  return { id, value: { name, kind, owner }, hasChildren: true, children: [] };
}

function initialProjects(): Node[] {
  return [
    branch("project-collab", "客户协作平台", "项目", "林晓"),
    branch("project-internal", "内部工具项目", "项目", "陈屿"),
  ];
}

// 模拟完整的一次分支接口响应；替换此函数即可接入真实 API。
async function requestChildren(node: Node, fail: boolean): Promise<Node[]> {
  await new Promise<void>((resolve) => window.setTimeout(resolve, 900));
  if (fail) throw new Error("模拟网络失败");
  if (node.id === "project-collab") return [
    branch("project-collab/design", "产品设计组", "项目组", "赵舒"),
    branch("project-collab/platform", "平台开发组", "项目组", "王宁"),
    branch("project-collab/quality", "质量保障组", "项目组", "周远"),
  ];
  const members: Record<string, readonly (readonly [string, string, string])[]> = {
    "project-collab/design": [["zhao", "赵舒", "产品设计师"], ["chen", "陈晨", "交互设计师"]],
    "project-collab/platform": [["wang", "王宁", "前端工程师"], ["xu", "许言", "后端工程师"], ["li", "李沐", "研发工程师"]],
  };
  return (members[node.id] ?? []).map(([id, name, owner]) => ({
    id: `${node.id}/${id}`, value: { name, kind: "成员", owner },
  }));
}

function replaceChildren(nodes: readonly Node[], parentId: string, children: readonly Node[]): Node[] {
  return nodes.map((node) => node.id === parentId
    ? { ...node, children }
    : node.children ? { ...node, children: replaceChildren(node.children, parentId, children) } : node);
}

function flatten(nodes: readonly Node[]): Node[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children ?? [])]);
}

export function ProjectMembersExample({ failFirstMemberRequest = false }: { failFirstMemberRequest?: boolean }) {
  const [nodes, setNodes] = useState<Node[]>(initialProjects);
  const [expandedIds, setExpandedIds] = useState<string[]>(["project-collab", "project-internal"]);
  const [loads, setLoads] = useState<Record<string, LoadState>>({});
  const [requestCount, setRequestCount] = useState(0);
  // 同步锁覆盖同一帧的连续点击；每个节点独立请求，互不覆盖。
  const pending = useRef(new Set<string>());
  const loaded = useRef(new Set<string>());
  const failedOnce = useRef(false);
  const generation = useRef(0);
  useEffect(() => () => { generation.current += 1; }, []);

  function reset() {
    generation.current += 1;
    pending.current.clear();
    loaded.current.clear();
    failedOnce.current = false;
    setNodes(initialProjects());
    setExpandedIds(["project-collab", "project-internal"]);
    setLoads({});
    setRequestCount(0);
  }

  async function loadChildren(node: Node) {
    if (node.value.kind === "成员" || pending.current.has(node.id) || loaded.current.has(node.id)) return;
    const requestGeneration = generation.current;
    const fail = failFirstMemberRequest && node.value.kind === "项目组" && !failedOnce.current;
    if (fail) failedOnce.current = true;
    pending.current.add(node.id);
    setRequestCount((count) => count + 1);
    setLoads((current) => ({ ...current, [node.id]: { status: "pending" } }));
    setExpandedIds((current) => Array.from(new Set([...current, node.id])));
    try {
      const children = await requestChildren(node, fail);
      if (generation.current !== requestGeneration) return;
      loaded.current.add(node.id);
      setNodes((current) => replaceChildren(current, node.id, children));
      setLoads((current) => ({ ...current, [node.id]: { status: "success", count: children.length } }));
      // 新组可展开，但绝不自动请求成员。
      setExpandedIds((current) => Array.from(new Set([...current, ...children.filter((child) => child.hasChildren).map((child) => child.id)])));
    } catch {
      if (generation.current !== requestGeneration) return;
      setLoads((current) => ({ ...current, [node.id]: { status: "error" } }));
    } finally {
      if (generation.current === requestGeneration) pending.current.delete(node.id);
    }
  }

  const entries = flatten(nodes);
  const groupCount = entries.filter((node) => node.value.kind === "项目组").length;
  const memberCount = entries.filter((node) => node.value.kind === "成员").length;
  const columns: TreeTableColumn<ProjectRow>[] = [
    { id: "name", header: "项目 / 项目组 / 成员", width: 260,
      cell: (value) => value.kind === "成员" ? value.name : <strong title={value.name}>{value.name}</strong> },
    { id: "kind", header: "类型", width: 110, cell: (value) => value.kind === "成员" ? value.kind :
      <Tag tone={value.kind === "项目" ? "blue" : "neutral"}
        leading={value.kind === "项目" ? <FolderKanban /> : <UsersRound />}>{value.kind}</Tag> },
    { id: "owner", header: "负责人 / 职责", width: 150, cell: (value) => value.owner },
    { id: "children", header: "下级数据", width: 160, cell: (value, { node }) => {
      if (value.kind === "成员") return "—";
      const state = loads[node.id];
      if (state?.status === "error") return <InlineMessage tone="danger">加载失败</InlineMessage>;
      if (state?.status === "success") return <StatusIndicator tone={state.count ? "success" : "neutral"}
        label={value.kind === "项目"
          ? state.count ? `${state.count} 个项目组` : "暂无项目组"
          : state.count ? `${state.count} 位成员` : "暂无成员"} />;
      return <StatusIndicator tone="neutral" label={state?.status === "pending" ? "加载中" : "待加载"} />;
    } },
    { id: "actions", header: "操作", width: 170, cell: (value, { node }) => {
      if (value.kind === "成员") return "—";
      const state = loads[node.id];
      const label = value.kind === "项目" ? "加载所有项目组" : "加载所有成员";
      return <Button size="small" icon={<Download />} variant="secondary"
        aria-label={`${label}：${value.name}`}
        loading={state?.status === "pending"} loadingLabel={label}
        disabled={state?.status === "success"}
        onClick={() => void loadChildren(node)}>{label}</Button>;
    } },
  ];

  return <div style={{ display: "grid", gap: 16, minWidth: 0 }}>
    <InlineMessage>项目 → 项目组 → 成员逐级缩进；「下级数据」显示本行的直接下级数量。展开不请求，点击本行按钮加载全部下级；失败后点击同一按钮重试。</InlineMessage>
    <TreeTable ariaLabel="项目组织与成员" nodes={nodes} columns={columns} treeColumnId="name"
      getRowLabel={(node) => node.value.name}
      expandedIds={expandedIds} onExpandedChange={setExpandedIds}
      toolbar={<Inline role="group" aria-label="项目组织工具栏" gap="small">
        <Button size="small" onClick={() => setExpandedIds(entries.filter((node) => node.hasChildren).map((node) => node.id))}>展开已加载层级</Button>
        <Button size="small" onClick={() => setExpandedIds([])}>全部收起</Button>
        <Button size="small" icon={<RotateCcw />} onClick={reset}>重置案例</Button>
      </Inline>}
      footer={<span role="status" aria-live="polite">{nodes.length} 个项目 · {groupCount} 个项目组 · {memberCount} 位成员 · 已发起 {requestCount} 次请求</span>}
    />
  </div>;
}

const explorerCase = {
  id: "data-table/project-members",
  label: "项目、项目组与成员",
  summary: "三级树表业务案例：通过缩进、父级名称加粗和类型图标区分层级；父行「下级数据」显示直接下级数量，收起后仍可查看。项目和组按钮显式加载全部下级，含独立加载、空数据、失败重试及重置。",
  states: ["default", "error", "keyboard", "mobile", "usage"],
  content: <ProjectMembersExample />,
  stateExamples: [
    { state: "default", exports: ["TreeTable"], content: <ProjectMembersExample /> },
    { state: "error", exports: ["TreeTable"], content: <ProjectMembersExample failFirstMemberRequest />, instructions: "先加载客户协作平台的项目组；首次成员请求模拟失败，点击同一按钮重试即可成功。另一个组可同时加载，已有分支保留。" },
    { state: "keyboard", exports: ["TreeTable"], content: <ProjectMembersExample />, instructions: "Tab 聚焦项目或项目组的加载按钮，Enter/Space 请求；展开、收起及工具栏不会请求。窄屏聚焦表格区域后用方向键横向滚动。" },
    { state: "mobile", exports: ["TreeTable"], content: <StatePreview state="mobile"><ProjectMembersExample /></StatePreview> },
    { state: "usage", exports: ["TreeTable"], content: <ProjectMembersExample />, instructions: "内部工具项目返回空项目组；质量保障组返回空成员。成功后按钮禁用，重开分支复用已加载数据；重置案例可重新演示，进行中的旧请求不会写回重置后的树。真实项目只需将 requestChildren 替换为完整分支 API。" },
  ],
  code: `// 完整可运行实现：cases/data/project-members.example.tsx
// 所有控件均从公开 ui barrel 导入；业务侧管理节点和每个分支的请求状态。
const columns: TreeTableColumn<ProjectRow>[] = [
  { id: "name", header: "名称", cell: (value) => value.name },
  { id: "children", header: "下级数据", cell: (value, { node }) => {
    if (value.kind === "成员") return "—";
    const state = loads[node.id];
    if (state?.status === "error") return <InlineMessage tone="danger">加载失败</InlineMessage>;
    if (state?.status === "success") return <StatusIndicator
      tone={state.count ? "success" : "neutral"}
      label={value.kind === "项目"
        ? state.count ? state.count + " 个项目组" : "暂无项目组"
        : state.count ? state.count + " 位成员" : "暂无成员"} />;
    return <StatusIndicator label={state?.status === "pending" ? "加载中" : "待加载"} />;
  } },
  { id: "actions", header: "操作", cell: (value, { node }) =>
    value.kind === "成员" ? "—" :
    <Button size="small" loading={loads[node.id]?.status === "pending"}
      loadingLabel={value.kind === "项目" ? "加载所有项目组" : "加载所有成员"}
      disabled={loads[node.id]?.status === "success"}
      onClick={() => loadChildren(node)}>
      {value.kind === "项目" ? "加载所有项目组" : "加载所有成员"}
    </Button> },
];
<TreeTable nodes={nodes} columns={columns} treeColumnId="name"
  expandedIds={expandedIds} onExpandedChange={setExpandedIds}
  getRowLabel={(node) => node.value.name} ariaLabel="项目组织与成员" />
// 数量与请求状态留在父行，收起仍能看到；不再在整个子树末尾重复提示。
// 不传 onRequestChildren：展开不触发请求。项目和组初始 children:[] / hasChildren:true。
// 请求成功后按 node.id 函数式替换 children；成员是没有 children 的叶节点。
// 同步节点锁阻止重复请求；独立状态支持并发、重试和重置失效保护。`,
} satisfies ExplorerCase;

export default explorerCase;
