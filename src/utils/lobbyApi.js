/**
 * 公共房间目录服务（lobby）HTTP 封装
 *
 * 配合 server/lobby-server.js 使用。lobby 只维护「公共房间目录」，房间内的 P2P 数据
 * 传输仍由 roomManager（PeerJS）处理。本模块仅负责：登记公开房间 / 查询列表 / 房主心跳 / 注销房间。
 *
 * 设计原则：lobby 是「可选增强层」。任何调用失败都不应阻断已建立的 P2P 房间——
 * 调用方需自行 try/catch 并给出非阻断提示（登记失败 → 房间退化为私密，仍可用邀请码）。
 */
import axios from 'axios'
import networkConfig from '@/config/network.config'

const cfg = networkConfig.lobby

// dev 环境默认走 vite 的 /lobby proxy（指向本地 lobby 实例），可用 VITE_LOBBY_BASE 覆盖；
// 生产环境直接用配置的 baseUrl（https://okjjko.top/lobby）
const baseURL = import.meta.env.DEV
  ? (import.meta.env.VITE_LOBBY_BASE || '/lobby')
  : cfg.baseUrl

const client = axios.create({
  baseURL,
  timeout: 8000,
  headers: { 'Content-Type': 'application/json' }
})

/**
 * 登记公开房间（房主 createRoom 成功后调用）
 * @returns {Promise<{ok:boolean, inviteCode:string, hostSecret:string, createdAt:number}>}
 */
export async function registerRoom(inviteCode, hostName) {
  const { data } = await client.post('/rooms', { inviteCode, hostName })
  return data
}

/**
 * 查询公共房间列表
 * @returns {Promise<{ok:boolean, rooms:Array, serverTime:number}>}
 */
export async function listRooms() {
  const { data } = await client.get('/rooms')
  return data
}

/**
 * 房主心跳保活（上报当前人数）
 * @param {string} inviteCode
 * @param {string} hostSecret registerRoom 返回的凭证
 * @param {{playerCount:number, spectatorCount:number}} counts
 */
export async function heartbeat(inviteCode, hostSecret, counts) {
  const { data } = await client.post(`/rooms/${inviteCode}/heartbeat`, counts, {
    headers: { 'X-Host-Secret': hostSecret }
  })
  return data
}

/**
 * 注销房间（房主解散/离开时调用）
 * 房间可能已被服务端过期清理，404 静默处理；其他错误仅告警，不抛出（避免阻塞离开流程）
 */
export async function unregisterRoom(inviteCode, hostSecret) {
  try {
    await client.delete(`/rooms/${inviteCode}`, {
      headers: { 'X-Host-Secret': hostSecret }
    })
  } catch (e) {
    if (e.response && e.response.status !== 404) {
      console.warn('[lobby] 注销失败:', e.message)
    }
  }
}

export default { registerRoom, listRooms, heartbeat, unregisterRoom }
