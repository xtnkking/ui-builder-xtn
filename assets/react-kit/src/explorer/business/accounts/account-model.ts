import { accounts as originalAccounts, type Account, type Role } from "./roles";

export type ManagedAccount = Account & {
  group: string;
  enabled: boolean;
  session: "offline" | "online";
};
export type AccountDraft = {
  login: string;
  name: string;
  group: string;
  note: string;
  enabled: boolean;
};
export type AccountFilters = {
  query: string;
  server: string;
  school: string;
  group: string;
  status: "all" | "enabled" | "disabled";
};
export type FilteredAccount = { account: ManagedAccount; roles: Role[]; accountMatches: boolean };
export type ImportRow = {
  line: number;
  login: string;
  name: string;
  group: string;
  status: "valid" | "duplicate" | "invalid";
  message: string;
};
export type AccountImportResult = {
  rows: ImportRow[];
  valid: ImportRow[];
  duplicates: ImportRow[];
  invalid: ImportRow[];
  error?: string;
};

const roleTemplates = originalAccounts.flatMap(account => account.roles);
const accountGroups = ["主力队伍", "日常任务", "收藏备用"];
const ungrouped = "未分组";

export function normalizeLogin(login: string): string {
  return login.trim().toLowerCase();
}

function loginError(login: string): string | undefined {
  if (!login) return "请输入账号";
  if (login.length < 3 || login.length > 80) return "账号长度应为 3–80 个字符";
  if (/[\s|｜\u0000-\u001f\u007f]/u.test(login)) return "账号不能包含空白、竖线或控制字符";
  if (login.includes("@") && !/^[^@\s,;|｜]+@[^@\s,;|｜]+\.[^@\s,;.|｜]+$/u.test(login)) {
    return "邮箱格式不正确";
  }
  return undefined;
}

export function validateAccount(
  draft: AccountDraft,
  existing: readonly ManagedAccount[],
  excludeId?: string,
): Partial<Record<keyof AccountDraft, string>> {
  const errors: Partial<Record<keyof AccountDraft, string>> = {};
  const login = normalizeLogin(draft.login);
  const invalidLogin = loginError(login);
  if (invalidLogin) errors.login = invalidLogin;
  else if (existing.some(account => account.id !== excludeId && normalizeLogin(account.login) === login)) {
    errors.login = "该账号已存在";
  }
  if (!draft.name.trim()) errors.name = "请输入备注名";
  else if (draft.name.trim().length > 40) errors.name = "备注名最多 40 个字符";
  if (draft.group.trim().length > 20) errors.group = "分组最多 20 个字符";
  if (draft.note.trim().length > 300) errors.note = "备注最多 300 个字符";
  return errors;
}

export function createAccount(draft: AccountDraft, id: string): ManagedAccount {
  const login = normalizeLogin(draft.login);
  const name = draft.name.trim() || login;
  return {
    id,
    login,
    name,
    shortName: Array.from(name)[0] || "账",
    group: draft.group.trim() || ungrouped,
    note: draft.note.trim(),
    enabled: draft.enabled,
    session: "offline",
    roles: [],
  };
}

function accountHash(id: string): number {
  let result = 0;
  for (const character of id) result = (result * 31 + character.charCodeAt(0)) >>> 0;
  return result;
}

export function mockRolesForAccount(account: ManagedAccount): Role[] {
  if (account.roles.length > 0) return account.roles.map(role => ({ ...role }));
  const hash = accountHash(account.id);
  const shortNumber = String(hash % 10000).padStart(4, "0");
  const count = 2 + hash % 3;
  return Array.from({ length: count }, (_, index) => {
    const template = roleTemplates[(hash + index) % roleTemplates.length];
    return {
      ...template,
      id: `role-${account.id}-${index + 1}`,
      name: `${template.name.replace(/·收藏角色$/u, "")} ${shortNumber}-${index + 1}`,
      notes: "此为本地模拟同步结果，仅用于演示账号与角色管理。",
    };
  });
}

export function createSeedAccounts(count = 240): ManagedAccount[] {
  const total = Math.max(0, Math.floor(Number.isFinite(count) ? count : 240));
  return Array.from({ length: total }, (_, index) => {
    const original = originalAccounts[index];
    if (original) {
      return {
        ...original,
        group: accountGroups[index % accountGroups.length],
        enabled: true,
        session: "online",
        roles: original.roles.map(role => ({ ...role })),
      };
    }
    const number = String(index + 1).padStart(3, "0");
    const offline = index === 3 || index === 4;
    const account: ManagedAccount = {
      id: `demo-${number}`,
      login: `demo${number}@example.test`,
      name: offline ? `待登录账号 ${number}` : `示例账号 ${number}`,
      shortName: "示",
      group: accountGroups[index % accountGroups.length],
      enabled: index % 13 !== 0,
      session: offline ? "offline" : "online",
      note: offline ? "尚未登录，点击登录后加载角色资料。" : "用于演示数百账号的全局搜索、分页和分组管理。",
      roles: [],
    };
    if (!offline && index % 29 !== 0) account.roles = mockRolesForAccount(account);
    return account;
  });
}

