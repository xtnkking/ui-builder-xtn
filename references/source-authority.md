# Source Authority And Support Policy

本文定义 `ui-builder-xtn` 的源码权威、同步方向和兼容性声明边界。机器可读事实以 [support-matrix.json](support-matrix.json) 为准；路线图的阶段与验收条件仍以 [v0.3.0-roadmap.md](v0.3.0-roadmap.md) 为准。

## 唯一可编辑来源

- 包含本文件的 Git checkout 是唯一可编辑的源码来源。
- 该 checkout 内，`assets/react-kit/src/personal-ui/` 是组件实现的 canonical 路径。
- `$CODEX_HOME/skills/ui-builder-xtn` 下的已安装 Skill、工作区中的备份、导出包和其他 mirror 都是生成副本，禁止直接修复或继续开发。
- 同步只能从 Git checkout 单向流向生成副本。若生成副本出现差异，应丢弃差异并从 Git checkout 重新生成，不能反向覆盖源码。
- 每次同步必须记录源 Git commit，并验证 managed source、Manifest、registry、版本和文件哈希一致。M7 的确定性发布命令完成前，这仍是人工触发但必须单向执行的过渡规则。
- `personal-ui-library-preview.html` 仅是历史视觉参考，不属于源码权威，也不能作为同步输入。

## 不可变基线

`v0.2.19` 由 Git tag `v0.2.19` 固定在 commit `0587d4b08c1a70efff80c228b332f4064a7db6d1`。恢复基线必须使用该 tag 或完整 commit，不得使用移动的 `main`。

## 支持状态的含义

支持矩阵使用三个阶段，不能混写：

- `declared`：配置文件声明了范围，但不代表完整测试覆盖。
- `verified`：仓库拥有可重复执行的自动化证据。
- `target`：`v0.3.0` 的验收目标；在对应测试矩阵通过前不得对外声称已支持。

## v0.2.19 基线事实

| 维度 | 当前范围 | 证据与限制 |
| --- | --- | --- |
| Node.js | `>=18.18` | 基线 tag 中的 `package.json` 声明；没有跨版本 CI，不能解释为所有更高版本均已验证。 |
| React / React DOM | `^18.3.1` | starter 依赖声明；当前 lockfile 锁定 `18.3.1`。 |
| TypeScript | `^5.7.2` | starter 声明；当前 lockfile 实际解析为 `5.9.3`，只有 strict build 证据。 |
| 包管理器 | npm | 提供 npm lockfile，安装器和门禁写入 npm scripts；pnpm、Yarn 尚未受支持。 |
| 浏览器 | Chromium 的聚焦检查 | 基线 tag 的 10 个脚本依赖调用方提供 Playwright 模块路径；没有仓库自带 runner、Firefox/WebKit 矩阵或 CI。 |
| 响应式范围 | 320 至 2560 CSS px 的人工/聚焦检查约定 | 宽度约定不是浏览器兼容性证明。 |

## 当前 hardening 工作树

以下是 M1 工作树中已经落地并通过本地 clean-install 验收的可重复门禁，不代表 `v0.3.0` 已发布，也不代表尚未覆盖的目标支持范围已经转为 `verified`：

- `assets/react-kit/package.json` 已将 Node.js 引擎约束设为 `>=22.12 <25`；GitHub Actions 在 Node 22 和 24 上执行 clean `npm ci`、文档、静态契约、组件测试和构建。
- Playwright 由仓库依赖和 lockfile 固定，统一配置包含 Chromium、Firefox 和 WebKit；10 个行为回归直接使用 Playwright Test 的 `page` 与 `baseURL` fixtures，不再在测试内部启动脚本、浏览器、Vite 服务或页面。本地及 CI 不再需要机器特定的模块路径。
- `npm run docs:check` 验证生成的 API 报告和组件覆盖矩阵均为最新；覆盖矩阵的 API 单元必须能回查生成报告，unit/browser/a11y 证据只接受对应 runner 会收集的测试文件内显式 `@personal-ui-coverage` 元数据。普通文本命中不算覆盖，尚未明确归属到公开 export 的页面级 axe 扫描也不会虚报为组件级 a11y ownership。
- `npm run test:contracts` 包含 Manifest、来源完整性、覆盖矩阵契约、仓库自带 Skill 校验器契约、严格扫描以及 starter/integrate 安装器 fixture。`npm run validate:skill` 不依赖用户机器上的系统 Skill 路径或第三方 Python 包。
- `npm run release:check` 串联 Skill 校验、文档、静态契约、组件测试、类型/构建、三浏览器行为测试、三浏览器 axe 检查和 Chromium 视觉基线。CI 中相同门禁按静态与浏览器 job 拆分，任何步骤失败都会令工作流失败。
- 当前 Git 工作树已从 clean `npm ci` 完整执行该 `release:check`：13 个覆盖契约、6 个 Skill 校验器契约、105 个严格扫描/安装器用例、8 个组件测试、30 个三浏览器行为测试、15 个 axe 页面扫描和 1 个 Chromium 视觉基线全部通过；TypeScript/Vite 构建、来源校验以及 28/28 managed source 完整性同时通过。

以上本地 clean-install 证据完成 M1 的本地验收。托管 GitHub Actions 仍需在未来明确授权 push 后运行并记录，不能把“工作流已配置”表述为“托管 CI 已通过”。React 19、最低/当前 TypeScript、npm 11、pnpm、Yarn 和真实 Safari 的 fixture 仍属于后续里程碑，也不能由本次本地三引擎结果推断支持。

## v0.3.0 目标支持范围

以下是发布门槛，不是当前承诺：

| 维度 | 目标范围 | 成为 `verified` 的条件 |
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
2. `target` 只有在对应自动化证据可从 clean checkout 重现后才能改为 `verified`。
3. 暂未支持的环境必须明确失败或报告，不允许静默降级后仍宣称验证成功。
4. README 只链接本政策，不重复维护版本范围。
