/**
 * 开局随机永久禁用植物配置
 *
 * 开局一次性随机抽取若干植物进入 globalBans（跨小局永久生效），与 BP 流程内可插入的
 * globalBan 预设步骤、局内手动抽取互补——本配置只控开局那一次性抽取。
 *
 * enabled —— 是否启用开局随机禁用。
 * - true（默认）：按 count 随机抽取。
 * - false：开局不禁用（globalBans 为空）。
 *
 * count —— 开局抽取数量（仅 enabled=true 时生效）。默认 5（与历史行为一致）；
 *          池不足时抽满为止，不报错。
 */
export default {
  enabled: true,
  count: 5
}
