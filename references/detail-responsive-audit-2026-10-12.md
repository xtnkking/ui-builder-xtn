# 细节与响应式自查 · 2026-10-12

本轮针对使用者持续反馈的“小细节、窄屏、长内容和组合布局”开展有界审阅，并修复确认的问题。范围为 **22 个公开组件、20 个实际 Explorer 目录**，不是全部 119 个目录重新验收，也不是手机实机兼容认证。

## 范围与方法

- 输入与筛选：Input、PasswordInput、SearchInput、Textarea、Select、SearchableSelect、FilterBar。
- 浮层与反馈：Dialog、Drawer、Popover、DropdownMenu、Toast、Alert、Lightbox。
- 数据与内容：DataTable、Pagination、Tabs、Tag、TagInput、OverflowText、Form、Field。
- 每个目录检查桌面总览和真实 320 CSS px 模拟视口的长内容案例。对选择菜单、Dialog、Drawer、Popover、DropdownMenu、Toast、Lightbox 实际打开 Portal 表面后截图，避免只审阅入口按钮。
- 先静态检查再审阅保存的截图；对确认修改补具名回归。另检查同一个桌面视口中的 320px 宿主，区分容器适配与移动媒体查询。
- 起点为 `26d30e86d6c8f47e39188c7cb05597fbc8516fd3`。初始截图记录自己的工作源码指纹 `fda9a0a3ad2985b4b2f9e77ea66e83fb6ca469bb4bad25382e16104ac2019af2`，不能冒称为修复后的源码证据。

## 逐目录结果

下表的“未见新增缺陷”只指本轮已观察状态，不代表该组件所有状态均已重新验收。

| 目录 / 公开组件 | 发现与处理 | 验证范围 |
| --- | --- | --- |
| text-input / Input、PasswordInput | 截图未见新的眼睛漂移、输入框外溢或字体裁切；保留现有实现 | 桌面总览、320px 长值 |
| search-input / SearchInput | 长内容案例原为只读且没有清除；改为真实编辑、清除、焦点返回，增加完整提示 | 具名编辑/清除回归 |
| textarea / Textarea | 截图底部半行位于可滚动内容边界，不是字体底部被行盒裁切 | 桌面、320px 长正文 |
| select / Select、SearchableSelect | 菜单长选项原仅省略，触屏不能读全；菜单文字和描述换行，触发器仍省略。普通 Select 窄屏/触屏选项至少 44px。禁用案例改为真正禁用 | 320px 全文宽高、禁用状态、浮层边界 |
| select / Select | WebKit 指针点击按钮不自动聚焦，Esc 未到达 combobox；打开时明确聚焦触发器，保持 active-descendant 键盘所有权 | Chromium / WebKit 指针打开、焦点、Esc |
| filter-bar / FilterBar | 原按 Field 总高度底对齐，提示和多行标签会挤偏控件。改为每行实际控件锚点对齐；按钮换行后偏移归零。保留紧凑密度、宽度限制与触屏高度 | Chromium / WebKit，长标签+hint+error、Enter、桌面及窄宿主 |
| dialog / Dialog | 正文直接段落默认 margin 与组件 gap 叠加；仅重置直接 p 的 margin，保留 16px gap | 320px 段落几何、footer、Esc、修复后截图 |
| drawer / Drawer | 本轮打开表面未见新的圆角、正文或 footer 缺陷；没有重构头部 | 桌面、320px 长正文 |
| popover / Popover | 等宽模式的数值 minWidth 会留住过宽值；改为锚点/当前可见宽度变量。约束当前 VisualViewport，监听其 resize/scroll | Chromium / WebKit，1440→320、合成可视视口事件、Esc |
| menu / DropdownMenu | 本轮打开表面未见新增缺陷。共享定位改进会覆盖复用同一 hook 的浮层，但不扩大为菜单全部键盘状态复验 | 桌面、320px 长菜单 |
| toast / Toast | 已观察短错误胶囊的图标、文字、关闭按钮对齐；长圆角提示未见裁切。保留当前形状与开关 | 桌面打开胶囊、320px 打开长圆角提示 |
| alert / Alert | 本轮标题、正文及边界未见新增缺陷 | 桌面、320px 长正文 |
| lightbox / Lightbox | 本轮实际打开预览未见新的明确缺陷，保留前一任务的切图、鼠标遮罩、关闭与焦点实现 | 桌面、320px 长说明 |
| data-table / DataTable | 示例仅点击应用筛选，Enter 会走原生 form 提交；统一 onSubmit 并阻止刷新，重置页码。保留组件固定容量规则 | 草稿不改变结果、Enter/点击一致、文档不刷新 |
| pagination / Pagination | 示例总页数原写死 12；根据 231/pageSize 计算。紧凑布局隐藏页码后，页码目标 spinner 也被隐藏；摘要保留固定加载槽 | 每页数量 50→5 页、320px 页码/页数量加载分别验证 |
| tabs / Tabs | 长纯文本标题原直接硬切；独立文字槽省略，保留全文 title 与可访问名称。fill 仍均分，原键盘与横向滚动保留 | 320px 长标题、省略、方向键切换、截图 |
| tag / Tag | 本轮长标签、移除控件和边界未见新增明确缺陷 | 桌面、320px 长标签 |
| tag-input / TagInput | 本轮文字省略、原始值和删除位置正常；删除案例中“方向键选择建议”的未实现承诺，说明实际 Enter、Backspace、Esc 和 Tab 能力 | 静态键盘能力核对及两宽度截图 |
| overflow / OverflowText | 本轮省略展示未见新增缺陷；保留已有全文披露方式 | 桌面、320px 长内容 |
| form / Form | 长内容案例 p 默认 margin 叠加 Form gap；仅归零该业务说明的 margin | 源码和截图间距对照、编译 |
| field / Field | 单独案例未见新增提示间距问题；带提示组合的问题由 FilterBar 修复，不改变所有 Field 的间距 | 两宽度截图及 FilterBar 组合回归 |

