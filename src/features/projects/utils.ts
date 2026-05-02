import type { ProjectPfmeaStat, RevisionPopupRow, RiskColor, RpnThresholds, UiProjectRow, ProjectRowDb } from './types'

export function errText(error: unknown) {
  if (!error) return 'unknown'
  if (typeof error === 'object') {
    const maybe = error as {
      message?: string
      error_description?: string
      details?: string
      hint?: string
    }
    return maybe.message || maybe.error_description || maybe.details || maybe.hint || String(error)
  }
  return String(error)
}

export function normalizeProjectText(value: unknown) {
  return (value ?? '').toString().trim()
}

export function formatDatePL(iso: string) {
  const date = new Date(iso)
  return date.toLocaleDateString('pl-PL', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

export function formatAvgRpn(value: number | null) {
  if (value == null || !Number.isFinite(value)) return '-'
  return String(Math.round(value))
}

export function formatAvgRpnInt(value: number | null) {
  if (value == null || !Number.isFinite(value)) return '-'
  return String(Math.round(value))
}

export function formatDateTimePL(iso: string | null | undefined) {
  if (!iso) return '-'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '-'
  const datePart = date.toLocaleDateString('pl-PL', { year: 'numeric', month: '2-digit', day: '2-digit' })
  const timePart = date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  return `${datePart} ${timePart}`
}

export function sectionRevisionFromLabel(revisionLabel: string | null | undefined, moduleName: 'PFD' | 'PFMEA' | 'PCP') {
  const raw = (revisionLabel ?? '').toString().trim()
  if (!raw) return '-'
  const parts = raw
    .split('.')
    .map((value) => value.trim())
    .filter(Boolean)

  const normalized = parts
    .map((part) => part.match(/\d+/)?.[0] ?? part)
    .filter(Boolean)

  if (normalized.length === 0) return '-'
  if (normalized.length === 1) return normalized[0]

  const targetIndex = moduleName === 'PFD' ? 0 : moduleName === 'PFMEA' ? 1 : 2
  const direct = normalized[targetIndex]
  if (direct && direct !== '0') return direct

  const nonZero = normalized.find((part) => part !== '0')
  return nonZero || direct || '-'
}

export function emptyRevisionRows(): RevisionPopupRow[] {
  return ['PFD', 'PFMEA', 'PCP'].map((moduleName) => ({
    module: moduleName as RevisionPopupRow['module'],
    revisionLabel: '-',
    at: '-',
    author: '-',
    description: 'No updates yet',
    hasData: false,
  }))
}

export function clampInt(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min
  return Math.max(min, Math.min(max, Math.trunc(value)))
}

export function cellKey(severity: number, doValue: number) {
  return `${severity}|${doValue}`
}

export function colorFromRpn(severity: number, doValue: number, thresholds: RpnThresholds): RiskColor {
  const rpn = severity * doValue
  if (rpn <= thresholds.greenMax) return 'green'
  if (rpn <= thresholds.yellowMax) return 'yellow'
  if (rpn <= thresholds.orangeMax) return 'orange'
  return 'red'
}

export function getRiskColorFor(
  severityRaw: number | null,
  doValueRaw: number | null,
  mode: 'manual' | 'rpn',
  thresholds: RpnThresholds,
  cells: Record<string, RiskColor>
): RiskColor | null {
  if (severityRaw == null || doValueRaw == null) return null

  const severity = clampInt(severityRaw, 1, 10)
  const doValue = clampInt(doValueRaw, 1, 100)

  if (mode === 'manual') {
    const hit = cells[cellKey(severity, doValue)]
    if (hit) return hit
    return colorFromRpn(severity, doValue, thresholds)
  }

  return colorFromRpn(severity, doValue, thresholds)
}

export function normalizeProductInputs(list: string[]) {
  const next = list.map((value) => (value ?? '').toString())
  const trimmed = next.filter((value, index) => value.trim() !== '' || index === next.length - 1)
  if (!trimmed.length || trimmed[trimmed.length - 1].trim() !== '') trimmed.push('')
  return trimmed
}

export function cleanProductList(list: string[]) {
  return list.map((value) => value.trim()).filter(Boolean)
}

export function parseProductList(value: string) {
  if (!value || value === '-') return ['']
  const parts = value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
  if (!parts.length) return ['']
  return [...parts, '']
}

export function mapProjectsToUiRows(
  rawProjects: ProjectRowDb[],
  siteDeptMap: Record<string, { site: string; department: string }>,
  projectPfmeaStats: Record<string, ProjectPfmeaStat>
): UiProjectRow[] {
  return rawProjects.map((project) => {
    const process = normalizeProjectText(project.name) || '-'
    const products = normalizeProjectText(project.products ?? project.product_names) || '-'
    const siteDepartment = project.site_department_id ? siteDeptMap[project.site_department_id] : null
    const site = normalizeProjectText(siteDepartment?.site) || '-'
    const department = normalizeProjectText(siteDepartment?.department) || '-'
    const updated = project.updated_at ?? project.created_at
    const revision = normalizeProjectText(project.draft_revision_label) || normalizeProjectText(project.open_revision_label) || '0.0.0'
    const currentRevisionId = normalizeProjectText(project.current_draft_revision_id) || normalizeProjectText(project.current_open_revision_id)
    const status = normalizeProjectText(project.status) || 'DRAFT'
    const stats = projectPfmeaStats[project.id] ?? { avgRpn: null, riskCount: 0 }

    return {
      id: project.id,
      currentRevisionId,
      site,
      department,
      process,
      products,
      avgRpn: stats.avgRpn,
      riskCount: stats.riskCount,
      updated,
      revision,
      status,
    }
  })
}
