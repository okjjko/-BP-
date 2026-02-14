/**
 * 自定义植物数据管理模块
 * 使用IndexedDB存储自定义植物，支持大量植物数据
 * 提供内存缓存以支持同步访问
 */

import { PLANTS } from './plants'

// IndexedDB配置
const DB_NAME = 'BP_PlantManager'
const DB_VERSION = 1
const STORE_NAME = 'customPlants'

// 内存缓存（用于同步访问）
let customPlantsCache = []
let isCacheLoaded = false

/**
 * 初始化缓存（应用启动时调用）
 * @returns {Promise<void>}
 */
export const initializeCache = async () => {
  if (!isCacheLoaded) {
    customPlantsCache = await loadCustomPlants()
    isCacheLoaded = true
    console.log(`自定义植物缓存已加载，共 ${customPlantsCache.length} 个植物`)
  }
}

/**
 * 更新缓存
 * 在添加、更新、删除操作后调用
 */
const updateCache = async () => {
  // 重新加载缓存以立即反映更改
  customPlantsCache = await loadCustomPlants()
  isCacheLoaded = true
  console.log(`缓存已更新，共 ${customPlantsCache.length} 个自定义植物`)
}

/**
 * 同步获取所有植物（内置+自定义）
 * 供组件同步调用
 * 注意：首次调用前需要先调用 initializeCache()
 */
export const getAllPlantsSync = () => {
  if (!isCacheLoaded) {
    console.warn('自定义植物缓存未初始化，将只返回内置植物')
    return [...PLANTS]
  }
  return [...PLANTS, ...customPlantsCache]
}

/**
 * 同步根据ID获取植物
 * 供组件同步调用
 */
export const getPlantByIdSync = (id) => {
  // 先从内置植物中查找
  const builtin = PLANTS.find(p => p.id === id)
  if (builtin) return builtin

  // 从缓存中查找
  if (!isCacheLoaded) return null
  return customPlantsCache.find(p => p.id === id) || null
}

/**
 * 打开IndexedDB数据库
 * @returns {Promise<IDBDatabase>}
 */
export const openDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      console.error('IndexedDB打开失败:', request.error)
      reject(request.error)
    }

    request.onsuccess = () => {
      resolve(request.result)
    }

    // 数据库首次创建或版本升级时执行
    request.onupgradeneeded = (event) => {
      const db = event.target.result

      // 创建对象存储（如果不存在）
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        // 创建索引以便快速查询
        store.createIndex('createdAt', 'createdAt', { unique: false })
        console.log('IndexedDB对象存储创建成功')
      }
    }
  })
}

/**
 * 加载所有自定义植物
 * @returns {Promise<Array>}
 */
export const loadCustomPlants = async () => {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.getAll()

      request.onsuccess = () => {
        resolve(request.result || [])
        db.close()
      }

      request.onerror = () => {
        console.error('加载自定义植物失败:', request.error)
        reject(request.error)
        db.close()
      }
    })
  } catch (error) {
    console.error('加载自定义植物失败:', error)
    return []
  }
}

/**
 * 添加新植物
 * @param {Object} plantData - 植物数据（不包含id）
 * @returns {Promise<Object>} 返回完整的植物对象
 */
export const addCustomPlant = async (plantData) => {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)

      // 生成唯一ID
      const newPlant = {
        ...plantData,
        id: `custom_${Date.now()}`,
        builtin: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      const request = store.add(newPlant)

      request.onsuccess = async () => {
        await updateCache() // 重新加载缓存
        resolve(newPlant)
        db.close()
      }

      request.onerror = () => {
        console.error('添加植物失败:', request.error)
        reject(request.error)
        db.close()
      }
    })
  } catch (error) {
    console.error('添加植物失败:', error)
    throw error
  }
}

/**
 * 更新植物
 * @param {string} id - 植物ID
 * @param {Object} updates - 要更新的字段
 * @returns {Promise<boolean>}
 */
export const updateCustomPlant = async (id, updates) => {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)

      // 先获取现有数据
      const getRequest = store.get(id)

      getRequest.onsuccess = () => {
        const existing = getRequest.result
        if (!existing) {
          reject(new Error(`植物 ${id} 不存在`))
          db.close()
          return
        }

        // 更新数据
        const updated = {
          ...existing,
          ...updates,
          id, // 确保ID不被修改
          updatedAt: new Date().toISOString()
        }

        const putRequest = store.put(updated)

        putRequest.onsuccess = async () => {
          await updateCache() // 重新加载缓存
          resolve(true)
          db.close()
        }

        putRequest.onerror = () => {
          console.error('更新植物失败:', putRequest.error)
          reject(putRequest.error)
          db.close()
        }
      }

      getRequest.onerror = () => {
        console.error('获取植物失败:', getRequest.error)
        reject(getRequest.error)
        db.close()
      }
    })
  } catch (error) {
    console.error('更新植物失败:', error)
    throw error
  }
}

/**
 * 删除植物
 * @param {string} id - 植物ID
 * @returns {Promise<boolean>}
 */
