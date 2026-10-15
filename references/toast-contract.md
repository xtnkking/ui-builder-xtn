# 轻提示（Toast / Snackbar）

使用公共 barrel 的 `ToastProvider` 和 `useToast`，在需要共享数量管理的页面外放置一个 Provider。Toast 用于短暂反馈；必须留存的业务通知应另存到业务消息列表，不能把等待队列当作可靠消息存储。

<a id="feedback-selection"></a>
## 反馈选型：短暂结果优先轻提示

新页面组合默认优先使用轻提示反馈短暂操作结果，避免为了成功或一次可重试失败在内容区插入大块提示、挤动表格和表单。按信息是否需要持续可见选择组件：

| 场景 | 推荐方式 |
| --- | --- |
| 保存、删除、复制、导出、加购等操作的成功或可重试失败 | `Toast`；简短业务说明、自动关闭，不额外堆叠 Alert |
| 点击查询或 Enter 提交的搜索 | 必须有加载态；成功轻提示可选，在当前请求成功后显示简短“查询完成”，不在点击时预报成功 |
| 表格请求失败 | `DataTable state="error"`；组件自动轻提示，并保留表内状态与重试，调用方不再手动通知 |
| 必填、格式不正确等字段校验 | `Field` 错误；必要时配合 `ValidationSummary`，保持字段关联与定位入口 |
| 某个区域持续加载失败、无权限、离线或暂不可用 | 保留该区域的紧凑持久说明和可用的重试入口；需要完整状态占位时使用 `ErrorState` / `StatusPage` |
| 系统维护、账号限制等需要持续显示的通知 | `Toast duration={null}`，或官方 `Banner` 的持久轻提示；每个独立问题只有一个通知出口 |

Toast 消失不代表问题已解决。仍阻断业务的状态需要就地保留必要说明或恢复操作；不能只弹一次轻提示后留下空白。普通点击、展开、切换和每次重渲染不必都弹提示，也不要为同一次失败同时显示 Alert、ErrorState 和手动 Toast。适用时使用一个共享 Provider、短文案和业务范围内的去重键，遵守下文数量上限。

搜索成功是否提示属于业务组合配置，不是 `FilterBar` 或 `Button` 的自动能力；它们不知道请求何时完成。结果变化已经清楚可见时可以省略成功提示。首次加载、翻页、输入实时变化及重置不发送成功提示；取消、过期响应和卸载后的请求均不发送提示。空结果留在表格空态，可选一条简短 info 轻提示，不同时再发成功提示。表格失败仍由 DataTable 自动提示，不能手动重复通知；没有 DataTable 反馈所有者时才由请求所有者发送失败 Toast。请求入口须共享同步锁，通知共用应用级 `ToastProvider`。

