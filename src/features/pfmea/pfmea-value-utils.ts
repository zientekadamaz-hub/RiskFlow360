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

export function normalizePfmeaPcpValue(raw: unknown): boolean | null {
  if (raw == null) return null
  if (typeof raw === 'boolean') return raw
  if (typeof raw === 'number') return raw === 1 ? true : raw === 0 ? false : null
  const source = String(raw).trim().toLowerCase()
  if (!source) return null
  if (source === 'true' || source === 't' || source === '1' || source === 'yes') return true
  if (source === 'false' || source === 'f' || source === '0' || source === 'no') return false
  return null
}
