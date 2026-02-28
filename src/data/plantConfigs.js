/**
 * 植物配置管理器
 *
 * 功能：
 * - 保存多套植物配置到 localStorage
 * - 加载配置并更新 IndexedDB
 * - 配置的增删改查操作
 * - 配置导入导出
 */

import { loadCustomPlants, addCustomPlant, deleteCustomPlant, clearAllCustomPlants, blobToBase64, base64ToBlob } from './customPlants'

const CONFIGS_KEY = 'bpPlantConfigs'

/**
 * 从 localStorage 获取所有配置数据
 */
function getConfigsData() {
  try {
    const data = localStorage.getItem(CONFIGS_KEY)
    if (!data) {
      return { configs: [], activeConfigId: null }
    }
    return JSON.parse(data)
  } catch (error) {
    console.error('读取配置失败:', error)
    return { configs: [], activeConfigId: null }
  }
}

/**
 * 保存配置数据到 localStorage
 */
function saveConfigsData(data) {
  try {
    localStorage.setItem(CONFIGS_KEY, JSON.stringify(data))
    return true
  } catch (error) {
    console.error('保存配置失败:', error)
    return false
  }
}

/**
 * 获取所有配置
 * @returns {Array} 配置列表
 */
export async function getAllConfigs() {
  const data = getConfigsData()
  return data.configs || []
}

/**
 * 获取当前活动配置
 * @returns {Object|null} 活动配置对象
 */
export async function getActiveConfig() {
  const data = getConfigsData()
  if (!data.activeConfigId) return null
  return data.configs.find(c => c.id === data.activeConfigId) || null
}

/**
 * 根据 ID 获取配置
 * @param {string} configId - 配置ID
 * @returns {Object|null} 配置对象
 */
export async function getConfigById(configId) {
  const data = getConfigsData()
  return data.configs.find(c => c.id === configId) || null
}

/**
 * 保存当前状态为新配置
 * @param {string} name - 配置名称
 * @param {string} description - 配置描述
 * @returns {Object|null} 创建的配置对象
 */
export async function saveConfig(name, description) {
  try {
    // 1. 从 IndexedDB 加载所有自定义植物
    const plants = await loadCustomPlants()

    // 2. 转换为保存格式（图片转 Base64）
    const plantsToSave = await Promise.all(
      plants.map(async (plant) => ({
        id: plant.id,
        name: plant.name,
        description: plant.description,
        type: plant.type,
        image: await blobToBase64(plant.imageData),
        builtin: false
      }))
    )

    // 3. 获取隐藏的内置植物列表
    const hiddenBuiltinPlants = getHiddenPlants()

    // 4. 创建配置对象
    const config = {
      id: 'config_' + Date.now(),
      name: name.trim(),
      description: description?.trim() || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      plants: plantsToSave,
      hiddenBuiltinPlants
    }

    // 5. 保存到 localStorage
    const data = getConfigsData()
    data.configs.push(config)

    // 如果这是第一个配置，自动设为活动配置
    if (!data.activeConfigId) {
      data.activeConfigId = config.id
    }

    saveConfigsData(data)

    console.log('[plantConfigs] 已保存配置:', config.name)
    return config
  } catch (error) {
    console.error('保存配置失败:', error)
    throw new Error('保存配置失败: ' + error.message)
  }
}

/**
 * 加载配置（替换 IndexedDB）
 * @param {string} configId - 配置ID
 */
export async function loadConfig(configId) {
  try {
    // 1. 从 localStorage 获取配置数据
    const config = await getConfigById(configId)
    if (!config) {
      throw new Error('配置不存在')
    }

    // 2. 清空 IndexedDB 中的所有自定义植物
    const existingPlants = await loadCustomPlants()
    for (const plant of existingPlants) {
      await deleteCustomPlant(plant.id)
    }
    console.log(`[plantConfigs] 已清空 ${existingPlants.length} 个现有植物`)

    // 3. 清空隐藏的内置植物设置
    localStorage.removeItem('hiddenBuiltinPlants')

    // 4. 将配置中的植物添加到 IndexedDB
    for (const plant of config.plants) {
      const imageBlob = await base64ToBlob(plant.image)
      await addCustomPlant({
        name: plant.name,
        description: plant.description,
        type: plant.type,
        imageData: imageBlob,
        imageType: imageBlob.type
      })
    }
    console.log(`[plantConfigs] 已加载 ${config.plants.length} 个植物`)

    // 5. 恢复隐藏的内置植物设置
    if (config.hiddenBuiltinPlants.length > 0) {
      localStorage.setItem('hiddenBuiltinPlants', JSON.stringify(config.hiddenBuiltinPlants))
      console.log(`[plantConfigs] 已恢复 ${config.hiddenBuiltinPlants.length} 个隐藏的内置植物`)
    }

    // 6. 设置为活动配置
    await setActiveConfig(configId)

    return config
  } catch (error) {
    console.error('加载配置失败:', error)
    throw new Error('加载配置失败: ' + error.message)
  }
}

