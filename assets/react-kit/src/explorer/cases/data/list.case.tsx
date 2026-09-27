// @personal-ui-coverage {"kind":"example","runner":"explorer","caseId":"list/overview","exports":["List","VirtualList"]}
import { Box, List, Stack, VirtualList } from "../../../personal-ui";
import type { ExplorerCase } from "../types";

const records = Array.from({ length: 40 }, (_, index) => ({ id: `record-${index + 1}`, name: `审计记录 ${index + 1}` }));

const explorerCase = {
  id: "list/overview",
  label: "普通与虚拟列表",
  summary: "短集合使用语义列表；大集合使用固定高度虚拟滚动并保留键盘滚动入口。",
  states: ["default", "longContent", "mobile", "dark", "locale"],
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
