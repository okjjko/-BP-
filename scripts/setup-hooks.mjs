#!/usr/bin/env node
/**
 * npm prepare 生命周期钩子：clone / npm install 后自动配置 git hooks。
 *
 * - 设置 core.hooksPath 指向仓库内 .githooks（随版本库管理，跨机器一致）
 * - 给 hook 文件加可执行位（Linux 需要；Windows 上为 noop，git for windows 忽略可执行位）
 *
 * 跨平台（node 实现，无新依赖）。非 git 环境（如解压源码安装）静默跳过，不阻断 install。
 */
import { execSync } from 'child_process'
import { chmodSync, readdirSync, existsSync } from 'fs'

try {
  execSync('git config core.hooksPath .githooks', { stdio: 'inherit' })
  if (existsSync('.githooks')) {
    for (const f of readdirSync('.githooks')) {
      try { chmodSync(`.githooks/${f}`, 0o755) } catch { /* Windows 无可执行位概念 */ }
    }
  }
  console.log('[setup-hooks] core.hooksPath = .githooks')
} catch {
  // 非 git 环境，跳过
}
