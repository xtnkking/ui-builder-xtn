import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Save, UserPlus } from "lucide-react";
import {
  Button, Card, Checkbox, ClipboardButton, Drawer, Field, Form, Grid, Inline, Input, List,
  OverflowText, Pagination, SegmentedControl, Select, Stack, Tag, Textarea, useToast,
} from "../../../ui";
import {
  parseAccountText, validateAccount,
  type AccountDraft, type ImportRow, type ManagedAccount,
} from "./account-model";
import "./account-drawers.css";

type EditorProps = {
  open: boolean;
  account: ManagedAccount | null;
  accounts: ManagedAccount[];
  groups: string[];
  onOpenChange: (open: boolean) => void;
  onSave: (draft: AccountDraft, accountId?: string) => Promise<void>;
};

const emptyAccount: AccountDraft = {
  login: "", name: "", group: "未分组", note: "", enabled: true,
};

export function AccountEditor({ open, account, accounts, groups, onOpenChange, onSave }: EditorProps) {
  const formId = useId();
  const { toast } = useToast();
  const [draft, setDraft] = useState<AccountDraft>(emptyAccount);
  const [errors, setErrors] = useState<Partial<Record<keyof AccountDraft, string>>>({});
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const latestAccount = useRef(account);
  latestAccount.current = account;
  const latestGroups = useRef(groups);
  latestGroups.current = groups;
  const savedDrafts = useRef(new Map<string, AccountDraft>());
  const accountId = account?.id;
  const draftKey = accountId ?? "new";
  const groupOptions = Array.from(new Set(["未分组", ...groups])).map(group => ({ value: group, label: group }));

  useEffect(() => {
    if (!open) return;
    const current = latestAccount.current;
    const restored = savedDrafts.current.get(current?.id ?? "new") ?? (current ? {
      login: current.login, name: current.name, group: current.group,
      note: current.note, enabled: current.enabled,
    } : { ...emptyAccount });
    setDraft({ ...restored, group: latestGroups.current.includes(restored.group) ? restored.group : "未分组" });
    setErrors({});
  }, [open, accountId]);

  function update<Key extends keyof AccountDraft>(key: Key, value: AccountDraft[Key]) {
    setDraft(current => {
      const next = { ...current, [key]: value };
      savedDrafts.current.set(draftKey, next);
      return next;
    });
    setErrors(current => ({ ...current, [key]: undefined }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingRef.current) return;
    const nextErrors = validateAccount(draft, accounts, accountId);
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await onSave({
        login: draft.login.trim(), name: draft.name.trim(), group: draft.group.trim(),
        note: draft.note.trim(), enabled: draft.enabled,
      }, accountId);
      savedDrafts.current.delete(draftKey);
    } catch (error) {
      toast({
        description: error instanceof Error ? error.message : "保存失败，请稍后重试，填写内容已保留。",
        tone: "danger", dedupeKey: "save-account-error",
      });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  function changeOpen(nextOpen: boolean) {
    if (!savingRef.current) onOpenChange(nextOpen);
  }

  return <Drawer open={open} onOpenChange={changeOpen} title={account ? "编辑账号" : "新增账号"}
    width="large"
    closable={!saving} closeOnBackdropClick={!saving}
    footer={<Inline justify="end" gap="small">
      <Button type="button" disabled={saving} onClick={() => changeOpen(false)}>取消</Button>
      <Button type="submit" form={formId} variant="primary" icon={<Save aria-hidden="true" />}
        loading={saving} loadingLabel="保存" aria-label="保存账号">保存</Button>
    </Inline>}>
    <Form id={formId} onSubmit={submit}>
      <Field label="账号" htmlFor={`${formId}-login`} required error={errors.login}
        hint="填写唯一的账号标识，不需要密码；前后空格会自动去除。">
        <Input id={`${formId}-login`} name="login" value={draft.login}
          onChange={event => update("login", event.target.value)} required maxLength={80}
          autoComplete="off" placeholder="例如 game-account-001" disabled={saving} />
      </Field>
      <Grid minItemWidth={200} gap="medium" style={{ alignItems: "start" }}>
        <Field label="备注名" htmlFor={`${formId}-name`} required error={errors.name} hint="便于辨认账号，最多 40 个字。">
          <Input id={`${formId}-name`} name="name" value={draft.name}
            onChange={event => update("name", event.target.value)} required maxLength={40}
            placeholder="例如 五开主力一号" disabled={saving} />
        </Field>
        <Field label="分组" htmlFor={`${formId}-group`} error={errors.group}>
          <Select id={`${formId}-group`} name="group" value={draft.group}
            onValueChange={value => update("group", value)} options={groupOptions}
            ariaLabel="分组" disabled={saving} />
        </Field>
      </Grid>
      <Field label="备注" htmlFor={`${formId}-note`} error={errors.note} hint="记录用途或交接事项，最多 300 个字。">
        <Textarea id={`${formId}-note`} name="note" value={draft.note}
          onChange={event => update("note", event.target.value)} rows={4} maxLength={300}
          placeholder="例如 日常副本队伍，周末同步角色资料" disabled={saving} />
      </Field>
      <Checkbox name="enabled" label="启用账号" checked={draft.enabled}
        onChange={event => update("enabled", event.target.checked)} disabled={saving} />
    </Form>
  </Drawer>;
}

type ImportProps = {
  open: boolean;
  accounts: ManagedAccount[];
  onOpenChange: (open: boolean) => void;
  onImport: (rows: ImportRow[]) => Promise<void>;
};

type ImportPreview = {
  source: string;
  result: ReturnType<typeof parseAccountText>;
};

const exampleAccounts = "new-demo-001 | 新增演示一 | 日常\nnew-demo-002 | 新增演示二 | 备用";
const previewPageSize = 8;
type PreviewScope = "all" | "invalid" | "duplicate";

export function ImportAccounts({ open, accounts, onOpenChange, onImport }: ImportProps) {
  const formId = useId();
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [page, setPage] = useState(1);
  const [scope, setScope] = useState<PreviewScope>("all");
  const [inputError, setInputError] = useState<string>();
  const [importing, setImporting] = useState(false);
  const importingRef = useRef(false);

  const currentPreview = preview?.source === text ? preview.result : null;
  const rows = currentPreview?.rows ?? [];
  const validRows = rows.filter(row => row.status === "valid");
  const duplicateCount = rows.filter(row => row.status === "duplicate").length;
  const invalidCount = rows.filter(row => row.status === "invalid").length;
  const scopedRows = scope === "all" ? rows : rows.filter(row => row.status === scope);
  const pageCount = Math.max(1, Math.ceil(scopedRows.length / previewPageSize));
  const visibleRows = scopedRows.slice((page - 1) * previewPageSize, page * previewPageSize);
  const originalLines = text.split(/\r\n|\n|\r/u);
  const errorLines = rows.filter(row => row.status === "invalid")
    .map(row => originalLines[row.line - 1]).join("\n");
  const canImport = Boolean(currentPreview && !currentPreview.error && validRows.length);

  function updateText(nextText: string) {
    setText(nextText);
    setPreview(null);
    setPage(1);
    setScope("all");
    setInputError(undefined);
  }

  function parsePreview() {
    if (importingRef.current) return;
    if (!text.trim()) {
      setInputError("请先输入账号文本，每行一个账号。");
      setPreview(null);
      return;
    }
    const result = parseAccountText(text, accounts);
    setPreview({ source: text, result });
    setInputError(result.error);
    setPage(1);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (importingRef.current || !canImport) return;
    const latest = parseAccountText(text, accounts);
    if (latest.error) {
      setInputError(latest.error);
      setPreview({ source: text, result: latest });
      return;
    }
    if (JSON.stringify(latest.rows) !== JSON.stringify(rows)) {
      setPreview({ source: text, result: latest });
      setInputError("账号列表已变化，请核对更新后的预览后再确认。");
      setPage(1);
      return;
    }
    const accepted = latest.rows.filter(row => row.status === "valid");
    if (!accepted.length) return;
    importingRef.current = true;
    setImporting(true);
    try {
      await onImport(accepted);
      setText("");
      setPreview(null);
      setPage(1);
      setScope("all");
      setInputError(undefined);
    } catch (error) {
      toast({
        description: error instanceof Error ? error.message : "批量新增失败，文本与预览已保留，请重试。",
        tone: "danger", dedupeKey: "import-accounts-error",
      });
    } finally {
      importingRef.current = false;
      setImporting(false);
    }
  }

  function changeOpen(nextOpen: boolean) {
    if (!importingRef.current) onOpenChange(nextOpen);
  }

  return <Drawer open={open} onOpenChange={changeOpen} title="批量新增账号" width="large"
    closable={!importing}
    closeOnBackdropClick={!importing}
    footer={<Inline justify="end" gap="small">
      <Button type="button" disabled={importing} onClick={() => changeOpen(false)}>取消</Button>
      <Button type="submit" form={formId} variant="primary" icon={<UserPlus aria-hidden="true" />}
        disabled={!canImport} loading={importing} loadingLabel="确认新增">确认新增</Button>
    </Inline>}>
    <Form id={formId} onSubmit={submit}>
      <Field label="账号文本" htmlFor={`${formId}-text`} required error={inputError}
        hint="每次最多 500 行。格式：账号 | 备注名 | 分组。账号必填，其余可省略；也支持 Tab 分隔，忽略空行。">
        <Textarea id={`${formId}-text`} name="accountText" value={text}
          onChange={event => updateText(event.target.value)} rows={8} maxLength={100000}
          placeholder={exampleAccounts} required disabled={importing} />
      </Field>
      <Inline gap="small">
        <Button type="button" size="small" disabled={importing} onClick={() => updateText(exampleAccounts)}>填入示例</Button>
        <Button type="button" size="small" disabled={importing} onClick={parsePreview}>解析预览</Button>
      </Inline>
      {currentPreview && <Card padding="small">
        <Stack gap="medium">
          <div aria-live="polite">
            <Inline gap="small">
              <Tag tone="success">有效 {validRows.length}</Tag>
              <Tag tone="warning">重复 {duplicateCount}</Tag>
              <Tag tone="danger">错误 {invalidCount}</Tag>
            </Inline>
          </div>
          <p className="demo-accounts-account-import-explanation">只新增有效账号，跳过重复和错误行，不覆盖已有资料。新增账号未登录，登录后才能获取角色。</p>
          {rows.length > 0 && <>
            <SegmentedControl value={scope} ariaLabel="预览范围" fill="mobile"
              options={[{ value: "all", label: "全部" }, { value: "invalid", label: "仅错误" }, { value: "duplicate", label: "仅重复" }]}
              disabled={importing} onValueChange={value => { setScope(value); setPage(1); }} />
            {invalidCount > 0 && <Inline><ClipboardButton text={errorLines} label="复制错误行" size="small" disabled={importing}
              onCopied={() => { toast({ description: `已复制 ${invalidCount} 行错误文本`, tone: "success" }); }}
              onError={() => { toast({ description: "复制失败，请手动选择账号文本。", tone: "danger" }); }} /></Inline>}
          </>}
          {rows.length > 0 && <List items={visibleRows} itemKey={row => String(row.line)}
            ariaLabel="逐行导入结果" density="compact"
            empty={<p className="demo-accounts-account-import-explanation">当前没有{scope === "invalid" ? "错误" : "重复"}行。</p>}
            renderItem={row => <div className="demo-accounts-account-import-row">
              <div className="demo-accounts-account-import-row-heading">
                <span className="demo-accounts-account-import-line">第 {row.line} 行</span>
                <Tag size="small" tone={row.status === "valid" ? "success" : row.status === "duplicate" ? "warning" : "danger"}>
                  {row.status === "valid" ? "可新增" : row.status === "duplicate" ? "重复" : "错误"}
                </Tag>
              </div>
              <div className="demo-accounts-account-import-copy">
                <OverflowText>{row.login || "未填写账号"}</OverflowText>
                {(row.name || row.group) && <div className="demo-accounts-account-import-row-meta"><OverflowText>{[row.name, row.group].filter(Boolean).join(" · ")}</OverflowText></div>}
                {row.message && <p className="demo-accounts-account-import-message">{row.message}</p>}
              </div>
            </div>} />}
          {scopedRows.length > previewPageSize && <Pagination page={page} pageCount={pageCount}
            total={scopedRows.length} pageSize={previewPageSize} disabled={importing}
            onPageChange={nextPage => setPage(nextPage)} />}
          <p className="demo-accounts-account-import-explanation" role="status">本次将新增 {canImport ? validRows.length : 0} 个账号。</p>
        </Stack>
      </Card>}
    </Form>
  </Drawer>;
}
