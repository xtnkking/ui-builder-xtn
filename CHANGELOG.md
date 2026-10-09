# Changelog

## [Unreleased]

### Added

- 为受支持的显式公共属性调用提供完整 React Hook Form、受控/非受控和有限 `controlRef` 示例，并分开验证 TypeScript 合同与来源政策。类型正确的 JSX 属性展开仍按政策拒绝，不宣称两种门禁对所有 TypeScript 写法等价。
- 官方 `DragDrop + FileUpload` 示例共用文件清单、类型拒绝和禁用状态；保留 accept 的 OR 语义，同名文件按稳定 ID 分别移除。`InfiniteScroll + LoadMore` 共用同步请求所有权、数据和游标；失败保留原记录并通过手动入口重试。低层组件的独立键盘能力不因此扩大。
- 新增 M8 证据连续性 producer/validator（`personal-ui-m8-evidence-continuity` / `assembler-only-v1`）及测试接线：只允许 assembler、其具名测试源码和 CHANGELOG 的维护差异，保留旧消费者与迁移身份；M6/M7 等新增源码不在有限复用范围内。

### Changed

- Explorer 仅挂载当前案例及选中状态，避免隐藏示例的 Portal 和全局快捷键相互干扰；Radio 案例使用实例独立组名，多语言几何断言限定可见案例。保留真实活动切换、单层关闭与双实例键盘选择回归，不改变公共 Tabs、Overlay 或 Radio API。
- Explorer 测试证据的正向夹具改为真实 `stateExamples` 代码，保持标签式状态和缺失公开组件归属仍被严格拒绝；修复 M6 验证器升级后旧夹具与正式门禁不一致的问题。
- Skill 路由解析的隔离测试同步受支持调用章节，并移除夹具中的重复目标链接，确保删除、图片替代和未使用引用定义仍因缺少导航路由被拒绝；正式源码与链接检查保持不变。
- 来源校验器允许官方 `controllerField` 接收 React Hook Form 的非视觉绑定对象；其他第三方包和视觉属性继续受原来源门禁约束。
- 发布适配器按 journal 登记且已确认归属的 Release ID 恢复草稿，远端核验和实际发布共用 tag、计划标记、commit 与状态校验；已公开的相同 Release 只读续跑，身份缺失或冲突时拒绝，不创建替代草稿、移动引用或重复上传附件。
- Explorer 按公开 API 记录 110 个运行时家族、142 个导出的真实适用状态实例，API 示例保留完整状态代码并支持单实例选择；严格门禁拒绝标签式和伪造映射。人工键盘入口及 320px 容器不冒充浏览器行为证明。
- 下一 releaseTarget 为 `0.3.1`。发行器、hosted 证据与 acceptance assembler 从完整受验证计划取得同一 release line 的候选版本，继续拒绝跨源晋升、无效摘要、错误 ZIP 和缺失正式验证命令；保留不可变 `v0.2.19` 历史迁移基线。

### Release status

- 以上为本地新增源码，尚未公开发行。相对公开 `v0.3.0` 没有公共组件 API 变化；兼容报告相对历史 `v0.2.19` 的 breaking 结论继续保留。新修复必须取得自己的候选、CI 和 M8 证据。

## [0.3.0] - 2026-10-08

### Added

- 为 142 个 runtime export 建立可搜索 Explorer、逐 export API/示例文档、键盘与 ARIA 证据，以及 `zh-CN` / `en-US` Locale 契约。
- 新增单一 release orchestrator，提供无写入 dry-run、隔离 prepare、可重复 ZIP、SHA-256、plan digest、verify、可续跑 journal，以及默认只读的 Git/GitHub 发布适配器；远端写入必须同时满足正式证据、精确 stable plan 授权和 `publish --execute`。
- 新增 artifact-backed hosted CI 证据：8 个支持 fixture、Chromium/Firefox/WebKit 实际版本和 system Safari 18+ smoke 均绑定同一 GitHub run 与候选摘要；每个 job 产物按路径、大小和 SHA-256 重新校验，Playwright WebKit 不能代替真实 Safari。
- 新增 M8 独立评估目录、候选可见投影 runner 和严格证据 validator；评估输入绑定候选与原始需求，首轮结果不可被修复结果覆盖，薄 `result: passed` JSON 不再满足发布前置条件。
- 新增 M8 场景质量 producer、确定性的最终 verification 和 acceptance assembler：每个场景真实执行 typecheck、build、来源校验、三引擎六宽行为、axe 与截图，并保留命令、日志和原始产物的逐字节来源链。
- 正式 `0.3.0` 只能从同一源码、已完整验证的 `0.3.0-rc.N` 晋升；晋升重新核对 RC plan、文件清单、验证记录与 CHANGELOG，且只允许确定性的版本和发布元数据变化。
- 仓库采用 MIT License，并在 Skill 与 React starter/lockfile 元数据中记录相同的许可证标识；`THIRD_PARTY_NOTICES.json` 精确清点 lockfile 中的 226 个依赖及其锁定来源。

