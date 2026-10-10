import { useEffect, useState } from "react";
import { Button, Inline, Progress, Spinner, Stack } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

function MotionExample() {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(20);
  useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(() => { setProgress(100); setRunning(false); }, 1000);
    return () => window.clearTimeout(timer);
  }, [running]);
  return (
    <Stack gap="large">
      <Inline gap="medium" wrap>
        <Button variant="primary" loading={running} loadingLabel="演示中" onClick={() => { setProgress(20); setRunning(true); }}>运行加载演示</Button>
        <span role="status">{running ? "等待示例任务完成" : progress === 100 ? "示例任务已完成" : "点击按钮观察真实加载状态"}</span>
      </Inline>
      <Progress value={progress} label="示例任务进度" showValue />
      <p className="demo-foundation-note">按钮颜色过渡 140ms，进度变化过渡 180ms，Spinner 旋转周期 800ms。开启系统“减少动态效果”后，规范样式取消这些动画与过渡；loading 和进度语义仍然存在。</p>
    </Stack>
  );
}

const explorerCase = {
  id: "motion/overview",
  label: "过渡、加载与减少动态效果",
  summary: "直接观察 Button、Progress 和 Spinner 的真实动效；没有提供任意动画时长的业务覆盖接口。",
  states: ["default", "loading"],
  stateExamples: [
    { state: "default", exports: [], content: <MotionExample /> },
    { state: "loading", exports: [], content: <Stack gap="medium"><Inline gap="medium"><Button variant="primary" loading loadingLabel="加载中">提交</Button><Spinner label="正在加载示例" /></Inline><Progress value={45} label="加载进度" showValue /></Stack>, instructions: "可在浏览器模拟 prefers-reduced-motion: reduce；文字状态仍可读取，旋转和过渡停止。此说明不代表自动验收已经通过。" },
  ],
  content: <MotionExample />,
  code: `<Button loading={loading} loadingLabel="保存中" onClick={handleSave}>保存</Button>\n<Progress value={progress} label="处理进度" showValue />\n<Spinner label="正在加载" />`,
} satisfies ExplorerCase;

export default explorerCase;
