import { PFMEA_EDITABLE_FIELDS } from './pfmea-columns'
import { pickPfmeaGroupIds } from './pfmea-hierarchy-utils'
import { makeEmptyPfmeaPayload } from './pfmea-row-factory-utils'
import { asInt1to10, computeDerived } from './pfmea-risk-utils'
import type { PfmeaRow } from './pfmea-types'
import { normalizeClassValue, normalizePfmeaPcpValue } from './pfmea-value-utils'

const PFMEA_NUMERIC_EDIT_FIELDS: (keyof PfmeaRow)[] = ['severity', 'occurrence', 'detection', 'occurrence2', 'detection2']

export function normalizePfmeaEditablePatch(patch: Partial<PfmeaRow>) {
  const guarded: Partial<PfmeaRow> = { ...patch }

  PFMEA_NUMERIC_EDIT_FIELDS.forEach((field) => {
    if (!(field in guarded)) return
    const value = guarded[field]
    if (value === null) return
    ;(guarded as Record<string, unknown>)[field] = asInt1to10(value)
  })

  if ('pcp' in guarded) {
    guarded.pcp = normalizePfmeaPcpValue(guarded.pcp)
  }

  if ('class' in guarded) {
    guarded.class = normalizeClassValue((guarded.class as string | null | undefined) ?? null)
  }

  return guarded
}

export function buildPfmeaPendingEditablePatch(row: PfmeaRow) {
  const pendingPatch: Partial<PfmeaRow> = {}
  for (const field of PFMEA_EDITABLE_FIELDS) {
    ;(pendingPatch as Record<string, unknown>)[field] = row[field]
  }
  return normalizePfmeaEditablePatch(pendingPatch)
}

export function buildPfmeaPlaceholderInsertPayload(row: PfmeaRow, finalRevisionId: string, patch: Partial<PfmeaRow>) {
  const merged = { ...row, ...patch } as PfmeaRow
  return {
    ...makeEmptyPfmeaPayload(row.operation_id, finalRevisionId, pickPfmeaGroupIds(row)),
    ...patch,
    ...computeDerived(merged),
  }
}
