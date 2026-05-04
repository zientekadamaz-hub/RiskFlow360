import { type RiskColor } from '@app/settings/risk-matrix/_lib/matrixColors'
import { clampRiskInt, riskCellKey } from '@/lib/risk-engine'

export type Mode = 'manual' | 'rpn'
export type { RiskColor }

export type DbCell = {
  organization_id?: string | null
  project_id?: string | null
  severity: number
  do_value: number
  color: RiskColor
}

export type DbConfig = {
  id: number
  mode: Mode
  rpn_green_max: number
  rpn_yellow_max: number
  rpn_orange_max: number
}

export type RpnThresholds = { greenMax: number; yellowMax: number; orangeMax: number }

export const GLOBAL_PROJECT_ID = '00000000-0000-0000-0000-000000000000'

export function cellKey(sev: number, doVal: number) {
  return riskCellKey(sev, doVal)
}

export function clampInt(v: number, min: number, max: number) {
  return clampRiskInt(v, min, max)
}

export function colorFill(c: RiskColor) {
  if (c === 'red') return 'rgba(239,68,68,0.12)'
  if (c === 'orange') return 'rgba(251,146,60,0.18)'
  if (c === 'yellow') return 'rgba(250,204,21,0.22)'
  return 'rgba(34,197,94,0.18)'
}
