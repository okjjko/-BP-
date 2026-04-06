# BP图形化工具 - PlantUML 软件建模文档

> 生成时间: 2026-04-02
> 技术栈: Vue 3 + Pinia + PeerJS + IndexedDB

---

## 图表索引

| # | 文件名 | 图表类型 | 说明 |
|---|--------|----------|------|
| 1 | [01-use-case.puml](01-use-case.puml) | 用例图 | 展示选手、主办方、观众、管理员的功能需求 |
| 2 | [02-class-diagram.puml](02-class-diagram.puml) | 类图 | Vue组件、Pinia Store、数据模型、工具层的完整结构 |
| 3 | [03-sequence-init-game.puml](03-sequence-init-game.puml) | 序列图 | 游戏初始化流程（本地/多人模式） |
| 4 | [04-sequence-bp-action.puml](04-sequence-bp-action.puml) | 序列图 | Ban/Pick操作流程，含南瓜头特殊规则 |
| 5 | [05-sequence-multiplayer-sync.puml](05-sequence-multiplayer-sync.puml) | 序列图 | 多人模式状态同步（WebRTC） |
| 6 | [06-communication-diagram.puml](06-communication-diagram.puml) | 协作图 | 站位阶段对象间的协作关系 |
| 7 | [07-state-diagram.puml](07-state-diagram.puml) | 状态图 | 游戏状态转换（setup→banning→positioning→result→finished） |
| 8 | [08-game-state-machine.puml](08-game-state-machine.puml) | 状态机 | 5个核心状态及BP20步详细流转 |
| 9 | [09-multiplayer-turn-based.puml](09-multiplayer-turn-based.puml) | 时序图 | 多人模式回合制操作权限切换 |
| 10 | [10-data-flow-diagram.puml](10-data-flow-diagram.puml) | 数据流图 | 植物选择验证的数据流向 |
| 11 | [11-design-patterns.puml](11-design-patterns.puml) | 设计模式 | 观察者模式（状态同步）+ 策略模式（BP规则） |

---

## 如何预览

### 在线预览
将任意 `.puml` 文件内容复制到 [PlantUML在线编辑器](http://www.plantuml.com/plantuml/)

### VS Code
安装 "PlantUML" 插件，打开 `.puml` 文件后按 `Alt+D` 预览

### 命令行
```bash
# 需要先安装 PlantUML
plantuml docs/*.puml
```

---

## 快速参考

### BP序列（20步）
```
Stage1 (禁用):  road2 → road4 → road2 → road4
Stage2 (选择):  road2 → road4 → road4 → road2 → road2 → road4
Stage3 (禁用):  road4 → road2 → road4 → road2 → road4 → road2
Stage4 (选择):  road4 → road2 → road2 → road4
```

### 游戏状态
| 状态 | 说明 |
|------|------|
| setup | 输入选手信息，选择道路 |
| banning | 执行20步Ban/Pick操作 |
| positioning | 拖拽植物到战场站位 |
| result | 选择本局胜者，更新分数 |
| finished | 先到4分者获胜 |

### 特殊规则
- **南瓜头保护**: 选择南瓜头不消耗BP步骤，下一个选择获得保护
- **使用次数限制**: 每个植物每局最多使用2次
- **败者选路权**: 下一局败者选择道路

### 未实现功能
- ⚠️ 巅峰对决模式（3:3平局触发）
