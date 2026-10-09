// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"list/overview","exports":["List","VirtualList"]}
import { StatePreview } from "../state-preview";
import { Box, List, Stack, VirtualList } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const records = Array.from({ length: 40 }, (_, index) => ({ id: `record-${index + 1}`, name: `审计记录 ${index + 1}` }));
const longRecords = [{ id: "long", name: "此审计记录覆盖全部产品中的角色配置、数据访问权限、通知偏好和账户安全设置，请在保存前确认所有关联配置均符合团队的实际使用要求。" }];

const explorerCase = {
  id: "list/overview",
  label: "普通与虚拟列表",
  summary: "短集合使用语义列表；大集合使用固定高度虚拟滚动并保留键盘滚动入口。",
  states: ["default", "empty", "longContent", "keyboard", "mobile", "dark", "locale"],
  stateExamples: [
    { state: "empty", exports: ["List", "VirtualList"], content: <Stack><List<string> items={[]} itemKey={(item) => item} renderItem={(item) => item} empty="没有记录" /><VirtualList<string> items={[]} itemKey={(item) => item} renderItem={(item) => item} height={192} ariaLabel="空虚拟列表" empty="没有记录" /></Stack> },
    { state: "longContent", exports: ["List", "VirtualList"], content: <Stack><List items={longRecords} itemKey={(item) => item.id} renderItem={(item) => item.name} /><VirtualList items={longRecords} itemKey={(item) => item.id} renderItem={(item) => <Box padding="small">{item.name}</Box>} height={192} itemSize={96} ariaLabel="长内容记录" /></Stack> },
    { state: "keyboard", exports: ["VirtualList"], instructions: "用 Tab 聚焦固定高度列表，用 PageDown/PageUp 或方向键滚动；可见记录随滚动切换。", content: <VirtualList items={records} itemKey={(item) => item.id} renderItem={(item) => <Box padding="small">{item.name}</Box>} height={192} itemSize={48} ariaLabel="键盘滚动记录" /> },
    { state: "default", exports: ["List","VirtualList"], content: (
    <Stack gap="large">
      <List items={records.slice(0, 3)} itemKey={(item) => item.id} divided renderItem={(item) => item.name} ariaLabel="最近审计记录" />
      <VirtualList
        items={records}
        itemKey={(item) => item.id}
        height={192}
        itemSize={48}
        ariaLabel="全部审计记录"
        renderItem={(item, meta) => <Box padding="small">{meta.index + 1}. {item.name}</Box>}
      />
    </Stack>
  ) },
    { state: "mobile", exports: ["List","VirtualList"], content: <StatePreview state="mobile">{(
    <Stack gap="large">
      <List items={records.slice(0, 3)} itemKey={(item) => item.id} divided renderItem={(item) => item.name} ariaLabel="最近审计记录" />
      <VirtualList
        items={records}
        itemKey={(item) => item.id}
        height={192}
        itemSize={48}
        ariaLabel="全部审计记录"
        renderItem={(item, meta) => <Box padding="small">{meta.index + 1}. {item.name}</Box>}
      />
    </Stack>
  )}</StatePreview> },
    { state: "dark", exports: ["List","VirtualList"], content: <StatePreview state="dark">{(
    <Stack gap="large">
      <List items={records.slice(0, 3)} itemKey={(item) => item.id} divided renderItem={(item) => item.name} ariaLabel="最近审计记录" />
      <VirtualList
        items={records}
        itemKey={(item) => item.id}
        height={192}
        itemSize={48}
        ariaLabel="全部审计记录"
        renderItem={(item, meta) => <Box padding="small">{meta.index + 1}. {item.name}</Box>}
      />
    </Stack>
  )}</StatePreview> },
    { state: "locale", exports: ["List","VirtualList"], content: <StatePreview state="locale">{(
    <Stack gap="large">
      <List items={records.slice(0, 3)} itemKey={(item) => item.id} divided renderItem={(item) => item.name} ariaLabel="最近审计记录" />
      <VirtualList
        items={records}
        itemKey={(item) => item.id}
        height={192}
        itemSize={48}
        ariaLabel="全部审计记录"
        renderItem={(item, meta) => <Box padding="small">{meta.index + 1}. {item.name}</Box>}
      />
    </Stack>
  )}</StatePreview> },
  ],
  content: (
    <Stack gap="large">
      <List items={records.slice(0, 3)} itemKey={(item) => item.id} divided renderItem={(item) => item.name} ariaLabel="最近审计记录" />
      <VirtualList
        items={records}
        itemKey={(item) => item.id}
        height={192}
        itemSize={48}
        ariaLabel="全部审计记录"
        renderItem={(item, meta) => <Box padding="small">{meta.index + 1}. {item.name}</Box>}
      />
    </Stack>
  ),
  code: `<List items={recent} itemKey={(item) => item.id} renderItem={(item) => item.name} />\n<VirtualList items={all} height={192} itemSize={48} ariaLabel="全部记录" itemKey={(item) => item.id} renderItem={(item) => item.name} />`,
} satisfies ExplorerCase;

export default explorerCase;
