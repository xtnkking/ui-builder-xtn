# Explorer 呈现审计与局部修复记录（2026-10-10）

本记录针对组件目录的实际呈现：中文文字是否被裁切、基础规范是否有真实示例、深色预览是否保持圆角，以及逐目录发现的留白、伸缩和对齐问题。它不是全交互、全浏览器引擎或正式发布验收证书。

当前状态：119 个目录的原始呈现清单已保存，发现问题后的 11 个目录另有局部复查清单。主任务的 production 构建、文档、覆盖率步骤及三项定向检查已通过，文件收据登记在下文。公开部署身份由包含本文件的 GitHub 提交及其 Pages Actions 记录确定。后续源码不能沿用旧截图的指纹宣称已验证。

## 用户反馈及原因

| 反馈 | 已确认原因 | 修复范围与处理 |
| --- | --- | --- |
| 中文按钮文字底部被切 | 按钮 `line-height: 1` 对真实 Microsoft YaHei 中文字形的垂直空间不足；只检查英文或替代字体不能覆盖这个问题。 | canonical Button 的行高改为 `1.5`，保持按钮公开尺寸档位；本次浏览器字体记录包含系统 Microsoft YaHei。 |
| Surface 等目录仍显示旧的 “M6-03 待补齐” | 9 项基础规范只有目录身份，没有对应的可视指南；它们没有 runtime export，不能把它们伪装成组件导出覆盖。 | 补齐 Typography、Spacing、Radius、Surface、Icons、Motion、Z-index、Density、Focus 九项 `.guide.tsx`，注册到基础目录，使用真实公共组件和非交互规范示意，保留 `exports: []`，不修改验收器放行伪证据。 |
| Divider 深色预览周围是方角 | 深色状态的预览宿主未统一处理背景与边界；组件分割线本身不是方角卡片的来源。 | 统一深色状态预览宿主的 8px 圆角及背景裁切，避免宿主背景穿出预览边界；不通过业务 CSS 修改 Divider。 |

基础指南明确区分公共能力与内部规范：圆角、动效和层级不因此变成任意覆盖接口；密度由组件已有的 `size`、`padding` 和布局 `gap` 表达。Card 的 large 留白标明桌面 24px、窄屏自动收为 16px。示例中的控件仍从 Personal UI 公共 barrel 导入。

## 原始证据身份

组织者保留的原始清单：`D:/m8-official-144235a/_organizer/explorer-component-audit/inventory.json`。

| 字段 | 原始呈现捕获 |
| --- | --- |
| kind / result | `presentation-inventory` / `captured` |
| Git HEAD | `f35cf52e99d3679750af8eba26a964dc3f4852cd` |
| workingSourceSha256 | `7df837321440d83641328adeb826a3ae44eb8968361f45319d424a287a38b796` |
| 捕获开始 UTC | `2026-10-10T08:23:20.755Z` |
| 捕获结束 UTC | `2026-10-10T08:24:20.728Z` |
| 本地预览地址 | `http://127.0.0.1:4187/` |
| 目录 / PNG | 119 / 453 |
| 状态构成 | 总览 119、长内容 104、深色模式 111、移动窗口 119 |
| 清单 errors | `[]` |
| 字体记录 | `Microsoft YaHei` / `MicrosoftYaHei`，系统字体 |

移动捕获实际设置了 320 CSS px 的浏览器 viewport。清单中的 `mobile.width: 288` 是预览卡片内部内容宽度，不能解释为只在 288px viewport 测试，也不能把桌面上的窄容器模拟等同于这组真实移动窗口记录。

原始清单逐视图记录 `documentOverflow: 0`，桌面视图的 `textClips` 为空。它们是呈现采样和几何候选检查结果，不证明所有内容在所有交互状态都不会裁切；移动记录没有独立 `textClips` 字段，不据此声称移动端完成了同一文字测量。

截图、联系图和 JSON 保留在上述组织者证据目录。本文件登记证据身份与审阅结论，不把本机证据目录当作 GitHub 已上传附件。

## 119 个目录逐项清单

下表顺序与原始 inventory 一致。数字表示文件后缀，例如 button 的总览 `0` 对应 `button-0.png`。移动列 `M` 对应 `<id>-mobile.png`，均为真实 320px viewport 的捕获。`—` 表示本次清单没有该状态截图，不代表该组件永远不适用该状态。前 110 行路由为 `#/components/<id>`，最后 9 行为 `#/patterns/<id>`。

“局部”标记仅表示另有后续局部复查，不能把该复查扩大为其余目录或原始全部 453 张截图的新源码验证。

