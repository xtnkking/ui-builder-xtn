# Source Authority And Support Policy

本文定义 `ui-builder-xtn` 的源码权威、同步方向和兼容性声明边界。机器可读事实以 [support-matrix.json](support-matrix.json) 为准；路线图的阶段与验收条件仍以 [v0.3.0-roadmap.md](v0.3.0-roadmap.md) 为准。

## 唯一可编辑来源

- 包含本文件的 Git checkout 是唯一可编辑的源码来源。
- 该 checkout 内，`assets/react-kit/src/personal-ui/` 是组件实现的 canonical 路径。
- `$CODEX_HOME/skills/ui-builder-xtn` 下的已安装 Skill、工作区中的备份、导出包和其他 mirror 都是生成副本，禁止直接修复或继续开发。
- 同步只能从 Git checkout 单向流向生成副本。若生成副本出现差异，应丢弃差异并从 Git checkout 重新生成，不能反向覆盖源码。
- 每次同步必须记录源 Git commit，并验证 managed source、Manifest、registry、版本和文件哈希一致。发布后的生成副本还必须与同一发行计划和校验和绑定；具体流程见 [release-process.md](release-process.md)。
- `personal-ui-library-preview.html` 仅是历史视觉参考，不属于源码权威，也不能作为同步输入。

## 不可变基线

`v0.2.19` 由 Git tag `v0.2.19` 固定在 commit `0587d4b08c1a70efff80c228b332f4064a7db6d1`。恢复基线必须使用该 tag 或完整 commit，不得使用移动的 `main`。

## 支持状态的含义

支持矩阵使用三个阶段，不能混写：

- `declared`：配置文件声明了范围，但不代表完整测试覆盖。
- `target`：`v0.3.0` 的验收目标；冻结源码快照中尚未嵌入完整结构化证据，不表示外部 hosted 运行从未发生。
- `verified`：对应的干净安装或发布 smoke 已通过，结构化证据记录准确版本、环境和来源绑定。矩阵条目只有在证据嵌入并通过契约校验后才改为此状态。

## v0.2.19 基线事实

| 维度 | 当前范围 | 证据与限制 |
| --- | --- | --- |
| Node.js | `>=18.18` | 基线 tag 中的 `package.json` 声明；没有跨版本 CI，不能解释为所有更高版本均已验证。 |
| React / React DOM | `^18.3.1` | starter 依赖声明；当前 lockfile 锁定 `18.3.1`。 |
| TypeScript | `^5.7.2` | starter 声明；当前 lockfile 实际解析为 `5.9.3`，只有 strict build 证据。 |
| 包管理器 | npm | 提供 npm lockfile，安装器和门禁写入 npm scripts；pnpm、Yarn 尚未受支持。 |
| 浏览器 | Chromium 的聚焦检查 | 基线 tag 的 10 个脚本依赖调用方提供 Playwright 模块路径；没有仓库自带 runner、Firefox/WebKit 矩阵或 CI。 |
| 响应式范围 | 320 至 2560 CSS px 的人工/聚焦检查约定 | 宽度约定不是浏览器兼容性证明。 |

## Hardening 源码与发行证据

仓库配置了 Node 22/24、八条安装和兼容 fixture、Chromium/Firefox/WebKit 浏览器门禁，以及 macOS 系统 Safari 18+ smoke。`npm run release:check` 是本地质量门禁；工作流配置和本地通过记录都不能代替 hosted 结果。M1 的历史本地验收记录见 [路线图](v0.3.0-roadmap.md)，实际发布流程和证据结构见 [release-process.md](release-process.md)。

冻结源码快照可以先于对应的 hosted 运行，因此本文件和支持矩阵不写入该快照自己的 run URL 或产物哈希。矩阵中的空证据数组只表示源码未嵌入验证结果。判断某个 RC 或 stable 发行物是否通过，须查看外部保留的 hosted-CI 和 M8 证据包，并校验其中的源 commit、`planDigest`、归档 SHA-256、运行身份、实际版本和结果均与该发行物一致。旧提交、失败或取消的运行不能证明当前发行物；Playwright WebKit 也不能证明真实 Safari。源码快照的 `target` 状态与发行物的外部验收结果分别读取，不回写冻结源码来制造循环哈希。

## v0.3.0 支持范围与验证条件

下表定义 `v0.3.0` 的声明范围及逐项验证条件。是否达到这些条件，以同一发行物绑定的结构化证据为准。

| 维度 | 声明范围 | 验证条件 |
| --- | --- | --- |
| Node.js | `>=22.12 <25`，覆盖 Node 22 和 24 LTS | 两条 LTS 线均完成 clean install、build、验证器与测试。 |
| React / React DOM | `>=18.3.1 <20` | React 18.3 与 React 19 fixture 均通过类型、行为和安装验证。 |
| TypeScript | `>=5.7 <6` | 最低支持版本和当前 5.x 版本均通过类型检查及 API report。 |
| npm | `>=10 <12` | npm 10、11 fixture 的安装、升级、验证和回滚通过。 |
| pnpm | `>=9 <11` | pnpm 9、10 及 workspace fixture 通过相同门禁。 |
| Yarn | `>=4 <5` | Yarn 4 与 workspace fixture 通过；Yarn Classic 不在目标范围。 |
| Chromium | 当前稳定版及前一稳定版 | 仓库自带 Playwright Chromium 项目通过核心行为；稳定 Chromium 负责视觉基线。 |
| Firefox | 当前稳定版及前一稳定版 | 仓库自带 Playwright Firefox 项目通过核心行为和无障碍检查。 |
| WebKit / Safari | Playwright 当前 WebKit；Safari 18+ 为产品支持下限 | WebKit 核心行为通过；真实 Safari 的发布 smoke 结果单独记录，不能用 WebKit 等同替代。 |
| 响应式范围 | 2560、1440、1024、736、360、320 CSS px | 适用组件在六档宽度完成自动或留证视觉审查。 |

具体工具版本应由 lockfile 和 CI 固定；支持政策使用范围表达，避免把偶然安装到的版本误认为唯一支持版本。扩大范围必须先增加对应 fixture/浏览器项目并取得证据，再修改矩阵。

## 维护规则

1. 任何支持范围变更必须先更新 `support-matrix.json`，再更新本文摘要。
2. `target` 只有在对应结构化证据嵌入矩阵并通过契约校验后才能改为 `verified`；发行物的外部验收由与其精确绑定的证据包独立证明。
3. 暂未支持的环境必须明确失败或报告，不允许静默降级后仍宣称验证成功。
4. README 只链接本政策，不重复维护版本范围。
