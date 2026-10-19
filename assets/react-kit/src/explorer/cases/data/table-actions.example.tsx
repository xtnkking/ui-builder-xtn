import { useEffect, useId, useRef, useState } from "react";
import { Activity, Copy, Eye, Pencil, Trash2 } from "lucide-react";
import {
  Button, ConfirmDialog, DataTable, Dialog, DropdownMenu, Field, Form,
  IconButton, Inline, Input, TableCellText, Tag, Tooltip, useToast,
  type DataColumn,
} from "../../../ui";
import { StatePreview } from "../state-preview";
import type { ExplorerCase } from "../types";

interface ProxyRow {
  id: string;
  name: string;
  address: string;
  readOnly: boolean;
}

const initialRows: ProxyRow[] = [
  { id: "proxy-a", name: "代理 A", address: "proxy-a.example.com:8080", readOnly: false },
  { id: "proxy-b", name: "代理 B", address: "proxy-b.example.com:8080", readOnly: false },
  { id: "proxy-readonly", name: "只读代理", address: "readonly.example.com:8080", readOnly: true },
];

function TableActionsExample({ more = false }: { more?: boolean }) {
  const [rows, setRows] = useState(() => initialRows.map((row) => ({
    ...row,
    address: more ? `${row.address}/international-subscription-platform/connection-with-a-deliberately-long-address` : row.address,
  })));
  const [editing, setEditing] = useState<ProxyRow | null>(null);
  const [draftName, setDraftName] = useState("");
  const [deleting, setDeleting] = useState<ProxyRow | null>(null);
  const [viewing, setViewing] = useState<ProxyRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<"check" | "save" | "delete" | "copy" | null>(null);
  const pending = useRef(false);
  const pendingCommand = useRef<Promise<void> | null>(null);
  const revision = useRef(0);
  const nameId = useId();
  const formId = useId();
  const { toast } = useToast();
  useEffect(() => () => { revision.current += 1; }, []);

  // A synchronous lock also blocks repeated activation before loading renders.
  const runCommand = (id: string, action: "check" | "save" | "delete", command: () => void): Promise<void> => {
    if (pendingCommand.current) return pendingCommand.current;
    if (pending.current) return Promise.resolve();
    pending.current = true;
    setBusyId(id);
    setBusyAction(action);
    const currentRevision = revision.current;
    const operation = (async () => {
      try {
        await new Promise<void>((resolve) => window.setTimeout(resolve, 500));
        if (currentRevision !== revision.current) return;
        command();
      } finally {
        pendingCommand.current = null;
        if (currentRevision === revision.current) {
          pending.current = false;
          setBusyId(null);
          setBusyAction(null);
        }
      }
    })();
    pendingCommand.current = operation;
    return operation;
  };
  const startEdit = (row: ProxyRow) => {
    if (row.readOnly || pending.current) return;
    setDraftName(row.name);
    setEditing(row);
  };
  const startDelete = (row: ProxyRow) => {
    if (!row.readOnly && !pending.current) setDeleting(row);
  };
  const save = () => {
    const name = draftName.trim();
    if (!editing || editing.readOnly || !name) return;
    const id = editing.id;
    void runCommand(id, "save", () => {
      setRows((current) => current.map((row) => row.id === id ? { ...row, name } : row));
      setEditing(null);
      toast({ tone: "success", title: "已保存修改", description: `代理名称已更新为${name}。` });
    });
  };
  const remove = async () => {
    if (!deleting || deleting.readOnly) return;
    const target = deleting;
    await runCommand(target.id, "delete", () => {
      setRows((current) => current.filter((row) => row.id !== target.id));
      toast({ tone: "success", title: "已删除代理", description: `已删除${target.name}，列表数据已同步更新。` });
    });
  };
  const copyAddress = async (row: ProxyRow) => {
    if (pending.current) return;
    const currentRevision = revision.current;
    pending.current = true;
    setBusyId(row.id);
    setBusyAction("copy");
    try {
      await navigator.clipboard.writeText(row.address);
      if (currentRevision === revision.current) toast({ tone: "success", title: "已复制地址", description: `${row.name}的连接地址已复制。` });
    } catch {
      if (currentRevision === revision.current) toast({ tone: "danger", title: "复制失败", description: "浏览器未允许写入剪贴板，请从查看记录中选取连接地址。" });
    } finally {
      if (currentRevision === revision.current) {
        pending.current = false;
        setBusyId(null);
        setBusyAction(null);
      }
    }
  };
  const checkConnection = (row: ProxyRow) => runCommand(row.id, "check", () => {
    toast({ tone: "success", title: "连接检查完成", description: `${row.name}的演示检测结果正常；实际项目应替换为连接检测接口。` });
  });
  const columns: DataColumn<ProxyRow>[] = [
    { id: "name", header: "名称", width: 180, cell: (row) => <TableCellText secondary={row.readOnly ? "可检测，编辑和删除不可用" : "可管理"}>{row.name}</TableCellText> },
    { id: "address", header: "连接地址", minWidth: 300, cell: (row) => row.address },
    { id: "protocol", header: "协议", width: 80, cell: () => "HTTP" },
    { id: "status", header: "状态", width: 100, cell: () => <Tag size="small" tone="success">已启用</Tag> },
    {
      id: "actions", header: "操作", width: more ? 120 : 164, pin: "end",
      cell: (row) => more ? <DropdownMenu
        label="更多"
        ariaLabel={`更多操作：${row.name}`}
        items={[
          { id: "edit", label: "编辑", icon: <Pencil />, disabled: row.readOnly || busyId !== null, onSelect: () => startEdit(row) },
          { id: "copy", label: "复制地址", icon: <Copy />, disabled: busyId !== null, onSelect: () => void copyAddress(row) },
          { id: "view", label: "查看记录", icon: <Eye />, disabled: busyId !== null, onSelect: () => setViewing(row) },
          { id: "check", label: "检测连接", icon: <Activity />, disabled: busyId !== null, onSelect: () => checkConnection(row) },
          { id: "delete", label: "删除", icon: <Trash2 />, danger: true, disabled: row.readOnly || busyId !== null, onSelect: () => startDelete(row) },
        ]}
      /> : <Inline gap="small" wrap={false} role="group" aria-label={`${row.name}的操作`}>
        <Tooltip content="检测连接">
          <IconButton icon={<Activity />} aria-label={`检测${row.name}`} loading={busyId === row.id && busyAction === "check"}
            disabled={busyId !== null && (busyId !== row.id || busyAction !== "check")} onClick={() => void checkConnection(row)} />
        </Tooltip>
        <Tooltip content="编辑" disabled={row.readOnly}>
          <IconButton icon={<Pencil />} aria-label={`编辑${row.name}`} disabled={row.readOnly || busyId !== null} onClick={() => startEdit(row)} />
        </Tooltip>
        <Tooltip content="删除" disabled={row.readOnly}>
          <IconButton icon={<Trash2 />} variant="danger" aria-label={`删除${row.name}`} disabled={row.readOnly || busyId !== null} onClick={() => startDelete(row)} />
        </Tooltip>
      </Inline>,
    },
  ];
  return <div style={{ display: "grid", gap: 20, minWidth: 0 }}>
    <DataTable ariaLabel="代理操作示例" columns={columns} rows={rows} rowKey={(row) => row.id} viewportRows={3} state={rows.length ? "ready" : "empty"} />
    <p style={{ margin: 0 }}>{more ? "次要或较多操作统一收进更多菜单；每项仍有中文名称与图标。" : "检测、编辑、删除统一使用图标按钮，悬停或键盘聚焦时显示中文提示。检测时仅当前按钮显示加载状态，避免重复请求。"}</p>
    <Dialog open={editing !== null} onOpenChange={(open) => { if (!open && !pending.current) setEditing(null); }}
      title="编辑代理" width="small" closable={busyId === null} closeOnBackdropClick={false}
      footer={<><Button disabled={busyId !== null} onClick={() => setEditing(null)}>取消</Button><Button type="submit" form={formId} variant="primary" loading={busyId === editing?.id} loadingLabel="保存修改" disabled={!draftName.trim()}>保存修改</Button></>}
    >
      <Form id={formId} busy={busyId !== null} onSubmit={(event) => { event.preventDefault(); save(); }}>
        <Field label="代理名称" htmlFor={nameId}>
          <Input id={nameId} name="name" value={draftName} required maxLength={60} disabled={busyId !== null} onChange={(event) => setDraftName(event.currentTarget.value)} />
        </Field>
      </Form>
    </Dialog>
    <ConfirmDialog open={deleting !== null} onOpenChange={(open) => { if (!open) setDeleting(null); }} title="删除代理"
      description={`确认删除${deleting?.name ?? "该代理"}？此操作无法撤销。`} confirmLabel="删除代理" cancelLabel="取消" tone="danger" closeOnBackdropClick={false} onConfirm={remove} />
    <Dialog open={viewing !== null} onOpenChange={(open) => { if (!open) setViewing(null); }} title="代理记录" width="small">
      <TableCellText wrap secondary={viewing?.address ?? ""}>{viewing?.name ?? ""}</TableCellText>
    </Dialog>
  </div>;
}

