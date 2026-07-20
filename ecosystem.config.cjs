// PM2 进程配置 —— 显式声明 bp-server 的启动方式与环境变量
//
// 为什么需要这个文件：
// PM2 默认会把"执行 pm2 命令那个 shell 的全部环境变量"继承给被托管进程并快照进
// dump.pm2。曾因此把 ANTHROPIC_AUTH_TOKEN / ANTHROPIC_BASE_URL / VSCODE_* 等
// 无关会话变量泄露进 dump.pm2（本机 root 可读，属隐患）。
// 本文件只显式注入 bp-server 真正需要的变量，其余一律不继承。
//
// 密钥来源：从 .env.local（已 gitignore）解析读取，不硬编码、不进仓库。
// 启动：pm2 start ecosystem.config.js && pm2 save

const fs = require('fs');
const path = require('path');

// 解析 KEY=VALUE 文件（支持 # 注释、可选引号）
function loadEnvFile(file) {
  const out = {};
  let txt;
  try {
    txt = fs.readFileSync(file, 'utf8');
  } catch {
    return out;
  }
  for (const line of txt.split('\n')) {
    if (line.trim().startsWith('#') || !line.trim()) continue;
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

const local = loadEnvFile(path.join(__dirname, '.env.local'));

if (!local.WEBHOOK_SECRET) {
  console.warn('[ecosystem] ⚠️ .env.local 未找到 WEBHOOK_SECRET，webhook 自动部署将无法校验签名');
}

module.exports = {
  apps: [
    {
      name: 'bp-server',
      script: path.join(__dirname, 'server', 'index.js'),
      cwd: path.join(__dirname, 'server'),
      exec_mode: 'cluster',   // 与原配置一致（cluster_mode, 单实例）
      instances: 1,
      max_memory_restart: '200M',
      autorestart: true,
      // 关键：只注入这三个，杜绝会话 env 混入
      env: {
        NODE_ENV: 'production',
        PORT: local.PORT || 8080,
        WEBHOOK_SECRET: local.WEBHOOK_SECRET || ''
      }
    }
  ]
};
