export function pfmeaRevisionNumberFromLabel(label: string | null | undefined) {
  const raw = (label ?? '').toString().trim()
  if (!raw) return '-'
  const parts = raw.split('.').map((v) => v.trim()).filter(Boolean)
  if (parts.length === 0) return '-'
  const normalized = parts.map((part) => part.match(/\d+/)?.[0] ?? part).filter(Boolean)
  if (normalized.length === 0) return '-'
  const direct = normalized[1]
  if (direct && direct !== '0') return direct
  const nonZero = normalized.find((part) => part !== '0')
  return nonZero || direct || normalized[0] || '-'
}

export function nextPfmeaRevisionLabel(label: string | null | undefined) {
  const raw = (label ?? '').toString().trim()
  const parts = raw ? raw.split('.') : ['0', '0', '0']
  const pfd = Number.parseInt((parts[0] ?? '0').trim(), 10)
  const pfmea = Number.parseInt((parts[1] ?? '0').trim(), 10)
  const pcp = Number.parseInt((parts[2] ?? '0').trim(), 10)
  const a = Number.isFinite(pfd) ? pfd : 0
  const b = Number.isFinite(pfmea) ? pfmea : 0
  const c = Number.isFinite(pcp) ? pcp : 0
  return `${a}.${b + 1}.${c}`
}
