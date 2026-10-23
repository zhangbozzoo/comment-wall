export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:9000'

export function getWsUrl(): string {
  const base = API_BASE.replace(/^http/, 'ws')
  return `${base}/ws`
}