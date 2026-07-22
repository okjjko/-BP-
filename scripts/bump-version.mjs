#!/usr/bin/env node
/**
 * pre-commit 钩子调用：自动递增 package.json 的版本号。
 *
 * 规则（用户约定）：
 * - 每次 commit：patch（最后一位）+1
 * - patch 满 10 → 进位 minor（第二位），patch 归 0
 * - minor 不自动进 major；major（第一位）仅在大重构 / 重大功能时由用户手动改
 *
 * 用正则替换 version 行以保持 package.json 原有格式（缩进 / 逗号 / 换行）。
 * 找不到 version 字段时安全跳过（不阻断 commit）。
 */
import { readFileSync, writeFileSync } from 'fs'

const pkgPath = new URL('../package.json', import.meta.url)
const original = readFileSync(pkgPath, 'utf-8')

const match = original.match(/"version"\s*:\s*"(\d+)\.(\d+)\.(\d+)"/)
if (!match) {
  console.warn('[bump-version] 未在 package.json 找到 version 字段，跳过')
  process.exit(0)
}

let major = parseInt(match[1], 10)
let minor = parseInt(match[2], 10)
let patch = parseInt(match[3], 10)

const prev = `${major}.${minor}.${patch}`
patch += 1
if (patch >= 10) {
  patch = 0
  minor += 1
}
// minor 不进位 major（major 由用户手动调整）
const next = `${major}.${minor}.${patch}`

const updated = original.replace(/"version"\s*:\s*"[^"]*"/, `"version": "${next}"`)
writeFileSync(pkgPath, updated)
console.log(`[bump-version] ${prev} → ${next}`)
