import type { RatingScaleConfig } from './config'
import type { EffectiveRatingScaleRow, RatingScaleCacheEntry, RatingScaleUiRow } from './types'

export const LEVEL_COUNT = 10
export const QUERY_TIMEOUT_MS = 2_000
export const CACHE_TTL_MS = 5 * 60 * 1000

export const BASE_COLUMN_WIDTHS = {
  level: 58,
  title: 210,
  definition: 260,
  examples: 240,
  status: 90,
  actions: 110,
}

export const DEFAULT_HIDDEN_COLUMNS = {
  level: false,
  title: false,
  definition: false,
  examples: false,
  status: false,
}

export function formatDateOnly(value: string | null | undefined) {
  if (!value) return '-'

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '-'

  return parsed.toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  })
}

export function readCache(cacheKey: string): RatingScaleCacheEntry | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.sessionStorage.getItem(cacheKey)
    if (!raw) return null

    const parsed = JSON.parse(raw) as RatingScaleCacheEntry
    if (!parsed || typeof parsed.ts !== 'number') return null
    if (Date.now() - parsed.ts > CACHE_TTL_MS) return null

    return parsed
  } catch {
    return null
  }
}

export function writeCache(cacheKey: string, entry: Omit<RatingScaleCacheEntry, 'ts'>) {
  if (typeof window === 'undefined') return

  try {
    window.sessionStorage.setItem(
      cacheKey,
      JSON.stringify({
        ...entry,
        ts: Date.now(),
      })
    )
  } catch {}
}

export function normalizeRows(config: RatingScaleConfig, rows: EffectiveRatingScaleRow[]) {
  const byLevel = new Map<number, EffectiveRatingScaleRow>()
  rows.forEach((row) => {
    if (Number.isFinite(row.level)) {
      byLevel.set(row.level, row)
    }
  })

  const normalized: RatingScaleUiRow[] = []
  for (let level = 1; level <= LEVEL_COUNT; level += 1) {
    const row = byLevel.get(level)
    const defaults = config.defaults[level]
    const name = row?.name?.trim() || defaults?.name || ''
    const description = row?.description?.trim() || defaults?.description || ''
    const split = splitName(name)

    normalized.push({
      level,
      name,
      title: split.title,
      definition: split.definition,
      description,
      examples: description
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
      active: row?.active ?? true,
      modified_by_name: row?.modified_by_name ?? null,
      modified_at: row?.modified_at ?? null,
    })
  }

  return normalized
}

export function splitName(rawName: string) {
  const match = rawName.match(/^(.+?)\s(?:-|\u2013|\u2014|\u00e2\u20ac\u201c)\s(.+)$/)
  if (match) {
    return {
      title: match[1].trim(),
      definition: match[2].trim(),
    }
  }

  return {
    title: rawName.trim(),
    definition: '',
  }
}

export function parseExampleInputs(value: string) {
  const rows = value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  return rows.length > 0 ? [...rows, ''] : ['']
}

export function normalizeExampleInputs(values: string[]) {
  const next = [...values]
  while (next.length > 1 && !next[next.length - 1].trim() && !next[next.length - 2].trim()) {
    next.pop()
  }
  if (next.length === 0 || next[next.length - 1].trim()) {
    next.push('')
  }
  return next
}

export function composeName(title: string, definition: string) {
  const safeTitle = title.trim()
  const safeDefinition = definition.trim()
  return safeDefinition ? `${safeTitle} - ${safeDefinition}` : safeTitle
}
