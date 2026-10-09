# M6 状态案例复核（发布基线与本地修复分开记录）

这份复核覆盖已发布并同步的 v0.3.0：`E:/huanJing/skill/ui-builder-xtn`，源码提交 `acc9ca12bd19707d7d0832ca23a8e1f997b3d550`。逐案例文件 SHA-256、公开导出、声明状态、真实 JSX 属性和公开 Props 来源均保存在 [机器清单](m6-state-case-audit.json)。本文不是通过报告，也不改变历史验收绑定。

## 已查清的范围

- 已逐模块读取 110 个家族案例、142 个运行时导出。旧汇总的“109 个家族”不包括当前新增的 locale 案例；本次以实际文件清单为准。
- 基线共有 955 条家族状态声明和 1190 条按导出展开的适用状态声明。110 个案例都没有将每个状态绑定到可切换的实际 JSX；这不等于它们完全没有演示对应行为。
- 初筛得到 151 条独立状态适用性问题。它们是待人工确认的 API 边界，不是自动删除状态的许可。
- `disabled` 等属性在 JSX 中存在只能证明有静态样例入口；受控变化、异步错误、键盘行为及环境切换还需要真实案例和对应证据。

## 判断规则

1. 实际组件状态：必须使用该导出真实支持的 Props/数据，并将导出和状态绑定到呈现内容。
2. 环境状态：dark、locale、mobile、overlay 通过真实 ThemeProvider、LocaleProvider、视口或可打开弹层呈现。不能只添加 Tag 标签。
3. 公共 Props 中继承的通用 DOM 属性不代表组件消费该状态。例如 DataTable 的 HTML 根属性可含 defaultValue/defaultChecked，但组件并没有非受控数据/排序模式。
4. 不适用的独立状态必须按导出写明原因。组合中的子控件校验、禁用或只读，必须明确作为组合案例；不能冒充父组件独立功能。
5. 清单中的 JSX/类型线索只用于定位；最终有效声明以新的状态案例验证器输出为准。键盘操作提示提供人工入口，不等于自动键盘测试通过。

## 首批实施记录（历史快照）

| 导出 | 新增/修正 | 独立状态边界 |
| --- | --- | --- |
| Input / PasswordInput | 两种导出分别有禁用、只读、非受控默认值、invalid 校验、长值、受控修改和环境案例。 | 各状态绑定两种导出；不再用一个 Input 的禁用展示替代 PasswordInput。 |
| DataTable | ready/loading/empty/error、重试、长内容、实际行排序、显式搜索按钮、选择、分页和环境案例。 | 没有独立 disabled/readOnly/validation 或 defaultSort；不制造不存在的 API。 |
| TreeTable | 受控/非受控展开、加载分支、空目录、实际拒绝的加载回调、长文件名和环境案例。 | 没有独立 disabled/readOnly/validation；异步分支失败属于 error。 |

首批记录时，本地文件已修改而具名验证尚未完成；该段保留当时事实。完整本地修复及验证见本文末尾的 2026-10-09 收口记录。

## 全家族基线清单

`JSX线索`只列本导出实际写出的状态相关属性；`API疑问`是缺少独立 disabled/readOnly/validation 语义的初筛数量。完整值、源码位置和逐导出理由见 JSON，不依赖本文推测。

