import type { RiskColor } from './matrix-colors'

export type RiskMatrixMode = 'manual' | 'rpn'

export type RiskMatrixScopeKind = 'organization' | 'system_default'

export type RiskMatrixContext = {
  globalRole: string | null
  id: string
  kind: RiskMatrixScopeKind
  notice: string
  userId: string
}

export type RpnThresholds = {
  greenMax: number
  orangeMax: number
  yellowMax: number
}

export type RiskMatrixDbCell = {
  color: RiskColor
  do_value: number
  organization_id?: string | null
  project_id?: string | null
  severity: number
}

export type RiskMatrixDbConfig = {
  id: number
  mode: RiskMatrixMode
  organization_id: string
  rpn_green_max: number
  rpn_orange_max: number
  rpn_yellow_max: number
  updated_at?: string
}

export type RiskMatrixCache = {
  cells: Record<string, RiskColor>
  globalRole: string | null
  mode: RiskMatrixMode
  rpn: RpnThresholds
  scopeId: string
  scopeKind: RiskMatrixScopeKind
  ts: number
  userId: string
}

export type RiskMatrixLegendRow = {
  color: RiskColor
  desc: string
  title: string
}

export type RpnInputKey = 'green' | 'yellow' | 'orange'

export type RpnInputState = Record<RpnInputKey, string>

export type RiskMatrixColorPickerState = {
  currentColor: RiskColor
  doValue: number
  left: number
  severity: number
  top: number
} | null
