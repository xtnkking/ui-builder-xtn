// @ui-coverage {"kind":"example","runner":"explorer","caseId":"icon-button/gallery","exports":["IconButton","Input","Tooltip","EmptyState"]}
import { useState, type ReactNode } from "react";
import {
  Activity, Archive, ArrowDown, ArrowUp, ArrowUpDown, Ban, ClipboardPaste,
  Columns2, Copy, Download, ExternalLink, Eye, FileDown, FileUp, Filter,
  Info, KeyRound, Link2, ListFilter, LockKeyhole, Maximize2, Minimize2,
  MoreHorizontal, MoreVertical, Pencil, Plus, Printer, RefreshCw, Save,
  Search, Send, Settings2, Share2, ShieldCheck, SlidersHorizontal, Trash2,
  Unlink2, UnlockKeyhole, Upload, UserRound,
} from "lucide-react";
import { EmptyState, IconButton, Input, Stack, Tooltip } from "../../../ui";
import { StatePreview } from "../state-preview";
import type { ExplorerCase } from "../types";
import sourceCode from "./icon-button-gallery.example.tsx?raw";

interface GalleryIcon {
  name: string;
  label: string;
  description: string;
  icon: ReactNode;
  variant?: "ghost" | "secondary" | "danger";
}

const iconGroups: readonly { label: string; icons: readonly GalleryIcon[] }[] = [
  { label: "查看与检测", icons: [
    { name: "Eye", label: "查看", description: "查看记录或打开详情", icon: <Eye /> },
    { name: "Activity", label: "检测", description: "检测连接、健康状态或运行情况", icon: <Activity /> },
    { name: "Search", label: "搜索", description: "执行明确的查询动作", icon: <Search /> },
    { name: "RefreshCw", label: "刷新", description: "重新获取当前数据", icon: <RefreshCw /> },
    { name: "Info", label: "详细说明", description: "打开当前对象的补充说明", icon: <Info /> },
  ] },
  { label: "编辑与记录", icons: [
    { name: "Pencil", label: "编辑", description: "编辑当前记录", icon: <Pencil /> },
    { name: "Plus", label: "新增", description: "新增记录或添加子项", icon: <Plus /> },
    { name: "Save", label: "保存", description: "保存当前修改", icon: <Save /> },
    { name: "Copy", label: "复制", description: "复制当前内容或记录", icon: <Copy /> },
    { name: "ClipboardPaste", label: "粘贴", description: "粘贴已有内容", icon: <ClipboardPaste /> },
  ] },
  { label: "导入与导出", icons: [
    { name: "Upload", label: "上传", description: "上传文件或媒体", icon: <Upload /> },
    { name: "Download", label: "下载", description: "下载当前资源", icon: <Download /> },
    { name: "FileUp", label: "导入", description: "从文件导入业务数据", icon: <FileUp /> },
    { name: "FileDown", label: "导出", description: "导出当前数据", icon: <FileDown /> },
    { name: "Printer", label: "打印", description: "打开打印流程", icon: <Printer /> },
  ] },
  { label: "链接与分享", icons: [
    { name: "Link2", label: "链接", description: "获取或管理链接", icon: <Link2 /> },
    { name: "Unlink2", label: "取消关联", description: "解除当前对象的关联", icon: <Unlink2 /> },
    { name: "ExternalLink", label: "新窗口打开", description: "在新的窗口打开目标", icon: <ExternalLink /> },
    { name: "Share2", label: "分享", description: "打开分享选项", icon: <Share2 /> },
    { name: "Send", label: "发送", description: "发送内容或消息", icon: <Send /> },
  ] },
  { label: "权限与安全", icons: [
    { name: "ShieldCheck", label: "安全校验", description: "检查安全策略或验证结果", icon: <ShieldCheck /> },
    { name: "LockKeyhole", label: "锁定", description: "锁定当前对象", icon: <LockKeyhole /> },
    { name: "UnlockKeyhole", label: "解锁", description: "解除锁定状态", icon: <UnlockKeyhole /> },
    { name: "KeyRound", label: "凭据", description: "查看或管理访问凭据", icon: <KeyRound /> },
    { name: "UserRound", label: "用户", description: "查看成员或账户信息", icon: <UserRound /> },
  ] },
  { label: "筛选与排序", icons: [
    { name: "ArrowUpDown", label: "切换排序", description: "切换当前排序方向", icon: <ArrowUpDown /> },
    { name: "ArrowUp", label: "升序", description: "按从小到大排列", icon: <ArrowUp /> },
    { name: "ArrowDown", label: "降序", description: "按从大到小排列", icon: <ArrowDown /> },
    { name: "ListFilter", label: "筛选列表", description: "打开列表筛选项", icon: <ListFilter /> },
    { name: "Filter", label: "筛选", description: "应用或编辑筛选条件", icon: <Filter /> },
  ] },
  { label: "设置与布局", icons: [
    { name: "Settings2", label: "设置", description: "打开当前功能的设置", icon: <Settings2 /> },
    { name: "SlidersHorizontal", label: "调整参数", description: "调整显示或运行参数", icon: <SlidersHorizontal /> },
    { name: "Maximize2", label: "展开视图", description: "扩大当前工作区", icon: <Maximize2 /> },
    { name: "Minimize2", label: "还原视图", description: "恢复原来的工作区大小", icon: <Minimize2 /> },
    { name: "Columns2", label: "显示列", description: "选择表格显示的列", icon: <Columns2 /> },
  ] },
  { label: "归档与更多", icons: [
    { name: "Trash2", label: "删除", description: "危险动作应先确认，不在此目录执行删除", icon: <Trash2 />, variant: "danger" },
    { name: "Archive", label: "归档", description: "将当前对象移入归档", icon: <Archive /> },
    { name: "Ban", label: "停用", description: "停用当前对象", icon: <Ban />, variant: "danger" },
    { name: "MoreHorizontal", label: "更多操作", description: "打开较大的操作集合", icon: <MoreHorizontal /> },
    { name: "MoreVertical", label: "纵向更多", description: "打开紧凑区域中的更多操作", icon: <MoreVertical /> },
  ] },
];

