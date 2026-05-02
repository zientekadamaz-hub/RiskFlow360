import type { RiskMatrixCache } from './types'
import { RISK_MATRIX_CACHE_KEY, RISK_MATRIX_CACHE_TTL_MS } from './risk-matrix-utils'

export function readRiskMatrixCache(): RiskMatrixCache | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.sessionStorage.getItem(RISK_MATRIX_CACHE_KEY)
    if (!raw) return null

    const parsed = JSON.parse(raw) as RiskMatrixCache
    if (!parsed || typeof parsed.ts !== 'number') return null
    if (!parsed.scopeId || typeof parsed.scopeId !== 'string') return null
    if (parsed.scopeKind !== 'organization' && parsed.scopeKind !== 'system_default') return null
    if (!parsed.userId || typeof parsed.userId !== 'string') return null
    if (Date.now() - parsed.ts > RISK_MATRIX_CACHE_TTL_MS) return null

    return parsed
  } catch {
    return null
  }
}

export function writeRiskMatrixCache(data: Omit<RiskMatrixCache, 'ts'>) {
  if (typeof window === 'undefined') return

  try {
    window.sessionStorage.setItem(RISK_MATRIX_CACHE_KEY, JSON.stringify({ ...data, ts: Date.now() }))
  } catch {}
}

export function clearRiskMatrixCache() {
  if (typeof window === 'undefined') return

  try {
    window.sessionStorage.removeItem(RISK_MATRIX_CACHE_KEY)
  } catch {}
}