| # | 目录 | 总览 | 长内容 | 深色 | 320px | 局部 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 按钮 · `button` | 0 | 1 | 2 | M | — |
| 2 | 按钮组 · `button-group` | 0 | 1 | 2 | M | — |
| 3 | 表面与边框 · `surface` | 0 | — | 1 | M | — |
| 4 | 层级规范 · `z-index` | 0 | — | — | M | — |
| 5 | 动效规范 · `motion` | 0 | — | — | M | — |
| 6 | 分割线 · `divider` | 0 | — | 1 | M | — |
| 7 | 分裂按钮 · `split-button` | 0 | 1 | 2 | M | — |
| 8 | 复制按钮 · `clipboard` | 0 | 1 | 2 | M | — |
| 9 | 工具栏 · `toolbar` | 0 | 1 | 2 | M | — |
| 10 | 滚动区域 · `scroll` | 0 | 1 | 2 | M | — |
| 11 | 基础布局 · `layout` | 0 | 1 | 2 | M | — |
| 12 | 间距规范 · `spacing` | 0 | — | — | M | — |
| 13 | 键盘快捷键 · `keyboard` | 0 | 1 | 2 | M | — |
| 14 | 焦点规范 · `focus` | 0 | — | — | M | — |
| 15 | 焦点限制 · `focus-trap` | 0 | — | 1 | M | — |
| 16 | 可调整分栏 · `resizable` | 0 | 1 | 2 | M | — |
| 17 | 跨层渲染 · `portal` | 0 | 1 | 2 | M | — |
| 18 | 宽高比容器 · `aspect` | 0 | 1 | 2 | M | 有 |
| 19 | 链接 · `link` | 0 | 1 | 2 | M | — |
| 20 | 密度规范 · `density` | 0 | — | — | M | — |
| 21 | 切换按钮 · `toggle-button` | 0 | 1 | 2 | M | — |
| 22 | 筛选栏 · `filter-bar` | 0 | 1 | 2 | M | — |
| 23 | 视觉隐藏 · `visually-hidden` | 0 | 1 | 2 | M | — |
| 24 | 图标按钮 · `icon-button` | 0 | — | 1 | M | — |
| 25 | 图标规范 · `icons` | 0 | — | — | M | — |
| 26 | 拖动排序 · `sortable` | 0 | 1 | 2 | M | — |
| 27 | 文件拖放 · `drag` | 0 | 1 | 2 | M | — |
| 28 | 吸顶操作栏 · `sticky` | 0 | 1 | 2 | M | — |
| 29 | 响应式显隐 · `responsive-visibility` | 0 | 1 | 2 | M | — |
| 30 | 响应式栅格 · `responsive` | 0 | 1 | 2 | M | — |
| 31 | 颜色与主题 · `color` | 0 | — | 1 | M | — |
| 32 | 语言与地区 · `locale` | 0 | 1 | — | M | — |
| 33 | 圆角规范 · `radius` | 0 | — | — | M | — |
| 34 | 字体与排版 · `typography` | 0 | 1 | 2 | M | — |
| 35 | 标签输入 · `tag-input` | 0 | 1 | 2 | M | — |
| 36 | 表单 · `form` | 0 | 1 | 2 | M | 有 |
| 37 | 表单字段 · `field` | 0 | 1 | 2 | M | — |
| 38 | 穿梭选择 · `transfer` | 0 | 1 | 2 | M | 有 |
| 39 | 代码编辑器 · `code-editor` | 0 | 1 | 2 | M | — |
| 40 | 单选框 · `radio` | 0 | 1 | 2 | M | — |
| 41 | 多项选择 · `multi-select` | 0 | 1 | 2 | M | — |
| 42 | 多行文本框 · `textarea` | 0 | 1 | 2 | M | 有 |
| 43 | 分段选择 · `segmented` | 0 | 1 | 2 | M | — |
| 44 | 复选框 · `checkbox` | 0 | 1 | 2 | M | — |
| 45 | 滑块 · `slider` | 0 | 1 | 2 | M | — |
| 46 | 级联选择 · `cascader` | 0 | 1 | 2 | M | 有 |
| 47 | 开关 · `switch` | 0 | 1 | 2 | M | — |
| 48 | 评分 · `rating` | 0 | 1 | 2 | M | — |
| 49 | 日期与时间 · `date-time` | 0 | 1 | 2 | M | 有 |
| 50 | 树形选择 · `tree-select` | 0 | 1 | 2 | M | — |
| 51 | 数字输入框 · `number` | 0 | 1 | 2 | M | — |
| 52 | 搜索输入框 · `search-input` | 0 | 1 | 2 | M | — |
| 53 | 文本编辑器 · `markdown-editor` | 0 | 1 | 2 | M | — |
| 54 | 文本与密码输入 · `text-input` | 0 | 1 | 2 | M | — |
| 55 | 文件上传 · `upload` | 0 | 1 | 2 | M | — |
| 56 | 下拉选择 · `select` | 0 | 1 | 2 | M | — |
| 57 | 行内编辑 · `inline-edit` | 0 | 1 | 2 | M | — |
| 58 | 颜色选择 · `color-picker` | 0 | 1 | 2 | M | — |
| 59 | 验证码输入 · `otp` | 0 | 1 | 2 | M | — |
| 60 | 组合输入与补全 · `combobox` | 0 | 1 | 2 | M | — |
| 61 | 标签页 · `tabs` | 0 | 1 | 2 | M | — |
| 62 | 步骤导航 · `stepper` | 0 | 1 | 2 | M | 有 |
| 63 | 菜单 · `menu` | 0 | 1 | 2 | M | — |
| 64 | 分页 · `pagination` | 0 | 1 | 2 | M | — |
| 65 | 加载更多 · `load-more` | 0 | 1 | 2 | M | — |
| 66 | 锚点导航 · `anchor` | 0 | 1 | 2 | M | — |
| 67 | 面包屑导航 · `breadcrumb` | 0 | 1 | 2 | M | — |
| 68 | 命令面板 · `command` | 0 | 1 | 2 | M | — |
| 69 | 无限滚动 · `infinite-scroll` | 0 | 1 | 2 | M | 有 |
| 70 | 应用导航 · `app-navigation` | 0 | 1 | 2 | M | — |
| 71 | 标签 · `tag` | 0 | 1 | 2 | M | — |
| 72 | 代码展示 · `code-block` | 0 | 1 | 2 | M | — |
| 73 | 附件 · `attachment` | 0 | 1 | 2 | M | — |
| 74 | 徽标 · `badge` | 0 | 1 | 2 | M | — |
| 75 | 计量条 · `meter` | 0 | 1 | 2 | M | — |
| 76 | 卡片 · `card` | 0 | 1 | 2 | M | — |
| 77 | 列表与虚拟列表 · `list` | 0 | 1 | 2 | M | — |
| 78 | 轮播 · `carousel` | 0 | 1 | 2 | M | — |
| 79 | 描述列表 · `description` | 0 | 1 | 2 | M | — |
| 80 | 日程安排 · `scheduler` | 0 | 1 | 2 | M | — |
| 81 | 日历 · `calendar` | 0 | — | 1 | M | — |
| 82 | 时间线 · `timeline` | 0 | 1 | 2 | M | — |
| 83 | 手风琴折叠 · `accordion` | 0 | 1 | 2 | M | — |
| 84 | 树形列表 · `tree` | 0 | 1 | 2 | M | — |
| 85 | 数据与树形表格 · `data-table` | 0 | 1 | 2 | M | — |
| 86 | 统计数值 · `statistic` | 0 | 1 | 2 | M | — |
| 87 | 头像与头像组 · `avatar` | 0 | — | 1 | M | — |
| 88 | 图片库 · `gallery` | 0 | 1 | 2 | M | — |
| 89 | 图片与媒体 · `media` | 0 | 1 | 2 | M | — |
| 90 | 文本省略与展开 · `overflow` | 0 | 1 | 2 | M | — |
| 91 | 折叠面板 · `collapse` | 0 | 1 | 2 | M | — |
| 92 | 柱状图 · `chart` | 0 | 1 | 2 | M | — |
| 93 | 状态指示 · `status` | 0 | 1 | 2 | M | — |
| 94 | 骨架屏 · `skeleton` | 0 | — | 1 | M | — |
| 95 | 横幅提示 · `banner` | 0 | 1 | 2 | M | — |
| 96 | 加载指示 · `spinner` | 0 | 1 | 2 | M | — |
| 97 | 结果与异常状态 · `result` | 0 | 1 | 2 | M | — |
| 98 | 进度条与进度环 · `progress` | 0 | 1 | 2 | M | 有 |
| 99 | 警告提示 · `alert` | 0 | 1 | 2 | M | — |
| 100 | 轻提示 · `toast` | 0 | 1 | 2 | M | — |
| 101 | 校验摘要 · `validation-summary` | 0 | 1 | 2 | M | — |
| 102 | 行内消息 · `inline-message` | 0 | 1 | 2 | M | — |
| 103 | 操作引导 · `tour` | 0 | 1 | 2 | M | — |
| 104 | 抽屉 · `drawer` | 0 | 1 | 2 | M | — |
| 105 | 对话框与确认弹窗 · `dialog` | 0 | 1 | 2 | M | — |
| 106 | 气泡浮层 · `popover` | 0 | 1 | 2 | M | — |
| 107 | 气泡确认 · `popconfirm` | 0 | 1 | 2 | M | — |
| 108 | 图片预览 · `lightbox` | 0 | 1 | 2 | M | — |
| 109 | 文字提示 · `tooltip` | 0 | 1 | 2 | M | — |
| 110 | 悬停卡片 · `hover-card` | 0 | 1 | 2 | M | — |
| 111 | 导入与导出页面 · `import-export` | 0 | 1 | 2 | M | — |
| 112 | 分步流程 · `wizard` | 0 | 1 | 2 | M | — |
| 113 | 列表与筛选页面 · `list-filter` | 0 | 1 | 2 | M | 有 |
| 114 | 认证与品牌登录 · `authentication` | 0 | 1 | 2 | M | — |
| 115 | 设置页面 · `settings` | 0 | 1 | 2 | M | — |
| 116 | 详情页面 · `detail` | 0 | 1 | 2 | M | — |
| 117 | 新建与编辑页面 · `create-edit` | 0 | 1 | 2 | M | — |
| 118 | 主从详情布局 · `master-detail` | 0 | 1 | 2 | M | 有 |
| 119 | 状态页面 · `status-page` | 0 | 1 | 2 | M | — |

