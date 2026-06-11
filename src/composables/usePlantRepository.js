/**
 * 植物数据仓库 Composable
 * 统一内置和自定义植物的访问接口
 * 封装 IndexedDB 操作和缓存管理
 */
import { computed } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import {
  getAllPlantsSync,
  getPlantByIdSync,
  getPlantImage as _getPlantImage,
  getPlantName as _getPlantName,
  getPlantDesc as _getPlantDesc,
  initializeCache,
  updateCache,
  addCustomPlant,
  updateCustomPlant,
  updateCustomPlantId,
  deleteCustomPlant,
  importCustomPlant,
  clearAllCustomPlants,
  getHiddenPlants,
  hideBuiltinPlant,
  unhideBuiltinPlant,
  unhideAllBuiltinPlants,
  isPlantHidden,
  validatePlant,
  checkPlantIdExists,
  checkPlantInGame,
  blobToBase64,
  base64ToBlob
} from '@/data/customPlants'

export function usePlantRepository() {
  const gameStore = useGameStore()

  /**
   * 获取所有可见植物（内置+自定义，排除隐藏的）
   */
  const allPlants = computed(() => {
    // 依赖缓存版本号以触发响应式更新
    const _v = gameStore._plantCacheVersion
    return getAllPlantsSync()
  })

  /**
   * 根据 ID 获取植物
   */
  function getPlant(id) {
    return getPlantByIdSync(id)
  }

  /**
   * 获取植物图片 URL
   */
  function getImage(id) {
    return _getPlantImage(id)
  }

  /**
   * 获取植物名称
   */
  function getName(id) {
    return _getPlantName(id)
  }

  /**
   * 获取植物描述
   */
  function getDesc(id) {
    return _getPlantDesc(id)
  }

  /**
   * 刷新植物缓存并触发响应式更新
   */
  async function refreshCache() {
    await updateCache()
    gameStore.triggerPlantCacheUpdate()
  }

  return {
    // 响应式数据
    allPlants,

    // 查询
    getPlant,
    getImage,
    getName,
    getDesc,
    getHiddenPlants,
    isPlantHidden,
    checkPlantIdExists,
    checkPlantInGame,
    validatePlant,

    // 变更
    refreshCache,
    initializeCache,
    addCustomPlant,
    updateCustomPlant,
    updateCustomPlantId,
    deleteCustomPlant,
    importCustomPlant,
    clearAllCustomPlants,
    hideBuiltinPlant,
    unhideBuiltinPlant,
    unhideAllBuiltinPlants,

    // 工具
    blobToBase64,
    base64ToBlob
  }
}
