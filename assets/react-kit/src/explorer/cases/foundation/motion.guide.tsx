import { useEffect, useRef, useState } from "react";
import { Button, Card, Carousel, Collapse, Dialog, Drawer, DropdownMenu, Inline, Lightbox, Progress, SegmentedControl, Select, Spinner, Stack, Tabs, ToastProvider, useToast } from "../../../ui";
import type { ExplorerCase } from "../types";

const contentImages = [
  { id: "coast", src: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="960" height="600" viewBox="0 0 960 600"><rect width="960" height="600" fill="#dceef5"/><path d="M0 350Q240 200 480 350T960 350V600H0Z" fill="#5b96b0"/><circle cx="740" cy="130" r="65" fill="#f4cc7a"/><text x="60" y="120" fill="#214f67" font-size="58" font-family="sans-serif">01 · COAST</text></svg>')}`, alt: "海岸蓝色风景", caption: "第一张：海岸。左右方向键、Home / End 和按钮均可切换；点击空白阴影或按 Esc 关闭。" },
  { id: "forest", src: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="960" height="600" viewBox="0 0 960 600"><rect width="960" height="600" fill="#e1eade"/><path d="M0 480 220 150 440 480 650 100 960 480V600H0Z" fill="#537858"/><text x="60" y="120" fill="#254e30" font-size="58" font-family="sans-serif">02 · FOREST</text></svg>')}`, alt: "森林绿色风景", caption: "第二张：森林。新图就绪后切换，说明与页码同步更新；导航和关闭入口始终保留。" },
];

function MotionContentPreview() {
  const [tab, setTab] = useState("overview");
  const [view, setView] = useState("list");
  const [slide, setSlide] = useState("overview");
  const [image, setImage] = useState("coast");
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [failurePreview, setFailurePreview] = useState(false);
  return (
    <Stack gap="large">
      <section aria-label="标签指示器动效演示">
        <Stack gap="medium">
          <h3>标签页：指示器跟随选中项</h3>
          <Tabs ariaLabel="动效项目标签" value={tab} onValueChange={setTab} fill items={[
            { id: "overview", label: "项目概览", content: <p>项目概览：指示器首次直接定位，切换时平滑移到新标签。</p> },
            { id: "members", label: "团队成员", content: <p>团队成员：快速切换会从当前位置继续，不回到上一标签的起点。</p> },
            { id: "activity", label: "活动记录", content: <p>活动记录：调整窗口宽度后，指示器仍与当前标签对齐。</p> },
          ]} />
        </Stack>
      </section>
      <section aria-label="分段指示器动效演示">
        <Stack gap="medium">
          <h3>分段选择：一块连续移动的选中背景</h3>
          <SegmentedControl ariaLabel="动效视图模式" value={view} onValueChange={setView} fill options={[
            { value: "list", label: "列表视图" }, { value: "board", label: "看板视图" }, { value: "calendar", label: "日历视图" },
          ]} />
          <p role="status">当前视图：{view === "list" ? "列表" : view === "board" ? "看板" : "日历"}。可连续选择不同项，观察背景跟随，而不是出现两块选中背景。</p>
        </Stack>
      </section>
      <section aria-label="轮播内容动效演示">
        <Stack gap="medium">
          <h3>内容轮播：轻淡入与稳定的操作区</h3>
          <Carousel ariaLabel="动效运营摘要" value={slide} onValueChange={setSlide} loop slides={[
            { id: "overview", label: "项目概览", content: <Card><Stack gap="medium"><h4>项目概览</h4><p>12 个进行中的项目。点击下一项，当前内容轻淡入；操作按钮保留原焦点。</p></Stack></Card> },
            { id: "members", label: "团队成员", content: <Card><Stack gap="medium"><h4>团队成员</h4><p>36 位协作成员。内容仅保留当前一页，避免重复的可操作元素和屏幕阅读器播报。</p></Stack></Card> },
            { id: "activity", label: "活动记录", content: <Card><Stack gap="medium"><h4>活动记录</h4><p>今天完成了 8 次更新。系统减少动效开启时，内容直接切换。</p></Stack></Card> },
          ]} />
        </Stack>
      </section>
      <section aria-label="图片内容动效演示">
        <Stack gap="medium">
          <h3>图片预览：加载就绪后切换</h3>
          <Inline gap="medium" wrap>
            <Button onClick={() => { setFailurePreview(false); setImage("coast"); setLightboxOpen(true); }}>预览两张风景</Button>
            <Button variant="ghost" onClick={() => { setFailurePreview(true); setImage("broken"); setLightboxOpen(true); }}>预览失败与恢复</Button>
          </Inline>
          <p>两张内置图片无需网络请求。失败演示从损坏图片开始，切换下一张可恢复；关闭、键盘与阴影操作保持不变。</p>
        </Stack>
      </section>
      <Lightbox open={lightboxOpen} onOpenChange={setLightboxOpen} value={image} onValueChange={setImage} items={failurePreview ? [
        { id: "broken", src: "data:image/png;base64,aW52YWxpZA==", alt: "无法解码的演示图片", caption: "当前图片损坏，请切换下一张查看正常图片。" }, contentImages[1],
      ] : contentImages} />
    </Stack>
  );
}

function MotionControls() {
  const { toast, dismissAll } = useToast();
  const [dialog, setDialog] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [paragraphs, setParagraphs] = useState(1);
  const [choice, setChoice] = useState("normal");
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(20);
  const reversalTimers = useRef<number[]>([]);
  useEffect(() => () => reversalTimers.current.forEach((timer) => window.clearTimeout(timer)), []);
  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(() => { setProgress(100); setRunning(false); }, 1000);
    return () => window.clearTimeout(timer);
  }, [running]);
  const reverseDialog = () => {
    reversalTimers.current.forEach((timer) => window.clearTimeout(timer));
    setDialog(false);
    reversalTimers.current = [window.setTimeout(() => setDialog(true), 60)];
  };
  const reverseDrawer = () => {
    reversalTimers.current.forEach((timer) => window.clearTimeout(timer));
    setDrawer(false);
    reversalTimers.current = [window.setTimeout(() => setDrawer(true), 60)];
  };
  return (
    <Stack gap="large">
      <p role="status"><span className="demo-motion-preference--reduced">系统减少动效：已开启，位移与展开过渡停用</span><span className="demo-motion-preference--standard">系统减少动效：未开启，使用默认轻动效</span>。此状态来自真实系统偏好。</p>
      <section aria-labelledby="motion-overlays-title">
        <Stack gap="medium">
          <h3 id="motion-overlays-title">弹窗与抽屉</h3>
          <Inline gap="medium" wrap>
            <Button onClick={() => setDialog(true)}>打开弹窗</Button>
            <Button onClick={() => setDrawer(true)}>打开抽屉</Button>
          </Inline>
          <p>观察进入与退出，再在弹窗中试一次“退出中重开”。关闭完成后焦点应回到触发入口；窄屏抽屉沿组件原有方向出现。</p>
        </Stack>
      </section>
      <section aria-labelledby="motion-toast-title">
        <Stack gap="medium">
          <h3 id="motion-toast-title">轻提示：进入、退出与有界排队</h3>
          <Inline gap="medium" wrap>
            <Button onClick={() => toast({ description: "设置已保存。", tone: "success", duration: 4000, showSeconds: true })}>4 秒自动关闭</Button>
            <Button onClick={() => toast({ description: "这是需要手动关闭的胶囊提示。", duration: null, shape: "pill", position: "top-center" })}>手动关闭胶囊</Button>
            <Button onClick={() => { for (let index = 1; index <= 5; index += 1) toast({ description: `队列中的第 ${index} 条消息`, duration: 2500, countdown: true, position: "bottom-right" }); }}>连续加入 5 条</Button>
            <Button variant="ghost" onClick={dismissAll}>清空全部提示</Button>
          </Inline>
          <p>此演示最多同时显示 2 条，等待队列最多 6 条。退出项保留槽位，退出完成再补位；悬停、聚焦及页面隐藏暂停自动关闭。</p>
        </Stack>
      </section>
      <section aria-labelledby="motion-menus-title">
        <Stack gap="medium">
          <h3 id="motion-menus-title">选择器与菜单</h3>
          <Inline gap="medium" wrap>
            <Select ariaLabel="选择演示模式" value={choice} onValueChange={setChoice} options={[{ value: "normal", label: "常规反馈" }, { value: "compact", label: "紧凑反馈" }, { value: "long", label: "较长的选项文字会按实际空间自然换行" }]} />
            <DropdownMenu label="打开操作菜单" ariaLabel="动效演示操作" items={[{ id: "notice", label: "显示反馈", onSelect: () => toast({ description: "菜单操作已完成。", duration: 3000 }) }, { id: "dialog", label: "打开弹窗", onSelect: () => setDialog(true) }]} />
          </Inline>
          <p>使用鼠标或键盘打开、选择、按 Esc 关闭。菜单退出期间停止选项交互，不影响最终选值。</p>
        </Stack>
      </section>
      <section aria-labelledby="motion-collapse-title">
        <Stack gap="medium">
          <h3 id="motion-collapse-title">折叠内容：动态高度与快速反向</h3>
          <Inline gap="medium" wrap>
            <Button onClick={() => setExpanded((current) => !current)}>{expanded ? "收起内容" : "展开内容"}</Button>
            <Button disabled={paragraphs >= 4} onClick={() => setParagraphs((current) => Math.min(4, current + 1))}>追加一段内容</Button>
            <Button variant="ghost" disabled={paragraphs === 1} onClick={() => setParagraphs(1)}>恢复一段</Button>
          </Inline>
          <Collapse title="可变高度的内容区域（初始展开）" open={expanded} onOpenChange={setExpanded}>
            <Stack gap="medium">
              {Array.from({ length: paragraphs }, (_, index) => <p key={index}>第 {index + 1} 段：组件使用自然内容高度，不固定像素高度。追加文字、换行或异步内容后应完整显示；在展开和收起期间快速再次操作，应平滑改变方向。</p>)}
              <Button onClick={() => setExpanded(false)}>从内容内收起并回焦</Button>
            </Stack>
          </Collapse>
        </Stack>
      </section>
      <h3>加载与基础反馈</h3>
      <Inline gap="medium" wrap>
        <Button variant="primary" loading={running} loadingLabel="演示中" onClick={() => { setProgress(20); setRunning(true); }}>运行加载演示</Button>
        <span role="status">{running ? "等待示例任务完成" : progress === 100 ? "示例任务已完成" : "点击按钮观察真实加载状态"}</span>
      </Inline>
      <Progress value={progress} label="示例任务进度" showValue />
      <MotionContentPreview />
      <p className="demo-foundation-note">默认轻反馈 120ms，常规进入 180ms，抽屉与折叠进入 220ms；退出略快。可在系统或浏览器模拟“减少动态效果”，加载文字、进度与提示的真实计时仍然有效。页面示例直接调用官方组件，不使用独立演示动画。</p>
      <Dialog title="弹窗动效演示" description="进入、关闭和退出中重开使用同一实例与层管理。" open={dialog} onOpenChange={setDialog} footer={<Inline gap="medium" wrap><Button onClick={reverseDialog}>退出中重开</Button><Button variant="primary" onClick={() => setDialog(false)}>关闭弹窗</Button></Inline>}>
        <p>打开后可按 Tab 检查焦点，按 Esc 或点击阴影关闭；也可以在退出完成前重开，旧的完成事件不应关闭新弹窗。</p>
      </Dialog>
      <Drawer title="抽屉动效演示" description="桌面从右侧出现，移动端沿底部方向出现。" open={drawer} onOpenChange={setDrawer} footer={<Inline gap="medium" wrap><Button onClick={reverseDrawer}>抽屉退出中重开</Button><Button variant="primary" onClick={() => setDrawer(false)}>完成并关闭</Button></Inline>}>
        <p>动画仅改变出现与消失过程，保留组件默认贴边、圆角、滚动和焦点行为。</p>
      </Drawer>
    </Stack>
  );
}

