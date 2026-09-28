import componentDocsJson from "../../component-docs.json";
import componentManifestJson from "../../component-manifest.json";

export type ExplorerCategoryId =
  | "foundation"
  | "input"
  | "navigation"
  | "data"
  | "feedback"
  | "overlay"
  | "pattern";

type DocsCategory = ExplorerCategoryId | "actions";

interface ManifestEntry {
  id: string;
  kind: string;
  publicExports: string[];
  aliases: string[];
}

export interface ExplorerCategory {
  id: ExplorerCategoryId;
  label: string;
}

export interface ExplorerFamily {
  id: string;
  category: ExplorerCategoryId;
  label: string;
  exports: string[];
  aliases: string[];
  href: string;
  searchText: string;
}

const docs = componentDocsJson as unknown as {
  families: Record<string, { category: DocsCategory }>;
};

const manifest = componentManifestJson as unknown as {
  entries: ManifestEntry[];
};

export const explorerCategories: readonly ExplorerCategory[] = [
  { id: "foundation", label: "基础" },
  { id: "input", label: "输入" },
  { id: "navigation", label: "导航" },
  { id: "data", label: "数据" },
  { id: "feedback", label: "反馈" },
  { id: "overlay", label: "浮层" },
  { id: "pattern", label: "页面模式" },
] as const;

const categoryOrder = new Map(explorerCategories.map((category, index) => [category.id, index]));
const categoryById = new Map(explorerCategories.map((category) => [category.id, category]));

const familyLabels: Record<string, string> = {
  authentication: "认证与品牌登录",
  "list-filter": "列表与筛选页面",
  "data-table": "DataTable / TreeTable",
  dialog: "Dialog / ConfirmDialog",
  number: "NumberInput",
  typography: "Typography 字体规范",
  spacing: "Spacing 间距规范",
  radius: "Radius 圆角规范",
  surface: "Surface 表面规范",
  icons: "Icons 图标规范",
  motion: "Motion 动效规范",
  "z-index": "Z-index 层级规范",
  density: "Density 密度规范",
  focus: "Focus 焦点规范",
};

const familyPurposes: Record<string, string> = {
  authentication: "登录 注册 认证 品牌家族",
  "list-filter": "成员管理 CRUD 查询 筛选 列表",
  "data-table": "表格 分页 冻结 勾选 编辑 数据加载",
  dialog: "弹窗 确认框 嵌套浮层 角色分配",
  number: "数字输入 步进器 范围 只读 禁用",
  typography: "字体 字号 字重 排版",
  spacing: "间距 留白 节奏",
  radius: "圆角 边角",
  surface: "表面 边框 阴影 背景",
  icons: "图标 图形",
  motion: "动效 动画 过渡",
  "z-index": "层级 堆叠",
  density: "密度 紧凑",
  focus: "焦点 键盘 可见焦点",
};

function normalizeCategory(category: DocsCategory): ExplorerCategoryId {
  return category === "actions" ? "foundation" : category;
}

function familyLabel(id: string, exports: string[]): string {
  if (familyLabels[id]) return familyLabels[id];
  if (exports.length === 0) return id;
  if (exports.length <= 2) return exports.join(" / ");
  return `${exports[0]} 等 ${exports.length} 项`;
}

function familyHref(id: string, category: ExplorerCategoryId): string {
  return `#/${category === "pattern" ? "patterns" : "components"}/${id}`;
}

export const explorerFamilies: readonly ExplorerFamily[] = manifest.entries
  .map((manifestEntry) => {
    const { id } = manifestEntry;
    const docsFamily = docs.families[id];
    if (!docsFamily && (manifestEntry.kind !== "foundation" || manifestEntry.publicExports.length > 0)) {
      throw new Error(`Explorer family ${id} is missing documentation metadata.`);
    }
    const category = docsFamily ? normalizeCategory(docsFamily.category) : "foundation";
    const categoryMeta = categoryById.get(category);
    if (!categoryMeta) {
      throw new Error(`Explorer family ${id} uses an unknown category.`);
    }
    const label = familyLabel(id, manifestEntry.publicExports);
    const aliases = manifestEntry.aliases ?? [];
    const exports = manifestEntry.publicExports ?? [];
    return {
      id,
      category,
      label,
      exports,
      aliases,
      href: familyHref(id, category),
      searchText: [
        id,
        label,
        ...aliases,
        ...exports,
        categoryMeta.label,
        familyPurposes[id] ?? "",
      ].join(" ").toLocaleLowerCase(),
    } satisfies ExplorerFamily;
  })
  .sort((left, right) => {
    const categoryDifference = (categoryOrder.get(left.category) ?? 0) - (categoryOrder.get(right.category) ?? 0);
    return categoryDifference || left.label.localeCompare(right.label, "zh-CN");
  });

export const explorerFamilyById = new Map(explorerFamilies.map((family) => [family.id, family]));
export const defaultExplorerFamilyId = "list-filter";

export function explorerFamilyFromHash(hash: string): ExplorerFamily | undefined {
  const match = hash.match(/^#\/(components|patterns)\/([^?/#]+)(?:[?#].*)?$/);
  if (!match) return undefined;
  try {
    const family = explorerFamilyById.get(decodeURIComponent(match[2]));
    if (!family) return undefined;
    const expectedSection = family.category === "pattern" ? "patterns" : "components";
    return match[1] === expectedSection ? family : undefined;
  } catch {
    return undefined;
  }
}

export function filterExplorerFamilies(query: string): ExplorerFamily[] {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [...explorerFamilies];
  return explorerFamilies.filter((family) => terms.every((term) => family.searchText.includes(term)));
}
