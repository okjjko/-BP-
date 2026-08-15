/**
 * 每步思考倒计时配置（TODO §3.4）
 *
 * BP 流程每一步限时思考，超时后由权威方从当前可选池随机 ban/pick 一个。
 *
 * enabled —— 是否启用倒计时。默认 false（保持现有行为，需手动开启）。
 *
 * secondsPerStep —— 每步秒数（仅 enabled=true 时生效）。默认 90s；
 *                   范围 30~300，UI 下拉档位：30/45/60/90/120/180/300。
 *
 * 多人一致性（关键）：倒计时到期动作（随机 ban/pick）属于随机操作，遵循权威方
 * 单点原则——仅 local/host 端跑定时器并执行超时动作 + syncState 广播；
 * player/spectator 端不设定时器，纯显示倒计时（时长与起始时间随状态同步）。
 */
export default {
  enabled: false,
  secondsPerStep: 90
}