/**
 * 删除配置
 * @param {string} configId - 配置ID
 */
export async function deleteConfig(configId) {
  try {
    const data = getConfigsData()
    const configIndex = data.configs.findIndex(c => c.id === configId)

    if (configIndex === -1) {
      throw new Error('配置不存在')
    }

    // 删除配置
    data.configs.splice(configIndex, 1)

    // 如果删除的是活动配置，切换到第一个可用配置
    if (data.activeConfigId === configId) {
      data.activeConfigId = data.configs.length > 0 ? data.configs[0].id : null
    }

    saveConfigsData(data)
    console.log('[plantConfigs] 已删除配置:', configId)
    return true
  } catch (error) {
    console.error('删除配置失败:', error)
    throw new Error('删除配置失败: ' + error.message)
  }
}

/**
 * 重命名配置
 * @param {string} configId - 配置ID
 * @param {string} newName - 新名称
 */
export async function renameConfig(configId, newName) {
  try {
    const data = getConfigsData()
    const config = data.configs.find(c => c.id === configId)

    if (!config) {
      throw new Error('配置不存在')
    }

    config.name = newName.trim()
    config.updatedAt = new Date().toISOString()

    saveConfigsData(data)
    console.log('[plantConfigs] 已重命名配置:', config.name)
    return config
  } catch (error) {
    console.error('重命名配置失败:', error)
    throw new Error('重命名配置失败: ' + error.message)
  }
}

/**
 * 设置活动配置
 * @param {string} configId - 配置ID
 */
export async function setActiveConfig(configId) {
  try {
    const data = getConfigsData()
    const config = data.configs.find(c => c.id === configId)

    if (!config) {
      throw new Error('配置不存在')
    }

    data.activeConfigId = configId
    saveConfigsData(data)
    console.log('[plantConfigs] 已设置活动配置:', config.name)
    return config
  } catch (error) {
    console.error('设置活动配置失败:', error)
    throw new Error('设置活动配置失败: ' + error.message)
  }
}

/**
 * 导出单个配置
 * @param {string} configId - 配置ID
 */
export async function exportConfig(configId) {
  try {
    const config = await getConfigById(configId)
    if (!config) {
      throw new Error('配置不存在')
    }

    const data = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      type: 'plantConfig',
      config
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = url
    a.download = `plant_config_${config.name}_${new Date().toISOString().slice(0, 10)}.json`
    a.click()

    URL.revokeObjectURL(url)
    console.log('[plantConfigs] 已导出配置:', config.name)
    return true
  } catch (error) {
    console.error('导出配置失败:', error)
    throw new Error('导出配置失败: ' + error.message)
  }
}

/**
 * 导入配置
 * @param {Object} importedData - 导入的配置数据
 */
export async function importConfig(importedData) {
  try {
    // 验证数据格式
    if (!importedData.config || !importedData.config.plants) {
      throw new Error('无效的配置文件格式')
    }

    const config = importedData.config

    // 生成新的 ID（避免冲突）
    const newConfig = {
      ...config,
      id: 'config_' + Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    // 检查名称是否重复
    const data = getConfigsData()
    const nameExists = data.configs.some(c => c.name === newConfig.name)

    if (nameExists) {
      // 如果名称重复，添加时间戳
      newConfig.name = `${newConfig.name}_${Date.now().toString().slice(-4)}`
    }

    // 保存到 localStorage
    data.configs.push(newConfig)

    // 如果这是第一个配置，自动设为活动配置
    if (!data.activeConfigId) {
      data.activeConfigId = newConfig.id
    }

    saveConfigsData(data)
    console.log('[plantConfigs] 已导入配置:', newConfig.name)
    return newConfig
  } catch (error) {
    console.error('导入配置失败:', error)
    throw new Error('导入配置失败: ' + error.message)
  }
}

/**
 * 获取隐藏的内置植物列表
 */
function getHiddenPlants() {
  try {
    const hidden = localStorage.getItem('hiddenBuiltinPlants')
    return hidden ? JSON.parse(hidden) : []
  } catch (error) {
    console.error('读取隐藏植物列表失败:', error)
    return []
  }
}
