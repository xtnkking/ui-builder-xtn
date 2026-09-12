import { useCallback, useEffect, useRef, useState } from "react";
import { BarChart3, FileText, Grid2X2, Users } from "lucide-react";
import {
  FamilyLoginPage,
  MemberManagementPage,
  SegmentedControl,
  Tabs,
  ToastProvider,
  useToast,
  type LoginProduct,
  type MemberQuery,
  type MemberRecord,
  type MemberResult,
} from "./personal-ui";

type Scenario = "success" | "empty" | "error";

const members: MemberRecord[] = [
  { id: "u01", name: "陈沐", email: "chen.mu@example.com", team: "平台", role: "管理员", status: "已加入", joinedAt: "2026-09-08" },
  { id: "u02", name: "陆宁", email: "lu.ning@example.com", team: "增长", role: "查看者", status: "待确认", joinedAt: "2026-09-07" },
  { id: "u03", name: "许澄", email: "xu.cheng@example.com", team: "产品", role: "编辑者", status: "已加入", joinedAt: "2026-08-29" },
  { id: "u04", name: "林夏", email: "lin.xia@example.com", team: "客户成功", role: "查看者", status: "已加入", joinedAt: "2026-08-24" },
  { id: "u05", name: "顾言", email: "gu.yan@example.com", team: "财务", role: "管理员", status: "待确认", joinedAt: "2026-08-18" },
  { id: "u06", name: "周清", email: "zhou.qing@example.com", team: "平台", role: "管理员", status: "已加入", joinedAt: "2026-08-12" },
  { id: "u07", name: "沈意", email: "shen.yi@example.com", team: "设计", role: "编辑者", status: "已加入", joinedAt: "2026-08-04" },
  { id: "u08", name: "江遥", email: "jiang.yao@example.com", team: "平台", role: "管理员", status: "已加入", joinedAt: "2026-07-22" },
  { id: "u09", name: "叶舟", email: "ye.zhou@example.com", team: "设计", role: "编辑者", status: "已加入", joinedAt: "2026-07-16" },
  { id: "u10", name: "温岚", email: "wen.lan@example.com", team: "客户成功", role: "查看者", status: "待确认", joinedAt: "2026-07-09" },
  { id: "u11", name: "秦川", email: "qin.chuan@example.com", team: "增长", role: "编辑者", status: "已加入", joinedAt: "2026-06-28" },
  { id: "u12", name: "夏禾", email: "xia.he@example.com", team: "运营", role: "查看者", status: "已加入", joinedAt: "2026-06-11" },
  { id: "u13", name: "程越", email: "cheng.yue@example.com", team: "平台", role: "管理员", status: "已加入", joinedAt: "2026-05-26" },
  { id: "u14", name: "苏晚", email: "su.wan@example.com", team: "设计", role: "编辑者", status: "待确认", joinedAt: "2026-05-18" },
  { id: "u15", name: "贺川", email: "he.chuan@example.com", team: "客户成功", role: "查看者", status: "已加入", joinedAt: "2026-04-30" },
  { id: "u16", name: "黎安", email: "li.an@example.com", team: "运营", role: "编辑者", status: "已停用", joinedAt: "2026-04-14" },
  { id: "u17", name: "楚宁", email: "chu.ning@example.com", team: "财务", role: "管理员", status: "已加入", joinedAt: "2026-03-27" },
  { id: "u18", name: "白榆", email: "bai.yu@example.com", team: "产品", role: "查看者", status: "已加入", joinedAt: "2026-03-08" },
  { id: "u19", name: "乔木", email: "qiao.mu@example.com", team: "增长", role: "编辑者", status: "待确认", joinedAt: "2026-02-19" },
  { id: "u20", name: "季衡", email: "ji.heng@example.com", team: "客户成功", role: "查看者", status: "已加入", joinedAt: "2026-01-12" },
  { id: "u21", name: "唐梨", email: "tang.li@example.com", team: "运营", role: "编辑者", status: "已停用", joinedAt: "2025-12-20" },
  { id: "u22", name: "宋知", email: "song.zhi@example.com", team: "产品", role: "查看者", status: "已加入", joinedAt: "2025-11-16" },
  { id: "u23", name: "闻溪", email: "wen.xi@example.com", team: "设计", role: "编辑者", status: "已加入", joinedAt: "2025-10-04" },
];

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      window.clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    }, { once: true });
  });
}

function ProductScene({ type }: { type: "docs" | "analysis" }) {
  return (
    <div className={`demo-product-scene demo-product-scene--${type}`} aria-hidden="true">
      <div className="demo-product-scene__rail">
        <span /><span /><span /><span />
      </div>
      <div className="demo-product-scene__canvas">
        <span className="demo-product-scene__topline" />
        {type === "docs" ? (
          <><strong>Project brief</strong><span /><span /><span className="is-short" /><span /><span className="is-short" /></>
        ) : (
          <><strong>Weekly activity</strong><div className="demo-bars"><span /><span /><span /><span /><span /></div><span /><span className="is-short" /></>
        )}
      </div>
    </div>
  );
}

