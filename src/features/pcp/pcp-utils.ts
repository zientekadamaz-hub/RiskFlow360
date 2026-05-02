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