## 11 个入口的局部修复及复查

后续局部清单单独保存于 `D:/m8-official-144235a/_organizer/explorer-component-audit-corrections/inventory.json`，不是原始目录内的 corrections 子目录。

| 字段 | 局部复查捕获 |
| --- | --- |
| Git HEAD | `f35cf52e99d3679750af8eba26a964dc3f4852cd` |
| workingSourceSha256 | `f293dbadbb6d808ebcf9bceaf73b8868e3f0cee908f0d9c39732ebc03e1314bb` |
| 开始 / 结束 UTC | `2026-10-10T08:31:17.065Z` / `2026-10-10T08:31:26.475Z` |
| result / errors | `captured` / `[]` |
| 目录 / PNG | 11 / 44（各有总览、长内容、深色和真实 320px 移动捕获） |

两份证据虽然 Git HEAD 一样，工作树指纹不同，必须分别保留。原始 453 张证明首次捕获对应源码的呈现；44 张局部截图只对应局部复查指纹，不改称全部 119 目录在最终提交上重新通过。

| 目录 | 已确认问题及处理 | 局部截图 |
| --- | --- | --- |
| `aspect` | 固定比例容器只有一行文字，大块留白无法说明比例用途；示例在真实 AspectRatio 内填入非交互比例示意，保留组件自有宽高比。 | `aspect-{0,1,2,mobile}.png` |
| `form` | 简单表单横向铺得过宽、按钮随布局拉伸；示例限制非交互外层最大宽度为 480px，按钮使用官方 Inline 排列。 | `form-{0,1,2,mobile}.png` |
| `transfer` | 长选项需要在原生列表内保持可读边界；canonical 为原生 option 设置省略并通过 title 保留完整文字。零高度文字测量候选另见下文，不把测量假阳性当作修复依据。 | `transfer-{0,1,2,mobile}.png` |
| `textarea` | 两列字段因其中一列带 hint 而被 Grid 默认 stretch 拉伸，标题/编辑框顶部不齐；示例布局顶对齐。共用 `demo-number-case__grid` 同样加 `align-items: start`，避免同行其他 Field 被拉高；没有覆盖公共控件样式。 | `textarea-{0,1,2,mobile}.png` |
| `cascader` | 共用 Select 按钮中的 chevron 缺少正确定位参照；canonical 按钮增加 `position: relative`，图标相对所属按钮定位。 | `cascader-{0,1,2,mobile}.png` |
| `date-time` | DateField 的自定义日历装饰与原生 picker 同时出现；仅 year 保留左侧日历，其余格式使用原生 picker，消除双装饰。DateRange 增加自身 inline-size 容器，容器不超过 480px 时纵排两个日期并隐藏“至”，适用于窄面板而不只依赖浏览器宽度。 | `date-time-{0,1,2,mobile}.png` |
| `stepper` | 连接线穿过步骤标题；canonical copy 区增加相对定位、surface 背景及右侧留白，挡住文字背后的 connector。 | `stepper-{0,1,2,mobile}.png` |
| `infinite-scroll` | 重复 loading 来自 canonical 内置按钮与 sentinel 同时呈现图标和文案，不是 overview 额外放置 LoadMore 所致；有内置 loadingButton 时哨兵只保留 sr-only live 文字，没有内置按钮时仍保留 spinner 和可见文案，避免删除必要的加载语义。 | `infinite-scroll-{0,1,2,mobile}.png` |
| `progress` | 横向进度在 Inline 中被缩为约 83px；示例改用最大 560px 的非交互布局容器和 Stack，进度横条占满容器，环形单独放入 Inline。长内容状态直接提供字面量长 label，保持现有 AST 证据规则。 | `progress-{0,1,2,mobile}.png` |
| `list-filter` | 含 Tabs 的页面示例沿用零 padding 的整页宿主，页头、搜索框、按钮和状态文字贴外框；默认、长内容及键盘 Tabs 外围增加官方 Box.medium 留白，仅改该示例，不影响登录页的整页模式。 | `list-filter-{0,1,2,mobile}.png` |
| `master-detail` | 左侧按钮贴外框、右侧描述文字贴中间竖线；默认、空和长内容状态均在两个 slot 内组合 Box.medium 留白，公开示例代码同步。 | `master-detail-{0,1,2,mobile}.png` |

