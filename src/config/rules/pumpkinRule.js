/**
 * 南瓜头特殊规则配置
 *
 * enabled —— 是否启用南瓜头锁定保护特殊规则。
 * - true（默认）：选南瓜不消耗 BP 步骤，保护下一个普通植物（受 pumpkinUsage 跨小局上限约束）。
 * - false：南瓜头当作普通植物，正常消耗 BP 步骤、受 maxPlantUsage 上限约束、计入 plantUsage。
 */
export default {
  enabled: true
}
