export type PfmeaGroupIds = {
  failure_mode_group_id: string
  failure_block_group_id: string
  action_plan_group_id: string
}

export type PfmeaRowHierarchy = {
  rowLabel: string
  failureModeKey: string
  failureBlockKey: string
  causeBlockKey: string
  actionKey: string
}

export type PfmeaHierarchyRow = {
  id: string
  operation_id?: string | null
  row_no?: string | null
  failure_mode_group_id?: string | null
  failure_block_group_id?: string | null
  action_plan_group_id?: string | null
  operations?: {
    id?: string | null
    operation_number?: number | null
  } | null
}

export const PLACEHOLDER_ROW_PREFIX = '__pfmea_placeholder__:'

export function isPlaceholderRowId(id: string) {
  return typeof id === 'string' && id.startsWith(PLACEHOLDER_ROW_PREFIX)
}

export function normalizePfmeaGroupId(value: string | null | undefined) {
  const normalized = (value ?? '').trim()
  return normalized || null
}

export function normalizePfmeaRowNo(value: string | null | undefined) {
  const normalized = (value ?? '').trim()
  return normalized || null
}

export function parsePfmeaRowNo(value: string | null | undefined): PfmeaRowHierarchy | null {
  const rowLabel = normalizePfmeaRowNo(value)
  if (!rowLabel) return null

  const parts = rowLabel.split('.').map((part) => part.trim())
  if (parts.length !== 5 || parts.some((part) => part.length === 0)) return null

  return {
    rowLabel,
    failureModeKey: parts.slice(0, 2).join('.'),
    failureBlockKey: parts.slice(0, 3).join('.'),
    causeBlockKey: parts.slice(0, 4).join('.'),
    actionKey: parts.slice(0, 5).join('.'),
  }
}

export function parsePfmeaRowNoParts(value: string | null | undefined) {
  const rowLabel = normalizePfmeaRowNo(value)
  if (!rowLabel) return null

  const parts = rowLabel.split('.').map((part) => Number.parseInt(part.trim(), 10))
  if (parts.length !== 5 || parts.some((part) => !Number.isFinite(part))) return null
  return parts
}

export function samePfmeaGroupValue(a: string | null | undefined, b: string | null | undefined) {
  const left = normalizePfmeaGroupId(a)
  const right = normalizePfmeaGroupId(b)
  return !!left && !!right && left === right
}

export function createPfmeaGroupId() {
  if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const rand = Math.floor(Math.random() * 16)
    const value = ch === 'x' ? rand : (rand & 0x3) | 0x8
    return value.toString(16)
  })
}

