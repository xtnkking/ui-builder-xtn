// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"result/overview","exports":["EmptyState","ErrorState","NoResults","RetryButton","AsyncAction"]}
import { StatePreview } from "../state-preview";
import { useState } from "react";
import { AsyncAction, EmptyState, ErrorState, Inline, InlineMessage, NoResults, RetryButton, Stack } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

async function wait() { await new Promise<void>((resolve) => setTimeout(resolve, 1200)); }
function AsyncFailure() {
  const [error, setError] = useState("");
  return <Stack><Inline><AsyncAction onAction={async () => { throw new Error("保存失败，请检查网络。"); }} onActionError={(failure) => setError(failure instanceof Error ? failure.message : "保存失败")}>触发保存失败</AsyncAction></Inline>{error ? <InlineMessage tone="danger">{error}</InlineMessage> : null}</Stack>;
}
const explorerCase = {
  id: "result/overview",
  label: "结果与恢复操作",
  summary: "空态、错误和请求状态各有真实实例；重试按钮的 loading 由请求所有者传入。",
  states: ["default","empty","error","disabled","loading","longContent","keyboard","overlay","dark","locale"],
  stateExamples: [
    { state: "default", exports: ["EmptyState","ErrorState","NoResults","RetryButton","AsyncAction"], content: <Stack gap="large"><EmptyState compact title="还没有成员" /><NoResults compact /><ErrorState compact onRetry={wait} /><Inline><RetryButton onRetry={() => undefined} /><AsyncAction onAction={wait}>保存更改</AsyncAction></Inline></Stack> },
    { state: "empty", exports: ["EmptyState","NoResults"], content: <Stack><EmptyState compact title="还没有成员" /><NoResults compact /></Stack> },
    { state: "error", exports: ["ErrorState","AsyncAction"], content: <Stack><ErrorState compact kind="offline" /><AsyncFailure /></Stack>, instructions: "点击触发保存失败，观察请求失败后的错误消息。" },
    { state: "disabled", exports: ["RetryButton","AsyncAction"], content: <Inline><RetryButton disabled onRetry={() => undefined} /><AsyncAction disabled onAction={wait}>保存更改</AsyncAction></Inline> },
    { state: "loading", exports: ["ErrorState","RetryButton","AsyncAction"], content: <Stack><ErrorState compact retryLoading onRetry={wait} /><Inline><RetryButton loading onRetry={() => undefined} /><AsyncAction loading onAction={wait}>保存更改</AsyncAction></Inline></Stack> },
    { state: "longContent", exports: ["EmptyState","ErrorState","NoResults","RetryButton","AsyncAction"], content: <Stack><EmptyState compact title="还没有成员" description="成员目录查询暂时无法完成，请检查工作区权限、组织网络代理及身份提供方配置。修正这些设置之后重试，已经成功载入的数据将保留，不会重复提交操作。" /><NoResults compact description="成员目录查询暂时无法完成，请检查工作区权限、组织网络代理及身份提供方配置。修正这些设置之后重试，已经成功载入的数据将保留，不会重复提交操作。" /><ErrorState compact description="成员目录查询暂时无法完成，请检查工作区权限、组织网络代理及身份提供方配置。修正这些设置之后重试，已经成功载入的数据将保留，不会重复提交操作。" /><Inline><RetryButton label="成员目录查询暂时无法完成，请检查工作区权限、组织网络代理及身份提供方配置。修正这些设置之后重试，已经成功载入的数据将保留，不会重复提交操作。" onRetry={() => undefined} /><AsyncAction onAction={wait}>成员目录查询暂时无法完成，请检查工作区权限、组织网络代理及身份提供方配置。修正这些设置之后重试，已经成功载入的数据将保留，不会重复提交操作。</AsyncAction></Inline></Stack> },
    { state: "keyboard", exports: ["ErrorState","RetryButton","AsyncAction"], content: <Stack gap="large"><EmptyState compact title="还没有成员" /><NoResults compact /><ErrorState compact onRetry={wait} /><Inline><RetryButton onRetry={() => undefined} /><AsyncAction onAction={wait}>保存更改</AsyncAction></Inline></Stack>, instructions: "用 Tab 聚焦本例操作按钮，用 Enter 或 Space 执行；关闭浮层后核对焦点返回。此处是人工操作入口，不是自动验收证书。" },
    { state: "overlay", exports: ["RetryButton","AsyncAction"], content: <StatePreview state="overlay"><Inline><RetryButton onRetry={() => undefined} /><AsyncAction onAction={wait}>保存更改</AsyncAction></Inline></StatePreview> },
    { state: "dark", exports: ["EmptyState","ErrorState","NoResults","RetryButton","AsyncAction"], content: <StatePreview state="dark"><Stack gap="large"><EmptyState compact title="还没有成员" /><NoResults compact /><ErrorState compact onRetry={wait} /><Inline><RetryButton onRetry={() => undefined} /><AsyncAction onAction={wait}>保存更改</AsyncAction></Inline></Stack></StatePreview> },
    { state: "locale", exports: ["EmptyState","ErrorState","NoResults","RetryButton","AsyncAction"], content: <StatePreview state="locale"><Stack gap="large"><EmptyState compact title="还没有成员" /><NoResults compact /><ErrorState compact onRetry={wait} /><Inline><RetryButton onRetry={() => undefined} /><AsyncAction onAction={wait}>保存更改</AsyncAction></Inline></Stack></StatePreview> },
  ],
  content: <Stack gap="large"><EmptyState compact title="还没有成员" /><NoResults compact /><ErrorState compact onRetry={wait} /><Inline><RetryButton onRetry={() => undefined} /><AsyncAction onAction={wait}>保存更改</AsyncAction></Inline></Stack>,
  code: "<ErrorState kind=\"offline\" onRetry={reload} />\n<RetryButton loading={pending} onRetry={reload} />\n<AsyncAction onAction={save}>保存更改</AsyncAction>",
} satisfies ExplorerCase;

export default explorerCase;