const loginProducts: LoginProduct[] = [
  {
    id: "docs",
    name: "文档协作",
    accent: "#1769e0",
    eyebrow: "Workspace Docs",
    headline: "让团队内容始终清楚、有序",
    description: "从计划到交付，共享同一份准确上下文。",
    visual: <ProductScene type="docs" />,
  },
  {
    id: "analysis",
    name: "数据分析",
    accent: "#188766",
    eyebrow: "Workspace Analytics",
    headline: "把复杂数据变成可执行判断",
    description: "统一指标、查询和团队决策记录。",
    visual: <ProductScene type="analysis" />,
  },
];

function DemoContent() {
  const [tab, setTab] = useState("data");
  const [scenario, setScenario] = useState<Scenario>("success");
  const scenarioRef = useRef(scenario);
  const { toast } = useToast();

  useEffect(() => {
    scenarioRef.current = scenario;
  }, [scenario]);

  const fetchMembers = useCallback(async (query: MemberQuery, signal: AbortSignal): Promise<MemberResult> => {
    await wait(650, signal);
    if (scenarioRef.current === "error") throw new Error("模拟请求失败");
    if (scenarioRef.current === "empty") return { items: [], total: 0 };
    const needle = query.search.trim().toLocaleLowerCase();
    const filtered = members.filter((member) => (
      (!needle || `${member.name} ${member.email}`.toLocaleLowerCase().includes(needle))
      && (!query.role || member.role === query.role)
      && (!query.status || member.status === query.status)
    ));
    const direction = query.sortDirection === "ascending" ? 1 : -1;
    const sorted = filtered.slice().sort((left, right) => (
      left[query.sortBy].localeCompare(right[query.sortBy], "zh-CN") * direction
    ));
    const start = (query.page - 1) * query.pageSize;
    return { items: sorted.slice(start, start + query.pageSize), total: sorted.length };
  }, []);

  const dataPage = (
    <div className="demo-case">
      <div className="demo-scenario-bar">
        <span>下一次响应</span>
        <SegmentedControl
          value={scenario}
          fill="mobile"
          ariaLabel="选择下一次查询响应"
          options={[
            { value: "success", label: "正常返回" },
            { value: "empty", label: "空结果" },
            { value: "error", label: "请求失败" },
          ]}
          onValueChange={setScenario}
        />
      </div>
      <MemberManagementPage
        fetchMembers={fetchMembers}
        onInvite={() => toast({
          tone: "success",
          title: "邀请已创建",
          description: "邀请链接已复制到剪贴板。",
          countdown: true,
        })}
      />
    </div>
  );

  const loginPage = (
    <div className="demo-auth-frame">
      <FamilyLoginPage
        companyName="Northstar"
        companyMark={<Grid2X2 aria-hidden="true" />}
        products={loginProducts}
        onForgotPassword={() => toast({ tone: "info", description: "密码重置入口已打开", duration: 2600 })}
        onCreateAccount={() => toast({ tone: "info", description: "账户注册入口已打开", duration: 2600 })}
        onSubmit={async () => {
          const controller = new AbortController();
          await wait(900, controller.signal);
          toast({
            tone: "success",
            position: "top-center",
            shape: "pill",
            description: "登录成功，正在进入工作区",
            closable: false,
            duration: 3200,
          });
        }}
      />
    </div>
  );

  return (
    <div className="demo-shell pui-root">
      <header className="demo-topbar">
        <div className="demo-brand"><span><Grid2X2 className="demo-brand__icon" aria-hidden="true" /></span><strong>Personal UI</strong></div>
        <span>React source kit</span>
      </header>
      <main className="demo-main">
        <div className="demo-titlebar">
          <div><h1>页面实例</h1><p>相同控件源码，按产品和业务组合。</p></div>
        </div>
        <div className="demo-tabs-scope">
          <Tabs
            value={tab}
            onValueChange={setTab}
            ariaLabel="页面实例"
            items={[
              { id: "data", label: <><Users aria-hidden="true" />成员管理</>, content: dataPage },
              { id: "login", label: <><FileText aria-hidden="true" />品牌家族登录</>, content: loginPage },
              { id: "report", label: <><BarChart3 aria-hidden="true" />更多模板</>, disabled: true, content: null },
            ]}
          />
        </div>
      </main>
    </div>
  );
}

export function App() {
  return <ToastProvider><DemoContent /></ToastProvider>;
}
