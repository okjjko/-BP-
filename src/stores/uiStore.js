/**
 * UI 状态 Store
 * 负责拖拽状态、弹窗显示等纯界面状态
 */
import { defineStore } from 'pinia'

export const useUIStore = defineStore('ui', {
  state: () => ({
    // 拖拽状态
    dragState: {
      isDragging: false,
      draggedPlantId: null,
      draggedFromPlayer: null,
      draggedFromType: null,
      draggedFromPosition: null,
      draggedSourceIndex: null
    },

    // 植物管理弹窗
    showPlantManager: false,
  }),

  actions: {
    setDragState(dragState) {
      this.dragState = { ...this.dragState, ...dragState }
    },

    clearDragState() {
      this.dragState = {
        isDragging: false,
        draggedPlantId: null,
        draggedFromPlayer: null,
        draggedFromType: null,
        draggedFromPosition: null,
        draggedSourceIndex: null
      }
    },

    setShowPlantManager(show) {
      this.showPlantManager = show
    }
  }
})
