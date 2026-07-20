/**
 * 植物缓存响应式契约回归测试
 *
 * 背景：PlantManager/index.vue 的 hiddenCount/hiddenPlants/filteredPlants 等 computed
 * 直接包普通函数（getHiddenBuiltinPlants/getAllPlantsSync），这些函数读 localStorage /
 * 模块级缓存，本身不是 Vue 响应式数据。若 computed 不依赖任何响应式源，首次计算后会被冻结，
 * 导致"隐藏内置植物后回收站入口在同一会话内不出现、必须重开弹窗才能恢复"。
 *
 * 修复：所有这类 computed 都读一行 store._plantCacheVersion 建立响应式依赖，
 * hide/unhide/导入等操作后调 store.triggerPlantCacheUpdate() bump 版本号驱动重算。
 *
 * 本测试直接刻画该契约（不挂载重型 PlantManager 组件），防未来重构丢失依赖。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import { getHiddenBuiltinPlants, hideBuiltinPlant, unhideBuiltinPlant, getPlantByIdSync, getPlantImage } from '@/data/customPlants'
import { PLANTS } from '@/data/plants'

describe('植物缓存响应式契约（_plantCacheVersion）', () => {
  let store
  const sampleBuiltinId = PLANTS[0].id // 胆小菇 scaredyshroom

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useGameStore()
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('computed 不读 _plantCacheVersion 时，隐藏后不会重算（复现 bug 根因）', () => {
    // 缺陷范式：computed 内部没有任何响应式依赖
    const brokenHiddenCount = computed(() => getHiddenBuiltinPlants().length)

    expect(brokenHiddenCount.value).toBe(0)

    hideBuiltinPlant(sampleBuiltinId) // 仅写 localStorage，非响应式

    // localStorage 不是响应式源 → computed 缓存未失效 → 仍是旧值（这就是"调不出来"的根因）
    expect(brokenHiddenCount.value).toBe(0)
    expect(getHiddenBuiltinPlants().length).toBe(1) // 直接调用能看到，但 computed 看不到
  })

  it('computed 依赖 _plantCacheVersion 时，triggerPlantCacheUpdate 后正确重算（修复范式）', () => {
    // 修复范式：与 PlantManager/index.vue 的 hiddenCount computed 一致
    const hiddenCount = computed(() => {
      const _v = store._plantCacheVersion // eslint-disable-line no-unused-vars
      return getHiddenBuiltinPlants().length
    })

    expect(hiddenCount.value).toBe(0)

    // 隐藏 + bump 版本号（PlantManager.confirmHide 走 refreshList → triggerPlantCacheUpdate）
    hideBuiltinPlant(sampleBuiltinId)
    store.triggerPlantCacheUpdate()
    expect(hiddenCount.value).toBe(1)

    // 恢复 + bump 版本号（PlantManager.restorePlant 走 refreshList → triggerPlantCacheUpdate）
    unhideBuiltinPlant(sampleBuiltinId)
    store.triggerPlantCacheUpdate()
    expect(hiddenCount.value).toBe(0)
  })

  it('triggerPlantCacheUpdate 使 _plantCacheVersion 单调变化', () => {
    const before = store._plantCacheVersion
    store.triggerPlantCacheUpdate()
    const after = store._plantCacheVersion
    expect(after).not.toBe(before)
    expect(typeof after).toBe('number')
  })

  it('getPlantByIdSync / getPlantImage 能取回已隐藏的内置植物（展示层不应受隐藏影响）', () => {
    // 隐藏后，单点查询（展示用）仍须找到该植物；否则回收站、Ban/Pick 区等"已发生事件"的图片会退化成占位图
    hideBuiltinPlant(sampleBuiltinId)
    const plant = getPlantByIdSync(sampleBuiltinId)
    expect(plant).toBeTruthy()
    expect(plant.id).toBe(sampleBuiltinId)

    const img = getPlantImage(sampleBuiltinId)
    expect(img).toBe(plant.image) // 真实图片路径，而非占位图
    expect(img).not.toMatch(/placehold\.co/)
  })
})
