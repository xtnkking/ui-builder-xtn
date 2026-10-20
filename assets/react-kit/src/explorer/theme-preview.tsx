import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowUpRight, Check, FolderKanban, Layers3, LayoutDashboard, Plus, RotateCcw, Search, Settings2, Sparkles } from "lucide-react";
import {
  AppNavigation,
  Button,
  Card,
  CodeBlock,
  DataTable,
  Dialog,
  Drawer,
  Field,
  FilterBar,
  FilterField,
  Form,
  Inline,
  Input,
  Link,
  OverflowText,
  SearchInput,
  SegmentedControl,
  Select,
  Stack,
  Switch,
  Tag,
  ThemeProvider,
  type DataColumn,
  type ThemeMaterial,
  type ThemePreset,
  type ThemeTokens,
} from "../ui";
import "./theme-preview.css";

type PreviewMode = "light" | "dark";
type Accent = "preset" | "blue" | "green" | "violet";
type WorkspaceSection = "overview" | "projects" | "settings";
type ProjectStatus = "active" | "review" | "done";
interface Project {
  id: string;
  name: string;
  detail: string;
  owner: string;
  status: ProjectStatus;
  updated: string;
}

const presetLabels: Record<ThemePreset, string> = { default: "默认风格", apple: "苹果风格", material: "Material 风格" };
const presetDescriptions: Record<ThemePreset, string> = {
  default: "熟悉、清晰的 ui-builder-xtn 默认外观。",
  apple: "Apple-inspired · 轻盈克制，细节更柔和。",
  material: "清晰的层次与鲜明的视觉重点。",
};
const accentOptions = [{ value: "preset", label: "跟随风格" }, { value: "blue", label: "海蓝" }, { value: "green", label: "松绿" }, { value: "violet", label: "鸢紫" }];
const accentTokens: Record<Exclude<Accent, "preset">, Record<PreviewMode, ThemeTokens>> = {
  blue: {
    light: { "--ui-primary": "#1763d6", "--ui-primary-hover": "#104eae", "--ui-primary-soft": "#e9f1ff", "--ui-primary-ink": "#154f9e", "--ui-on-primary": "#ffffff", "--ui-focus-ring": "#1763d6", "--ui-product-accent": "#3779e8" },
    dark: { "--ui-primary": "#88b6ff", "--ui-primary-hover": "#accdff", "--ui-primary-soft": "#1c3150", "--ui-primary-ink": "#b8d3ff", "--ui-on-primary": "#102544", "--ui-focus-ring": "#88b6ff", "--ui-product-accent": "#88b6ff" },
  },
  green: {
    light: { "--ui-primary": "#08775d", "--ui-primary-hover": "#065b47", "--ui-primary-soft": "#e3f5ee", "--ui-primary-ink": "#086348", "--ui-on-primary": "#ffffff", "--ui-focus-ring": "#08775d", "--ui-product-accent": "#159574" },
    dark: { "--ui-primary": "#74d8b5", "--ui-primary-hover": "#9be5cb", "--ui-primary-soft": "#173c33", "--ui-primary-ink": "#a5e8d0", "--ui-on-primary": "#12392b", "--ui-focus-ring": "#74d8b5", "--ui-product-accent": "#74d8b5" },
  },
  violet: {
    light: { "--ui-primary": "#7348c4", "--ui-primary-hover": "#5d35a7", "--ui-primary-soft": "#f1eaff", "--ui-primary-ink": "#6236ab", "--ui-on-primary": "#ffffff", "--ui-focus-ring": "#7348c4", "--ui-product-accent": "#9268de" },
    dark: { "--ui-primary": "#c6a7ff", "--ui-primary-hover": "#dcc9ff", "--ui-primary-soft": "#35254e", "--ui-primary-ink": "#ddcaff", "--ui-on-primary": "#302044", "--ui-focus-ring": "#c6a7ff", "--ui-product-accent": "#c6a7ff" },
  },
};
const initialProjects: Project[] = [
  { id: "brand", name: "品牌体验升级", detail: "网站与产品视觉的一次新探索", owner: "林晓", status: "active", updated: "刚刚" },
  { id: "workspace", name: "团队协作工作台", detail: "让跨团队协作更轻松、更有序", owner: "陈宇", status: "review", updated: "12 分钟前" },
  { id: "system", name: "设计系统 · 秋季更新", detail: "组件、规范与使用文档", owner: "许宁", status: "done", updated: "昨天" },
];
const statusLabels: Record<ProjectStatus, string> = { active: "进行中", review: "待评审", done: "已完成" };
const statusTones = { active: "blue", review: "warning", done: "success" } as const;
const projectColumns: DataColumn<Project>[] = [
  { id: "name", header: "项目名称", minWidth: 240, cell: (project) => <div className="theme-preview-project-name"><OverflowText>{project.name}</OverflowText><span className="theme-preview-project-detail"><OverflowText>{project.detail}</OverflowText></span></div> },
  { id: "owner", header: "负责人", width: 84, cell: (project) => project.owner },
  { id: "status", header: "状态", width: 100, cell: (project) => <Tag tone={statusTones[project.status]}>{statusLabels[project.status]}</Tag> },
  { id: "updated", header: "最近更新", width: 112, cell: (project) => <span className="theme-preview-muted">{project.updated}</span> },
];