## 代码与检查

修复发生在 canonical `src/personal-ui/`，Explorer 继续从公开 barrel 复用组件。没有在案例外写 `.pui-*` 补丁，没有混入另一套组件。

- 回归：`assets/react-kit/tests/browser/detail-responsive-audit.spec.ts`（7 项）和 `detail-floating.spec.ts`（2 项）。9 项 Chromium，加上仅针对改动行为的 3 项 WebKit，共 12 个唯一检查，最终都有通过结果。
- 首轮 10/12；一项测试混用 innerText/textContent，一项发现 WebKit Select 焦点缺陷。只复验相关路径；随后纠正一次误把 Select 焦点断言套到 Popover 的测试错误。保留失败记录和一次明确的重试预算例外，没有重跑全部组件。
- 源码完整性、API/兼容性、生成文档、Explorer AST 状态证据、覆盖元数据、模块边界、CSS 合同、TypeScript/Vite 生产构建、产物 CSS 检查通过。文档门禁发现长搜索的通用状态 helper 不能提供静态长内容证据，改用真实独立长内容案例后，从文档阶段恢复，未重复已通过的前置步骤。
- 修复后的 Select、FilterBar、Tabs 截图再次人工查看，避免仅凭机器几何断言判断美观。
- 审阅工具增加选定目录、指定状态及打开表面捕获能力。第二次库存捕获属误判控制台中文编码后的重复操作，已在组织者台账记录；有效初始证据仍为第一次库存，不用重复捕获扩大覆盖声明。

维护者证据：初始库存 receipt `a94fc567d6ad448b9f44fb180b29d612`；浏览器首轮 `9f7b5998099c4904babfa72e4077deb3`、局部复验 `286707d4b52d4363a49a684fb743bb2c`、最终定点通过 `0ee9c10b4c59476c9b375ee396547be0`；最终构建 `d6559667f4da43e2b9f82a8ff1805d95`。具体文件、运行输入和失败记录保留在唯一组织者台账。

## 边界与后续

- 本轮没有运行 M8 消费者矩阵、全量行为/axe/视觉套件或全部浏览器全量组合，没有创建版本号、tag、Release，也没有同步安装副本。
- VisualViewport 合成事件证明布局约束和事件响应，不证明真实 iOS/Android 软键盘、IME、缩放和安全区兼容。未作手机实机认证。
- Tabs 的自动省略针对 string/number 标签；复合 ReactNode 的图标/徽章布局保持原结构，不能据此宣称任意插槽内容都已截断。
- 未选中的其他组件族不属于本轮新增审阅范围；新的反馈应先定位共同原因，补最小真实案例并运行受影响的具名回归。
- 本轮交付更新 main 与现有 GitHub Pages 组件预览。在线部署事实以最终交付记录及对应 workflow head 为准，不能将本地构建当作已部署。