### Changed

- M8 acceptance assembler 允许历史审阅说明中正常出现 `placeholder` 一词，仍拒绝独立占位值、括号占位及 TODO/TBD/FIXME 等未完成标记，避免将真实失败记录误判为模板。
- M8 源码清单按原始字节保留，清单中的 ZIP 成员路径不再被当成消费者工作区证据路径重定位；初始和最终源码 ZIP 的哈希、文件清单及内容摘要校验保持有效。

- 嵌套确认框在 WebKit 中自动聚焦早于层注册时，保留同一父弹窗内的点击来源，关闭后准确恢复到触发按钮；焦点转向无关控件、后续键盘和指针操作仍会使旧来源失效。
- `Button` 和 `IconButton` 在首次条件挂载浮层时传递真实触发源，`Drawer` 在 WebKit 指针打开并关闭后也能把焦点还给原按钮；新增独立的三引擎焦点回归，且后续键盘或焦点操作会使过期触发记录失效。
- 收紧公共 Props、受控/非受控状态和有限 ref 契约，统一 semantic theme、Portal、复合表单、modal layer、高级控件键盘模型、源码模块所有权和 CSS 门禁。
- 安装与升级继续以 Git checkout 为单一权威来源；安装状态仅能声明受管理源码和固定 support 文件，旧清单、符号链接/联接点、伪造 ownership 和并发写入均在落盘前阻断。
- 安装器支持显式 project/package/source root、工作区发现、自定义 source root 恢复、确定性 dry-run、包级排他锁与进程内事务回滚；候选版本只写入隔离 staging，不改当前 `0.2.19` 工作树或已安装副本。
- M8 首轮通过必须直接绑定同一次场景质量 producer 的四条命令和报告；通过后的命令追加、倒序时间戳或审阅后补造首轮证据会被记录器与最终 validator 同时拒绝。
- 发布候选内的 M8 合同不再依赖外层 `.git`；合成候选显式声明版本集合，baseline 算法使用自包含 annotated-tag fixture，并禁止对已成功或失败的候选重复执行正式 verify。
- M8 acceptance assembler 的合成候选从自身 fixture package 派生 coverage 版本，不再把已转换的 RC staging 版本混入 `0.2.19` 基线 fixture。
- AppNavigation 链接显式进入 WebKit 的 Tab 顺序并显示键盘焦点；Autocomplete 在 Portal 挂载后重新定位列表，避免已展开但列表隐藏；MarkdownEditor 键盘回归等待控件挂载后才发送首次 Tab。
- M8 迁移运行器在 Windows 上显式调用 `npm.cmd` 并记录真实执行 argv；发行候选的安装器/验证器核对已打包覆盖率与 Manifest 的一致性，不再要求在 Skill 目录预装 TypeScript，仓库质量门禁仍执行完整 AST 覆盖率重算。
- `FamilyLoginPage` 在 760px 以下不再降低整个产品视觉槽的透明度，避免自定义视觉内容中的文字和背景同时被淡化而损失对比度；736px 登录示例新增不透明与 axe 回归。
- `MultiSelect` 打开后的搜索框在布局阶段获得焦点，避免 WebKit 中紧接着按 Esc 时由父 Dialog 误处理；浮层回归新增打开后的实际焦点断言。
- 发行文档移除过期的候选状态与发布能力描述；支持矩阵区分冻结源码中的目标配置和发行物的外部验收证据，M8 审阅报告不再把单独验证的 hosted CI 误写为尚未发生。

### Breaking

- `v0.3.0` 的 Props/ref、主题、表单/浮层、控件能力、Locale 与安装升级迁移见 [迁移说明](references/v0.3.0-migrations.md)。当前兼容报告仍将本工作树判定为 breaking，因此不能作为 `0.2.x` patch 发布。

### Release status

- Promoted from verified `0.3.0-rc.2` with reviewed RC plan `9231765176650250833dbff8cd31078f5ba7204de71353faeaa2bf9f1db4bcd3`.
- Public availability is established only after exact stable-plan authorization, immutable tag verification, GitHub Release publication, and public reinstall checks.

## 0.2.19 - 2026-09-17

- 桌面端默认贴边 `Drawer` 的左上、左下圆角由 `8px` 提升为 `16px`，增强整屏抽屉的轮廓感；右侧继续贴边无圆角，显式 `inset` 和移动端底部抽屉保持原有半径。

## 0.2.18 - 2026-09-17

