export const IDLE_MINUTES = 10
export const IDLE_MS = IDLE_MINUTES * 60 * 1000
export const ACTIVITY_WRITE_THROTTLE_MS = 5000
export const LAST_ACTIVITY_KEY = '__APP_LAST_ACTIVITY_AT__'
export const IDLE_LOGOUT_BROADCAST_KEY = '__APP_IDLE_LOGOUT_AT__'

export function readIdleTimestamp(key: string) {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null

    const parsed = Number(raw)
    return Number.isFinite(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function writeIdleTimestamp(key: string, value: number) {
  try {
    window.localStorage.setItem(key, String(value))
  } catch {}
}

export function clearIdleTimestamp(key: string) {
  try {
    window.localStorage.removeItem(key)
  } catch {}
}