const explorerCase = {
  id: "data-table/actions",
  label: "操作列组合",
  summary: "检测、编辑、删除等两至三个常用操作优先使用同一组横向图标按钮，较多或次要操作统一收进更多菜单。同一列不默认混用文字与图标；中文提示、固定列宽、只读状态、异步锁和删除确认由业务组合提供。",
  states: ["default", "longContent", "keyboard", "mobile", "dark"],
  content: <TableActionsExample />,
  stateExamples: [
    { state: "default", exports: ["DataTable", "IconButton", "Tooltip", "Inline", "ConfirmDialog"], content: <TableActionsExample />, instructions: "检测显示真实加载状态并在完成后发送一次轻提示；编辑实际更新名称，删除须确认后才移除记录。只读代理仍可检测。" },
    { state: "longContent", exports: ["DataTable", "DropdownMenu", "ConfirmDialog"], content: <TableActionsExample more />, instructions: "长地址在自己的列宽内省略，操作列固定在右侧。五项操作使用一个更多菜单；只读记录禁用编辑和删除，仍可检测、复制地址和查看记录。" },
    { state: "keyboard", exports: ["DataTable", "IconButton", "Tooltip", "ConfirmDialog"], content: <TableActionsExample />, instructions: "Tab 聚焦图标即显示中文说明，Enter/Space 操作；编辑和删除弹窗支持取消，异步保存时锁定提交。更多菜单的方向键示例见长内容预览。" },
    { state: "mobile", exports: ["DataTable", "IconButton", "Inline"], content: <StatePreview state="mobile"><TableActionsExample /></StatePreview>, instructions: "窄屏只在表格内横向滚动，操作列保持可见；不缩小图标点击区域、不把三个操作挤成上下两行。" },
    { state: "dark", exports: ["DataTable", "IconButton", "Tooltip", "ConfirmDialog"], content: <StatePreview state="dark"><TableActionsExample /></StatePreview> },
  ],
  code: `const columns: DataColumn<Row>[] = [
  { id: "name", header: "名称", minWidth: 240, cell: (row) => row.name },
  { id: "actions", header: "操作", width: 164, pin: "end", cell: (row) => (
    <Inline gap="small" wrap={false} role="group" aria-label={row.name + "的操作"}>
      <Tooltip content="检测连接">
        <IconButton icon={<Activity />} aria-label={"检测" + row.name}
          loading={pendingId === row.id && pendingAction === "check"}
          disabled={pending && !(pendingId === row.id && pendingAction === "check")}
          onClick={() => checkConnection(row)} />
      </Tooltip>
      <Tooltip content="编辑" disabled={row.readOnly}>
        <IconButton icon={<Pencil />} aria-label={"编辑" + row.name}
          disabled={row.readOnly || pending} onClick={() => edit(row)} />
      </Tooltip>
      <Tooltip content="删除" disabled={row.readOnly}>
        <IconButton icon={<Trash2 />} variant="danger" aria-label={"删除" + row.name}
          disabled={row.readOnly || pending} onClick={() => setDeleting(row)} />
      </Tooltip>
    </Inline>
  ) },
];
// 默认 IconButton 是 36×36px；两按钮建议 120px，三按钮建议 164px。
// 检测、编辑、删除统一图标；更多或次要操作用 DropdownMenu，不另加触发器。
// 删除由一处 ConfirmDialog 确认，成功后用共享 Toast 反馈。
// 完整文件包含检测加载、编辑表单、异步锁、只读状态、实际删除与更多菜单。`,
} satisfies ExplorerCase;

export default explorerCase;
