# M1–M8 目标收口记录

记录日期：2026-10-10。本页是源码交付快照；原路线图的有日期条目继续作为历史依据，不以旧的“未发布”描述覆盖已发生的发行事实。

## 已发布成果

[v0.3.1](https://github.com/xtnkking/ui-builder-xtn/releases/tag/v0.3.1) 于 2026-10-10 公开，发行提交为 `4f4dda6fc13f983adb14844a4584e1a804e10e9e`，产品源码为 `7e1cda6bc5d0be3f1cf49105f09a1614ec28dcb7`。发行提交增加版本和发布元数据，保留源码历史；README 未更新不表示 main 未包含开发改动。

- stable plan：`260f132d62dd3942867cde8cedc77308d31d2e14a1f6056b6acee3c5bb0239c0`。
- ZIP SHA-256：`4832c577cdd0b86b94386e3117d65ce982051b448e0e4937fad59d05a4568445`。
- RC.9 精确源码 hosted run：`38017880698`，12 个 job 成功，包括真实 system Safari 证据。
- stable 自身正式验证：241 个组件、564 个浏览器、414 个无障碍、1 个视觉用例通过。
- 公开下载、干净安装、依赖安装、构建、来源校验和两个指定安装副本同步均已完成，原始发行物及 tag 保持不变。

这些成果证明 v0.3.1 按当时修订的支持范围完成交付，不能替代下列恢复的原目标。

## 恢复的原目标

用户于 2026-10-10 明确要求补齐 M2/M5 原目标、M8 剩余 60 格，并提交到 main；本次不自动创建新 Release。

| 阶段 | 已有成果 | 新增执行范围 |
| --- | --- | --- |
| M1 | 仓库质量门禁、三引擎、CI、视觉基线 | 无已确认新增缺口，复用实际历史证据 |
| M2 | 公共 Props、受控状态、有限 ref、来源保护 | 已补齐安全类型属性展开、别名/导入/函数/泛型与 factory 调用；React key 也遵循 intrinsic 类型规则 |
| M3 | 语义 token、主题、Portal、对比度 | 无已确认新增缺口，复用实际历史证据 |
| M4 | 表单合同、共享浮层内核、关闭和焦点行为 | 无已确认新增缺口，复用实际历史证据 |
| M5 | 高级控件键盘合同、官方上传与加载组合 | 已完成：DragDrop 和 InfiniteScroll 默认自带键盘操作入口，原官方组合保留并显式避免重复按钮 |
| M6 | Explorer、真实状态案例、API 生成、Locale | 已交付；本次跟随实际 API 同步相关案例 |
| M7 | 安装、事务、源码组织、可追溯发布系统 | 已交付；本次跟随新增支持文件检查分发 |
| M8 | 已接受 48 格与旧版迁移，所有证据保留真实候选身份 | 原冻结消费者剩余 60 格首轮全部通过，108 格组装验收通过。新增源码另作影响审阅，不把旧测量改称新源码测量 |

## 新增实现与验收依据

M2 的 Python/Node 校验器共享 TypeScript Compiler API 分析，安装器同时分发该分析模块。接受安全的属性对象、导入、别名、函数返回/参数、有限泛型、union、嵌套展开及 createElement/JSX-runtime 调用；真实错误类型、可观察的视觉/ref/ownership 注入继续拒绝。独立审阅发现并修复 React `key` 的 intrinsic 属性遗漏，专用正负向检查首轮通过。这里的等价指公共 ownership 合同内的语法等价；`any`、不透明索引、未知公共属性、诊断抑制和任意运行时修改不构成安全证明。

M5 已补齐独立控件入口：DragDrop 默认提供浏览文件按钮，并共用 accept、多选、禁用和拒绝规则；InfiniteScroll 默认提供手动加载与失败重试按钮，保持请求去重、焦点、加载、结束和无观察器降级行为。22 项定向组件合同通过，Chromium、Firefox、WebKit 各有 8 项实际通过结果。前两次浏览器命令存在进程/诊断产物生命周期超时，记录继续保留为失败或部分结果；未把它们写成完整命令成功。仅剩 WebKit 在事前登记的单次环境修复例外后完成，8 项均 retry 0，最终命令退出码 0。通过引擎没有重跑。

可复现的定向入口为 `assets/react-kit/playwright.original-goals-m5.config.ts`，配合 `m5-drag-drop`、`m5-standalone-infinite-scroll`、`d2-drag-upload`、`infinite-scroll-composition` 四个 browser spec。该配置仅关闭已确认导致 Windows 生命周期异常的 trace/video 诊断，保留行为、axe 断言及失败截图。

M8 此次只执行缺少的 60 格，五个场景均首轮通过，原 48 格继续保留。完整 [108 格索引及原始文件摘要](evidence/m8-original-matrix-closeout-2026-10-10.json) 与 [矩阵说明](evidence/m8-original-matrix-closeout-2026-10-10.md) 保留 RC.8 family 18 格、RC.9 其他 90 格的实际身份。

M2 改动为校验工具与安装支持，组件运行时代码未因 M2 改变。M5 运行时改动仅涉及 DragDrop、InfiniteScroll 和所属文件选择样式；六个原消费者未使用这两个控件。因此新增能力由具名定向检查负责，108 格不改称本次 main 源码的全新测量。

完整开发检查、失败修复记录及本次源码 SHA-256 快照集中在 [机器可读开发收口记录](evidence/m1-m8-main-development-2026-10-10.json)。发行版 v0.3.1、tag 和附件保持不变；本次交付目标是 main。
