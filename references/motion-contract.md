# 组件动效契约

动效属于官方组件实现，安装当前源码后默认获得；业务页面继续使用原来的公开 Props，不需要动画库、组件包装器、应用 CSS 或额外 Provider。主题与材质选择不改变组件的交互模型。本契约描述源码行为；实际验收结果与源码身份记录在当前执行台账，不把预览文案当作测试证据。

## 使用方式

```tsx
import { Collapse, Dialog, Drawer, ToastProvider, useToast } from "./ui";

<Dialog open={open} onOpenChange={setOpen} title="设置">
  <SettingsForm />
</Dialog>

<Drawer open={detailsOpen} onOpenChange={setDetailsOpen} title="订单详情">
  <OrderDetails />
</Drawer>

<Collapse title="更多信息" defaultOpen>
  <AdditionalInformation />
</Collapse>

<ToastProvider maxVisible={3} maxQueue={20}>
  <Page />
</ToastProvider>

// 在 Provider 内的 Page 中调用：
const { toast, dismissAll } = useToast();
toast({ description: "设置已保存。", duration: 4000, showSeconds: true });
```

业务关闭仍通过 `open` / `onOpenChange` 或 `dismiss` 表达。不要为了播放退出动画延迟业务回调，也不要给面板添加自行维护的卸载计时器。需要退出动画时，让受控组件继续存在于 React 树中并将 `open` 设为 `false`；父级直接卸载会立即释放资源，不保证播放退出。未新增公共 `duration`、`easing`、位移或几何 token。Toast 的 `duration` 仍表示消息显示时间。

## 默认节奏与范围

| 场景 | 进入 / 反馈 | 退出 |
| --- | --- | --- |
| 按钮、输入框、Switch 等基础状态 | 120ms | 同一轻反馈节奏 |
| Dialog、ConfirmDialog、Lightbox、GuidedTour、Toast、Popover | 180ms | 140ms |
| Drawer、Collapse | 220ms | 180ms |
| 选择器菜单、DropdownMenu、ContextMenu、Tooltip | 120ms | 100ms |
| Tabs、SegmentedControl 选中指示器 | 180ms 移动 | 不额外退出 |
| Carousel、Lightbox 当前内容切换 | 180ms 轻淡入 | 不保留旧交互内容 |

进入使用 `cubic-bezier(0.2, 0, 0, 1)`，退出使用 `cubic-bezier(0.4, 0, 1, 1)`。官方内部配置统一拥有 CSS 时长和清理时序，业务不覆盖。静态 Alert、Banner、Tag、普通表格行及页面内容不会被统一加入入场动画。加载指示保留自身有意义的周期。

Dialog 等以淡入和轻缩放出现，Drawer 沿实际布局方向进入；桌面从右侧、窄屏按底部抽屉布局。浮动菜单的视觉变化与定位测量分离，不能让 transform 改变定位结果。Toast 进入/退出与同位置补位不改变稳定消息身份或再次播报。

## 生命周期与中断

内部状态为 `closed → entering → open → exiting → closed`。关闭请求立即通知业务，退出完成后卸载视觉节点；退出中重开取消旧完成路径并保留当前实例。快速开关、结束事件缺失、零时长、系统减少动效和页面已隐藏都有有界完成路径；父级卸载、StrictMode effect 重放会清理监听与计时器。

动画结束时先停止完成监听和兜底计时，保留已完成的视觉终点，直到最终状态提交或节点卸载后再释放动画资源。终态提交前不得重新启动 CSS 动画，避免收尾闪回；快速反向仍从当前视觉位置继续。

模态退出完成前仍拥有焦点、背景 inert 与滚动锁，防止连续 Esc 或点击穿透父层/背景。退出期间阻止重复关闭和新的业务操作；完成后释放一次并恢复焦点。受控父级拒绝关闭时不进入退出状态。关闭策略、嵌套与回焦细节见[浮层契约](overlay-contract.md)。

非模态菜单在逻辑关闭时立即停止选项操作和导航，并清理 active-descendant。若焦点仍在退出内容中，先按原规则交还触发器，再使视觉残留内容 inert、退出辅助技术访问；焦点已移到外部时不抢回。没有退出期间可选的“幽灵菜单”。

Toast 退出项继续占用原容量和槽位，退出完成才删除并 FIFO 补位。计时在首次显示开始，进入计入显示时间；移动不重置计时，关闭停止该项计时和操作。`dismissAll()` 先清空等待项再退出显示项，不能在退出后误补位。去重键到实际删除前仍被占用。详见[轻提示契约](toast-contract.md)。

## 选中指示与内容切换

`Tabs` 和 `SegmentedControl` 使用组件拥有的装饰指示器，首次展示直接对齐当前选项，选择改变后才移动。键盘和受控更新使用同一行为；快速连续选择从当前视觉位置继续，窗口缩放、选项重排或字体尺寸变化后重新对齐。指示器不参与焦点和辅助技术访问，也不改变原有选中状态和回调。

`Carousel` 立即更新所选内容，再播放短淡入；不会为转场同时保留两个可操作轮播页，自动播放、暂停和播报规则保持原样。`Lightbox` 切换时等待新图可显示，避免未加载图片造成闪白；快速导航不会让旧图片请求覆盖当前图片，失败状态仍提供关闭和切换入口。图片切换不重开浮层、不重置焦点或滚动锁；说明和当前序号跟随实际选择。

上传拖放反馈与进度使用统一时长和缓动。上述效果默认可用，不需要新增业务参数；真实系统减少动效会停用装饰过渡。它们不意味着全站列表、树节点或路由都必须播放动画。

## 折叠与动态内容

`Collapse` 使用内容的自然高度进行展开/收起；初始 `defaultOpen` / `open` 已展开时直接显示，不从零闪开。图片加载、文字换行或异步追加内容后不残留固定像素高度。快速反向切换从当前高度继续，关闭完成后默认保留隐藏内容；`unmountOnExit` 在退出完成后卸载。

收起时若焦点仍在内容内部，先回到标题触发按钮；随后内容退出键盘与辅助技术访问。受控关闭、默认保留和退出后卸载都遵守同一规则。业务不需要自行找焦点或管理高度。

## 系统减少动效

遵循真实 `prefers-reduced-motion: reduce`，不增加独立业务开关。开启时停用位移、缩放、展开与补位过渡；非必要循环停止。运行中切换偏好，正在退出的内容立即完成；重新允许动效不重播已经完成的进入。

减少动效不暂停业务工作，也不改变 Toast 的显示时间。加载文字/ARIA、进度值、Toast 的真实剩余时间与数字读秒继续有效。不要仅隐藏 Spinner 或倒计时而删除加载/超时语义。

## 人工预览与检查边界

`#/components/motion` 提供中文优先的真实组件操作：弹窗、退出中重开、桌面/窄屏抽屉、自动/手动提示、连续入队及清空、菜单选择、动态 Collapse、加载与进度、标签页和分段指示器，以及轮播和图片切换，并显示实际系统减少动效状态。通过系统设置或浏览器偏好模拟验证减少动效，不用演示文字开关代替。

验收应观察实际进入/退出过程、快速反向、焦点与最终几何；最终截图无法单独证明动效。限定的场景、浏览器采样与停止条件见[增强计划与验收标准](motion-enhancement-plan.md)。改动仅影响文档时复用已有组件证据，不因此重跑全库、M8 或发布流程。