- 修复 `DescriptionList` 新旧 CSS 同名覆盖：移除遗留的 `110px` 外层网格规则，成员详情抽屉改为直接使用公开 `DescriptionList` 组件，避免长权限标识在窄抽屉中被逐字符换行或条目错列。
- `Drawer` 桌面端默认改为 `edge`：上、右、下贴合视口，仅保留左上和左下圆角；原悬浮留缝样式保留为显式 `variant="inset"`，移动端仍统一为顶部圆角的底部抽屉。
- `Button` 新增语义尺寸 `size="field"`，由组件源码稳定提供与输入框一致的 `44px` 高度，不再依赖按钮所在的查询栏 DOM 位置。
- `FilterBar` 兼容其任意组合区域中的默认中号按钮，包括字段区内的 `Inline`；内置成员查询页和标准示例改为显式使用 `size="field"`，普通按钮继续保持 `38px`、紧凑按钮保持 `32px`。
- 查询控件文档补充可直接复用的源码示例，浏览器回归覆盖 `actions`、字段区 `Inline`、独立 `Inline`、加载前后尺寸稳定性以及 `1440px`、`736px`、`320px` 响应式布局。

## 0.2.17 - 2026-09-17

- 固定表头的 `DataTable` 在桌面端隐藏原生滚动箭头，并让纵向滚动轨道从表头分隔线下方开始，避免滚动条占据表头和破坏右上角圆角。
- `FilterBar` 默认改为无框筛选栏，移除背景、边框、容器圆角和外层内边距，不再把简单查询区域表现成大面积卡片。
- 筛选栏与查询工具栏中的中号操作按钮统一匹配 `44px` 输入控件高度；普通胶囊按钮继续保持轻薄的 `38px` 高度。
- 浏览器回归新增滚动条表头避让、筛选栏无框样式及查询控件在 `1440px`、`736px`、`320px` 下的对齐校验。

## 0.2.16 - 2026-09-16

- `DataTable` 外框统一裁切桌面和移动滚动层，原生滚动条不再破坏表格四个圆角；有分页与无分页模式继续共用完整圆角边界。
- 固定高度桌面表格继续保留稳定的纵向滚动条预留区，并让该区域延续表头分隔线和表体背景，避免无滚动条时出现右侧白条，同时不改变列宽。
- 浏览器回归新增滚动条预留区像素校验、稀疏与滚动态列宽稳定性，以及无分页横向溢出时的左下、右下圆角和冻结列验证。

## 0.2.15 - 2026-09-16

- `DataTable` 新增 `kind: "selection"` 列语义；当首个可见列是勾选列时，默认同时冻结勾选列与第二个可见数据列。
- `pin: "start"`、`pin: "end"` 和 `pin: false` 可由开发者显式覆盖默认冻结规则；隐藏的勾选列不会触发自动冻结。
- 固定高度表格在数据不足一屏时保留最后一行分隔线，满屏时避免与容器底边形成双线。
- React 预览补充桌面端与移动端真实勾选交互，并增加选择列冻结和表格高度的浏览器回归测试。

## 0.2.14 - 2026-09-16

- Git commit `a181164` 中的 package metadata 记录该源码版本，主题为稳定表格视口；没有对应 tag 证据。

## 0.2.12 - 2026-09-13

- Git commit `15b3511` 中的 package metadata 记录该源码版本，主题为统一无效输入聚焦；没有 `0.2.13` 源码版本或对应 tag 的证据。

## 0.2.11 - 2026-09-13

- Git commit `c591699` 中的 package metadata 记录该源码版本，主题为一致的无效输入焦点色；没有对应 tag 证据。

## 0.2.10 - 2026-09-13

- Git commit `a920114` 中的 package metadata 记录该源码版本，主题为 modal dismissal 与 focus 修复；没有对应 tag 证据。

## 0.2.8 - 2026-09-13

- Git commit `54b15d0` 中的 package metadata 记录该源码版本，主题为组件几何与 dialog 对齐；没有 `0.2.9` 源码版本或对应 tag 的证据。

## 0.2.5 - 2026-09-13

- Git commit `a24e11f` 中的 package metadata 记录该源码版本，主题为圆角表格与分页模式；没有 `0.2.6`、`0.2.7` 源码版本或对应 tag 的证据。

## 0.2.1 - 2026-09-13

- Git commit `9d495b2` 中的 package metadata 记录该源码版本，主题为 autofill 与样式门禁修复；没有 `0.2.2` 至 `0.2.4` 源码版本或对应 tag 的证据。

## 0.2.0 - 2026-09-11

- Git commit `91973f8` 中的 package metadata 记录 source-enforced component kit；没有对应 tag 证据。

## 0.1.0 - 2026-09-11

- Git commit `11e8f90` 是初始源码版本记录；没有对应 tag 证据。

历史条目的版本、日期和主题来自对应 commit 的 package metadata 与 commit subject。除本地 annotated baseline tag `v0.2.19` 外，审计时未发现其他 tag；这些记录不能单独证明曾创建公开 GitHub Release。