| 家族 | 导出 | 声明状态数 | JSX线索 | API疑问 |
| --- | --- | ---: | --- | ---: |
| button-group | ButtonGroup | 6 | 默认 JSX；无明确状态属性 | 0 |
| button | Button | 6 | disabled, loading | 0 |
| clipboard | ClipboardButton | 6 | disabled | 0 |
| drag | DragDrop | 6 | 默认 JSX；无明确状态属性 | 0 |
| filter-bar | FilterBar | 11 | 默认 JSX；无明确状态属性 | 1 |
| icon-button | IconButton | 6 | loading, disabled | 0 |
| link | Link | 6 | 默认 JSX；无明确状态属性 | 1 |
| sortable | SortableList | 9 | 默认 JSX；无明确状态属性 | 2 |
| split-button | SplitButton | 11 | 默认 JSX；无明确状态属性 | 2 |
| toggle-button | ToggleButton | 11 | disabled | 2 |
| toolbar | Toolbar | 6 | 默认 JSX；无明确状态属性 | 1 |
| accordion | Accordion | 11 | defaultValue | 3 |
| attachment | Attachment | 6 | 默认 JSX；无明确状态属性 | 0 |
| avatar | Avatar, AvatarGroup | 6 | 默认 JSX；无明确状态属性 | 0 |
| badge | Badge | 6 | tone | 0 |
| calendar | Calendar | 9 | locale, value | 3 |
| card | Card | 4 | 默认 JSX；无明确状态属性 | 0 |
| carousel | Carousel | 11 | value | 3 |
| chart | BarChart | 6 | 默认 JSX；无明确状态属性 | 0 |
| code-block | CodeBlock | 4 | 默认 JSX；无明确状态属性 | 0 |
| collapse | Collapse | 11 | disabled | 2 |
| data-table | DataTable, TreeTable | 9 | state, sort, expandedIds | 6 |
| description | DescriptionList | 6 | 默认 JSX；无明确状态属性 | 0 |
| gallery | Gallery | 9 | selectedId | 3 |
| list | List, VirtualList | 5 | 默认 JSX；无明确状态属性 | 0 |
| media | Media | 6 | 默认 JSX；无明确状态属性 | 0 |
| meter | Meter | 6 | value | 0 |
| overflow | OverflowText, ExpandableText | 11 | 默认 JSX；无明确状态属性 | 4 |
| scheduler | Scheduler | 9 | locale | 3 |
| statistic | Statistic | 6 | value | 0 |
| status | StatusIndicator | 6 | tone | 0 |
| tag | Tag | 6 | tone | 0 |
| timeline | Timeline | 6 | 默认 JSX；无明确状态属性 | 0 |
| tree | Tree | 9 | value, expandedIds | 3 |
| alert | Alert | 6 | tone | 0 |
| banner | Banner | 6 | tone | 0 |
| inline-message | InlineMessage | 6 | tone | 0 |
| progress | Progress, ProgressRing | 6 | value | 0 |
| result | EmptyState, ErrorState, NoResults, RetryButton, AsyncAction | 13 | 默认 JSX；无明确状态属性 | 1 |
| skeleton | Skeleton | 4 | 默认 JSX；无明确状态属性 | 0 |
| spinner | Spinner | 6 | 默认 JSX；无明确状态属性 | 0 |
| toast | ToastProvider, useToast | 8 | 默认 JSX；无明确状态属性 | 0 |
| validation-summary | ValidationSummary | 6 | 默认 JSX；无明确状态属性 | 1 |
| aspect | AspectRatio | 5 | 默认 JSX；无明确状态属性 | 0 |
| color | ThemeProvider | 3 | mode | 0 |
| divider | Divider | 5 | 默认 JSX；无明确状态属性 | 0 |
| focus-trap | FocusTrap | 9 | 默认 JSX；无明确状态属性 | 3 |
| keyboard | KeyboardShortcut | 4 | 默认 JSX；无明确状态属性 | 0 |
| layout | Box, Stack, Inline | 5 | 默认 JSX；无明确状态属性 | 0 |
| locale | LocaleProvider, usePersonalUILocale | 3 | locale | 0 |
| portal | Portal | 5 | disabled | 0 |
| resizable | ResizablePanels | 11 | 默认 JSX；无明确状态属性 | 3 |
| responsive-visibility | ResponsiveVisibility | 5 | 默认 JSX；无明确状态属性 | 0 |
| responsive | Grid | 5 | 默认 JSX；无明确状态属性 | 0 |
| scroll | ScrollArea | 5 | 默认 JSX；无明确状态属性 | 0 |
| sticky | StickyHeaderActionBar | 5 | 默认 JSX；无明确状态属性 | 0 |
| visually-hidden | VisuallyHidden | 4 | 默认 JSX；无明确状态属性 | 0 |
| cascader | Cascader | 11 | value, defaultValue, disabled | 2 |
| checkbox | Checkbox | 11 | checked, defaultChecked, disabled | 2 |
| code-editor | CodeEditor | 11 | value | 1 |
| color-picker | ColorPicker | 11 | value, defaultValue, disabled | 2 |
| combobox | Combobox, Autocomplete | 11 | value, disabled | 4 |
| date-time | DateField, DateRangeField, TimezoneSelect, DEFAULT_TIMEZONE_OPTIONS | 12 | value, defaultValue, readOnly | 3 |
| field | Field | 6 | error | 0 |
| form | Form | 11 | 默认 JSX；无明确状态属性 | 1 |
| inline-edit | InlineEdit | 11 | value, disabled | 1 |
| markdown-editor | MarkdownEditor, RichTextEditor | 11 | value | 2 |
| multi-select | MultiSelect | 11 | value, defaultValue | 2 |
| number | NumberInput | 11 | value, readOnly, disabled | 0 |
| otp | OtpInput | 11 | value, defaultValue, disabled | 1 |
| radio | Radio | 11 | checked, disabled | 2 |
| rating | Rating | 11 | value, defaultValue, readOnly, disabled | 1 |
| search-input | SearchInput | 11 | value, readOnly | 0 |
| segmented | SegmentedControl | 11 | value | 2 |
| select | Select, SearchableSelect, AsyncSelect | 14 | value, loading | 4 |
| slider | Slider | 11 | value, defaultValue, disabled | 2 |
| switch | Switch | 11 | checked, disabled | 2 |
| tag-input | TagInput | 11 | value, defaultValue, disabled | 2 |
| text-input | Input, PasswordInput | 11 | value, defaultValue, readOnly, disabled | 0 |
| textarea | Textarea | 11 | value, defaultValue, readOnly | 1 |
| transfer | Transfer | 9 | value | 2 |
| tree-select | TreeSelect | 11 | value, defaultValue | 2 |
| upload | FileUpload | 13 | 默认 JSX；无明确状态属性 | 1 |
| anchor | AnchorNavigation | 6 | 默认 JSX；无明确状态属性 | 1 |
| app-navigation | AppNavigation, TopNavigation, SideNavigation, BottomNavigation | 6 | 默认 JSX；无明确状态属性 | 4 |
| breadcrumb | Breadcrumbs | 6 | 默认 JSX；无明确状态属性 | 1 |
| command | CommandPalette, useCommandPaletteShortcut | 12 | open | 3 |
| infinite-scroll | InfiniteScroll | 13 | loading | 1 |
| load-more | LoadMore | 13 | loading | 1 |
| menu | Menu, DropdownMenu, ContextMenu | 11 | 默认 JSX；无明确状态属性 | 7 |
| pagination | Pagination | 9 | 默认 JSX；无明确状态属性 | 2 |
| stepper | Stepper | 9 | 默认 JSX；无明确状态属性 | 3 |
| tabs | Tabs | 11 | value, defaultValue | 3 |
| dialog | Dialog, ConfirmDialog | 11 | open, tone | 6 |
| drawer | Drawer | 11 | open | 3 |
| hover-card | HoverCard | 11 | 默认 JSX；无明确状态属性 | 2 |
| lightbox | Lightbox | 11 | open, value | 3 |
| popconfirm | Popconfirm | 11 | disabled | 2 |
| popover | Popover | 11 | open | 2 |
| tooltip | Tooltip | 11 | disabled | 2 |
| tour | GuidedTour | 11 | open | 3 |
| authentication | AuthenticationPage, FamilyLoginPage | 11 | 默认 JSX；无明确状态属性 | 2 |
| create-edit | CreateEditPage | 11 | 默认 JSX；无明确状态属性 | 1 |
| detail | DetailPage | 11 | 默认 JSX；无明确状态属性 | 1 |
| import-export | ImportExportPage | 11 | 默认 JSX；无明确状态属性 | 1 |
| list-filter | PageHeading, ListManagementPage, SearchFilterPage, MemberManagementPage | 11 | 默认 JSX；无明确状态属性 | 4 |
| master-detail | MasterDetail | 11 | 默认 JSX；无明确状态属性 | 1 |
| settings | SettingsPage | 11 | 默认 JSX；无明确状态属性 | 1 |
| status-page | StatusPage | 11 | 默认 JSX；无明确状态属性 | 1 |
| wizard | WizardFlow | 11 | 默认 JSX；无明确状态属性 | 1 |