export function ThemePreview() {
  const [preset, setPreset] = useState<ThemePreset>("apple");
  const [material, setMaterial] = useState<ThemeMaterial>("glass");
  const [mode, setMode] = useState<PreviewMode>("light");
  const [accent, setAccent] = useState<Accent>("preset");
  const [section, setSection] = useState<WorkspaceSection>("overview");
  const [projects, setProjects] = useState(initialProjects);
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [appliedStatus, setAppliedStatus] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectOwner, setProjectOwner] = useState("lin");
  const [workspaceName, setWorkspaceName] = useState("栖云设计团队");
  const [notifications, setNotifications] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(false);
  const [message, setMessage] = useState("");
  const tokens = accent === "preset" ? undefined : accentTokens[accent][mode];
  const visibleProjects = projects.filter((project) => `${project.name} ${project.detail}`.includes(appliedQuery) && (appliedStatus === "all" || project.status === appliedStatus));
  const snippet = `import { ThemeProvider, Button, Card } from "./ui";\n\n${tokens ? `const brandTokens = ${JSON.stringify(tokens, null, 2)};\n\n` : ""}<ThemeProvider\n  preset="${preset}"\n  material="${material}"\n  mode="${mode}"${tokens ? "\n  tokens={brandTokens}" : ""}\n>\n  <Card heading="欢迎回来">\n    <Button variant="primary">开始协作</Button>\n  </Card>\n</ThemeProvider>`;

  useEffect(() => {
    const previousTitle = document.title;
    document.title = "主题与材质 · ui-builder-xtn";
    return () => { document.title = previousTitle; };
  }, []);

  function resetAppearance() {
    setPreset("apple"); setMaterial("glass"); setMode("light"); setAccent("preset");
  }
  function queryProjects(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setAppliedQuery(query.trim()); setAppliedStatus(status);
  }
  function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = projectName.trim();
    if (!name) return;
    setProjects((current) => [...current, { id: `project-${current.length + 1}`, name, detail: "新的想法，从这里开始", owner: projectOwner === "lin" ? "林晓" : "陈宇", status: "active", updated: "刚刚" }]);
    setProjectName(""); setDialogOpen(false); setAppliedQuery(""); setAppliedStatus("all"); setQuery(""); setStatus("all");
    setMessage(`已创建「${name}」`);
  }

  return <ThemeProvider preset={preset} material={material} mode={mode} tokens={tokens}>
    <div className="theme-preview-page" data-preview-mode={mode} data-preview-accent={accent}>
      <header className="theme-preview-topbar">
        <div className="theme-preview-brand"><span className="theme-preview-mark" aria-hidden="true"><Layers3 size={21} /></span><div><strong>ui-builder-xtn</strong><span>主题实验室</span></div></div>
        <Link href="#/components/button" icon={<ArrowLeft aria-hidden="true" />}>组件目录</Link>
      </header>
      <main className="theme-preview-main">
        <section className="theme-preview-intro" aria-labelledby="theme-preview-title">
          <div><p className="theme-preview-eyebrow">APPEARANCE / 外观设计</p><h1 id="theme-preview-title">主题与材质</h1><p className="theme-preview-description">从熟悉的默认风格，到轻盈的苹果风格与鲜明的 Material。选择你喜欢的外观，让每个细节自然呼应。</p></div>
          <div className="theme-preview-intro-aside"><Tag tone="blue" selected leading={<Sparkles aria-hidden="true" />}>实时预览</Tag><span>同一套组件，更多表达。</span></div>
        </section>

        <section className="theme-preview-controls" aria-label="主题预览控制">
          <Card padding="medium">
            <div className="theme-preview-control-grid">
              <div className="theme-preview-control"><span className="theme-preview-control-label">设计风格</span><SegmentedControl<ThemePreset> ariaLabel="设计风格" value={preset} onValueChange={setPreset} options={[{ value: "default", label: "默认" }, { value: "apple", label: "苹果" }, { value: "material", label: "Material" }]} /></div>
              <div className="theme-preview-control"><span className="theme-preview-control-label">表面材质</span><SegmentedControl<ThemeMaterial> ariaLabel="表面材质" value={material} onValueChange={setMaterial} options={[{ value: "solid", label: "实色" }, { value: "glass", label: "磨砂玻璃" }]} /></div>
              <div className="theme-preview-control"><span className="theme-preview-control-label">显示模式</span><SegmentedControl<PreviewMode> ariaLabel="显示模式" value={mode} onValueChange={setMode} options={[{ value: "light", label: "浅色" }, { value: "dark", label: "深色" }]} /></div>
              <div className="theme-preview-control"><span className="theme-preview-control-label">主题强调色</span><Select ariaLabel="主题强调色" value={accent} onValueChange={(value) => setAccent(value as Accent)} options={accentOptions} /></div>
              <div className="theme-preview-reset"><Button size="small" variant="ghost" icon={<RotateCcw aria-hidden="true" />} onClick={resetAppearance}>恢复初始</Button></div>
            </div>
          </Card>
        </section>

        <div className="theme-preview-selection" aria-live="polite"><Inline gap="small"><Tag selected>{presetLabels[preset]}</Tag><Tag selected>{material === "glass" ? "磨砂玻璃" : "实色材质"}</Tag><Tag selected>{mode === "light" ? "浅色模式" : "深色模式"}</Tag></Inline><p>{presetDescriptions[preset]}</p></div>

        <section className="theme-preview-scene" aria-label="协作工作台预览">
          <div className="theme-preview-scene-orb theme-preview-scene-orb--one" aria-hidden="true" />
          <div className="theme-preview-scene-orb theme-preview-scene-orb--two" aria-hidden="true" />
          <div className="theme-preview-workspace">
            <Card padding="medium" variant="raised">
              <div className="theme-preview-workspace-top"><div className="theme-preview-workspace-brand"><span className="theme-preview-workspace-logo" aria-hidden="true">栖</span><div><strong>{workspaceName}</strong><span>每一个好想法，都值得发生。</span></div></div><Tag tone="success" leading={<Check aria-hidden="true" />}>已同步</Tag></div>
              <AppNavigation variant="top" ariaLabel="示例工作台导航" items={[
                { id: "overview", label: "工作概览", icon: <LayoutDashboard aria-hidden="true" />, active: section === "overview", onSelect: () => setSection("overview") },
                { id: "projects", label: "团队项目", icon: <FolderKanban aria-hidden="true" />, active: section === "projects", onSelect: () => setSection("projects") },
                { id: "settings", label: "偏好设置", icon: <Settings2 aria-hidden="true" />, active: section === "settings", onSelect: () => { setSection("settings"); setDrawerOpen(true); } },
              ]} />
              <div className="theme-preview-workspace-content">
                <div className="theme-preview-workspace-heading"><div><p className="theme-preview-eyebrow">{section === "projects" ? "PROJECTS / 团队项目" : "WORKSPACE / 工作概览"}</p><h2>{section === "projects" ? "让协作井然有序" : "把好想法，一起变成现实。"}</h2><p>欢迎回来，林晓。今天也从一件喜欢的事开始。</p></div><div className="theme-preview-workspace-actions"><Button icon={<Settings2 aria-hidden="true" />} onClick={() => setDrawerOpen(true)}>空间设置</Button><Button variant="primary" icon={<Plus aria-hidden="true" />} onClick={() => { setMessage(""); setDialogOpen(true); }}>新建项目</Button></div></div>
                <div className="theme-preview-stats"><Card padding="medium"><div className="theme-preview-stat"><span>进行中的项目</span><strong>{projects.filter((project) => project.status !== "done").length.toString().padStart(2, "0")}</strong><small>保持专注，稳步向前</small></div></Card><Card padding="medium"><div className="theme-preview-stat"><span>本周完成任务</span><strong>24<small>项</small></strong><small>比上周多完成 6 项</small></div></Card><Card padding="medium"><div className="theme-preview-stat"><span>团队协作效率</span><strong>96<small>%</small></strong><small>让每一次协作更顺畅</small></div></Card></div>
                <div className="theme-preview-content-grid">
                  <div className="theme-preview-projects">
                    <div className="theme-preview-section-heading"><h3>最近的项目</h3><span>{visibleProjects.length} 个项目</span></div>
                    <div className="theme-preview-filters">
                      <FilterBar ariaLabel="示例项目筛选" onSubmit={queryProjects} actions={<Button type="submit" size="field" variant="primary" icon={<Search aria-hidden="true" />}>查询</Button>}>
                        <FilterField width="medium"><SearchInput aria-label="搜索示例项目" placeholder="搜索项目" value={query} onChange={(event) => setQuery(event.currentTarget.value)} onClear={() => setQuery("")} /></FilterField>
                        <FilterField width="short"><Select ariaLabel="筛选示例项目状态" value={status} onValueChange={setStatus} options={[{ value: "all", label: "全部状态" }, { value: "active", label: "进行中" }, { value: "review", label: "待评审" }, { value: "done", label: "已完成" }]} /></FilterField>
                      </FilterBar>
                    </div>
                    <DataTable ariaLabel="示例团队项目" rows={visibleProjects} columns={projectColumns} rowKey={(project) => project.id} emptyTitle="没有找到相关项目" emptyDescription="试试其他关键词，或调整状态筛选。" mobileRow={(project) => <div className="theme-preview-mobile-project"><div className="theme-preview-project-name"><OverflowText>{project.name}</OverflowText><span className="theme-preview-muted">{project.owner} · {project.updated}</span></div><Tag tone={statusTones[project.status]}>{statusLabels[project.status]}</Tag></div>} />
                    <p className="theme-preview-status" role="status">{message || "项目更新会自动同步给团队成员。"}</p>
                  </div>
                  <aside className="theme-preview-side-card"><Card heading="为灵感留一点空间" description="少一点打扰，多一点专注。" variant="subtle"><Stack gap="large"><div className="theme-preview-note"><span className="theme-preview-note-eyebrow">本周的一点小提醒</span><p>先做一件小事。<br />好想法会在行动里生长。</p><span>栖云 · 团队笔记</span></div><Switch label="项目更新通知" checked={notifications} onChange={(event) => setNotifications(event.currentTarget.checked)} /><Button variant="ghost" size="small" trailingIcon={<ArrowUpRight aria-hidden="true" />} onClick={() => setDrawerOpen(true)}>管理我的偏好</Button></Stack></Card></aside>
                </div>
              </div>
            </Card>
          </div>
        </section>

        <section className="theme-preview-code" aria-labelledby="theme-preview-code-heading"><div className="theme-preview-section-heading"><div><p className="theme-preview-eyebrow">BUILD WITH IT / 开始使用</p><h2 id="theme-preview-code-heading">把喜欢的外观带进产品</h2></div><Tag>官方 ThemeProvider</Tag></div><p className="theme-preview-description">风格、材质与颜色独立组合。以下代码随当前选择更新，弹窗、抽屉和下拉内容会沿用同一套外观。</p><CodeBlock language="tsx" code={snippet} copyable copyLabel="复制当前主题代码" wrap maxHeight={360} /></section>
        <footer className="theme-preview-footer"><span>ui-builder-xtn · 由官方组件组成的可交互预览</span><Link href="#/components/color">查看主题组件</Link></footer>
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen} title="新建团队项目" description="让一个好想法，成为团队的下一个目标。" width="small" footer={<Inline justify="end"><Button onClick={() => setDialogOpen(false)}>取消</Button><Button type="submit" form="theme-preview-new-project" variant="primary">创建项目</Button></Inline>}>
        <Form id="theme-preview-new-project" onSubmit={createProject}><Stack gap="large"><Field htmlFor="theme-preview-project-name" label="项目名称" required><Input id="theme-preview-project-name" placeholder="例如：秋季产品体验升级" value={projectName} onChange={(event) => setProjectName(event.currentTarget.value)} required maxLength={64} /></Field><Field htmlFor="theme-preview-project-owner" label="项目负责人"><Select id="theme-preview-project-owner" ariaLabel="项目负责人" value={projectOwner} onValueChange={setProjectOwner} options={[{ value: "lin", label: "林晓 · 设计负责人" }, { value: "chen", label: "陈宇 · 产品经理" }]} /></Field><p className="theme-preview-overlay-note">创建后，项目会出现在当前工作台中。</p></Stack></Form>
      </Dialog>
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} title="空间偏好设置" description="让工作空间更适合你和团队。" footer={<Inline justify="end"><Button variant="primary" icon={<Check aria-hidden="true" />} onClick={() => { setDrawerOpen(false); setMessage("空间偏好已保存"); }}>完成设置</Button></Inline>}>
        <Stack gap="large"><Field htmlFor="theme-preview-workspace-name" label="工作空间名称"><Input id="theme-preview-workspace-name" value={workspaceName} onChange={(event) => setWorkspaceName(event.currentTarget.value)} maxLength={32} /></Field><Card heading="消息与提醒" variant="subtle" padding="medium"><Stack gap="large"><Switch label="项目更新通知" checked={notifications} onChange={(event) => setNotifications(event.currentTarget.checked)} /><Switch label="每周工作摘要" checked={weeklyDigest} onChange={(event) => setWeeklyDigest(event.currentTarget.checked)} /></Stack></Card><Card heading="当前外观" description={presetDescriptions[preset]}><Inline gap="small"><Tag tone="blue">{presetLabels[preset]}</Tag><Tag>{material === "glass" ? "磨砂玻璃" : "实色材质"}</Tag><Tag>{mode === "light" ? "浅色模式" : "深色模式"}</Tag></Inline></Card><p className="theme-preview-overlay-note">你的外观选择会同步应用于工作台、弹窗、抽屉和下拉菜单。</p></Stack>
      </Drawer>
    </div>
  </ThemeProvider>;
}
