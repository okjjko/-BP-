#!/usr/bin/env node
/**
 * npm prepare 生命周期钩子：clone / npm install 后自动配置 git hooks。
 *
 * - 设置 core.hooksPath 指向仓库内 .githooks（随版本库管理，跨机器一致）
 * - 给 hook 文件加可执行位（Linux 需要；Windows 上为 noop，git for windows 忽略可执行位）
 * - 自动纠正：若 core.hooksPath 被外部（IDE/GUI 等）改成其他值，纠正回 .githooks 并提醒
 * - 自愈兜底：在 .git/hooks/pre-commit 写入 fallback 脚本——即使 core.hooksPath 被覆盖/清空
 *   导致 .githooks/pre-commit 不触发，git 回退到此仍能 bump 版本号并自愈 hooksPath，
 *   破解「hooksPath 被改 → 钩子不触发 → 无法自纠正」的死循环。
 *
 * 跨平台（node 实现，无新依赖）。非 git 环境（如解压源码安装）静默跳过，不阻断 install。
 */
import { execSync } from 'child_process'
import { chmodSync, readdirSync, existsSync, writeFileSync } from 'fs'

const DESIRED = '.githooks'

function git(...args) {
  try {
    return execSync(['git', ...args].join(' '), { encoding: 'utf8' }).trim()
  } catch {
    return null
  }
}

// 非 git 环境（解压源码安装等）静默跳过
if (git('rev-parse', '--git-dir') === null) {
  process.exit(0)
}

// 1. 检测 + 纠正 core.hooksPath
const current = git('config', 'core.hooksPath') // 未设置 → null
if (current !== null && current !== DESIRED) {
  console.warn(`[setup-hooks] ⚠️ 检测到 core.hooksPath 被外部改为 "${current}"（通常是 IDE/GUI 覆盖），已自动纠正回 "${DESIRED}"`)
}
git('config', 'core.hooksPath', DESIRED)
console.log(`[setup-hooks] core.hooksPath = ${DESIRED}`)

// 2. 给 .githooks 下 hook 文件加可执行位
if (existsSync(DESIRED)) {
  for (const f of readdirSync(DESIRED)) {
    try { chmodSync(`${DESIRED}/${f}`, 0o755) } catch { /* Windows 无可执行位概念 */ }
  }
}

// 3. 自愈兜底：在 .git/hooks/pre-commit 写 fallback（不进版本库，每次 prepare 重写以保持最新）
const gitDir = git('rev-parse', '--git-dir') || '.git'
const fallbackPath = `${gitDir}/hooks/pre-commit`
const fallbackScript = [
  '#!/bin/sh',
  '# fallback pre-commit：当 core.hooksPath 被外部覆盖/清空、.githooks/pre-commit 不触发时，',
  '# git 回退到此仍能 bump 版本号并自愈 hooksPath。由 scripts/setup-hooks.mjs 自动生成，勿手动改。',
  'if [ -f .githooks/pre-commit ]; then',
  '  sh .githooks/pre-commit || exit $?',
  'fi',
  'cur=$(git config core.hooksPath 2>/dev/null)',
  'if [ "$cur" != ".githooks" ]; then',
  '  echo "[setup-hooks] ⚠️ core.hooksPath 被改为 ${cur:-（空）}，已自动纠正回 .githooks" >&2',
  '  git config core.hooksPath .githooks',
  'fi',
  ''
].join('\n')
try {
  writeFileSync(fallbackPath, fallbackScript)
  try { chmodSync(fallbackPath, 0o755) } catch { /* Windows */ }
} catch { /* .git/hooks 不可写，忽略；主路径 .githooks 仍生效 */ }