export function validateGroupName(
  name: string,
  groups: readonly string[],
  excludeName?: string,
): string | undefined {
  const trimmed = name.trim();
  if (!trimmed) return "请输入分组名称";
  if (trimmed.length > 20) return "分组名称最多 20 个字符";
  if (/[\u0000-\u001f\u007f]/u.test(trimmed)) return "分组名称不能包含控制字符";
  if (trimmed === ungrouped) return "未分组为系统保留名称";
  if (groups.some(group => group !== excludeName && group.trim() === trimmed)) return "该分组已存在";
  return undefined;
}

export function renameAccountGroup(
  accounts: readonly ManagedAccount[],
  from: string,
  to: string,
): ManagedAccount[] {
  const source = from.trim();
  const target = to.trim();
  return accounts.map(account => account.group === source ? { ...account, group: target } : account);
}

export function deleteAccountGroup(accounts: readonly ManagedAccount[], group: string): ManagedAccount[] {
  return renameAccountGroup(accounts, group, ungrouped);
}

export function filterAccounts(accounts: readonly ManagedAccount[], filters: AccountFilters): FilteredAccount[] {
  const query = filters.query.trim().toLowerCase();
  const roleFiltersActive = filters.server !== "all" || filters.school !== "all";
  return accounts.flatMap(account => {
    if (filters.group !== "all" && account.group !== filters.group) return [];
    if (filters.status === "enabled" && !account.enabled) return [];
    if (filters.status === "disabled" && account.enabled) return [];
    const accountMatches = !query || [account.name, account.login, account.note, account.group]
      .some(value => value.toLowerCase().includes(query));
    const roles = account.roles.filter(role => {
      if (filters.server !== "all" && role.server !== filters.server) return false;
      if (filters.school !== "all" && role.school !== filters.school) return false;
      return accountMatches || [role.name, role.id, role.character].some(value => value.toLowerCase().includes(query));
    });
    if (roles.length === 0 && (!accountMatches || roleFiltersActive)) return [];
    return [{ account, roles, accountMatches }];
  });
}

export function parseAccountText(text: string, existing: readonly ManagedAccount[]): AccountImportResult {
  const result: AccountImportResult = { rows: [], valid: [], duplicates: [], invalid: [] };
  const lines = text.replace(/^\uFEFF/u, "").split(/\r\n|\n|\r/u)
    .map((value, index) => ({ value, line: index + 1 }))
    .filter(({ value }) => value.trim() !== "");
  if (lines.length > 500) {
    return { ...result, error: `每次最多导入 500 个账号，当前有 ${lines.length} 行，请分批处理。` };
  }
  if (lines.length === 0) return { ...result, error: "请先粘贴需要导入的账号，每行一个。" };

  const existingLogins = new Set(existing.map(account => normalizeLogin(account.login)));
  const validLines = new Map<string, number>();
  for (const { value, line } of lines) {
    const columns = value.split(/[|｜\t]/u).map(column => column.trim());
    const login = normalizeLogin(columns[0] || "");
    const name = columns[1] || login;
    const group = columns[2] || ungrouped;
    const row: ImportRow = { line, login, name, group, status: "valid", message: "可导入" };
    const errors = validateAccount({ login, name, group, note: "", enabled: true }, []);
    const invalidMessage = columns.length > 3
      ? "最多填写账号、备注名、分组三列，请使用竖线或 Tab 分隔"
      : errors.login || errors.name || errors.group;
    if (invalidMessage) {
      row.status = "invalid";
      row.message = invalidMessage;
    } else if (existingLogins.has(login)) {
      row.status = "duplicate";
      row.message = "账号已存在，将跳过，不覆盖已有资料";
    } else if (validLines.has(login)) {
      row.status = "duplicate";
      row.message = `与第 ${validLines.get(login)} 行重复，将跳过`;
    } else {
      validLines.set(login, line);
    }
    result.rows.push(row);
    if (row.status === "valid") result.valid.push(row);
    else if (row.status === "duplicate") result.duplicates.push(row);
    else result.invalid.push(row);
  }
  return result;
}
