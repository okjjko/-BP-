/**
 * 通用诊断脚本 - 尝试多种方式获取 store
 */

(function() {
  console.log('\n=== 多人对战同步诊断（通用版）===\n')

  // 尝试多种方式获取 Pinia
  let pinia = null
  let accessMethod = ''

  // 方法1: 尝试从 __NUXT__ 获取
  if (window.__NUXT__?.pinia) {
    pinia = window.__NUXT__.pinia
    accessMethod = 'window.__NUXT__.pinia'
    console.log('✅ 方法1成功: window.__NUXT__.pinia')
  }

  // 方法2: 尝试从 #__nuxt 的 Vue app 获取
  if (!pinia) {
    try {
      const nuxtEl = document.querySelector('#__nuxt')
      if (nuxtEl) {
        const app = nuxtEl.__vue_app__ || nuxtEl.__vue__
        if (app?.config?.globalProperties?.$pinia) {
          pinia = app.config.globalProperties.$pinia
          accessMethod = '#__nuxt.__vue_app__.$pinia'
          console.log('✅ 方法2成功: #__nuxt Vue app')
        } else if (app?.$pinia) {
          pinia = app.$pinia
          accessMethod = '#__nuxt.__vue__.$pinia'
          console.log('✅ 方法2成功: #__nuxt.__vue__.$pinia')
        }
      }
    } catch (e) {
      console.log('❌ 方法2失败:', e.message)
    }
  }

  // 方法3: 尝试从 #app 获取
  if (!pinia) {
    try {
      const appEl = document.querySelector('#app')
      if (appEl) {
        const app = appEl.__vue_app__ || appEl.__vue__
        if (app?.config?.globalProperties?.$pinia) {
          pinia = app.config.globalProperties.$pinia
          accessMethod = '#app Vue app'
          console.log('✅ 方法3成功: #app Vue app')
        } else if (app?.$pinia) {
          pinia = app.$pinia
          accessMethod = '#app.__vue__.$pinia'
          console.log('✅ 方法3成功: #app.__vue__.$pinia')
        }
      }
    } catch (e) {
      console.log('❌ 方法3失败:', e.message)
    }
  }

  // 方法4: 尝试遍历所有可能的元素
  if (!pinia) {
    const elements = document.querySelectorAll('[id*="app"], [id*="nuxt"], [class*="vue"]')
    console.log(`🔍 方法4: 检查 ${elements.length} 个可能包含 Vue 实例的元素...`)

    for (let i = 0; i < elements.length; i++) {
      try {
        const el = elements[i]
        const app = el.__vue_app__ || el.__vue__
        if (app?.config?.globalProperties?.$pinia) {
          pinia = app.config.globalProperties.$pinia
          accessMethod = `元素[${i}].$pinia`
          console.log(`✅ 方法4成功: 找到第 ${i} 个元素`)
          break
        }
      } catch (e) {
        // 忽略错误，继续尝试
      }
    }
  }

  // 方法5: 直接查找 gameStore
  if (!pinia) {
    console.log('🔍 方法5: 尝试直接查找 gameStore...')
    try {
      // 检查 window 上是否有直接暴露的 store
      if (window.gameStore) {
        console.log('✅ 方法5成功: window.gameStore')
        console.log('\n=== 直接使用 window.gameStore ===\n')

        const store = window.gameStore
        console.log('roomMode:', store.roomMode)
        console.log('myRole:', store.myRole)
        console.log('stateVersion:', store.stateVersion)
        console.log('当前步骤:', store.currentRound?.step)

        if (store.myRole === null || store.myRole === 'multiplayer') {
          console.error('❌ myRole 设置错误:', store.myRole)
        } else if (store._isSyncing) {
          console.log('✅ 同步系统已启动')
        } else {
          console.error('❌ 同步系统未启动')
        }

        // 暴露到全局以便调试
        window.$debugStore = store
        console.log('\n已将 store 暴露到 window.$debugStore')
        console.log('你可以在控制台输入 $debugStore 来访问它')

        return
      }
    } catch (e) {
      console.log('❌ 方法5失败:', e.message)
    }
  }

  // 如果还是找不到，提供调试建议
  if (!pinia) {
    console.error('\n❌ 无法获取 Pinia store')
    console.log('\n🔍 调试建议：')
    console.log('1. 确认页面已完全加载（等待几秒后再试）')
    console.log('2. 确认已进入多人对战模式')
    console.log('3. 尝试在控制台输入以下命令查找 store：')
    console.log('   - window.__NUXT__')
    console.log('   - document.querySelector("#__nuxt").__vue_app__')
    console.log('   - document.querySelector("#app").__vue__')

    // 尝试显示可用的全局对象
    console.log('\n📋 可用的全局对象：')
    console.log('window.__NUXT__ 存在:', !!window.__NUXT__)
    console.log('window.Vue 存在:', !!window.Vue)
    console.log('window.Pinia 存在:', !!window.Pinia)
    console.log('#__nuxt 元素存在:', !!document.querySelector('#__nuxt'))
    console.log('#app 元素存在:', !!document.querySelector('#app'))

    // 检查#__nuxt 元素的属性
    const nuxtEl = document.querySelector('#__nuxt')
    if (nuxtEl) {
      console.log('\n#__nuxt 元素属性：')
      console.log('  __vue_app__:', !!nuxtEl.__vue_app__)
      console.log('  __vue__:', !!nuxtEl.__vue__)
      if (nuxtEl.__vue_app__) {
        console.log('  config.globalProperties.$pinia:', !!nuxtEl.__vue_app__.config?.globalProperties?.$pinia)
      }
    }

    return
  }

  // 成功获取 Pinia
  console.log(`\n✅ 成功通过 ${accessMethod} 获取 Pinia`)

  // 获取 gameStore
  let store = null
  if (pinia._s) {
    store = pinia._s.get('gameStore')
    if (store) {
      console.log('✅ 从 pinia._s 获取 gameStore')
    } else {
      console.log('⚠️  pinia._s 中没有 gameStore')
      console.log('   可用的 stores:', Array.from(pinia._s.keys()))
    }
  }

  if (!store) {
    // 尝试直接从 state 获取
    if (pinia.state?.value) {
      const state = pinia.state.value
      console.log('pinia.state.value 中的 keys:', Object.keys(state))

      if (state.gameStore) {
        console.log('✅ 从 pinia.state.value.gameStore 获取')
        store = state.gameStore
      }
    }
  }

  if (!store) {
    console.error('\n❌ 无法获取 gameStore')
    console.log('   但是 Pinia 已经找到了，请检查 store 的 ID')
    return
  }

  console.log('\n=== gameStore 信息 ===\n')

  // 显示关键信息
  console.log('📊 基本信息:')
  console.log('   roomMode:', store.roomMode)
  console.log('   myRole:', store.myRole)
  console.log('   myPlayerName:', store.myPlayerName)
  console.log('   stateVersion:', store.stateVersion)
  console.log('   gameStatus:', store.gameStatus)
  console.log('   当前步骤:', store.currentRound?.step)
  console.log('   _isSyncing:', store._isSyncing)

  // 检查角色
  console.log('\n👤 角色检查:')
  if (store.myRole === null) {
    console.error('   ❌ myRole 为 null！这会导致同步失败')
  } else if (store.myRole === 'multiplayer') {
    console.error('   ❌ myRole 为 "multiplayer"！这是一个已知 bug')
  } else if (store.myRole === 'host') {
    console.log('   ✅ 角色: 主办方')
  } else if (store.myRole === 'player') {
    console.log('   ✅ 角色: 选手')
  } else {
    console.warn('   ⚠️  未知角色:', store.myRole)
  }

  // 检查同步状态
  console.log('\n🔄 同步检查:')
  if (store._isSyncing) {
    console.log('   ✅ 同步监听器已启动')
  } else {
    console.error('   ❌ 同步监听器未启动')
    console.log('   可能的原因：')
    console.log('   - 未调用 startStateSync()')
    console.log('   - WebRTC 连接未建立')
    console.log('   - 仍在本地模式')
  }

  // 检查 BP 状态
  console.log('\n🎮 BP 状态:')
  console.log('   是否我的回合:', store.isMyTurn)
  console.log('   当前操作选手:', store.currentRound?.currentPlayer)
  console.log('   当前操作类型:', store.currentRound?.action)

  // 暴露到全局
  window.$debugStore = store
  window.$debugPinia = pinia

  console.log('\n🛠️  调试工具:')
  console.log('   已暴露到 window.$debugStore')
  console.log('   已暴露到 window.$debugPinia')
  console.log('   使用 $debugStore 访问 store')
  console.log('   使用 $debugPinia 访问 pinia')

  // 提供手动同步测试
  window.$testSync = () => {
    console.log('\n=== 手动同步测试 ===')
    const before = window.$debugStore.stateVersion
    console.log('同步前版本:', before)

    window.$debugStore.syncState()

    setTimeout(() => {
      const after = window.$debugStore.stateVersion
      console.log('同步后版本:', after)
      console.log('版本变化:', after - before)

      if (after > before) {
        console.log('✅ 版本已增加')
      } else {
        console.warn('⚠️  版本未增加')
      }
    }, 100)
  }

  console.log('   使用 $testSync() 手动触发同步')

  // 总结
  console.log('\n✨ 诊断总结:')
  const issues = []

  if (store.roomMode === 'local') {
    issues.push('⚠️  当前是本地模式，不使用多人同步')
  } else {
    if (store.myRole === null || store.myRole === 'multiplayer') {
      issues.push('❌ myRole 设置错误: ' + store.myRole)
    }
    if (!store._isSyncing) {
      issues.push('❌ 同步监听器未启动')
    }
  }

  if (issues.length === 0) {
    console.log('✅ 所有关键检查通过！')
    console.log('   现在可以执行 BP 操作，观察控制台日志')
  } else {
    console.log('⚠️  发现问题:')
    issues.forEach(issue => console.log('   ' + issue))
  }

  console.log('\n=== 诊断完成 ===\n')
})()
