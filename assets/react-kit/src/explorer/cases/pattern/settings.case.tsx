// @ui-coverage {"kind":"example","runner":"explorer","caseId":"settings/overview","exports":["SettingsPage"]}
import { StatePreview } from "../state-preview";
import { useEffect, useId, useRef, useState } from "react";
import { Box, Button, Field, Form, Grid, Input, NumberInput, SettingsPage, Switch, Textarea, ToastProvider, useToast } from "../../../ui";
import type { ExplorerCase } from "../types";

function TaskLimitsExample({ longContent = false }: { longContent?: boolean }) {
  const id = useId();
  const { toast } = useToast();
  const mounted = useRef(false);
  const pending = useRef(false);
  const [saving, setSaving] = useState(false);
  const [limits, setLimits] = useState<Record<string, number | "">>({ imports: 500, retries: 3, timeout: 60, concurrency: 4 });
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const fields = [
    { name: "imports", label: "单次导入上限（条）", max: 10000, hint: "每批可导入 1 至 10000 条记录。" },
    { name: "retries", label: "失败重试次数", max: 10, hint: "任务失败后自动重试，最多 10 次。" },
    { name: "timeout", label: "任务超时（秒）", max: 3600, hint: "超时后停止当前任务，保留已处理记录。" },
    { name: "concurrency", label: "同时执行任务数", max: 20, hint: "同时运行 1 至 20 个任务。" },
  ];
  return <Form aria-label="任务限制设置" busy={saving} onSubmit={async (event) => {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setSaving(true);
    await new Promise<void>((resolve) => setTimeout(resolve, 900));
    if (!mounted.current) return;
    pending.current = false;
    setSaving(false);
    toast({ description: "任务限制已保存", tone: "success", dedupeKey: "save-task-limits" });
  }}>
    <Box style={{ width: "100%", maxWidth: 504 }}>
      <Grid minItemWidth={240} gap="large">
        {fields.map((field) => <Field
          key={field.name}
          label={longContent ? `${field.label}：适用于当前工作区全部自动处理任务` : field.label}
          htmlFor={`${id}-${field.name}`}
          width="short"
          required
          hint={longContent ? `${field.hint}修改后将在下一次任务启动时生效；已开始的任务继续使用原设置。` : field.hint}
        >
          <NumberInput id={`${id}-${field.name}`} name={field.name} value={limits[field.name]} onValueChange={(value) => setLimits((current) => ({ ...current, [field.name]: value }))} min={1} max={field.max} disabled={saving} />
        </Field>)}
      </Grid>
    </Box>
    <Button type="submit" variant="primary" size="field" loading={saving} loadingLabel="正在保存">保存设置</Button>
  </Form>;
}

export function SettingsExample({ longContent = false }: { longContent?: boolean }) {
  const id = useId();
  const [section, setSection] = useState("limits");
  const [notices, setNotices] = useState(true);
  const [name, setName] = useState("Northstar");
  const sections = [
        {
          id: "limits", label: "任务限制",
          title: longContent ? "WorkspaceAutomationTaskProcessingConcurrencyAndImportLimits" : undefined,
          actions: longContent ? <Button size="field" onClick={() => setSection("profile")}>查看基本信息</Button> : undefined,
          content: <TaskLimitsExample longContent={longContent} />,
        },
        { id: "profile", label: "基本信息", title: "基本信息", content: <Form aria-label="工作区基本信息" onSubmit={(event) => event.preventDefault()}>
          <Field label="工作区名称" htmlFor={`${id}-name`} width="medium"><Input id={`${id}-name`} value={name} onChange={(event) => setName(event.currentTarget.value)} /></Field>
          <Field label="服务地址" htmlFor={`${id}-service`} width="long"><Input id={`${id}-service`} defaultValue="https://api.example.com/workspace" /></Field>
          <Field label="备注" htmlFor={`${id}-notes`} hint="较长的备注使用完整内容区。"><Textarea id={`${id}-notes`} defaultValue="任务限制由工作区管理员统一维护。" /></Field>
        </Form> },
        { id: "notices", label: "通知", title: "通知", content: <Switch label="接收每周摘要" checked={notices} onChange={(event) => setNotices(event.currentTarget.checked)} /> },
        { id: "billing", label: "账单", title: "账单", content: <p>由组织管理员管理。</p>, disabled: true },
      ];
  return (
    <ToastProvider>{longContent ? <SettingsPage
      title="工作区设置"
      description="这些限制适用于当前工作区全部自动处理任务。修改后将在下一次任务启动时生效；已开始的任务继续使用原设置，请结合实际任务规模和服务容量调整。"
      currentId={section}
      onCurrentChange={setSection}
      sections={sections}
    /> : <SettingsPage title="工作区设置" currentId={section} onCurrentChange={setSection} sections={sections} />}</ToastProvider>
  );
}

const explorerCase: ExplorerCase = {
  id: "settings/overview",
  label: "设置页面",
  summary: "短数值字段在限宽分组内紧凑排列，列间距 24px；空间不足自动单列，保存按钮保持内容宽度。",
  states: ["default", "disabled", "controlled", "empty", "longContent", "keyboard", "mobile", "overlay", "dark", "locale"],
  stateExamples: [
    { state: "disabled", exports: ["SettingsPage"], instructions: "账单导航项由 section.disabled 禁用；其他设置分类仍可切换。", content: <SettingsExample /> },
    { state: "controlled", exports: ["SettingsPage"], content: <SettingsExample /> },
    { state: "empty", exports: ["SettingsPage"], content: <SettingsPage title="没有设置分类" sections={[]} currentId="" onCurrentChange={() => undefined} /> },
    { state: "longContent", exports: ["SettingsPage"], content: <SettingsExample longContent /> },
    { state: "default", exports: ["SettingsPage"], content: <SettingsExample /> },
    { state: "keyboard", exports: ["SettingsPage"], content: <SettingsExample />, instructions: "用 Tab 访问本例可用控件，使用 Enter、Space 和组件文档中的方向键操作。此项为人工操作案例，不是自动行为验收证书。" },
    { state: "mobile", exports: ["SettingsPage"], content: <StatePreview state="mobile">{<SettingsExample />}</StatePreview> },
    { state: "overlay", exports: ["SettingsPage"], content: <StatePreview state="overlay">{<SettingsExample />}</StatePreview> },
    { state: "dark", exports: ["SettingsPage"], content: <StatePreview state="dark">{<SettingsExample />}</StatePreview> },
    { state: "locale", exports: ["SettingsPage"], content: <StatePreview state="locale">{<SettingsExample />}</StatePreview> },
  ],
  content: <SettingsExample />,
  previewLayout: "page",
  code: `import { Box, Button, Field, Form, Grid, NumberInput, SettingsPage } from "./ui";

<SettingsPage title="工作区设置" sections={sections} currentId={section} onCurrentChange={setSection} />
// 在设置分类的 content 中：
<Form busy={saving} onSubmit={save}>
  <Box style={{ width: "100%", maxWidth: 504 }}>
    <Grid minItemWidth={240} gap="large">
      <Field label="失败重试次数" htmlFor="retries" width="short" hint="最多 10 次。">
        <NumberInput id="retries" value={retries} onValueChange={setRetries} min={1} max={10} />
      </Field>
    </Grid>
  </Box>
  <Button type="submit" variant="primary" loading={saving}>保存设置</Button>
</Form>`,
};

export default explorerCase;