11 项局部记录的 `documentOverflow` 均为 0。十个目录的桌面 `textClips` 为空；Transfer 原样保留了 13 个 OPTION 候选：总览 4 个、长内容 5 个、深色 4 个，均有 `boxHeight: 35` 与 `textHeight: 0`。原生 OPTION 由浏览器绘制，Range 未返回可用文字高度；零测量值不能证明文字越界。这批记录经原图/原生控件语义核对归为测量假阳性，没有删掉原始候选，也没有通过修改组件迁就错误测量。

## 审阅边界

联系图用于逐项发现间距、边界、异常拉伸与对齐问题；可疑项再查看原始 PNG。完整窗口没有横向溢出，不代表组件内部应有的滚动条、文本省略、固定高度空状态或宽高比容器是缺陷。Popover 的纯文字触发与 canonical CSS 一致，不据此误报样式丢失。

Dialog、Drawer、Popover、Popconfirm、Tooltip、HoverCard、Lightbox、GuidedTour，以及部分菜单和消息示例，在默认截图中没有自动打开。本组截图只审阅其实际可见触发区域，不据此宣称浮层内容、焦点、Escape、遮罩关闭、全部菜单项或异步行为已经验收。深色和长内容截图也只覆盖捕获时实际可见的内容。

本次呈现捕获没有枚举全部浏览器引擎，没有替代 M8 独立消费者矩阵，也没有替代现有键盘、axe、类型、来源约束与版本证据。字体记录证明使用了系统 Microsoft YaHei，不等于所有平台字体都已经验证。