## 逐导出适用性待确认项

这里只记录公共 API 缺少独立状态的导出；没有列出的导出也仍须补真实状态绑定。`disabled:item` 表示可通过项目级禁用展示，不应该创建根级 disabled Props。

| 导出 | 家族 | 初筛问题 | API来源 |
| --- | --- | --- | --- |
| FilterBar | filter-bar | validation | `src/personal-ui/action/actions.tsx:137` |
| Link | link | disabled | `src/personal-ui/action/actions.tsx:30` |
| SortableList | sortable | readOnly, validation | `src/personal-ui/data/data-extra.tsx:1197` |
| SplitButton | split-button | readOnly, validation | `src/personal-ui/action/actions.tsx:163` |
| ToggleButton | toggle-button | readOnly, validation | `src/personal-ui/action/actions.tsx:212` |
| Toolbar | toolbar | disabled | `src/personal-ui/action/actions.tsx:103` |
| Accordion | accordion | disabled:item, readOnly, validation | `src/personal-ui/display/display.tsx:815` |
| Calendar | calendar | disabled:item, readOnly, validation | `src/personal-ui/data/data-extra.tsx:584` |
| Carousel | carousel | disabled:item, readOnly, validation | `src/personal-ui/data/data-extra.tsx:907` |
| Collapse | collapse | readOnly, validation | `src/personal-ui/foundation/layout.tsx:246` |
| DataTable | data-table | disabled, readOnly, validation | `src/personal-ui/data/data-table.tsx:185` |
| TreeTable | data-table | disabled, readOnly, validation | `src/personal-ui/data/data-extra.tsx:405` |
| Gallery | gallery | disabled:item, readOnly, validation | `src/personal-ui/display/display.tsx:599` |
| OverflowText | overflow | disabled | `src/personal-ui/overlay/overlays.tsx:777` |
| ExpandableText | overflow | disabled, readOnly, validation | `src/personal-ui/data/data-extra.tsx:1249` |
| Scheduler | scheduler | disabled, readOnly, validation | `src/personal-ui/data/data-extra.tsx:804` |
| Tree | tree | disabled:item, readOnly, validation | `src/personal-ui/data/data-extra.tsx:193` |
| AsyncAction | result | validation | `src/personal-ui/feedback/feedback-extra.tsx:243` |
| ValidationSummary | validation-summary | disabled | `src/personal-ui/feedback/feedback-extra.tsx:82` |
| FocusTrap | focus-trap | disabled, readOnly, validation | `src/personal-ui/foundation/layout.tsx:389` |
| ResizablePanels | resizable | disabled, readOnly, validation | `src/personal-ui/data/data-extra.tsx:1040` |
| Cascader | cascader | readOnly, validation | `src/personal-ui/input/inputs-extra.tsx:1713` |
| Checkbox | checkbox | readOnly, validation | `src/personal-ui/input/forms.tsx:1343` |
| CodeEditor | code-editor | validation | `src/personal-ui/input/inputs-extra.tsx:706` |
| ColorPicker | color-picker | readOnly, validation | `src/personal-ui/input/value-controls.tsx:247` |
| Combobox | combobox | readOnly, validation | `src/personal-ui/input/forms.tsx:1016` |
| Autocomplete | combobox | readOnly, validation | `src/personal-ui/input/inputs-extra.tsx:941` |
| DateField | date-time | validation | `src/personal-ui/input/date-field.tsx:59` |
| TimezoneSelect | date-time | readOnly, validation | `src/personal-ui/input/value-controls.tsx:453` |
| Form | form | validation | `src/personal-ui/input/inputs-extra.tsx:156` |
| InlineEdit | inline-edit | readOnly | `src/personal-ui/input/inputs-extra.tsx:785` |
| MarkdownEditor | markdown-editor | validation | `src/personal-ui/input/inputs-extra.tsx:645` |
| RichTextEditor | markdown-editor | validation | `src/personal-ui/input/inputs-extra.tsx:650` |
| MultiSelect | multi-select | readOnly, validation | `src/personal-ui/input/inputs-extra.tsx:1430` |
| OtpInput | otp | readOnly | `src/personal-ui/input/inputs-extra.tsx:279` |
| Radio | radio | readOnly, validation | `src/personal-ui/input/forms.tsx:1414` |
| Rating | rating | validation | `src/personal-ui/input/value-controls.tsx:148` |
| SegmentedControl | segmented | readOnly, validation | `src/personal-ui/input/forms.tsx:1580` |
| Select | select | readOnly, validation | `src/personal-ui/input/forms.tsx:709` |
| SearchableSelect | select | readOnly, validation | `src/personal-ui/input/inputs-extra.tsx:1108` |
| Slider | slider | readOnly, validation | `src/personal-ui/input/value-controls.tsx:55` |
| Switch | switch | readOnly, validation | `src/personal-ui/input/forms.tsx:1485` |
| TagInput | tag-input | readOnly, validation | `src/personal-ui/input/inputs-extra.tsx:1580` |
| Textarea | textarea | validation | `src/personal-ui/input/forms.tsx:596` |
| Transfer | transfer | readOnly, validation | `src/personal-ui/input/inputs-extra.tsx:2010` |
| TreeSelect | tree-select | readOnly, validation | `src/personal-ui/input/inputs-extra.tsx:1797` |
| FileUpload | upload | validation | `src/personal-ui/input/inputs-extra.tsx:435` |
| AnchorNavigation | anchor | disabled:item | `src/personal-ui/navigation/navigation-extra.tsx:541` |
| AppNavigation | app-navigation | disabled:item | `src/personal-ui/navigation/navigation-extra.tsx:111` |
| TopNavigation | app-navigation | disabled:item | `src/personal-ui/navigation/navigation-extra.tsx:118` |
| SideNavigation | app-navigation | disabled:item | `src/personal-ui/navigation/navigation-extra.tsx:123` |
| BottomNavigation | app-navigation | disabled:item | `src/personal-ui/navigation/navigation-extra.tsx:128` |
| Breadcrumbs | breadcrumb | disabled:item | `src/personal-ui/navigation/navigation.tsx:224` |
| CommandPalette | command | disabled:item, readOnly, validation | `src/personal-ui/navigation/navigation-extra.tsx:348` |
| InfiniteScroll | infinite-scroll | validation | `src/personal-ui/navigation/navigation-extra.tsx:198` |
| LoadMore | load-more | validation | `src/personal-ui/navigation/navigation-extra.tsx:162` |
| Menu | menu | disabled:item | `src/personal-ui/navigation/navigation-extra.tsx:137` |
| DropdownMenu | menu | disabled:item, readOnly, validation | `src/personal-ui/overlay/overlays.tsx:241` |
| ContextMenu | menu | disabled:item, readOnly, validation | `src/personal-ui/overlay/overlays-extra.tsx:413` |
| Pagination | pagination | readOnly, validation | `src/personal-ui/navigation/navigation.tsx:299` |
| Stepper | stepper | disabled:item, readOnly, validation | `src/personal-ui/navigation/navigation-extra.tsx:274` |
| Tabs | tabs | disabled:item, readOnly, validation | `src/personal-ui/navigation/navigation.tsx:58` |
| Dialog | dialog | disabled, readOnly, validation | `src/personal-ui/overlay/overlays.tsx:58` |
| ConfirmDialog | dialog | disabled, readOnly, validation | `src/personal-ui/overlay/overlays-extra.tsx:307` |
| Drawer | drawer | disabled, readOnly, validation | `src/personal-ui/overlay/overlays.tsx:146` |
| HoverCard | hover-card | readOnly, validation | `src/personal-ui/overlay/overlays-extra.tsx:285` |
| Lightbox | lightbox | disabled, readOnly, validation | `src/personal-ui/overlay/overlays-extra.tsx:692` |
| Popconfirm | popconfirm | readOnly, validation | `src/personal-ui/overlay/overlays-extra.tsx:382` |
| Popover | popover | readOnly, validation | `src/personal-ui/overlay/overlays-extra.tsx:275` |
| Tooltip | tooltip | readOnly, validation | `src/personal-ui/overlay/overlays.tsx:493` |
| GuidedTour | tour | disabled, readOnly, validation | `src/personal-ui/overlay/overlays-extra.tsx:925` |
| AuthenticationPage | authentication | validation | `src/personal-ui/patterns/standard-pages.tsx:265` |
| FamilyLoginPage | authentication | validation | `src/personal-ui/patterns/family-login-page.tsx:50` |
| CreateEditPage | create-edit | validation | `src/personal-ui/patterns/standard-pages.tsx:84` |
| DetailPage | detail | validation | `src/personal-ui/patterns/standard-pages.tsx:113` |
| ImportExportPage | import-export | validation | `src/personal-ui/patterns/standard-pages.tsx:223` |
| PageHeading | list-filter | validation | `src/personal-ui/patterns/standard-pages.tsx:19` |
| ListManagementPage | list-filter | validation | `src/personal-ui/patterns/standard-pages.tsx:62` |
| SearchFilterPage | list-filter | validation | `src/personal-ui/patterns/standard-pages.tsx:68` |
| MemberManagementPage | list-filter | validation | `src/personal-ui/patterns/member-management-page.tsx:196` |
| MasterDetail | master-detail | validation | `src/personal-ui/patterns/standard-pages.tsx:200` |
| SettingsPage | settings | validation | `src/personal-ui/patterns/standard-pages.tsx:145` |
| StatusPage | status-page | validation | `src/personal-ui/patterns/standard-pages.tsx:245` |
| WizardFlow | wizard | validation | `src/personal-ui/patterns/standard-pages.tsx:177` |

