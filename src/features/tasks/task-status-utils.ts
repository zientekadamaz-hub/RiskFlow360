export function normalizeTaskStatus(value: string | null | undefined) {
  const normalized = (value ?? '').trim().toUpperCase()
  if (!normalized) return 'OPEN'
  if (['DONE', 'COMPLETE', 'COMPLETED', 'CLOSED'].includes(normalized)) return 'CLOSED'
  if (['CANCELED', 'CANCELLED'].includes(normalized)) return 'CANCELED'
  if (['IN_PROGRESS', 'IN PROGRESS', 'ONGOING'].includes(normalized)) return 'IN PROGRESS'
  return normalized
}

export function isTerminalTaskStatus(value: string | null | undefined) {
  return ['CLOSED', 'CANCELED'].includes(normalizeTaskStatus(value))
}
