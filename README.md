# 植物大战僵尸 BP 对战辅助工具

一个用于管理植物大战僵尸改版 Ban/Pick（BP）对战的 Web 工具。支持完整的 4 阶段 BP 流程、多人实时同步、自定义规则与植物库，面向比赛裁判与选手的实战使用。

当前版本：**v3.2.2**（footer 显示 `v{version} · {git短hash}`，用于确认部署是否生效）。

---

## 功能特性

**BP 流程**
- 标准 4 阶段 20 步流程（4 ban + 6 pick + 6 ban + 4 pick），顺序模板可自定义
- **动态二路/四路映射**：BP 顺序基于「二路/四路」而非固定 player1/player2，谁选哪条路就对应哪一方
- 同一小局内同一植物可选多次（默认上限 2，可配）；对手已选的植物不可选
- 败者选路权（可配为败者选 / 胜者选 / 不换边）
- 大局获胜所需小局数开局可配（下拉 1~7，**默认 4**），率先达成者赢得大局

**多人对战（中心化 WebSocket）**
- host / 选手 / 观众三种角色，邀请码房间
- 断线重连身份自愈（本地推导 + host 补发双通道，无需持久化身份）
- 公共房间目录（lobby），可登记并一键加入
- host 可兼任其中一名选手（2 人即可开局）
- 24 小时内自动重连会话

**裁判工具**
- **通用撤销栈**：BP 流程内所有操作（ban / pick / 南瓜 / 手动抽取永禁）均可撤销，解决「点错只能整局重来」
- 全局永久禁用三种来源：开局随机抽取（默认 5 个，可配）、BP 流程内预设步骤自动抽取、局内裁判手动抽取
- 每步操作自动保存到 localStorage

**自定义**
- 阵营名称、选边方式、BP 顺序模板、植物使用上限、南瓜开关、随机禁用数量——集中存于 `ruleConfig`，支持赛前与比赛预设
- **比赛预设**：植物卡组 + BP 规则的整包配置，可保存多套并切换；内置不可删的「默认预设」
- **自定义植物**：通过「配置管理」弹窗增删改，图片存 IndexedDB，支持 JSON 导入导出

**体验**
- Toast / Confirm 应用内通知（替代 `alert/confirm`）
- 移动端 / 桌面端响应式布局
- ban/pick 飞行动效（遵循 `prefers-reduced-motion`）

---

## 快速开始

```bash
# 安装依赖（首次）
npm install

# 一键启动开发环境（vite:3000 前端 + ws server:8080 后端，多人对战需两者同时运行）
npm run dev
```

启动后访问 <http://localhost:3000>。

> 关闭开发服务器：在运行 `npm run dev` 的终端按 `Ctrl + C`。

### 常用脚本

| 命令 | 说明 |
|---|---|
| `npm run dev` | 一键启动前端 (3000) + ws 后端 (8080) |
| `npm run dev:web` | 仅前端（vite:3000） |
| `npm run dev:server` | 仅后端（ws:8080，不运行则创建房间报 ECONNREFUSED） |
| `npm run build` | 构建生产产物到 `dist/` |
| `npm run preview` | 预览生产构建 |
| `npm run test:unit:run` | 单元测试（vitest，多人逻辑回归主力，单次运行） |
| `npm run test:multiplayer:headed` | 多人同步 E2E（Playwright，有头模式） |
| `npm run test:agents` | Agent 架构自动化测试套件 |

> **端口占用**：若 3000 被占用，Windows 用 `netstat -ano | findstr ":3000" | findstr LISTENING` 查 PID 后 `taskkill /PID <PID> /F`；Linux/Mac 用 `lsof -i :3000` 后 `kill -9 <PID>`。不要同时启动多个 dev server。

---

## 项目结构

