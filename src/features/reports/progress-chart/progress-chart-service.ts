import type { SupabaseClient } from '@supabase/supabase-js'
import {
  fetchRiskMatrixConfig,
  fetchProjectSiteDepartments,
  fetchProjectsUserContext,
  fetchProjectsWithRevision,
} from '@/features/projects/projects-service'
import { PFMEA_REPORT_RISK_SELECT_WITH_REVISION } from '@/features/reports/pfmea-report-query'
import { collectPfmeaCurrentOpenRisks, toReportNumber, type PfmeaReportRiskRow } from '@/features/reports/pfmea-report-risk-utils'
import { buildOpenReportProjectScope } from '@/features/reports/report-project-scope'
import type {
  ProgressChartData,
  ProgressChartFilters,
  ProgressChartPoint,
  ProgressProjectOption,
} from './types'

type PfmeaHistoryRow = {
  created_at?: string | null
  avg_rpn?: number | string | null
  project_id?: string | null
  risk_count?: number | string | null
}

type BucketAggregate = {
  count: number
  end: Date
  label: string
  start: Date
  sum: number
}

const DEFAULT_FILTERS: ProgressChartFilters = {
  departments: [],
  granularity: 'monthly',
  projectIds: [],
  sites: [],
}

function toNumber(value: unknown) {
  return toReportNumber(value)
}

function startOfWeek(date: Date) {
  const next = new Date(date)
  const day = next.getDay()
  const diff = day === 0 ? -6 : 1 - day
  next.setDate(next.getDate() + diff)
  next.setHours(0, 0, 0, 0)
  return next
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function bucketForDate(date: Date, granularity: ProgressChartFilters['granularity']) {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)

  if (granularity === 'weekly') {
    const weekStart = startOfWeek(date)
    return { start: weekStart, end: addDays(weekStart, 6) }
  }

  if (granularity === 'monthly') {
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1)
    return { start: monthStart, end: new Date(date.getFullYear(), date.getMonth() + 1, 0) }
  }

  return { start, end: start }
}

function localDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function shortDateLabel(date: Date) {
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${day}.${month}`
}

function bucketLabel(start: Date, end: Date, granularity: ProgressChartFilters['granularity']) {
  if (granularity === 'monthly') {
    return `${String(start.getMonth() + 1).padStart(2, '0')}.${start.getFullYear()}`
  }

  if (granularity === 'weekly') {
    return `${shortDateLabel(start)} - ${shortDateLabel(end)}`
  }

  return shortDateLabel(start)
}

function buildPoints(rows: PfmeaHistoryRow[], filters: ProgressChartFilters): ProgressChartPoint[] {
  const buckets = new Map<string, BucketAggregate>()

  for (const row of rows) {
    const createdAt = row.created_at ? new Date(row.created_at) : null
    if (!createdAt || Number.isNaN(createdAt.getTime())) continue

    const avgRpn = toNumber(row.avg_rpn)
    if (avgRpn == null) continue
    const riskCount = Math.max(1, Math.trunc(toNumber(row.risk_count) ?? 1))

    const { start, end } = bucketForDate(createdAt, filters.granularity)
    const key = localDateKey(start)
    const bucket = buckets.get(key) ?? {
      count: 0,
      end,
      label: bucketLabel(start, end, filters.granularity),
      start,
      sum: 0,
    }

    bucket.count += riskCount
    bucket.sum += avgRpn * riskCount
    buckets.set(key, bucket)
  }

  return Array.from(buckets.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([bucketKey, bucket]) => ({
      averageRpn: Number((bucket.sum / bucket.count).toFixed(1)),
      bucketEnd: localDateKey(bucket.end),
      bucketKey,
      bucketStart: localDateKey(bucket.start),
      label: bucket.label,
      recordCount: bucket.count,
    }))
}

export function summarizeProgressCurrentRows(rows: PfmeaReportRiskRow[]) {
  let sum = 0
  let count = 0

  for (const risk of collectPfmeaCurrentOpenRisks(rows)) {
    const rpn = risk.rpn
    if (rpn == null) continue
    sum += rpn
    count += 1
  }

  return {
    averageRpn: count ? Number((sum / count).toFixed(1)) : null,
    count,
  }
}

function upsertCurrentPoint(
  points: ProgressChartPoint[],
  filters: ProgressChartFilters,
  currentSummary: ReturnType<typeof summarizeProgressCurrentRows>
) {
  if (currentSummary.averageRpn == null || currentSummary.count <= 0) return points

  const now = new Date()
  const { start, end } = bucketForDate(now, filters.granularity)
  const bucketKey = localDateKey(start)
  const currentPoint: ProgressChartPoint = {
    averageRpn: currentSummary.averageRpn,
    bucketEnd: localDateKey(end),
    bucketKey,
    bucketStart: localDateKey(start),
    label: bucketLabel(start, end, filters.granularity),
    recordCount: currentSummary.count,
  }

  const withoutCurrentBucket = points.filter((point) => point.bucketKey !== bucketKey)
  return [...withoutCurrentBucket, currentPoint].sort((left, right) => left.bucketKey.localeCompare(right.bucketKey))
}

function trendForPoints(points: ProgressChartPoint[]) {
  if (points.length < 2) return 'none' as const

  const first = points[0].averageRpn
  const last = points[points.length - 1].averageRpn
  const diff = Number((last - first).toFixed(1))
  if (Math.abs(diff) < 1) return 'flat' as const
  return diff < 0 ? 'decreasing' as const : 'increasing' as const
}

export async function fetchProgressChartData(
  supabase: SupabaseClient,
  userId: string,
  rawFilters: ProgressChartFilters
): Promise<ProgressChartData> {
  const filters = { ...DEFAULT_FILTERS, ...rawFilters }
  const userCtx = await fetchProjectsUserContext(supabase, userId)
  const [projects, siteDeptData, riskMatrixConfig] = await Promise.all([
    fetchProjectsWithRevision(supabase, userCtx.orgId),
    fetchProjectSiteDepartments(supabase, userCtx.orgId),
    fetchRiskMatrixConfig(supabase, userCtx.orgId),
  ])

  const projectOptions: ProgressProjectOption[] = buildOpenReportProjectScope(projects, siteDeptData.siteDeptMap)
    .map((project) => ({
      currentRevisionId: project.revisionId,
      department: project.department,
      id: project.id,
      name: project.name,
      site: project.site,
    }))
    .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }))

  const siteOptions = Array.from(new Set([
    ...siteDeptData.siteOptions,
    ...projectOptions.map((project) => project.site).filter(Boolean),
  ])).sort((left, right) => left.localeCompare(right))

  const departmentOptions = Array.from(new Set(projectOptions.map((project) => project.department).filter(Boolean)))
    .sort((left, right) => left.localeCompare(right))

  const siteFilter = new Set(filters.sites)
  const departmentFilter = new Set(filters.departments)
  const projectFilter = new Set(filters.projectIds)

  const scopedProjectIds = projectOptions
    .filter((project) => !siteFilter.size || siteFilter.has(project.site))
    .filter((project) => !departmentFilter.size || departmentFilter.has(project.department))
    .map((project) => project.id)

  const eligibleProjectIds = projectFilter.size
    ? scopedProjectIds.filter((projectId) => projectFilter.has(projectId))
    : scopedProjectIds
  const eligibleProjectIdSet = new Set(eligibleProjectIds)
  const eligibleRevisionIds = projectOptions
    .filter((project) => eligibleProjectIdSet.has(project.id))
    .map((project) => project.currentRevisionId)
    .filter(Boolean)

  let rows: PfmeaHistoryRow[] = []
  let currentRows: PfmeaReportRiskRow[] = []
  if (eligibleProjectIds.length) {
    const historyQuery = supabase
      .from('pfmea_change_history')
      .select('project_id,created_at,avg_rpn,risk_count')
      .in('project_id', eligibleProjectIds)
      .order('created_at', { ascending: true })

    const currentQuery = eligibleRevisionIds.length
      ? supabase
          .from('pfmea_rows')
          .select(PFMEA_REPORT_RISK_SELECT_WITH_REVISION)
          .in('revision_id', eligibleRevisionIds)
      : Promise.resolve({ data: [], error: null })

    const [historyRes, currentRes] = await Promise.all([
      historyQuery,
      currentQuery,
    ])

    if (historyRes.error) throw historyRes.error
    if (currentRes.error) throw currentRes.error
    rows = (historyRes.data ?? []) as PfmeaHistoryRow[]
    currentRows = (currentRes.data ?? []) as PfmeaReportRiskRow[]
  }

  const currentSummary = summarizeProgressCurrentRows(currentRows)
  const points = upsertCurrentPoint(buildPoints(rows, filters), filters, currentSummary).slice(-30)
  const recordCount = points.reduce((sum, point) => sum + point.recordCount, 0)
  const lastAverageRpn = points.at(-1)?.averageRpn ?? null

  return {
    departmentOptions,
    filters,
    points,
    projectOptions,
    siteOptions,
    summary: {
      averageRpn: currentSummary.averageRpn,
      currentRecordCount: currentSummary.count,
      lastAverageRpn,
      openProjectsCount: eligibleProjectIds.length,
      recordCount,
      thresholds: riskMatrixConfig.thresholds,
      trend: trendForPoints(points),
    },
  }
}
