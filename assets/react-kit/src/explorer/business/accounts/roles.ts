export const artRoot = "https://xyq.res.netease.com/pc/gw/20170118103441/data/";
export type Role = { id: string; name: string; character: string; level: number; school: string; region: string; server: string; race: "human" | "fairy" | "demon"; art: string; avatar: string; training: string; skill: string; pet: string; notes: string };
export type Account = { id: string; name: string; shortName: string; login: string; note: string; roles: Role[] };

function withRoleExamples(roles: Role[], total: number): Role[] {
  const names = ["清风入弦", "明月轻舟", "山河如画", "竹影听泉", "疏星照水", "云山拾梦", "烟雨江南", "花间晚照"];
  return [
    ...roles,
    ...Array.from({ length: Math.max(0, total - roles.length) }, (_, index) => {
      const template = roles[index % roles.length];
      const number = roles.length + index + 1;
      return {
        ...template,
        id: `${template.id}-example-${number}`,
        name: `${names[index % names.length]}·${String(number).padStart(2, "0")}`,
        notes: "多角色账号展示示例，角色资料为本地演示数据。",
      };
    }),
  ];
}

export const accounts: Account[] = [
  { id: "main", name: "主力账号", shortName: "主", login: "feng***@163.com", note: "主力与高等级角色", roles: withRoleExamples([
    { id: "10862031", name: "长安听雨", character: "剑侠客", level: 175, school: "大唐官府", region: "浙江一区", server: "西栅老街", race: "human", art: "people2/role_01.png", avatar: "role-tx/jxk.png", training: "25 / 25 / 25", skill: "横扫千军 180", pet: "画魂 · 狂豹", notes: "主力物理输出角色，装备与召唤兽资料已整理。" },
    { id: "10862032", name: "云外逍遥", character: "逍遥生", level: 175, school: "化生寺", region: "浙江一区", server: "西栅老街", race: "human", art: "people2/role_02.png", avatar: "role-tx/xiaoyao.png", training: "25 / 25 / 25", skill: "金刚护体 180", pet: "童子 · 雷鸟人", notes: "团队辅助角色，日常与副本常用。" },
    { id: "10862033", name: "星河入梦", character: "龙太子", level: 159, school: "龙宫", region: "北京一区", server: "紫禁城", race: "fairy", art: "xian2/role_01.png", avatar: "role-tx/xian_01.png", training: "25 / 22 / 22", skill: "龙卷雨击 170", pet: "画魂 · 吸血鬼", notes: "法系角色，主要用于日常任务。装备与技能明细可在详情中核对。" },
    { id: "10862034", name: "桃花落处又逢君·收藏角色", character: "桃夭夭", level: 129, school: "普陀山", region: "北京一区", server: "紫禁城", race: "fairy", art: "xian2/role_06.png", avatar: "role-tx/xian_06.png", training: "21 / 21 / 21", skill: "普渡众生 140", pet: "泪妖 · 凤凰", notes: "用于展示长角色名的布局表现。卡片保持统一宽度，完整名称在详情中查看。" },
  ], 12) },
  { id: "daily", name: "日常任务账号", shortName: "日", login: "qing***@163.com", note: "日常与副本搭配", roles: withRoleExamples([
    { id: "20871051", name: "晚风照月", character: "飞燕女", level: 129, school: "女儿村", region: "山东一区", server: "钓鱼岛", race: "human", art: "people2/role_03.png", avatar: "role-tx/fyn.png", training: "21 / 21 / 21", skill: "雨落寒沙 140", pet: "泪妖 · 机关鸟", notes: "日常队伍封系角色，资料已缓存，折叠分组不会重新加载或清除选择。" },
    { id: "20871052", name: "枕上星辰", character: "骨精灵", level: 129, school: "阴曹地府", region: "山东一区", server: "钓鱼岛", race: "demon", art: "mo2/role_01.png", avatar: "role-tx/mo_01.png", training: "21 / 18 / 18", skill: "尸腐毒 140", pet: "吸血鬼 · 画魂", notes: "日常任务辅助角色，详细资料可在角色详情中查看。" },
    { id: "20871053", name: "青山一顾", character: "玄彩娥", level: 109, school: "普陀山", region: "山东一区", server: "钓鱼岛", race: "fairy", art: "xian2/role_02.png", avatar: "role-tx/xian_02.png", training: "17 / 17 / 17", skill: "普渡众生 120", pet: "画魂 · 如意仙子", notes: "休闲辅助角色，账号下的每个角色均可独立选择与查看详情。" },
  ], 18) },
  { id: "backup", name: "备用账号", shortName: "备", login: "luo***@163.com", note: "收藏与备用角色", roles: [
    { id: "30952011", name: "南风知我意", character: "狐美人", level: 109, school: "盘丝洞", region: "北京一区", server: "紫禁城", race: "demon", art: "mo2/role_03.png", avatar: "role-tx/mo_03.png", training: "17 / 17 / 17", skill: "天罗地网 120", pet: "吸血鬼 · 蛟龙", notes: "备用账号下的收藏角色。与其他账号的选择、刷新及折叠状态相互独立。" },
    { id: "30952012", name: "明月照清川", character: "舞天姬", level: 89, school: "天宫", region: "浙江一区", server: "西栅老街", race: "fairy", art: "xian2/role_04.png", avatar: "role-tx/xian_04.png", training: "13 / 13 / 13", skill: "天雷斩 100", pet: "蛟龙 · 凤凰", notes: "低等级体验角色，保留角色归属信息，便于跨账号管理。" },
  ] },
];
export const allRoles = accounts.flatMap(account => account.roles);