## 收尾命令证据与公开部署身份

下列标识是组织者 action receipt，不是 Git SHA。文件位置相对 `D:/m8-official-144235a/_organizer/`；原始命令输出保存在对应 `stdout.log`，实际命令、退出状态及绑定依组织者收据和唯一台账复核。

| 步骤 | 主任务报告结果 | 文件证据 |
| --- | --- | --- |
| Production 构建 | 通过 | `action-logs/1c8d2a438e4d42e7852e6da61331458d/stdout.log` |
| 文档步骤 | 通过 | `action-logs/fb8f7c127cc448d6bd39f9a4dfe4cd2c/stdout.log` |
| 覆盖率步骤 | 通过 | `action-logs/aa898b0f02ac48ffa81425330dc8c04a/stdout.log` |
| Cascader 图标定位、InfiniteScroll 加载呈现两项定向检查 | 首轮通过 | `action-logs/30ac885bd8194d48ac80015f277700b8/stdout.log` |
| DateRange 窄容器布局定向检查 | 修正测试的 `has` 定位后通过；保留实际测试修正历史，不把定位失败当成新组件缺陷 | `action-logs/67f127e22d1c4667a7de66c607eb1b45/stdout.log` |

本记录的最终源码身份由 GitHub 中包含该文件的提交确定；Pages 的部署来源、运行结果和公开地址以该提交的 Pages Actions 记录为准。最终 hosted 核验另记组织者唯一台账，不在这里预先宣称尚未观察的部署结果，也不为此重新绑定原始截图。

本文件是日期固定的审计记录，不取代组织者 `execution-state.json` 的当前进度，也不把本地截图或文档修改称为已经公开发布。