```
bp-plant-war/
├── src/
│   ├── App.vue                      # 根组件（路由 transition 注意事项见 AGENTS.md）
│   ├── main.js
│   ├── router/                      # vue-router 路由表
│   ├── views/
│   │   └── BanPickView.vue          # BP 对局主视图
│   ├── stores/                      # Pinia 状态
│   │   ├── gameStore.js             # 游戏核心状态（BP 流程/计分/撤销/持久化/同步）
│   │   ├── connectionStore.js       # 多人连接/身份/回合判定/重连自愈
│   │   └── uiStore.js
│   ├── components/
│   │   ├── GameSetup.vue            # 本地对战初始化（选手/选路/规则）
│   │   ├── RoomSetup.vue            # 多人房间创建/加入/重连
│   │   ├── PlantSelector.vue        # 植物选择网格
│   │   ├── BanArea.vue / PickArea.vue
│   │   ├── StageIndicator.vue       # 阶段/步骤指示器
│   │   ├── PlayerInfo.vue / RoundResult.vue / PositionSetup.vue
│   │   ├── PlantManager/            # 配置管理弹窗（植物库 + 比赛预设）
│   │   ├── RulesEditor/             # 规则编辑器（SideRules / BPRules）
│   │   ├── ui/                      # 共享基座（BaseButton/BaseDialog/Toast/Confirm）
│   │   ├── animation/               # 飞行动效
│   │   └── dev/                     # 多客户端模拟面板（仅 dev）
│   ├── composables/                 # useToast/useConfirm/useBreakpoint/usePumpkin 等
│   ├── config/
│   │   ├── defaultRules.js          # 聚合 rules/ 子文件，规则默认值单一事实来源
│   │   ├── rules/                   # 各规则默认值子文件（新增配置项改这里）
│   │   ├── network.config.js        # ws/lobby 连接地址
│   │   └── buildInfo.js             # 版本号/hash 注入封装
│   ├── data/                        # plants / customPlants(IndexedDB) / plantConfigs(预设)
│   ├── utils/                       # bpRules / validators / roomManager(ws) / lobbyApi
│   └── ...
├── server/                          # 中心化 ws 后端（单进程三合一）
│   ├── index.js                     # ws hub + lobby HTTP + 静态托管 + webhook 部署
│   └── lobby-server.js
├── agents/                          # Agent 架构测试（Playwright）
├── docs/                            # 协议契约 / 部署 / 规划 / TODO
├── scripts/                         # auto-deploy.sh / 版本号 bump / hooks 安装
├── .githooks/                       # pre-commit 自动 bump 版本号
└── ecosystem.config.cjs             # PM2 进程配置
```

---

## 游戏流程

1. **初始化**：输入两名选手名，选择开局道路（一人 2 路、一人 4 路），系统随机永久禁用若干植物（默认 5 个），设置大局获胜所需小局数（默认 4）
2. **BP 阶段**：按 4 阶段 20 步顺序交替 ban/pick；南瓜头在 pick 阶段不消耗步数；任何操作可撤销
3. **站位设置**：在所选道路上摆放植物（1~5 号位）
4. **小局结算**：选择获胜选手，按选边规则进入下一小局
5. **大局结束**：一方累计达成约定小局数即赢得大局

> 详细规则实现、架构决策与扩展约定见 [`AGENTS.md`](AGENTS.md)（同时是 AI 编码助手的项目主指令）。

---

## 数据持久化

- 游戏进度自动保存到浏览器 localStorage，刷新后自动恢复
- 自定义植物存 IndexedDB（图片为 Blob）
- 「重置游戏」清空对局进度，但**保留当前应用的 BP/规则配置（`ruleConfig`）**，下一局沿用同一套规则
- 清空浏览器数据会丢失以上全部本地状态

---

## 部署

生产部署为**单 Node 进程 + nginx TLS 终止**：Node 同时提供 ws hub、lobby HTTP、静态前端托管与 SPA fallback；nginx 终止 TLS 并反代 `/ws` 到 Node。支持 GitHub/GitLab webhook 签名校验后自动部署（`git fetch → ff-only merge → build → PM2 重启`）。

完整步骤见：
- [`docs/SERVER-SETUP.md`](docs/SERVER-SETUP.md) — 服务器部署（Node + PM2 + nginx + Let's Encrypt）
- [`docs/AUTO-DEPLOY.md`](docs/AUTO-DEPLOY.md) — webhook 自动部署配置
- [`docs/network-protocol.md`](docs/network-protocol.md) — ws 协议契约（冻结）

> 8080 端口不对公网开放，仅本机 nginx 访问。不再需要 PeerJS / coturn / TURN（2026-07 已从 P2P 重构为中心化架构）。

---

## 浏览器兼容

推荐最新版 Chrome / Firefox / Edge / Safari（需 ES6+、WebSocket、IndexedDB、localStorage）。

---

## 注意事项与待办

- ⚠️ **巅峰对决模式（3:3 决胜）暂未实现**，遇到此情况需手动处理
- ⚠️ 站位阶段的「副C/大C」规则校验待完善（`validators.validatePosition` 目前只校验道路与数量）
- 完整待办清单见 [`docs/TODO.md`](docs/TODO.md)

---

## 技术栈

- **前端**：Vue 3 + Pinia + Vue Router + Vite + Tailwind CSS，图标 lucide-vue-next，拖拽 vuedraggable
- **后端**：Node.js + ws（唯一运行时依赖）
- **测试**：vitest（单元）+ Playwright（E2E / 多人同步）
- **部署**：PM2 + nginx + webhook 自动部署

---

## 相关文档

- [`AGENTS.md`](AGENTS.md) — AI 编码助手项目主指令（架构/约定/规则实现，详尽）
- [`docs/`](docs) — 协议契约、部署、规划与 TODO

如有问题或建议，B 站同名联系。
