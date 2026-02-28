/**
 * 多人对战同步诊断脚本 v2
 * 直接从 Pinia store 获取信息，不依赖 window.roomManager
 */

(function() {
  console.log('\n=== 多人对战同步诊断 v2 ===\n')

  // 尝试从 Vue 3 / Nuxt 3 应用中获取 Pinia store
  const getPiniaStore = () => {
    try {
      // 方法1: 从 Nuxt 3 获取
      const nuxt = window.__NUXT__
      if (nuxt?.pinia) {
        return nuxt.pinia
      }

      // 方法2: 从 Vue 3 app 获取
      const app = document.querySelector('#__nuxt')?.__vue_app__
      if (app?.config?.globalProperties?.$pinia) {
        return app.config.globalProperties.$pinia
      }

      // 方法3: 直接查找
      const vueElement = document.querySelector('#app, #__nuxt')
      if (vueElement) {
        const vueInstance = vueElement.__vue_app__ || vueElement.__vue__
        if (vueInstance?.$pinia || vueInstance?.config?.globalProperties?.$pinia) {
          return vueInstance.$pinia || vueInstance.config.globalProperties.$pinia
        }
      }

      return null
    } catch (e) {
      console.error('获取 Pinia 失败:', e)
      return null
    }
  }

  const getGameStore = (pinia) => {
    if (!pinia) return null

    // 尝试从 pinia._s 获取 store
    if (pinia._s) {
      for (const [key, store] of pinia._s.entries()) {
        if (key === 'gameStore') {
          return store
        }
      }
    }

    return null
  }

  // 1. 获取 store
  console.log('📋 1. 获取游戏状态 store')
  const pinia = getPiniaStore()

  if (!pinia) {
    console.error('❌ 无法获取 Pinia store')
    console.log('   请确认：')
    console.log('   1. 页面已完全加载')
    console.log('   2. 已进入多人对战模式')
    console.log('   3. 应用正常初始化')
    return
  }

  console.log('✅ Pinia store 已获取')

  const store = getGameStore(pinia)
  if (!store) {
    console.error('❌ 无法获取 gameStore')
    console.log('   Pinia stores:', Array.from(pinia._s?.keys() || []))
    return
  }

  console.log('✅ gameStore 已获取')
  console.log('   Store ID:', store.$id)

  // 2. 检查角色和模式
  console.log('\n👤 2. 角色和模式检查')
  console.log('   roomMode:', store.roomMode)
  console.log('   myRole:', store.myRole)
  console.log('   myPlayerName:', store.myPlayerName)

  const roleMap = {
    null: '❌ 未设置',
    'host': '✅ 主办方',
    'player': '✅ 选手',
    'spectator': '👥 观众',
    'multiplayer': '❌ 错误：应该是 host/player'
  }

  console.log('   角色说明:', roleMap[store.myRole] || `⚠️  未知角色: ${store.myRole}`)

  if (store.myRole === null) {
    console.error('\n❌ 关键问题：myRole 为 null！')
    console.log('   这会导致同步失败')
    console.log('   请检查 RoomSetup.vue 中的 setMyIdentity 调用')
  }

  if (store.myRole === 'multiplayer') {
    console.error('\n❌ 关键问题：myRole 为 "multiplayer"！')
    console.log('   这是一个已知的 bug')
    console.log('   请检查 gameStore.js 中的 setRoomMode 函数')
  }

  // 3. 检查状态版本
  console.log('\n📊 3. 状态版本检查')
  console.log('   stateVersion:', store.stateVersion)
  console.log('   gameStatus:', store.gameStatus)
  console.log('   当前步骤:', store.currentRound?.step, '/', store.currentRound?.bpSequence?.flat()?.length)
  console.log('   当前阶段:', store.currentRound?.stage)

  // 4. 检查 BP 权限
  console.log('\n🎮 4. BP 权限检查')
  console.log('   是否我的回合:', store.isMyTurn)
  console.log('   回合描述:', store.myTurnDescription)
  console.log('   当前操作选手:', store.currentRound?.currentPlayer)
  console.log('   当前操作类型:', store.currentRound?.action)

  // 5. 检查同步状态
  console.log('\n🔄 5. 同步状态检查')
  console.log('   正在同步:', store.isSyncing)
  console.log('   同步错误:', store.syncError)
  console.log('   最后同步时间:', store.lastSyncTime ? new Date(store.lastSyncTime).toLocaleString() : '无')
  console.log('   最后同步版本:', store.lastSyncVersion)

  // 6. 检查 WebRTC 连接状态（通过查看 roomManager 的内部状态）
  console.log('\n🔗 6. WebRTC 连接状态')

  // 尝试访问导入的 roomManager 模块
  // 注意：这个需要修改代码才能访问，但我们可以尝试通过 store 间接判断
  if (store.roomMode === 'local') {
    console.log('   ⚠️  当前是本地模式，不使用 WebRTC')
  } else if (store._isSyncing) {
    console.log('   ✅ 同步监听器已启动')
    console.log('   这通常意味着 WebRTC 连接已建立')
  } else {
    console.log('   ❌ 同步监听器未启动')
    console.log('   可能的原因：')
    console.log('   1. 未进入多人对战模式')
    console.log('   2. WebRTC 连接未建立')
    console.log('   3. startStateSync() 未被调用')
  }

  // 7. 检查 Ban/Pick 状态
  console.log('\n🌱 7. 当前 BP 状态')
  console.log('   选手1 禁用:', store.currentRound?.bans?.player1 || [])
  console.log('   选手2 禁用:', store.currentRound?.bans?.player2 || [])
  console.log('   选手1 选择:', store.currentRound?.picks?.player1 || [])
  console.log('   选手2 选择:', store.currentRound?.picks?.player2 || [])
  console.log('   全局禁用:', store.globalBans || [])

  // 8. 暴露到 window 以便进一步调试
  console.log('\n🛠️  8. 调试工具')
  window.$debugStore = store
  window.$debugPinia = pinia

  console.log('   已将 store 暴露到 window.$debugStore')
  console.log('   已将 pinia 暴露到 window.$debugPinia')
  console.log('   你可以在控制台中使用这些变量进行深入调试')

  // 9. 手动触发同步
  window.$testSync = () => {
    console.log('\n=== 手动触发同步 ===')
    console.log('同步前状态版本:', window.$debugStore.stateVersion)

    const before = window.$debugStore.stateVersion
    window.$debugStore.syncState()

    setTimeout(() => {
      console.log('同步后状态版本:', window.$debugStore.stateVersion)
      console.log('版本变化:', window.$debugStore.stateVersion - before)

      if (window.$debugStore.stateVersion > before) {
        console.log('✅ 状态版本已增加')
        console.log('   请检查其他客户端是否收到更新')
      } else {
        console.warn('⚠️  状态版本未增加')
      }
    }, 100)
  }

  console.log('   使用 $testSync() 手动触发同步测试')

  // 10. 监听状态变化
  console.log('\n🔍 11. 实时监控')
  console.log('   启动实时状态监控...')

  let lastVersion = store.stateVersion
  const monitorInterval = setInterval(() => {
    if (store.stateVersion !== lastVersion) {
      const timestamp = new Date().toLocaleTimeString()
      console.log(`[${timestamp}] 📢 状态版本变化: v${lastVersion} → v${store.stateVersion}`)
      console.log(`   gameStatus: ${store.gameStatus}`)
      console.log(`   当前步骤: ${store.currentRound?.step}`)
      console.log(`   当前操作选手: ${store.currentRound?.currentPlayer}`)

      lastVersion = store.stateVersion
    }
  }, 500)

  window.$stopMonitor = () => {
    clearInterval(monitorInterval)
    console.log('监控已停止')
  }

  console.log('   使用 $stopMonitor() 停止监控')

  // 11. 诊断总结
  console.log('\n✨ 12. 诊断总结')

  const issues = []

  if (store.roomMode === 'local') {
    issues.push('⚠️  当前是本地模式，不测试多人同步')
  } else {
    if (store.myRole === null || store.myRole === 'multiplayer') {
      issues.push('❌ myRole 设置错误：' + store.myRole)
    }

    if (!store._isSyncing) {
      issues.push('❌ 同步监听器未启动')
    }

    if (store.stateVersion === 0) {
      issues.push('⚠️  状态版本为 0（可能还没有同步过）')
    }
  }

  if (issues.length === 0) {
    console.log('✅ 所有关键检查通过！')
    console.log('   现在可以：')
    console.log('   1. 在一个客户端执行 BP 操作')
    console.log('   2. 观察控制台的实时监控输出')
    console.log('   3. 检查其他客户端是否收到更新')
  } else {
    console.log('⚠️  发现以下问题：')
    issues.forEach(issue => console.log('   ' + issue))
    console.log('\n💡 修复建议：')
    if (store.myRole === null || store.myRole === 'multiplayer') {
      console.log('   1. 刷新页面重新连接')
      console.log('   2. 检查是否已应用最新的代码修复')
      console.log('   3. 检查 RoomSetup.vue 的 setMyIdentity 调用')
    }
  }

  console.log('\n=== 诊断完成 ===\n')
})()