export const deleteCustomPlant = async (id) => {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.delete(id)

      request.onsuccess = async () => {
        await updateCache() // 重新加载缓存
        resolve(true)
        db.close()
      }

      request.onerror = () => {
        console.error('删除植物失败:', request.error)
        reject(request.error)
        db.close()
      }
    })
  } catch (error) {
    console.error('删除植物失败:', error)
    throw error
  }
}

/**
 * 根据ID获取植物（从内置或自定义中查找）
 * @param {string} id - 植物ID
 * @returns {Promise<Object|null>}
 */
export const getPlantById = async (id) => {
  // 先从内置植物中查找
  const builtin = PLANTS.find(p => p.id === id)
  if (builtin) {
    return builtin
  }

  // 从自定义植物中查找
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.get(id)

      request.onsuccess = () => {
        resolve(request.result || null)
        db.close()
      }

      request.onerror = () => {
        console.error('获取植物失败:', request.error)
        reject(request.error)
        db.close()
      }
    })
  } catch (error) {
    console.error('获取植物失败:', error)
    return null
  }
}

/**
 * 获取所有植物（内置+自定义）
 * @returns {Promise<Array>}
 */
export const getAllPlants = async () => {
  try {
    const customPlants = await loadCustomPlants()
    return [...PLANTS, ...customPlants]
  } catch (error) {
    console.error('获取所有植物失败:', error)
    return [...PLANTS] // 降级为只返回内置植物
  }
}

/**
 * 获取植物图片URL
 * 用于UI显示，处理Blob和URL两种格式
 * @param {Object} plant - 植物对象
 * @returns {string}
 */
export const getPlantImage = (plant) => {
  if (!plant) return ''

  // 如果是Blob对象，转换为URL
  if (plant.imageData instanceof Blob) {
    return URL.createObjectURL(plant.imageData)
  }

  // 如果是直接的URL字符串
  if (plant.image) {
    return plant.image
  }

  // 默认占位图
  return 'https://placehold.co/100x100/9370DB/white?text=未知'
}

/**
 * 获取植物名称
 * @param {string} id - 植物ID
 * @returns {Promise<string>}
 */
export const getPlantName = async (id) => {
  const plant = await getPlantById(id)
  return plant?.name || '未知植物'
}

/**
 * 获取植物描述
 * @param {string} id - 植物ID
 * @returns {Promise<string>}
 */
export const getPlantDesc = async (id) => {
  const plant = await getPlantById(id)
  return plant?.description || '未知描述'
}

/**
 * 清空所有自定义植物（危险操作）
 * @returns {Promise<boolean>}
 */
export const clearAllCustomPlants = async () => {
  try {
    const db = await openDB()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.clear()

      request.onsuccess = () => {
        updateCache() // 使缓存失效
        resolve(true)
        db.close()
      }

      request.onerror = () => {
        console.error('清空自定义植物失败:', request.error)
        reject(request.error)
        db.close()
      }
    })
  } catch (error) {
    console.error('清空自定义植物失败:', error)
    throw error
  }
}

/**
 * 检测浏览器是否支持IndexedDB
 * @returns {boolean}
 */
export const isIndexedDBSupported = () => {
  return 'indexedDB' in window
}

/**
 * 验证植物数据完整性
 * @param {Object} plant - 植物对象
 * @returns {Object} { valid: boolean, errors: Array<string> }
 */
export const validatePlant = (plant) => {
  const errors = []

  if (!plant.id || typeof plant.id !== 'string') {
    errors.push('缺少有效的植物ID')
  }

  if (!plant.name || typeof plant.name !== 'string') {
    errors.push('缺少植物名称')
  }

  if (!plant.description || typeof plant.description !== 'string') {
    errors.push('缺少功能描述')
  }

  if (!plant.type || typeof plant.type !== 'string') {
    errors.push('缺少植物类型')
  } else {
    const validTypes = ['shooter', 'producer', 'defense', 'instant', 'melee', 'support']
    if (!validTypes.includes(plant.type)) {
      errors.push('无效的植物类型')
    }
  }

  // 图片数据验证（Blob或Base64字符串）
  if (!plant.imageData && !plant.image) {
    errors.push('缺少植物图片')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * 将Blob转换为Base64（用于导出）
 * @param {Blob} blob
 * @returns {Promise<string>}
 */
export const blobToBase64 = (blob) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/**
 * 将Base64转换为Blob（用于导入）
 * @param {string} base64
 * @returns {Promise<Blob>}
 */
export const base64ToBlob = (base64) => {
  return new Promise((resolve, reject) => {
    try {
      // 分离数据和元数据
      const [metadata, data] = base64.split(',')
      const mime = metadata.match(/:(.*?);/)[1]

      // 转换为Blob
      const byteString = atob(data)
      const arrayBuffer = new ArrayBuffer(byteString.length)
      const uint8Array = new Uint8Array(arrayBuffer)

      for (let i = 0; i < byteString.length; i++) {
        uint8Array[i] = byteString.charCodeAt(i)
      }

      resolve(new Blob([uint8Array], { type: mime }))
    } catch (error) {
      reject(error)
    }
  })
}
