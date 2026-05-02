import type { RpnThresholds } from '@/features/projects/types'

export type ProgressGranularity = 'daily' | 'weekly' | 'monthly'

export type ProgressChartFilters = {
  departments: string[]
  granularity: ProgressGranularity
  projectIds: string[]
  sites: string[]
}

export type ProgressProjectOption = {
  currentRevisionId: string
  department: string
  id: string
  name: string
  site: string
}

export type ProgressChartPoint = {
  averageRpn: number
  bucketEnd: string
  bucketKey: string
  bucketStart: string
  label: string
  recordCount: number
}

export type ProgressChartData = {
  departmentOptions: string[]
  filters: ProgressChartFilters
  points: ProgressChartPoint[]
  projectOptions: ProgressProjectOption[]
  siteOptions: string[]
  summary: {
    averageRpn: number | null
    currentRecordCount: number
    lastAverageRpn: number | null
    openProjectsCount: number
    recordCount: number
    thresholds: RpnThresholds
    trend: 'decreasing' | 'flat' | 'increasing' | 'none'
  }
}
