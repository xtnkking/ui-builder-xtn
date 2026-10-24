import { useId, useRef, useState, type FormEvent } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  Button, ConfirmDialog, Drawer, Field, Form, IconButton, Inline, Input, List,
  OverflowText, Stack, Tooltip, useToast,
} from "../../../ui";
import type { ManagedAccount } from "./account-model";
import "./account-drawers.css";

type GroupManagerProps = {
  open: boolean;
  groups: string[];
  accounts: ManagedAccount[];
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string) => Promise<void>;
  onRename: (from: string, to: string) => Promise<void>;
  onDelete: (name: string) => Promise<void>;
};

const ungrouped = "未分组";

export function GroupManager({ open, groups, accounts, onOpenChange, onCreate, onRename, onDelete }: GroupManagerProps) {
  const formId = useId();
  const { toast } = useToast();
  const [newName, setNewName] = useState("");
  const [newError, setNewError] = useState<string>();
  const [editing, setEditing] = useState<string | null>(null);
  const [editedName, setEditedName] = useState("");
  const [editError, setEditError] = useState<string>();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [pending, setPending] = useState<"create" | "rename" | "delete" | null>(null);
  const pendingRef = useRef(false);
  const names = Array.from(new Set([ungrouped, ...groups]));
  const deletedAccountCount = accounts.filter(account => account.group === deleting).length;

  function validateName(value: string, except?: string): string | undefined {
    const name = value.trim();
    if (!name) return "请输入分组名称";
    if (name.length > 20) return "分组名称最多 20 个字";
    if (names.some(group => group !== except && group.toLocaleLowerCase() === name.toLocaleLowerCase())) return "该分组已存在";
    return undefined;
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingRef.current) return;
    const error = validateName(newName);
    setNewError(error);
    if (error) return;
    pendingRef.current = true;
    setPending("create");
    try {
      await onCreate(newName.trim());
      setNewName("");
    } catch (error) {
      toast({ description: error instanceof Error ? error.message : "新建分组失败，请重试。", tone: "danger" });
    } finally {
      pendingRef.current = false;
      setPending(null);
    }
  }

  async function rename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || pendingRef.current) return;
    const error = validateName(editedName, editing);
    setEditError(error);
    if (error) return;
    if (editedName.trim() === editing) {
      setEditing(null);
      return;
    }
    pendingRef.current = true;
    setPending("rename");
    try {
      await onRename(editing, editedName.trim());
      setEditing(null);
    } catch (error) {
      toast({ description: error instanceof Error ? error.message : "重命名失败，请重试。", tone: "danger" });
    } finally {
      pendingRef.current = false;
      setPending(null);
    }
  }

  async function remove() {
    if (!deleting || pendingRef.current) return;
    pendingRef.current = true;
    setPending("delete");
    try {
      await onDelete(deleting);
      if (editing === deleting) setEditing(null);
    } finally {
      pendingRef.current = false;
      setPending(null);
    }
  }

  return <>
    <Drawer open={open} title="分组管理" width="large" closable={!pending}
      closeOnBackdropClick={!pending} onOpenChange={nextOpen => { if (!pendingRef.current) onOpenChange(nextOpen); }}
      footer={<Inline justify="end"><Button disabled={Boolean(pending)} onClick={() => onOpenChange(false)}>完成</Button></Inline>}>
      <Stack gap="large">
        <Form id={`${formId}-create`} onSubmit={create}>
          <Field label="新分组" htmlFor={`${formId}-new-name`} error={newError} required>
            <div className="demo-accounts-account-group-create-row">
              <div className="demo-accounts-account-group-create-input">
                <Input id={`${formId}-new-name`} name="newGroup" value={newName} required maxLength={20}
                  placeholder="输入分组名称" disabled={Boolean(pending)}
                  onChange={event => { setNewName(event.target.value); setNewError(undefined); }} />
              </div>
              <div className="demo-accounts-account-group-create-action">
                <Button type="submit" variant="primary" size="field" icon={<Plus aria-hidden="true" />}
                  loading={pending === "create"} disabled={Boolean(pending && pending !== "create")} loadingLabel="新建分组">新建分组</Button>
              </div>
            </div>
          </Field>
        </Form>
        <List items={names} itemKey={name => name} ariaLabel="账号分组" density="compact"
          renderItem={name => editing === name ? <Form id={`${formId}-rename`} onSubmit={rename}>
            <div className="demo-accounts-account-group-editor">
              <div className="demo-accounts-account-group-field">
                <Field label="分组名称" htmlFor={`${formId}-edit-name`} error={editError} required>
                  <Input id={`${formId}-edit-name`} name="groupName" value={editedName} required maxLength={20}
                    disabled={Boolean(pending)} onChange={event => { setEditedName(event.target.value); setEditError(undefined); }} />
                </Field>
              </div>
              <Inline gap="small" wrap={false}>
                <Tooltip content="保存名称"><IconButton type="submit" icon={<Check aria-hidden="true" />}
                  aria-label={`保存分组名称：${name}`} loading={pending === "rename"} disabled={Boolean(pending && pending !== "rename")} /></Tooltip>
                <Tooltip content="取消修改"><IconButton icon={<X aria-hidden="true" />} aria-label={`取消重命名：${name}`}
                  disabled={Boolean(pending)} onClick={() => setEditing(null)} /></Tooltip>
              </Inline>
            </div>
          </Form> : <div className="demo-accounts-account-group-row">
            <div className="demo-accounts-account-group-copy">
              <OverflowText>{name}</OverflowText>
              <span className="demo-accounts-account-group-count">{accounts.filter(account => account.group === name).length} 个账号</span>
            </div>
            {name !== ungrouped && <Inline gap="small" wrap={false}>
              <Tooltip content="重命名"><IconButton icon={<Pencil aria-hidden="true" />} aria-label={`重命名分组：${name}`}
                disabled={Boolean(pending)} onClick={() => { setEditing(name); setEditedName(name); setEditError(undefined); }} /></Tooltip>
              <Tooltip content="删除分组"><IconButton icon={<Trash2 aria-hidden="true" />} aria-label={`删除分组：${name}`} variant="danger"
                disabled={Boolean(pending)} onClick={() => setDeleting(name)} /></Tooltip>
            </Inline>}
          </div>} />
      </Stack>
    </Drawer>
    <ConfirmDialog open={deleting !== null} onOpenChange={nextOpen => { if (!nextOpen) setDeleting(null); }}
      title="删除分组？" tone="danger" confirmLabel="删除分组" errorMessage="删除分组失败，请重试。"
      description={`删除“${deleting ?? ""}”后，${deletedAccountCount} 个账号将移至“未分组”，不会删除账号或角色。`}
      onConfirm={remove} />
  </>;
}
