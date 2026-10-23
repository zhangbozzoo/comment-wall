// @ts-ignore
export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:9000'

// 获取 WebSocket 地址
export const getWsUrl = () => {
  // 优先读取 VITE_WS_URL
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL
  }
  // 如果没有配置，基于 API_BASE 自动替换
  return API_BASE.replace(/^http/, 'ws') + '/ws'
}