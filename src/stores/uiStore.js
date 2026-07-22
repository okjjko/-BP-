/**
 * UI 状态 Store
 * 负责拖拽状态、弹窗显示、植物飞行动画等纯界面状态
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

    // BP 规则编辑弹窗（赛前快速改当前对局 BP 规则，不存预设）
    showBPRulesEditor: false,

    // ban/pick 植物飞行动画状态（与 dragState 同构，纯界面态）
    // active:是否飞行中；key:每次飞行唯一标识（overlay watch 触发用）；
    // plantId/action:本次操作的植物与类型；fromRect/toRect:起点/终点视口坐标。
    flightState: {
      active: false,
      key: null,
      plantId: null,
      action: null,
      fromRect: null,
      toRect: null
    }
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
    },

    setShowBPRulesEditor(show) {
      this.showBPRulesEditor = show
    },

    // 开始一次植物飞行：写入坐标与标识，overlay 渲染克隆体并播放过渡
    startFlight(payload) {
      this.flightState = {
        active: true,
        key: payload.key,
        plantId: payload.plantId,
        action: payload.action,
        fromRect: payload.fromRect,
        toRect: payload.toRect
      }
    },

    // 结束飞行：清空状态，overlay 移除克隆体
    endFlight() {
      this.flightState = {
        active: false,
        key: null,
        plantId: null,
        action: null,
        fromRect: null,
        toRect: null
      }
    }
  }
})
