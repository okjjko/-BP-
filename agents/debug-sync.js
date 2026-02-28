/**
 * 多人对战同步快速诊断脚本
 *
 * 使用方法：
 * 1. 打开浏览器控制台（F12）
 * 2. 粘贴此脚本并回车
 * 3. 脚本会自动检测并报告同步状态
 */

(function() {
  console.log('\n=== 多人对战同步诊断开始 ===\n')

  // 辅助函数：获取全局变量
  const getStore = () => {
    // 尝试多种方式获取 store
    return window.__NUXT__?.pinia?.gameStore ||
           window.$nuxt?.$pinia?.gameStore ||
           window.Vue?.config?.globalProperties?.$pinia?.gameStore
  }

  const getRoomManager = () => {
    return window.roomManager
  }

  // 1. 基础信息检查
  console.log('📋 1. 基础信息检查')
  const store = getStore()
  const roomManager = getRoomManager()

  if (!store) {
    console.error('❌ 无法获取 gameStore')
    console.log('   可能原因：页面未完全加载或应用初始化失败')
    return
  }

  if (!roomManager) {
    console.error('❌ 无法获取 roomManager')
    console.log('   可能原因：未进入多人对战模式')
    return
  }

  console.log('✅ gameStore 和 roomManager 已加载')

  // 2. 角色检查
  console.log('\n👤 2. 角色检查')
  console.log('   myRole:', store.myRole)
  console.log('   roomMode:', store.roomMode)

  if (store.myRole === 'host') {
    console.log('✅ 你是主办方')
  } else if (store.myRole === 'player') {
    console.log('✅ 你是选手')
  } else if (store.myRole === null) {
    console.warn('⚠️  myRole 为 null')
    console.log('   这可能导致同步失败！')
  } else {
    console.warn('⚠️  myRole 值异常:', store.myRole)
  }

  // 3. 连接检查
  console.log('\n🔗 3. WebRTC 连接检查')
  console.log('   连接数量:', roomManager.connections?.size || 0)

  if (roomManager.connections?.size > 0) {
    console.log('✅ 已建立连接')
    roomManager.connections.forEach((conn, peerId) => {
      console.log(`   - ${peerId}: open=${conn.open}`)
    })
  } else {
    console.error('❌ 没有建立任何连接')
    console.log('   请确认：')
    console.log('   1. 是否已创建/加入房间？')
    console.log('   2. 其他客户端是否已连接？')
    console.log('   3. 网络连接是否正常？')
  }

  // 4. 状态版本检查
  console.log('\n📊 4. 状态版本检查')
  console.log('   stateVersion:', store.stateVersion)
  console.log('   gameStatus:', store.gameStatus)
  console.log('   当前步骤:', store.currentRound?.step)
  console.log('   当前阶段:', store.currentRound?.stage)

  // 5. 事件监听器检查
  console.log('\n🎧 5. 事件监听器检查')
  const listenerCount = roomManager.eventHandlers?.size || 0
  console.log('   已注册事件处理器:', listenerCount)

  if (listenerCount === 0) {
    console.warn('⚠️  没有注册事件处理器')
    console.log('   这可能导致无法接收同步消息！')
  } else {
    console.log('✅ 事件监听器已注册')
    roomManager.eventHandlers.forEach((handlers, event) => {
      console.log(`   - ${event}: ${handlers.length} 个处理器`)
    })
  }

  // 6. 实时监控设置
  console.log('\n🔍 6. 实时监控设置')
  console.log('   现在开始监控同步消息...')

  // 保存原始的 setupConnectionHandlers
  const originalSetup = roomManager.setupConnectionHandlers.bind(roomManager)

  // 重新设置连接处理器以添加日志
  roomManager.connections.forEach((conn, peerId) => {
    conn.off('data') // 移除旧的监听器

    conn.on('data', (data) => {
      const timestamp = new Date().toLocaleTimeString()
      console.log(`[${timestamp}] 🔔 收到消息:`, data.type)

      if (data.type === 'stateUpdate') {
        console.log(`   版本: v${data.version}`)
        console.log(`   发送者: ${data.senderRole}`)
        console.log(`   发送者ID: ${data.senderId}`)

        // 检查 store 是否会处理这个更新
        const store = getStore()
        if (data.version > store.stateVersion) {
          console.log('   ✅ 这个更新会被应用（新版本）')
        } else {
          console.log('   ⚠️  这个更新会被忽略（旧版本）')
        }
      }
    })
  })

  console.log('✅ 监控已启动，现在执行一些 BP 操作来观察同步')

  // 7. 测试同步按钮
  console.log('\n🧪 7. 手动测试同步')
  console.log('   在控制台输入 testSync() 来手动触发同步测试')

  window.testSync = () => {
    const store = getStore()
    const roomManager = getRoomManager()

    console.log('\n=== 手动同步测试 ===')
    console.log('同步前状态版本:', store.stateVersion)

    const beforeVersion = store.stateVersion

    // 触发同步
    store.syncState()

    setTimeout(() => {
      console.log('同步后状态版本:', store.stateVersion)
      console.log('版本变化:', store.stateVersion - beforeVersion)

      if (store.stateVersion > beforeVersion) {
        console.log('✅ 本地状态版本已增加')
        console.log('   请检查其他客户端是否收到更新')
      } else {
        console.warn('⚠️  状态版本未增加')
        console.log('   可能是 syncState() 函数有问题')
      }
    }, 100)
  }

  // 8. 健康检查总结
  console.log('\n✨ 8. 健康检查总结')

  const issues = []

  if (store.myRole === null || store.myRole === 'multiplayer') {
    issues.push('❌ myRole 未正确设置')
  }

  if (!roomManager.connections || roomManager.connections.size === 0) {
    issues.push('❌ 没有建立 WebRTC 连接')
  }

  if (store.stateVersion === 0) {
    issues.push('⚠️  状态版本为 0（可能还没有同步过）')
  }

  if (issues.length === 0) {
    console.log('✅ 所有关键检查通过！')
    console.log('   同步系统看起来正常，现在可以：')
    console.log('   1. 在一个客户端执行 BP 操作')
    console.log('   2. 观察控制台输出的同步消息')
    console.log('   3. 检查其他客户端是否收到更新')
  } else {
    console.log('⚠️  发现以下问题：')
    issues.forEach(issue => console.log('   ' + issue))
    console.log('\n请参考《多人对战同步诊断指南.md》进行修复')
  }

  console.log('\n=== 诊断完成 ===\n')
})()
