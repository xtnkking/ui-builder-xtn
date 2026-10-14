# 主题、品牌色与材质

当前开发版在同一套官方组件上提供三种视觉预设和两种表面材质。它们属于 `ThemeProvider` 的公共 API，安装器会随完整组件源码安装。无需修改已安装的 `src/ui/`，也不需要在业务 CSS 中覆盖组件选择器。

## 直接使用

```tsx
import { Button, ThemeProvider } from "./ui";

export function App() {
  return (
    <ThemeProvider mode="light" preset="apple" material="glass">
      <Button variant="primary">保存设置</Button>
      {/* 在这里组合其他官方组件和业务布局 */}
    </ThemeProvider>
  );
}
```

| 属性 | 可选值 | 省略时 |
| --- | --- | --- |
| `preset` | `default`、`apple`、`material` | 继承最近的外层主题，没有外层时使用 `default` |
| `material` | `solid`、`glass` | 继承最近的外层材质，没有外层时使用 `solid` |
| `mode` | `inherit`、`light`、`dark`、`system` | `inherit`，沿用既有明暗模式合同 |
| `tokens` | `ThemeTokens` 公共语义颜色对象 | 使用主题颜色；显式 token 优先 |

`default` 保留原组件外观。`apple` 使用中性表面、柔和阴影和更舒展的圆角；`material` 使用紫色品牌基调、色调表面和更明确的层次。两种名称描述设计方向，不代表 Apple 或 Google 官方实现，不承诺完整复刻其平台规范。

`glass` 是独立材质，不是第四种视觉预设；可以与三种预设组合。它用于适合的表面与浮层，保持输入内容、表格数据和重要文本的可读性。组件的布局、交互状态、受保护属性和业务行为仍由原官方实现负责。

选择器及下拉菜单的选中／悬停背景圆角按菜单外框与内部间距配套计算。苹果风格的普通下拉和菜单内部圆角为 14px，搜索下拉为 13px；Material 分别为 10px 和 9px，默认风格保留原有 6px。调用方无需单独调整每个选项。

## 品牌色

主题预设与业务品牌色可以分别指定。需要品牌色时，通过同一个公共入口配置配套颜色：

```tsx
import type { ReactNode } from "react";
import { ThemeProvider, type ThemeTokens } from "./ui";

const emerald: ThemeTokens = {
  "--ui-primary": "#047857",
  "--ui-primary-hover": "#065f46",
  "--ui-primary-soft": "#ecfdf5",
  "--ui-primary-ink": "#065f46",
  "--ui-on-primary": "#ffffff",
  "--ui-focus-ring": "#047857",
  "--ui-product-accent": "#047857",
};

export function ProductTheme({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider mode="light" preset="apple" material="solid" tokens={emerald}>
      {children}
    </ThemeProvider>
  );
}
```

这是一套浅色配色示例。深色模式应提供另一套经过对比度检查的颜色；只指定一个十六进制颜色不会自动生成完整明暗主题。成功、警告、错误保留各自语义，除非产品另有完整且可读的配色要求。

## 继承与弹层

未指定 `preset` 或 `material` 的嵌套 Provider 沿用对应外层设置；显式传入 `preset="default"` 或 `material="solid"` 可以局部恢复默认风格或实底材质。

Dialog、Drawer、下拉菜单等 Portal 使用逻辑来源的主题，即使其 DOM 挂在 `document.body` 或模态容器下也保持一致。官方内部仅同步经过审核的主题变量与属性；任意私有变量、组件几何和业务样式不因此成为公共配置。

磨砂需要有可透出的背景内容。浏览器不支持 `backdrop-filter` 或用户开启减少透明度偏好时，官方表面回退为可读实底。无需通过业务 CSS 强制开启模糊；背景图案和产品插画可以由业务非交互布局提供。

## 预览与验证范围

Explorer 的 `#/themes` 是可操作的主题工作台，支持切换风格、材质、品牌色和明暗模式，并打开弹窗、抽屉与下拉表面。控件均使用公共 barrel，不复制组件皮肤；该页面是文档示例，消费项目只需使用上面的公共接口。

本次开发按主题实际影响验证 Provider/Portal 合同、公共类型、来源完整性、生产构建和具名桌面／320px 浏览器案例。2026-10-14 的交付范围是 `main` 源码与 GitHub Pages 预览，固定版本 `v0.3.1` 的 tag 和 Release 附件不变；不重新执行 M1–M8。具体变更见仓库 CHANGELOG。
