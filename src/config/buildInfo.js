/**
 * 构建期注入的应用版本信息（由 vite.config.js 的 define 注入）
 *
 * - APP_VERSION：语义版本，单一事实来源为 package.json 的 version 字段
 * - APP_GIT_HASH：构建时当前 git commit 短 hash，每次自动部署（auto-deploy.sh 在
 *   `git merge --ff-only` 之后 build）自动变化
 *
 * 用途：footer 显示「vX.Y.Z · abc1234」，git hash 让用户一眼确认 webhook 自动部署是否生效。
 */
/* global __APP_VERSION__, __APP_GIT_HASH__ */
export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0'
export const APP_GIT_HASH = typeof __APP_GIT_HASH__ !== 'undefined' ? __APP_GIT_HASH__ : 'unknown'