function MotionExample() {
  return <ToastProvider maxVisible={2} maxQueue={6}><MotionControls /></ToastProvider>;
}

const explorerCase = {
  id: "motion/overview",
  label: "交互动效与减少动态效果",
  summary: "操作真实弹窗、抽屉、轻提示、菜单、动态折叠、移动指示器与内容切换；观察进入、退出、中断及系统减少动效。",
  states: ["default", "loading"],
  stateExamples: [
    { state: "default", exports: [], content: <MotionExample /> },
    { state: "loading", exports: [], content: <Stack gap="medium"><Inline gap="medium"><Button variant="primary" loading loadingLabel="加载中">提交</Button><Spinner label="正在加载示例" /></Inline><Progress value={45} label="加载进度" showValue /></Stack>, instructions: "可在浏览器模拟 prefers-reduced-motion: reduce；文字状态仍可读取，旋转和过渡停止。此说明不代表自动验收已经通过。" },
  ],
  content: <MotionExample />,
  code: `<Dialog open={open} onOpenChange={setOpen} title="设置"><p>关闭退出由组件处理。</p></Dialog>\n<Drawer open={drawerOpen} onOpenChange={setDrawerOpen} title="详情"><p>桌面右侧、窄屏底部进入。</p></Drawer>\n<Collapse title="详细信息" defaultOpen><p>自然内容高度，无需动画参数。</p></Collapse>\n<ToastProvider maxVisible={2} maxQueue={6}><Page /></ToastProvider>\n// Page 内：const { toast, dismissAll } = useToast();\ntoast({ description: "已保存", duration: 4000, showSeconds: true });`,
} satisfies ExplorerCase;

export default explorerCase;
