// 同时启动 ws hub(:8080) + vite 前端(:3000)，供 playwright webServer / 本地联调用。
// 用 node child_process 拉起两个子进程，绕开 concurrently 在 Windows 下的引号问题。
// 退出时清理子进程。端口可用环境变量覆盖。
import { spawn } from 'node:child_process'

const PORT = process.env.PORT || '8080'
const children = []

function spawnCmd(cmd, args, opts = {}) {
  const c = spawn(cmd, args, { stdio: 'inherit', shell: true, ...opts })
  children.push(c)
  c.on('exit', (code) => {
    if (code != null && code !== 0) console.warn(`[dev-all] ${cmd} ${args.join(' ')} 退出码 ${code}`)
  })
  return c
}

// 先起 server（无编译，秒起），再起 vite（需编译，稍慢）；vite 就绪时 server 早已就绪
spawnCmd('node', ['server/index.js'], { env: { ...process.env, PORT } })
spawnCmd('npx', ['vite'])

function killAll() {
  children.forEach((c) => { try { c.kill() } catch (_) { /* ignore */ } })
  setTimeout(() => process.exit(0), 100)
}
process.on('SIGTERM', killAll)
process.on('SIGINT', killAll)
