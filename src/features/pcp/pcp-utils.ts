export const PCP_PLACEHOLDER_PREFIX = '__pcp_placeholder__:'

export function normalizeText(value: unknown) {
  return String(value ?? '').trim()
}

export function normalizePcpFlag(value: unknown): boolean | null {
  if (value == null) return null
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value === 1 ? true : value === 0 ? false : null
  const source = String(value).trim().toLowerCase()
  if (!source) return null
  if (source === 'true' || source === 't' || source === '1' || source === 'yes') return true
  if (source === 'false' || source === 'f' || source === '0' || source === 'no') return false
  return null
}

export function normalizeClassValue(raw: string | null | undefined): string | null {
  if (raw == null) return null
  const source = String(raw).trim()
  if (!source) return null
  const upper = source.toUpperCase()
  const token = upper.split(/[\s-]/)[0] ?? ''
  if (token === 'SC' || upper.includes('SPECIAL CHARACTERISTIC')) return 'SC'
  if (token === 'CC' || upper.includes('CRITICAL CHARACTERISTIC')) return 'CC'
  return null
}

export function asInt1to10(value: unknown): number | null {
  if (value == null) return null
  const n = typeof value === 'number' ? value : Number(String(value).trim())
  if (!Number.isFinite(n)) return null
  const i = Math.trunc(n)
  if (i < 1 || i > 10) return null
  return i
}

export function isPfmeaSeedSelectedForPcp(
  row: { pcp: unknown; class: string | null | undefined; severity: unknown; rpn: number | null | undefined },
  yellowMax: number
) {
  const override = normalizePcpFlag(row.pcp)
  if (override != null) return override
  if (normalizeClassValue(row.class)) return true
  const severity = asInt1to10(row.severity)
  if (severity != null && severity >= 9) return true
  const rpn = typeof row.rpn === 'number' && Number.isFinite(row.rpn) ? row.rpn : null
  return rpn != null && rpn > yellowMax
}

export function nextPcpRevisionLabel(labelRaw: string | null | undefined) {
  const raw = (labelRaw ?? '0.0.0').toString().trim() || '0.0.0'
  const parts = raw.split('.')
  const pfd = Number.parseInt((parts[0] ?? '0').trim(), 10)
  const pfmea = Number.parseInt((parts[1] ?? '0').trim(), 10)
  const pcp = Number.parseInt((parts[2] ?? '0').trim(), 10)
  const a = Number.isFinite(pfd) ? pfd : 0
  const b = Number.isFinite(pfmea) ? pfmea : 0
  const c = Number.isFinite(pcp) ? pcp : 0
  return `${a}.${b}.${c + 1}`
}

export function isPlaceholderPcpRowId(id: string | null | undefined) {
  return String(id ?? '').startsWith(PCP_PLACEHOLDER_PREFIX)
}

export type PcpPayloadSource = {
  characteristic?: string | null
  class?: string | null
  control_method?: string | null
  current_detection?: string | null
  current_prevention?: string | null
  failure_mode?: string | null
  frequency?: string | null
  operation_id: string
  pfmea_row_id?: string | null
  reaction_plan?: string | null
  revision_id: string | null
  sample_size?: string | null
  source?: string | null
  status?: string | null
}

export function buildPcpRowPayload(row: PcpPayloadSource) {
  return {
    operation_id: row.operation_id,
    revision_id: row.revision_id,
    pfmea_row_id: row.pfmea_row_id ?? null,
    failure_mode: row.failure_mode ?? '',
    characteristic: row.characteristic ?? '',
    class: normalizeClassValue(row.class ?? null),
    current_prevention: row.current_prevention ?? '',
    current_detection: row.current_detection ?? '',
    control_method: row.control_method ?? '',
    sample_size: row.sample_size ?? '',
    frequency: row.frequency ?? '',
    reaction_plan: row.reaction_plan ?? '',
    source: normalizeText(row.source || 'MANUAL').toUpperCase(),
    status: normalizeText(row.status || 'OPEN').toUpperCase(),
  }
}

export function isEquivalentPcpRow(a: Partial<PcpPayloadSource>, b: Partial<PcpPayloadSource>) {
  const pfmeaA = normalizeText(a.pfmea_row_id)
  const pfmeaB = normalizeText(b.pfmea_row_id)
  if (pfmeaA && pfmeaB) return pfmeaA === pfmeaB
  return (
    normalizeText(a.operation_id) === normalizeText(b.operation_id) &&
    normalizeText(a.failure_mode) === normalizeText(b.failure_mode) &&
    normalizeText(a.characteristic) === normalizeText(b.characteristic) &&
    normalizeClassValue(a.class ?? null) === normalizeClassValue(b.class ?? null) &&
    normalizeText(a.current_prevention) === normalizeText(b.current_prevention) &&
    normalizeText(a.current_detection) === normalizeText(b.current_detection)
  )
}

export function getComparableTime(value: string | null | undefined) {
  const time = value ? new Date(value).getTime() : Number.NaN
  return Number.isFinite(time) ? time : 0
}
