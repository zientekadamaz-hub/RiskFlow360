export type SharedRiskColor = 'green' | 'yellow' | 'orange' | 'red'
export type SharedRiskMatrixMode = 'manual' | 'rpn'

export type SharedRpnThresholds = {
  greenMax: number
  orangeMax: number
  yellowMax: number
}

export const DEFAULT_RPN_THRESHOLDS: SharedRpnThresholds = {
  greenMax: 100,
  orangeMax: 360,
  yellowMax: 200,
}

export function clampRiskInt(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min
  return Math.max(min, Math.min(max, Math.trunc(value)))
}

export function riskCellKey(severity: number, doValue: number) {
  return `${severity}|${doValue}`
}

export function riskColorFromRpnValue(value: number, thresholds: SharedRpnThresholds): SharedRiskColor {
  if (value <= thresholds.greenMax) return 'green'
  if (value <= thresholds.yellowMax) return 'yellow'
  if (value <= thresholds.orangeMax) return 'orange'
  return 'red'
}

export function riskColorFromRpn(severity: number, doValue: number, thresholds: SharedRpnThresholds): SharedRiskColor {
  return riskColorFromRpnValue(severity * doValue, thresholds)
}

export function normalizeRpnThresholds(next: SharedRpnThresholds): SharedRpnThresholds {
  const normalized: SharedRpnThresholds = {
    greenMax: clampRiskInt(next.greenMax, 1, 1000),
    orangeMax: clampRiskInt(next.orangeMax, 1, 1000),
    yellowMax: clampRiskInt(next.yellowMax, 1, 1000),
  }

  if (normalized.yellowMax < normalized.greenMax) normalized.yellowMax = normalized.greenMax
  if (normalized.orangeMax < normalized.yellowMax) normalized.orangeMax = normalized.yellowMax

  return normalized
}

export function riskColorForMatrixCell(
  severityRaw: number | null,
  doValueRaw: number | null,
  mode: SharedRiskMatrixMode,
  thresholds: SharedRpnThresholds,
  cells: Record<string, SharedRiskColor>,
  fallbackColorForCell?: (severity: number, doValue: number) => SharedRiskColor
): SharedRiskColor | null {
  if (severityRaw == null || doValueRaw == null) return null

  const severity = clampRiskInt(severityRaw, 1, 10)
  const doValue = clampRiskInt(doValueRaw, 1, 100)

  if (mode === 'manual') {
    const configured = cells[riskCellKey(severity, doValue)]
    if (configured) return configured
    return fallbackColorForCell?.(severity, doValue) ?? riskColorFromRpn(severity, doValue, thresholds)
  }

  return riskColorFromRpn(severity, doValue, thresholds)
}