function IconGalleryExample({ initialQuery = "" }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [selected, setSelected] = useState<GalleryIcon | null>(null);
  const keyword = query.trim().toLocaleLowerCase();
  const groups = iconGroups.map((group) => ({
    ...group,
    icons: group.icons.filter((item) => `${group.label} ${item.label} ${item.name} ${item.description}`.toLocaleLowerCase().includes(keyword)),
  })).filter((group) => group.icons.length > 0);
  const resultCount = groups.reduce((count, group) => count + group.icons.length, 0);

  return <Stack gap="large">
    <div style={{ display: "grid", gap: 8, width: "100%", maxWidth: 420, minWidth: 0 }}>
      <Input aria-label="搜索图标" placeholder="搜索中文动作或英文图标名" startAdornment={<Search />} value={query} onChange={(event) => setQuery(event.currentTarget.value)} />
      <p role="status">{resultCount} / 40 个常用图标</p>
    </div>
    <p>点击按钮查看图标含义；这里只演示图标选择，不执行检测、删除或其他业务操作。业务中请提供对象名称、Tooltip 和真实处理回调。</p>
    {selected ? <p role="status">当前查看：{selected.label} · {selected.name}。{selected.description}。</p> : null}
    {groups.length === 0 ? <EmptyState compact title="没有匹配的图标" description="试试“检测”“导出”或“RefreshCw”，也可以清空搜索查看全部图标。" /> : groups.map((group) => <section key={group.label} aria-label={group.label} style={{ display: "grid", gap: 12, minWidth: 0 }}>
      <h3>{group.label}</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 132px), 1fr))", gap: 16, minWidth: 0 }}>
        {group.icons.map((item) => <div key={item.name} style={{ display: "grid", justifyItems: "center", alignContent: "start", gap: 6, minWidth: 0, textAlign: "center" }}>
          <Tooltip content={`${item.label} · ${item.name}：${item.description}`}>
            <IconButton aria-label={`查看${item.label}图标`} icon={item.icon} variant={item.variant ?? "ghost"} onClick={() => setSelected(item)} />
          </Tooltip>
          <span>{item.label}</span>
          <span lang="en" style={{ maxWidth: "100%", overflowWrap: "anywhere" }}>{item.name}</span>
        </div>)}
      </div>
    </section>)}
  </Stack>;
}

const explorerCase = {
  id: "icon-button/gallery",
  label: "常用图标目录",
  summary: "8 类共 40 个常用 Lucide 图标，中文优先、英文名称辅助搜索；全部使用真实 IconButton 与 Tooltip，无需新增组件或安装图标目录依赖。",
  states: ["default", "empty", "keyboard", "mobile", "dark"],
  content: <IconGalleryExample />,
  stateExamples: [
    { state: "default", exports: ["IconButton", "Input", "Tooltip"], content: <IconGalleryExample />, instructions: "输入“检测”或“Activity”可找到同一个图标；清空输入重新显示全部 40 项。点击仅查看释义，不执行业务操作。" },
    { state: "empty", exports: ["EmptyState", "Input"], content: <IconGalleryExample initialQuery="没有这个图标" /> },
    { state: "keyboard", exports: ["IconButton", "Tooltip", "Input"], content: <IconGalleryExample initialQuery="检测" />, instructions: "Tab 从搜索框进入检测按钮，聚焦后显示 Tooltip；Enter 或空格查看图标含义，Esc 关闭 Tooltip。" },
    { state: "mobile", exports: ["IconButton", "Input", "Tooltip"], content: <StatePreview state="mobile"><IconGalleryExample /></StatePreview> },
    { state: "dark", exports: ["IconButton", "Input", "Tooltip"], content: <StatePreview state="dark"><IconGalleryExample initialQuery="查看与检测" /></StatePreview> },
  ],
  code: sourceCode,
} satisfies ExplorerCase;

export default explorerCase;
