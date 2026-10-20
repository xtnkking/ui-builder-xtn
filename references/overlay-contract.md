# ui-builder-xtn 浮层内核契约

本契约适用于 `v0.3.0` M4 之后的模态浮层。公开组件不得各自实现焦点圈定、Escape、背景 inert 或页面滚动锁；这些行为由 `assets/react-kit/src/ui/internal/layer-kernel.tsx` 统一拥有。

## 1. 内核职责

- 每个 owner document 维护独立层栈，不假设浮层一定属于全局 `document`。
- 模态层打开后锁定其 document 的 body 滚动，并按注册数量引用计数；最后一层关闭时精确恢复原来的 `overflow` 和 `padding-right`。
- 仅当前顶层模态可交互。真实页面背景和下层模态被设为 `inert`，关闭后恢复它们原有的 inert 状态。
- 由当前模态通过 `aria-controls` 关联的 Select、Popover 等浮动 Portal，以及 Toast Portal，是合法交互分支，不得被误设为 inert。
- 初始焦点、Tab/Shift+Tab 圈定、顶层 Escape、关闭后的焦点恢复均由内核处理。触发器失效时，焦点回到仍可用的相邻页面停点；不会把焦点送入已卸载或仍 inert 的节点。
- Tab/Shift+Tab 只在实际首尾边界、panel 入口或层外焦点处圈定；Firefox 等浏览器在当前 owned layer 内生成的原生滚动停点保持双向默认导航，不因未列入静态停点列表而跳回边界。
- 嵌套层只响应最上层 Escape。父层先卸载时，存活子层会重新挂接到上级，滚动锁和背景 inert 不泄漏。
- Portal 主题同步由内核调用 M3 的逻辑源主题协议；服务端 render 不创建 Portal，也不在 render 阶段无条件访问浏览器全局对象。

## 2. 内部接入方式

内部浮层先始终渲染隐藏的逻辑源节点，再等待客户端 owner document 的 body 成为 Portal 目标：

```tsx
const sourceRef = useRef<HTMLSpanElement>(null);
const portalRef = useRef<HTMLDivElement>(null);
const panelRef = useRef<HTMLDivElement>(null);
const ready = useLayerPortalReady();
const portalTarget = useLayerPortalTarget(ready, sourceRef);
const presence = useMotionPresence(open, portalRef);
const layer = useLayerKernel({
  active: presence.present && portalTarget !== null,
  sourceRef,
  portalRef,
  panelRef,
  dismissPolicy: { backdrop: true, closeControl: true, escape: true },
  initialFocus: "panel",
  onDismiss: () => { if (open) setOpen(false); },
});

return (
  <LayerParentProvider id={layer.id}>
    <span ref={sourceRef} hidden aria-hidden="true" />
    {presence.present && portalTarget ? createPortal(
      <div ref={portalRef} data-ui-motion={presence.state} onMouseDown={(event) => {
        if (open && event.target === event.currentTarget && layer.isTopLayer()) layer.dismiss("backdrop");
      }}>
        <div ref={panelRef} tabIndex={-1} onFocusCapture={layer.captureRestoreFocus} />
      </div>,
      portalTarget,
    ) : null}
  </LayerParentProvider>
);
```

`initialFocus` 可选 `"panel"`、`"first-tabbable"` 或返回目标元素的函数。Dialog、Drawer 和 ConfirmDialog 保留现有的安全操作按钮优先规则；图片预览或引导层可明确把焦点放在其 panel/card。

`useMotionPresence` 是官方内部能力，不从公共 barrel 导出。上例只展示内核接入关系；实际组件还在退出阶段统一阻止新的提交/业务操作。公开调用方仍使用原来的 `open` / `onOpenChange`，无需额外生命周期 Props。

## 出入动效与层所有权

Dialog、ConfirmDialog、Drawer、Lightbox 与 GuidedTour 关闭后保留视觉节点至退出结束；期间继续拥有顶层、焦点、背景 inert 和滚动锁，防止连续 Esc 或点击穿透。退出期间不对仍含焦点的模态 panel 设置 `aria-hidden` 或 `inert`，而是阻止重复 dismiss 和新的业务操作。完成后一次性卸载、解锁并恢复焦点。

退出中重开取消旧完成路径，不能提前回焦、释放背景锁或由晚到结束事件卸载新层。受控父级拒绝关闭时保留原状态。父级直接卸载时立即清理，不保证播放退出。Portal 就绪条件与 presence 同时决定内核激活，SSR render 不访问浏览器全局。系统减少动效或页面已隐藏时及时完成退出。完整时序与减少动效见[组件动效契约](motion-contract.md)。

非模态菜单/Popover/Tooltip 的视觉退出不持有模态焦点锁；逻辑关闭后立即停止操作，必要时先移交焦点，再使退出内容 inert 且不再向辅助技术暴露。

Popover 与 HoverCard 的外部点击、焦点离开和 Escape 判断包含通过 `aria-controls` 关联的子浮层 Portal。正文内组合官方 Select、MultiSelect 等控件时，选择选项仍属于父浮层；第一次 Escape 交给当前子层。HoverCard 的键盘焦点离开触发器、正文及所属子层后关闭，Escape 回到触发器时不会立即重开。GuidedTour 的长正文在受限卡片内滚动，页脚操作独立保留；调用方无需裁短说明或加应用滚动补丁。

## 3. 关闭策略

### 弹窗表单与操作区

