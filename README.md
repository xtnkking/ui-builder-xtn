# UI Builder XTN

`ui-builder-xtn` 是一个带完整 React + TypeScript 源码的 Codex Skill，用于构建风格一致、交互稳定的产品界面。

它不是一份只靠提示词约束的视觉规范。v0.2.17 将 Personal UI 源码、公开导出、组件清单、安装器和来源校验器组成同一个闭环：使用者提出功能后，页面中的控件必须直接使用本仓库提供的组件代码。

当前版本的改动见 [CHANGELOG.md](CHANGELOG.md)。

## 强制源码模式

- `assets/react-kit/src/personal-ui/` 是唯一 canonical 组件源码。
- 安装器会把完整、带版本的源码复制到目标项目 `src/personal-ui/`。
- 业务代码只能从 `src/personal-ui/index.ts` 的公开 barrel 导入运行时组件和页面模式。
- 目标项目不得临时仿写控件、深层导入实现文件、修改已安装组件、添加本地扩展，或用第三方 JSX 组件绕开 Personal UI。
- `component-manifest.json` 将 118 个基础、组件和页面模式家族以及 130 个目录别名绑定到真实源文件，并把 139 个 runtime export 明确分类为 136 个可视组件/模式和 3 个非可视 Hook/常量。
- `component-manifest.json` 还保存全部 28 个 managed source 文件的 SHA-256，任何缺失、修改或额外文件都会失败。
- 安装器会把固定的 `verify:personal-ui` 自动接入 npm `prebuild`；常规 `npm run build` 必须先通过源码完整性和组件来源门禁。
- 校验器扫描项目中的脚本、JSX/TSX、MDX、HTML、CSS、PostCSS、SCSS、Sass 和 Less，并识别实际使用的公开导出；不需要靠人工列出组件，也没有允许源码漂移的绕过开关。
- 业务样式可以负责非交互布局和文档允许的主题 token，但不能用通用控件选择器、私有 `.pui-*` / `data-pui-*` 选择器、CSS-in-JS 包装、预处理器注入、动态 `<style>`、外部全局样式、DOM/CSSOM 修改，或受保护组件的 `className`、`style`、`css`、`sx`、`tw`、`ref`、spread props / `cloneElement` 改写组件皮肤和几何。

业务代码仍然可以负责数据请求、状态、文案、产品图片、非交互布局和文档允许的 token 配置。按钮、输入、选择、导航、反馈、弹层、数据展示和复用页面模式必须由 Personal UI 公开组件负责。

## 主要能力

- React、TypeScript、Vite 与 `lucide-react` 源码组件包
- 表单、选择、导航、数据展示、反馈、弹层、布局和辅助工具
- 品牌家族登录页：共享登录结构，各产品通过图片、名称、文案和强调色表达差异
- 服务端数据列表：草稿筛选、手动查询、排序、分页、加载、空状态、错误和重试
- 列表管理、创建编辑、详情、设置、向导、主从视图、导入导出和状态页模式
- 稳定的异步尺寸、分页表格固定可视区、输入框图标位置、浮层行为和 320px 至宽屏响应式契约
- 弹窗和抽屉可用 `closeOnBackdropClick={false}` 禁止点击遮罩关闭，同时保留关闭图标和 Esc；`ConfirmDialog` 也支持该属性

完整映射见 [组件目录](references/component-catalog.md)，安装、升级和强制来源规则见 [集成指南](references/integration.md)。

## 预览与设计基准

`assets/react-kit` 中的 React 实例和 `src/personal-ui/` 是实际可安装、可运行的组件来源。旧的 `personal-ui-library-preview.html` 是独立的静态设计稿，其原生控件和演示交互不会随 Skill 源码自动更新，也不能被复制到业务页面。自 v0.2.8 起，基础控件高度、圆角、主色和弹窗间距已向该设计稿的默认浅色模式对齐；复杂表单弹窗、嵌套确认和默认内嵌抽屉等新场景则以 React 预览及公开组件 API 为准。

在仓库中运行 `npm --prefix assets/react-kit run dev` 查看最新实例。检查视觉问题时请同时查看真实业务场景、对应的公开组件源码和浏览器中的 React 实例，不要仅从旧设计稿截图推断当前 Skill 的行为。