M2 属性展开策略和 M5 拖放/无限滚动键盘组合边界按用户最新要求暂不修改。本复核不能将这两项记为已解决。

## 2026-10-09 本地修复收口

本节是本轮工程交付快照；唯一实时状态仍为组织者台账 `auditRemediation`。本轮没有准备候选、推送、打标签、发布或同步副本。

### 范围与案例

110 个运行时家族、142 个导出完成适用性核对和 `stateExamples` 绑定，共 1065 个适用导出状态，严格源码检查剩余 0 项。目录共 119 个家族，另 9 个是无运行时导出的基础目录。

原基线的 1190 项声明并非全部对应组件自身支持的状态。不支持的根级 disabled、readOnly、validation 或状态模式不再伪造；项目级禁用、真实异步回调和官方组合按真实归属保留。不适用理由见 [输入控件](m6-state-applicability-input.json)、[数据/操作/页面](m6-state-applicability-data-pattern.json)、[导航](m6-state-applicability-navigation.json)、[基础/反馈](m6-state-applicability-foundation-feedback.json)。基线机器清单不改写，M2/M5 目标不调整。

实际案例包含编辑、invalid、禁用/只读、长内容、显式查询、排序/选择/分页、延迟请求、空结果、失败/重试、Toast 异步操作、错误摘要聚焦等。Explorer 同时只呈现总览或一个选定状态，避免重复 ID 和多个浮层同时激活。生成完整 `PersonalUiExample` 支持 `state` 与 `component`，内联真实宿主/类型，从公共 barrel 导入，不依赖私有 Explorer 模块。

