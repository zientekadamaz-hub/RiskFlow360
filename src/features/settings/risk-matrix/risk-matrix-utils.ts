import { DO_VALUES, SEVERITIES, cellKey, defaultColor } from './matrix-config'
import type { RiskColor } from './matrix-colors'
import type { RiskMatrixLegendRow, RpnThresholds } from './types'
import {
  DEFAULT_RPN_THRESHOLDS,
  clampRiskInt,
  normalizeRpnThresholds as normalizeSharedRpnThresholds,
  riskColorFromRpn,
} from '@/lib/risk-engine'
import { errorText as sharedErrorText, isTimeoutError as sharedIsTimeoutError } from '@/lib/error-utils'

export const DEFAULT_RPN: RpnThresholds = DEFAULT_RPN_THRESHOLDS
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
  return clampRiskInt(value, min, max)
}

export function errorText(error: unknown) {
  return sharedErrorText(error)
}

export function isTimeoutError(error: unknown) {
  return sharedIsTimeoutError(error)
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
  return riskColorFromRpn(severity, doValue, thresholds)
}

export function normalizeRpnThresholds(next: RpnThresholds): RpnThresholds {
  return normalizeSharedRpnThresholds(next)
}
