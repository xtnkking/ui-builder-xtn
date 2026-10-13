# 轻提示（Toast / Snackbar）

使用公共 barrel 的 `ToastProvider` 和 `useToast`，在需要共享数量管理的页面外放置一个 Provider。Toast 用于短暂反馈；必须留存的业务通知应另存到业务消息列表，不能把等待队列当作可靠消息存储。

## 数量上限、排队与去重

| 配置 | 默认值 | 行为 |
| --- | --- | --- |
| `ToastProvider.maxVisible` | `3` | 此 Provider 内所有位置合计的显示上限，规范化到 `1`–`8`。 |
| `ToastProvider.maxQueue` | `20` | 等待提示数量上限，规范化到 `0`–`100`；`0` 表示不排队。 |
| `ToastOptions.dedupeKey` | 未设置 | 非空去重键与可见及等待提示匹配。重复调用返回原 ID，不修改内容、不重置计时。 |

显示位满后，新提示按先入先出等待，真正显示时才开始计时。队列也满时忽略新提示，不挤压卡片、不移走正在阅读或执行操作的提示；该次调用返回的 ID 不对应显示内容，对它调用 `dismiss` 不产生效果。不要用每次不同的时间戳当去重键。

动态调低 `maxVisible` 不强制移除已经显示的提示；后续补位遵守新上限。调低 `maxQueue` 同样不会删除已有等待项，只限制后续接收。非有限数量回退默认值，小数向下取整后限制在支持范围。`dismiss(id)` 同时适用于可见提示和等待提示。`dismissAll()` 清空两者并释放计时器。多个 Provider 的数量独立，因此同一页面通常只放一个。

```tsx
import { ToastProvider } from "./ui";

<ToastProvider maxVisible={3} maxQueue={20}>
  <Page />
</ToastProvider>
```

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

保留组件自带宽度、圆角、图标、关闭入口和正文溢出处理，不用应用 CSS 固定整块高度或让多条提示缩小。Toast 应优先提供简短摘要和操作；确实需要长正文时仍需保证正文能够访问、关闭按钮可见。多条消息的容器局部滚动不应使页面横向溢出。

Explorer 路由 `#/components/toast` 共用一个 Provider，包含独立配置开关、圆角/胶囊与三种位置、持久错误、长正文、异步撤销、仅进度、仅读秒、二者同时显示、连续 10 条排队、重复键去重及清空全部。“多位置同时显示”会清空已有提示并在三个位置各显示一条，方便比较边缘定位与窄屏避让。不要从 Explorer 复制演示文案或界面到消费者项目；按业务需求调用这些公共 API。
