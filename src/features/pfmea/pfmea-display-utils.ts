export function shortSeverityLabel(nameRaw: string | null | undefined, descriptionRaw: string | null | undefined) {
  const source = (nameRaw ?? descriptionRaw ?? '').toString().replace(/\r/g, '')
  const firstLine =
    source
      .split('\n')
      .map((x) => x.trim())
      .find(Boolean) ?? ''
  const cut = firstLine.split(/[-\u2013\u2014]/)[0]?.trim() ?? ''
  return cut || firstLine || 'No description'
}

export function parseExamples(descriptionRaw: string | null | undefined) {
  return (descriptionRaw ?? '')
    .toString()
    .replace(/\r/g, '')
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean)
}

export function normalizeHistoryText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  return null
}
