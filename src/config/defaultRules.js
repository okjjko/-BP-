/**
 * 规则配置聚合器（ruleConfig 默认值）
 *
 * 这是「配置契约层」的单一事实来源。
 * Phase 0 定型后本文件不再改动；各功能默认值在 src/config/rules/ 下独立文件维护，
 * 由对应功能开发者负责，互不冲突。
 *
 * 详见 docs/CUSTOM-RULES-PARALLEL-PLAN.md 与 CLAUDE.md「ruleConfig 配置契约」一节。
 */
import sideNames from './rules/sideNames'
import sideSelection from './rules/sideSelection'
import bpSequence from './rules/bpSequence'
import limits from './rules/limits'
import pumpkinRule from './rules/pumpkinRule'
import randomBan from './rules/randomBan'

export default {
  sideNames,
  sideSelection,
  bpSequence,
  limits,
  pumpkinRule,
  randomBan
}