Dialog／Drawer 已将标题、可滚动正文和 `footer` 分开布局。保存、取消放入 `footer`，通过 `Button type="submit" form={formId}` 提交正文的唯一 `Form id`，而不是放在长正文末尾或另套完整页面模式。字段并排、窄容器换行和完整示例见[弹窗表单契约](form-contract.md#forms-inside-dialogs-and-drawers)。组件不会根据业务字段名称自动重排子节点。

### Drawer 宽度与全屏（v0.3.5）

`width` 默认 `"medium"`（460px），`"large"` 为 620px。需要更宽时直接使用官方参数：正数按 px 处理，正数的 `px`、`%`、`vw` 字符串也受支持。百分比相对于浮层可用内容宽度，vw 相对于视口；最终均不超过浮层可用宽度，inset 模式会保留原有外侧留白。不接受任意 CSS 表达式、负数、零或非有限数；非法运行时值回退 medium。

```tsx
import { Drawer } from "./ui";

<Drawer open={open} onOpenChange={setOpen} title="编辑项目" width={800}>
  {projectForm}
</Drawer>

<Drawer open={open} onOpenChange={setOpen} title="项目详情" width="75%">
  {projectDetails}
</Drawer>

<Drawer open={open} onOpenChange={setOpen} title="工作区" width="80vw">
  {workspace}
</Drawer>

<Drawer open={open} onOpenChange={setOpen} title="完整工作区" fullScreen>
  {workspace}
</Drawer>
```

`fullScreen` 默认 false；开启时优先于 width 和 variant，在桌面和移动端均铺满视口，移除 inset 留白与边框／圆角。未开启时，普通移动端抽屉继续全宽底部面板，不以自定义桌面宽度压缩手机布局。宽度及全屏均复用官方关闭、焦点和默认出入动效，不需要业务 CSS、style 或动画包装。

`v0.3.4` 起，ConfirmDialog／Popconfirm 的确认失败由组件自动发送轻提示，当前浮层保持打开，原确认按钮继续承担重试。不要在 onConfirm 的失败路径再插入 Alert 或手动通知同一失败。复用应用级 ToastProvider；独立组件有内部兜底。Toast 的关闭只关闭通知，不提交或关闭确认浮层。

内核使用三个互相独立的原因：`backdrop`、`close-control`、`escape`。组件必须把每个入口映射到对应原因，不能用一个旧闭包同时控制所有入口。

- Dialog/Drawer 的 `closeOnBackdropClick={false}` 只禁用遮罩，保留 × 和 Escape。
- Dialog/Drawer 的 `closable={false}` 禁用遮罩、× 和 Escape；业务内容仍须提供明确的保存、取消或完成路径。
- 受控父级可以拒绝一次关闭请求。只要 `open` 仍为 true，该层必须继续保持顶层、焦点圈定、inert 和滚动锁。
- 关闭并重新打开后重新读取当前策略，不沿用前一次监听器捕获的 Props。
- Lightbox 的 ×、Escape 和空白遮罩均可关闭预览；空白包括图片与说明之外的 figure 区域。点击图片、说明、页码或控件本身不会触发遮罩关闭。遮罩只响应同一空白目标上的主指针按下并松开；右键、取消的手势或移动超过 8px 的拖动不关闭，拖回原点也不例外。关闭后按统一内核恢复触发器焦点；嵌套预览只关闭最上层图片查看器。

### 下拉菜单触发入口

`DropdownMenu` 默认 `triggerAppearance="button"`，保留文字与下箭头，适合普通页面命令。表格操作列与 `IconButton` 并排时，使用 `triggerAppearance="icon"`：入口复用官方 ghost 图标按钮，默认省略号，不显示文字胶囊或下箭头；`icon` 可显式替换图标。

图标模式的 `label` 用于悬停／键盘聚焦提示，`ariaLabel` 提供含具体记录名称的可访问名称。菜单项继续显示完整文字，保持原有方向键、Enter、Escape、关闭和焦点恢复行为；只有禁用项或空列表时入口禁用。使用现成公共属性，不通过 `label` 塞入另一个按钮，不自建触发器或覆写样式。

```tsx
<DropdownMenu triggerAppearance="icon" label="更多操作"
  ariaLabel={`更多操作：${record.name}`} align="end" items={secondaryActions} />
```

同一行的常用操作与更多菜单不重复命令，详见[操作列组合](data-workflows.md#table-operation-columns)。

## 4. 验收证据

下列是原有浮层内核的基线验证入口，不代表本轮新增动效已经全部验收通过。动效生命周期与 Collapse 的定向组件入口包括 `tests/components/motion-presence-contracts.test.tsx`、`tests/components/motion-collapse.test.tsx`；本轮实际执行结果、源码身份及尚待完成的浏览器/production 检查仅记录在 organizer 的唯一台账。

- 组件回归：`tests/components/layer-kernel-contracts.test.tsx`、`core-contracts.test.tsx`、`modal-overlay-contracts.test.tsx`。
- 三引擎行为：`tests/browser/modal-layer-kernel.spec.ts`。
- 现有复杂 Portal 回归：`scripts/test_dialog_multiselect_browser.mjs`。
- 抽屉视觉仍由 `tests/visual/drawer-edge.visual.spec.ts` 负责；内核迁移不得改变桌面端贴边和左侧圆角，也不得改变移动端底部抽屉契约。

完整 M4 验收还包括 Lightbox、GuidedTour 和 Popover trigger 的后续迁移；仅完成本文件所述内核和 Dialog/Drawer/ConfirmDialog 不代表整个 M4 已完成。