完整可用代码与取消信号见[搜索反馈契约及 TaskFilters 示例](data-workflows.md#search-feedback)。可运行的[搜索反馈案例](../assets/react-kit/src/explorer/cases/actions/search-feedback.example.tsx)位于 `#/components/filter-bar` →「搜索反馈」，演示手动查询后的可选成功提示、空态、DataTable 唯一错误提示与重试，以及翻页成功静默。示例开关初始开启便于观察效果；文档组合参数 `notifyOnSuccess` 默认关闭，均不是新增公共组件参数。

`v0.3.4` 起，以下官方组件和示例已直接采用轻提示，使用者不需要手动补相同通知：

| 组件 / 组合 | 默认反馈与恢复入口 |
| --- | --- |
| `FamilyLoginPage` | 提交失败轻提示；无产品配置持续轻提示。字段校验保留在 Field，重试仍使用原提交按钮。 |
| `ConfirmDialog` / `Popconfirm` | 确认失败轻提示，保留当前浮层与原确认按钮；再次失败属于新的尝试。 |
| `Banner` | 默认持续显示的轻提示，保留标题、正文、业务 action 和 ×；不占页面高度。 |
| 商城认证、收藏、购物车、地址、订单和结算 | 操作结果通过共享 ToastProvider 通知；必要的操作入口留在原页面。 |
| `InfiniteScroll`＋`LoadMore` 官方组合 | 请求失败轻提示，已加载数据和原加载按钮保留；紧凑状态说明可手动重试。 |

这些自动通知组件优先复用最近的 `ToastProvider`，独立使用时有内部兜底；整页仍应只放一个共享 Provider，统一数量上限。`useToast()` 业务调用必须位于明确的 Provider 内。不要为同一次失败增加第二条手动 Toast。

`Banner` 的 `sticky` 仍可传入，但不再改变页面布局或定位；通知位置沿用官方轻提示默认右上角。挂载发送一次，更新标题、正文或 action 会更新原通知，不重新排队或重置计时；手动关闭后普通重渲染不重放，卸载会移除自己拥有的通知。`duration: null` 表示无自动关闭，仍可点击 ×。重要业务状态仍须记录在业务数据中，不能依赖通知队列保证送达。

`Alert` 保留为明确需要行内提示时使用的公开组件，不能再作为上述操作的默认搭配。字段关联的校验以及整页无权限、离线等状态占位仍各有自己的语义，不替换为空白页面上的一条短通知。

下面是新操作使用官方组件的具体组合。`AsyncAction` 负责加载态与阻止重复操作；成功和失败各只有一个轻提示出口，失败后保留原操作按钮供重试：

```tsx
import { AsyncAction, ToastProvider, useToast } from "./ui";

function SaveSettingsAction({ save }: { save: () => Promise<void> }) {
  const { toast } = useToast();
  return (
    <AsyncAction
      loadingLabel="正在保存"
      onAction={async () => {
        await save();
        toast({ tone: "success", description: "设置已保存。" });
      }}
      onActionError={() => {
        toast({ tone: "danger", description: "保存失败，请重试。" });
      }}
    >保存设置</AsyncAction>
  );
}

export function SettingsExample({ save }: { save: () => Promise<void> }) {
  return <ToastProvider><SaveSettingsAction save={save} /></ToastProvider>;
}
// 已有应用级 ToastProvider 时，直接组合 SaveSettingsAction，避免再套独立 Provider。
```

## 数量上限、排队与去重

| 配置 | 默认值 | 行为 |
| --- | --- | --- |
| `ToastProvider.maxVisible` | `3` | 此 Provider 内所有位置合计的显示上限，规范化到 `1`–`8`。 |
| `ToastProvider.maxQueue` | `20` | 等待提示数量上限，规范化到 `0`–`100`；`0` 表示不排队。 |
| `ToastOptions.dedupeKey` | 未设置 | 非空去重键与可见及等待提示匹配。重复调用返回原 ID，不修改内容、不重置计时。 |

显示位满后，新提示按先入先出等待，真正显示时才开始计时。队列也满时忽略新提示，不挤压卡片、不移走正在阅读或执行操作的提示；该次调用返回的 ID 不对应显示内容，对它调用 `dismiss` 不产生效果。不要用每次不同的时间戳当去重键。

动态调低 `maxVisible` 不强制移除已经显示的提示；后续补位遵守新上限。调低 `maxQueue` 同样不会删除已有等待项，只限制后续接收。非有限数量回退默认值，小数向下取整后限制在支持范围。`dismiss(id)` 同时适用于可见提示和等待提示。等待项直接取消；显示项立即停止计时与操作，保留容量与槽位至退出完成，再删除并 FIFO 补位。`dismissAll()` 先清空等待项及停止计时，再退出显示项，不能随后误补位。多个 Provider 的数量独立，因此同一页面通常只放一个。

进入、退出和同位置补位由官方组件处理，不需要调用方延迟 `dismiss`。进入计入显示时间，补位不重挂载、不重复播报，也不重置剩余时间；退出期间去重键仍占用，重复 dismiss 幂等，晚到异步结果不能复活已关闭提示。系统减少动效时立即完成视觉退出，但保留原真实显示时间、暂停原因、进度值与读秒逻辑。完整动效规则见[组件动效契约](motion-contract.md)。

```tsx
import { ToastProvider } from "./ui";

<ToastProvider maxVisible={3} maxQueue={20}>
  <Page />
</ToastProvider>
```

## Automatic table error notifications

`DataTable state="error"` 自动发送一条 danger 轻提示，标题和说明来自 `errorTitle`、`errorDescription` 或组件本地化默认文案；调用方不需要再调用 `toast()`。这条提示持续五秒，可点击 × 关闭，不附带重试操作。表格框架内保留简短错误状态与唯一重试入口，因此提示消失后仍能理解失败原因并重试；表格上方不再自动出现大块 Alert。

同一次失败只通知一次。父组件重渲染、内联回调或新建说明 JSX 不应重复发送；离开错误状态后再次失败，或一次重试结束仍失败，才视为新失败阶段。调用方应使用实际请求状态驱动 `retrying`，每个表格分别维护自己的请求范围。不要为同一个表格请求再叠加外部 Alert、ErrorState 或手动 Toast；其它业务范围的反馈仍按各自场景选择。

DataTable 优先复用最近的上层 `ToastProvider`，因此建议应用根部只放一个共享 Provider，使多个表格与其它动作共享默认最多三条提示及等待队列。单独使用 DataTable 而没有上层 Provider 时，它提供内部兜底，不要求修改原有调用。多个独立兜底的数量分别管理；需要整页统一上限时使用共享 Provider，而不是给每个表格单独套一个。

这是组件自动通知的能力，不改变 `useToast()` 的直接使用合同：业务代码调用 `useToast()` 仍须位于明确的 `ToastProvider` 内。Toast 关闭只影响短暂反馈，不代表请求已恢复；持续状态由表格保留。可直接使用的代码见[表格请求错误](data-workflows.md#table-request-failures)。

## 关闭时间与显示选项

| 选项 | 默认行为 | 使用方式 |
| --- | --- | --- |
| `duration` | 普通提示 `5000` 毫秒；带操作提示持续显示 | 正数指定自动关闭时间；`null` 表示手动关闭。不要用 `0` 表示持续显示。 |
| `closable` | 显示关闭按钮 | 设为 `false` 隐藏 ×；持续显示且没有可关闭操作时保留关闭入口，防止无法关闭。 |
| `countdown` | 不显示进度条 | 独立开关，只在自动关闭时显示剩余时间进度。 |
| `showSeconds` | 不显示读秒 | 独立开关，只在自动关闭时显示剩余秒数。可与进度条同时使用。 |
| `position` | `top-right` | 支持 `top-center`、`top-right`、`bottom-right`，与形状独立。 |
| `shape` | `rounded` | `rounded` 圆角与 `pill` 胶囊均支持所有位置。 |
| `tone` | `info` | `info`、`success`、`warning`、`danger`。 |

非法、非有限或非正数的 `duration` 回退到 5 秒；超大时间受浏览器计时器范围约束。悬停、指针按下、键盘聚焦、异步操作和页面隐藏分别暂停计时，所有暂停原因解除后继续。进度条和读秒与真实剩余时间同步，而不是另一套自动关闭计时。

### 自动关闭，不显示倒计时

```tsx
const { toast } = useToast();

toast({
  description: "成员权限已保存。",
  tone: "success",
  duration: 4000,
  countdown: false,
  showSeconds: false,
  closable: true,
});
```

### 仅读秒，或与进度条同时显示

```tsx
toast({
  description: "设置已保存。",
  duration: 6000,
  showSeconds: true,
  countdown: false, // 改为 true 可同时显示进度条
  closable: true,
  shape: "pill",
  position: "top-center",
});
```

### 手动关闭与程序关闭

```tsx
const { toast, dismiss, dismissAll } = useToast();

const id = toast({
  title: "连接中断",
  description: "请检查网络后重试。",
  duration: null,
  closable: true,
  tone: "danger",
});

// 业务恢复后可关闭单条；页面重置时可清空显示和等待提示。
dismiss(id);
dismissAll();
```

### 带异步操作的提示

```tsx
toast({
  description: "文件已移至回收站。",
  duration: null,
  dedupeKey: `delete:${fileId}`,
  action: {
    label: "撤销",
    loadingLabel: "正在撤销",
    onClick: () => restoreFile(fileId),
    onError: (error) => reportRestoreFailure(error),
  },
});
```

操作中使用组件自带加载态并禁止重复执行；成功默认关闭，`action.dismiss: false` 可保留，失败保留提示并调用 `onError`。`dedupeKey` 防止重复显示同一条反馈，不能替代业务请求的并发控制。

## 长内容与人工预览

三个位置各自独立排列，宽屏从顶部居中、右上、右下各自边缘开始；共用数量上限与等待队列，右上提示不会把居中提示推到页面中间。宽度不足以并排时，顶部居中优先贴顶部，右上在其下方留出间距；上下同时显示时限制各自可滚动区域，避免互相覆盖。窗口缩放不重建提示，保留进行中的操作与剩余计时。

保留组件自带宽度、圆角、图标、关闭入口和正文溢出处理，不用应用 CSS 固定整块高度或让多条提示缩小。Toast 应优先提供简短摘要和操作；确实需要长正文时仍需保证正文能够访问、关闭按钮可见。堆叠区与长正文隐藏滚动条外观，保留滚轮、触屏和键盘滚动；键盘聚焦操作或关闭按钮时可将对应提示滚入视野，长正文溢出时保留独立阅读入口。关闭后的补位动画暂保原容器高度，完成后自然收拢，不因动画位移产生临时滚动条或页面横向溢出。

Explorer 路由 `#/components/toast` 共用一个 Provider，包含独立配置开关、圆角/胶囊与三种位置、持久错误、长正文、异步撤销、仅进度、仅读秒、二者同时显示、连续 10 条排队、重复键去重及清空全部。“多位置同时显示”会清空已有提示并在三个位置各显示一条，方便比较边缘定位与窄屏避让。不要从 Explorer 复制演示文案或界面到消费者项目；按业务需求调用这些公共 API。