## 环境要求

- Codex
- Python 3.10+
- Node.js 18.18+

## 安装为 Codex Skill

PowerShell：

```powershell
git clone https://github.com/xtnkking/ui-builder-xtn.git "$env:USERPROFILE\.codex\skills\ui-builder-xtn"
```

macOS / Linux：

```bash
git clone https://github.com/xtnkking/ui-builder-xtn.git "${CODEX_HOME:-$HOME/.codex}/skills/ui-builder-xtn"
```

重新打开 Codex 任务后即可调用：

```text
$ui-builder-xtn 使用现有组件做一个带筛选、手动查询、分页和右侧抽屉的成员管理页面
```

## 创建新项目

在 Skill 仓库根目录执行：

```powershell
python scripts/install_personal_ui.py --mode starter --target <destination>
cd <destination>
npm ci
npm run dev
```

## 接入已有项目

先预览完整替换计划：

```powershell
python scripts/install_personal_ui.py --mode integrate --target <project-root> --force --dry-run
```

确认后安装：

```powershell
python scripts/install_personal_ui.py --mode integrate --target <project-root> --force
```

在应用入口只引入一次样式：

```tsx
import "./personal-ui/styles.css";
```

所有组件从统一出口导入：

```tsx
import { Button, DataTable, Drawer, SearchInput } from "./personal-ui";
```

不要从 `./personal-ui/primitives`、`./personal-ui/forms` 等内部路径导入。目标项目已有另一套 UI 系统时，应先确定迁移或项目隔离方案；严格来源扫描不会把两套控件混用视为合格结果。

## 缺失组件怎么处理

缺失能力必须先进入 canonical 组件库，不能在业务页面里做一个临时版本：

1. 在 `assets/react-kit/src/personal-ui/` 实现可复用组件及样式。
2. 从 canonical `index.ts` 公开导出。
3. 更新 `component-manifest.json` 的家族、源文件、别名和 ownership marker。
4. 更新 `registry.json` 的运行时导出。
5. 添加测试和代表性案例，完成 typecheck/build。
6. 运行 `python scripts/update_component_manifest_integrity.py` 更新 managed source 哈希清单。
7. 同步并提升版本，再把新版本重新安装到目标项目。
8. 业务页面最后从公开 barrel 使用该组件。

无法在当前任务中完成 canonical 扩展时，应明确报告缺失能力，而不是交付原生控件、CSS 仿制品或第三方替代品。

## 验证

校验目标项目的安装完整性和组件来源：

```powershell
npm run build
python scripts/verify_personal_ui.py --target <project-root>
```

校验器会自动检查：

- installed 与 bundled 版本、registry 和支持文件一致
- `component-manifest.json` 有效，且所有公开导出都由真实源码覆盖
- `src/personal-ui/` 没有 missing、changed 或 extra 文件
- `package.json` 保留 installer 管理的 `verify:personal-ui` 与 `prebuild` 门禁
- 业务源码仅从公开 barrel 使用 Personal UI
- 没有原生受保护控件、交互 role、深层导入、私有导出、伪造 `.pui-*` / `data-pui-*`、危险通用/预处理器控件 CSS、CSS-in-JS 包装、动态或外部全局样式、DOM/CSSOM 改写、组件克隆、受保护组件外观覆盖或未允许的外部 JSX 控件
- 样式入口只引入一次，依赖版本兼容

只有报告中的 `upToDate`、`componentManifest.valid` 和 `provenance.valid` 全部为 `true`，`errors` 与全部 `sourceDrift` 列表为空，才可以交付。`--require-component` 只是兼容旧调用的附加断言，不能替代自动扫描；`--allow-unreferenced` 只允许在刚安装、尚未组合页面时做中间检查。

验证仓库自带源码：

```powershell
python scripts/validate_component_manifest.py
python scripts/test_strict_enforcement.py
npm --prefix assets/react-kit ci
npm --prefix assets/react-kit run build
```

## 命名说明

Codex Skill 的调用名是 `ui-builder-xtn`。组件目录、CSS 命名空间和安装脚本继续使用 `personal-ui`，用于保持已安装项目的稳定导入路径。

## License

本仓库当前未附加开源许可证。公开可见不代表自动授予复制、修改或再分发权利。
