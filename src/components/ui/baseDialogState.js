/**
 * BaseDialog 打开状态追踪（模块级单例）
 *
 * 供需要判断"当前是否有 BaseDialog 打开"的外层焦点陷阱使用。
 * 典型场景：PlantManager 主弹窗的自定义 trapKeydown 在任意 BaseDialog
 * （回收站 / 编辑预设 / 重命名等）打开时让出 Tab/Esc 控制，避免嵌套对话框焦点冲突。
 */
const openInstances = new Set()

export function registerBaseDialogOpen(id) {
  openInstances.add(id)
}

export function unregisterBaseDialogOpen(id) {
  openInstances.delete(id)
}

export function isAnyBaseDialogOpen() {
  return openInstances.size > 0
}
