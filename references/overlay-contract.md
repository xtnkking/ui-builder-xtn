# Personal UI 浮层内核契约

本契约适用于 `v0.3.0` M4 之后的模态浮层。公开组件不得各自实现焦点圈定、Escape、背景 inert 或页面滚动锁；这些行为由 `assets/react-kit/src/personal-ui/internal/layer-kernel.tsx` 统一拥有。

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
const layer = useLayerKernel({
  active: open && portalTarget !== null,
  sourceRef,
  portalRef,
  panelRef,
  dismissPolicy: { backdrop: true, closeControl: true, escape: true },
  initialFocus: "panel",
  onDismiss: () => setOpen(false),
});

return (
  <LayerParentProvider id={layer.id}>
    <span ref={sourceRef} hidden aria-hidden="true" />
    {open && portalTarget ? createPortal(
      <div ref={portalRef} onMouseDown={(event) => {
        if (event.target === event.currentTarget && layer.isTopLayer()) layer.dismiss("backdrop");
      }}>
        <div ref={panelRef} tabIndex={-1} onFocusCapture={layer.captureRestoreFocus} />
      </div>,
      portalTarget,
    ) : null}
  </LayerParentProvider>
);
```

`initialFocus` 可选 `"panel"`、`"first-tabbable"` 或返回目标元素的函数。Dialog、Drawer 和 ConfirmDialog 保留现有的安全操作按钮优先规则；图片预览或引导层可明确把焦点放在其 panel/card。

## 3. 关闭策略

内核使用三个互相独立的原因：`backdrop`、`close-control`、`escape`。组件必须把每个入口映射到对应原因，不能用一个旧闭包同时控制所有入口。

- Dialog/Drawer 的 `closeOnBackdropClick={false}` 只禁用遮罩，保留 × 和 Escape。
- Dialog/Drawer 的 `closable={false}` 禁用遮罩、× 和 Escape；业务内容仍须提供明确的保存、取消或完成路径。
- 受控父级可以拒绝一次关闭请求。只要 `open` 仍为 true，该层必须继续保持顶层、焦点圈定、inert 和滚动锁。
- 关闭并重新打开后重新读取当前策略，不沿用前一次监听器捕获的 Props。

## 4. 验收证据

- 组件回归：`tests/components/layer-kernel-contracts.test.tsx`、`core-contracts.test.tsx`、`modal-overlay-contracts.test.tsx`。
- 三引擎行为：`tests/browser/modal-layer-kernel.spec.ts`。
- 现有复杂 Portal 回归：`scripts/test_dialog_multiselect_browser.mjs`。
- 抽屉视觉仍由 `tests/visual/drawer-edge.visual.spec.ts` 负责；内核迁移不得改变桌面端贴边和左侧圆角，也不得改变移动端底部抽屉契约。

完整 M4 验收还包括 Lightbox、GuidedTour 和 Popover trigger 的后续迁移；仅完成本文件所述内核和 Dialog/Drawer/ConfirmDialog 不代表整个 M4 已完成。