### 约束与边界

默认严格验证器检查可达 JSX、真实公共 Props、回调和值，拒绝只加标签、死分支、同名遮蔽、无关字段、隐藏内容、借用其他导出和重复绑定。`--inventory` 仅用于清点，不能替代严格门禁。

API、目录与覆盖 JSON 已刷新。覆盖 JSON 区分 `applicableStates`、`sourceDemonstratedStates` 和带文件/索引身份的 `fixtures`。keyboard 保留 `manual-interaction-fixture`，`behavioralVerification: false` 明确禁止把源码映射当作全状态浏览器验收。

共享宿主使用真实 ThemeProvider、LocaleProvider、官方 Box 表面和可打开 Dialog。mobile 是 320px 容器，不证明真实 viewport 的媒体查询行为。旧浏览器/axe 所有权保留，不重新标为本轮新状态已全部执行通过。

### 有界证据

| 检查 | 实际收据 |
| --- | --- |
| 首批渲染/交互 7 项 | `23971ce9ae2e4d63b023a1ba0f3b8bc9`、失败单项修复 `2dd7bfe5893942689e0f9a36c2a51757` |
| 反馈交互 3 项 | `0583a6f365a94045890e00c6490308b4`、失败单项修复 `72883a54f0af4c3aa3fe629104431dda` |
| 状态验证器合同 | 36 个不同方法在各自修订上通过；最后仅新增方法 `0ade080cdca94b35b71264e5c4e64c79`，未在最终源码重跑全部 36 项 |
| 完整生成示例合同 2 项 | `0ab18a0be130451596b2ad71b5c346fc`；保留当次工具和宿主源码身份 |
| 最终清点 1065/0 | `8b5a01bdc11047048a5e900be5afe1ed`；JSON 保留重命名前源码哈希，后续 helper/Box 布局修复由最终严格生成与构建绑定，不重写旧清点 |
| 覆盖导出合同 1 个具名方法 | `1d7a7f762784418faca00f5f27c72bb6`；含正/负子案例，拒绝缺失、借用、重复和伪造浏览器/键盘证明 |
| 严格覆盖生成 | `526f92e9357546a3b70e62987f99e50f`；142 导出文档齐全，保留源码实例而非新增浏览器运行 |
| 最终严格 API/目录生成 | `ccf18c786c9e46778baa67a33f20b43d`；实际当前案例/宿主源码，无状态缺口 |
| 最终正常构建 | `8029729358174ae584bdd0b120e67d74`；来源校验、TypeScript、Vite 通过，首轮 provenance 失败保留，未放宽来源校验器 |

共享宿主后来改用官方 Box，生成合同的旧收据没有冒充在新宿主上重跑；最终生成和构建证明当前代码。独立窄范围源码审阅确认 Box 导入保留、单 fixture 选择和人工键盘标记没有丢失。

最终构建仍有 Explorer 压缩 JS chunk 约 801 kB 的非阻断提示。路由拆分不属于本轮状态修复，不据此重跑测试。公共组件实现及样式未修改；本轮交付不能关闭暂缓的 M2/M5 差异或宣称所有未来业务组合无风险。
