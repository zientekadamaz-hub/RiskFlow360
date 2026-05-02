import type { SupabaseClient } from '@supabase/supabase-js'
import type { PfmeaMiniRow } from './types'

type PfmeaMiniRowNumberKey = 'severity' | 'occurrence' | 'detection'

export function isPfmeaMiniScore(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value >= 1 && value <= 10
}

function safeMul(a: number | null, b: number | null): number | null {
  if (a == null || b == null) return null
  const result = a * b
  if (!Number.isFinite(result)) return null
  return Math.trunc(result)
}

function safeRpn(severity: number | null, oxd: number | null): number | null {
  if (severity == null || oxd == null) return null
  const result = severity * oxd
  if (!Number.isFinite(result)) return null
  return Math.trunc(result)
}

export function computePfmeaMiniDerived(row: PfmeaMiniRow): Pick<PfmeaMiniRow, 'oxd' | 'rpn'> {
  const severity = isPfmeaMiniScore(row.severity) ? row.severity : null
  const occurrence = isPfmeaMiniScore(row.occurrence) ? row.occurrence : null
  const detection = isPfmeaMiniScore(row.detection) ? row.detection : null
  const oxd = safeMul(occurrence, detection)
  const rpn = safeRpn(severity, oxd)
  return { oxd, rpn }
}

export function clampPfmeaMiniScore(value: number) {
  if (!Number.isFinite(value)) return 1
  return Math.max(1, Math.min(10, Math.round(value)))
}

export async function fetchPfmeaMiniRows(
  supabase: SupabaseClient,
  operationId: string
): Promise<PfmeaMiniRow[]> {
  const res = await supabase
    .from('pfmea_rows')
    .select('id,operation_id,failure_mode,effect,cause,severity,occurrence,detection,rpn,oxd,created_at')
    .eq('operation_id', operationId)
    .order('created_at', { ascending: true })

  if (res.error) throw new Error(res.error.message)
  return (res.data ?? []) as PfmeaMiniRow[]
}

export async function createPfmeaMiniRow(supabase: SupabaseClient, operationId: string) {
  const payload = {
    operation_id: operationId,
    failure_mode: '',
    effect: '',
    cause: '',
    severity: null,
    occurrence: null,
    detection: null,
    oxd: null,
    rpn: null,
    class: null,
    current_prevention: '',
    current_detection: '',
    recommended_action: '',
    responsible: '',
    target_date: null,
    action_status: 'OPEN',
    occurrence2: null,
    detection2: null,
    rpn2: null,
    oxd2: null,
    rpn_current: null,
    oxd_current: null,
  }

  const res = await supabase.from('pfmea_rows').insert([payload])
  if (res.error) throw new Error(res.error.message)
}

export async function updatePfmeaMiniRow(
  supabase: SupabaseClient,
  row: PfmeaMiniRow,
  patch: Partial<PfmeaMiniRow>
): Promise<PfmeaMiniRow> {
  const guarded: Partial<PfmeaMiniRow> = { ...patch }
  ;(['severity', 'occurrence', 'detection'] as PfmeaMiniRowNumberKey[]).forEach((key) => {
    if (!(key in guarded)) return
    const value = guarded[key]
    if (value === null || value === undefined) return
    if (!isPfmeaMiniScore(value)) guarded[key] = null
  })

  const nextRow: PfmeaMiniRow = { ...row, ...guarded }
  const derived = computePfmeaMiniDerived(nextRow)
  const res = await supabase.from('pfmea_rows').update({ ...guarded, ...derived }).eq('id', row.id)
  if (res.error) throw new Error(res.error.message)

  return { ...nextRow, ...derived }
}