export function createDeterministicPfmeaGroupId(seed: string) {
  let h1 = 0x811c9dc5
  let h2 = 0x9e3779b9
  let h3 = 0x85ebca6b
  let h4 = 0xc2b2ae35

  for (let index = 0; index < seed.length; index += 1) {
    const code = seed.charCodeAt(index)
    h1 = Math.imul(h1 ^ code, 16777619)
    h2 = Math.imul((h2 + code) ^ (h2 >>> 13), 2246822519)
    h3 = Math.imul((h3 ^ code) + 0x27d4eb2d, 3266489917)
    h4 = Math.imul((h4 + (code << (index % 5))) ^ (h4 >>> 15), 668265263)
  }

  const chars = [h1, h2, h3, h4]
    .map((value) => (value >>> 0).toString(16).padStart(8, '0'))
    .join('')
    .slice(0, 32)
    .split('')

  chars[12] = '5'
  chars[16] = (((Number.parseInt(chars[16] ?? '0', 16) & 0x3) | 0x8) >>> 0).toString(16)

  const hex = chars.join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

export function createPfmeaGroupIds(overrides: Partial<PfmeaGroupIds> = {}): PfmeaGroupIds {
  return {
    failure_mode_group_id: normalizePfmeaGroupId(overrides.failure_mode_group_id) ?? createPfmeaGroupId(),
    failure_block_group_id: normalizePfmeaGroupId(overrides.failure_block_group_id) ?? createPfmeaGroupId(),
    action_plan_group_id: normalizePfmeaGroupId(overrides.action_plan_group_id) ?? createPfmeaGroupId(),
  }
}

export function derivePfmeaGroupIds(row: Partial<PfmeaHierarchyRow>, hierarchy?: PfmeaRowHierarchy | null): PfmeaGroupIds {
  const rowHierarchy = hierarchy ?? parsePfmeaRowNo(row.row_no)
  const rowSeed = row.id || `${row.operation_id || row.operations?.id || 'op'}:${normalizePfmeaRowNo(row.row_no) || 'row'}`

  return {
    failure_mode_group_id:
      normalizePfmeaGroupId(row.failure_mode_group_id) ??
      createDeterministicPfmeaGroupId(`pfmea:fm:${rowHierarchy?.failureModeKey || rowSeed}`),
    failure_block_group_id:
      normalizePfmeaGroupId(row.failure_block_group_id) ??
      createDeterministicPfmeaGroupId(`pfmea:fb:${rowHierarchy?.failureBlockKey || rowSeed}`),
    action_plan_group_id:
      normalizePfmeaGroupId(row.action_plan_group_id) ??
      createDeterministicPfmeaGroupId(`pfmea:cb:${rowHierarchy?.causeBlockKey || rowSeed}`),
  }
}

export function pickPfmeaGroupIds(row: Partial<PfmeaHierarchyRow> | null | undefined): Partial<PfmeaGroupIds> {
  return {
    failure_mode_group_id: normalizePfmeaGroupId(row?.failure_mode_group_id) ?? undefined,
    failure_block_group_id: normalizePfmeaGroupId(row?.failure_block_group_id) ?? undefined,
    action_plan_group_id: normalizePfmeaGroupId(row?.action_plan_group_id) ?? undefined,
  }
}

export function buildPfmeaHierarchy<T extends PfmeaHierarchyRow>(rows: T[]): PfmeaRowHierarchy[] {
  const persistedHierarchy = rows.map((row) => parsePfmeaRowNo(row.row_no))
  const canUsePersistedHierarchy =
    rows.length > 0 &&
    rows.every((row, index) => isPlaceholderRowId(row.id) || !!persistedHierarchy[index])

  if (canUsePersistedHierarchy) {
    return rows.map((row, index) => {
      const item = persistedHierarchy[index]
      if (item) return item

      const opNumberLabel =
        row.operations?.operation_number != null && Number.isFinite(row.operations.operation_number)
          ? String(row.operations.operation_number)
          : '-'

      return {
        rowLabel: `${opNumberLabel}.1.1.1.1`,
        failureModeKey: `${opNumberLabel}.1`,
        failureBlockKey: `${opNumberLabel}.1.1`,
        causeBlockKey: `${opNumberLabel}.1.1.1`,
        actionKey: `${opNumberLabel}.1.1.1.1`,
      }
    })
  }

  const failureModeIndexByKey = new Map<string, number>()
  const failureModeCountByOperation = new Map<string, number>()
  const failureBlockIndexByKey = new Map<string, number>()
  const failureBlockCountByFailureMode = new Map<string, number>()
  const causeBlockIndexByKey = new Map<string, number>()
  const causeBlockCountByFailureBlock = new Map<string, number>()
  const actionCountByCauseBlock = new Map<string, number>()

  return rows.map((row) => {
    const opId = row.operation_id || row.operations?.id || `op:${row.id}`
    const opNumberLabel =
      row.operations?.operation_number != null && Number.isFinite(row.operations.operation_number)
        ? String(row.operations.operation_number)
        : '-'

    const failureModeGroupId = normalizePfmeaGroupId(row.failure_mode_group_id) ?? `fm:${row.id}`
    const failureModeScopeKey = `${opId}`
    const failureModeKey = `${failureModeScopeKey}::${failureModeGroupId}`
    let failureModeIndex = failureModeIndexByKey.get(failureModeKey)
    if (!failureModeIndex) {
      failureModeIndex = (failureModeCountByOperation.get(failureModeScopeKey) ?? 0) + 1
      failureModeCountByOperation.set(failureModeScopeKey, failureModeIndex)
      failureModeIndexByKey.set(failureModeKey, failureModeIndex)
    }

    const failureBlockGroupId = normalizePfmeaGroupId(row.failure_block_group_id) ?? `fb:${row.id}`
    const failureBlockScopeKey = `${failureModeKey}`
    const failureBlockKey = `${failureBlockScopeKey}::${failureBlockGroupId}`
    let failureBlockIndex = failureBlockIndexByKey.get(failureBlockKey)
    if (!failureBlockIndex) {
      failureBlockIndex = (failureBlockCountByFailureMode.get(failureBlockScopeKey) ?? 0) + 1
      failureBlockCountByFailureMode.set(failureBlockScopeKey, failureBlockIndex)
      failureBlockIndexByKey.set(failureBlockKey, failureBlockIndex)
    }

    const causeBlockGroupId = normalizePfmeaGroupId(row.action_plan_group_id) ?? `cause:${row.id}`
    const causeBlockScopeKey = `${failureBlockKey}`
    const causeBlockKey = `${causeBlockScopeKey}::${causeBlockGroupId}`
    let causeBlockIndex = causeBlockIndexByKey.get(causeBlockKey)
    if (!causeBlockIndex) {
      causeBlockIndex = (causeBlockCountByFailureBlock.get(causeBlockScopeKey) ?? 0) + 1
      causeBlockCountByFailureBlock.set(causeBlockScopeKey, causeBlockIndex)
      causeBlockIndexByKey.set(causeBlockKey, causeBlockIndex)
    }

    const actionIndex = (actionCountByCauseBlock.get(causeBlockKey) ?? 0) + 1
    actionCountByCauseBlock.set(causeBlockKey, actionIndex)

    return {
      rowLabel: `${opNumberLabel}.${failureModeIndex}.${failureBlockIndex}.${causeBlockIndex}.${actionIndex}`,
      failureModeKey: `${opId}.${failureModeIndex}`,
      failureBlockKey: `${opId}.${failureModeIndex}.${failureBlockIndex}`,
      causeBlockKey: `${opId}.${failureModeIndex}.${failureBlockIndex}.${causeBlockIndex}`,
      actionKey: `${opId}.${failureModeIndex}.${failureBlockIndex}.${causeBlockIndex}.${actionIndex}`,
    }
  })
}

export function buildPfmeaBlockMergeInfoByHierarchy(
  rows: PfmeaHierarchyRow[],
  hierarchy: PfmeaRowHierarchy[],
  keySelector: (item: PfmeaRowHierarchy) => string
) {
  const spans = rows.map((_, index) => ({ span: 1, end: index }))
  let i = 0

  while (i < rows.length) {
    const currentItem = hierarchy[i]
    const currentKey = currentItem ? keySelector(currentItem) : ''
    let j = i + 1

    while (j < rows.length) {
      const nextItem = hierarchy[j]
      const nextKey = nextItem ? keySelector(nextItem) : ''
      if (!currentKey || !nextKey || currentKey !== nextKey) break
      j += 1
    }

    if (j - i > 1) {
      for (let k = i; k < j; k += 1) {
        spans[k] = { span: k === i ? j - i : 0, end: j - 1 }
      }
    }

    i = j
  }

  return spans
}

