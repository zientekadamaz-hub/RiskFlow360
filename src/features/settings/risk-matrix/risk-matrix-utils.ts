import { DO_VALUES, SEVERITIES, cellKey, defaultColor } from './matrix-config'
import type { RiskColor } from './matrix-colors'
import type { RiskMatrixLegendRow, RpnThresholds } from './types'

export const DEFAULT_RPN: RpnThresholds = { greenMax: 100, yellowMax: 200, orangeMax: 360 }
export const QUERY_TIMEOUT_MS = 1800
export const RISK_MATRIX_CACHE_KEY = '__SETTINGS_RISK_MATRIX_CACHE__'
export const RISK_MATRIX_CACHE_TTL_MS = 5 * 60 * 1000

export const legendRows: RiskMatrixLegendRow[] = [
  { color: 'green', title: 'GREEN', desc: 'Action not required' },
  { color: 'yellow', title: 'YELLOW', desc: 'Action not required unless the team decides otherwise' },
  { color: 'orange', title: 'ORANGE', desc: 'Action required unless the team decides otherwise' },
  { color: 'red', title: 'RED', desc: 'Action must be implemented' },
]

export function clampInt(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min
  return Math.max(min, Math.min(max, Math.trunc(value)))
}

export function errorText(error: unknown) {
  if (!error) return 'unknown'
  if (error instanceof Error) return error.message
  if (typeof error === 'object') {
    const candidate = error as {
      details?: unknown
      error_description?: unknown
      hint?: unknown
      message?: unknown
    }
    return String(candidate.message ?? candidate.error_description ?? candidate.details ?? candidate.hint ?? error)
  }
  return String(error)
}

export function isTimeoutError(error: unknown) {
  return errorText(error).toLowerCase().includes('timeout')
}

export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function withTimeout<T>(promise: PromiseLike<T>, ms: number, fallback: T): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timeoutId = setTimeout(() => resolve(fallback), ms)
      }),
    ])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

export function buildDefaultCells() {
  const next: Record<string, RiskColor> = {}
  for (const severity of SEVERITIES) {
    for (const doValue of DO_VALUES) {
      next[cellKey(severity, doValue)] = defaultColor(severity, doValue)
    }
  }
  return next
}

export function colorFromRpn(severity: number, doValue: number, thresholds: RpnThresholds): RiskColor {
  const rpn = severity * doValue
  if (rpn <= thresholds.greenMax) return 'green'
  if (rpn <= thresholds.yellowMax) return 'yellow'
  if (rpn <= thresholds.orangeMax) return 'orange'
  return 'red'
}

export function normalizeRpnThresholds(next: RpnThresholds): RpnThresholds {
  const normalized: RpnThresholds = {
    greenMax: clampInt(next.greenMax, 1, 1000),
    yellowMax: clampInt(next.yellowMax, 1, 1000),
    orangeMax: clampInt(next.orangeMax, 1, 1000),
  }

  if (normalized.yellowMax < normalized.greenMax) normalized.yellowMax = normalized.greenMax
  if (normalized.orangeMax < normalized.yellowMax) normalized.orangeMax = normalized.yellowMax

  return normalized
}
