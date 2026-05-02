import type { RiskColor } from '@/features/settings/risk-matrix/matrix-colors'
import type { RpnThresholds } from '@/features/settings/risk-matrix/types'

export type RpnMatrixProject = {
  department: string
  id: string
  name: string
  openRevisionId: string
  revisionId: string
  site: string
}

export type RpnMatrixFilters = {
  departments: string[]
  projectIds: string[]
  sites: string[]
}

export type RpnMatrixCellSummary = {
  averageRpn: number | null
  color: RiskColor
  count: number
  rpnMax: number | null
  rpnMin: number | null
}

export type RpnMatrixSummary = {
  averageRpn: number | null
  colorCounts: Record<RiskColor, number>
  openProjectCount: number
  riskCount: number
}

export type RpnMatrixProjectColorCounts = {
  colorCounts: Record<RiskColor, number>
  projectId: string
  projectName: string
  riskCount: number
}

export type RpnMatrixReportData = {
  cells: Record<string, RpnMatrixCellSummary>
  departments: string[]
  filters: RpnMatrixFilters
  matrixMode: 'manual' | 'rpn'
  projectColorCounts: RpnMatrixProjectColorCounts[]
  projectOptions: RpnMatrixProject[]
  projects: RpnMatrixProject[]
  riskMatrixCells: Record<string, RiskColor>
  sites: string[]
  summary: RpnMatrixSummary
  thresholds: RpnThresholds
}
