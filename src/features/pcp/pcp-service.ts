import type { SupabaseClient } from '@supabase/supabase-js'
import {
  DEFAULT_RPN_THRESHOLDS,
  riskCellKey,
  riskColorForMatrixCell,
  riskColorFromRpnValue,
  type SharedRiskColor,
  type SharedRiskMatrixMode,
  type SharedRpnThresholds,
} from '@/lib/risk-engine'
import {
  asInt1to10,
  buildPcpRowPayload,
  getComparableTime,
  isEquivalentPcpRow,
  isSamePcpRiskContext,
  normalizeClassValue,
  normalizeText,
  type PcpPayloadSource,
} from './pcp-utils'

export type PcpProjectView = {
  id: string
  name: string
  status: 'DRAFT' | 'OPEN' | 'OBSOLETE'
  current_open_revision_id: string | null
  current_draft_revision_id: string | null
  open_revision_label: string | null
  draft_revision_label: string | null
}

export type PcpOperation = {
  id: string
  project_id: string
  operation_number: number | null
  name: string
  machine: string | null
  operation: string | null
  active?: boolean
}

export type PcpRow = {
  id: string
  revision_id?: string | null
  risk_uid?: string | null
  operation_id: string
  pfmea_row_id?: string | null
  failure_mode: string | null
  characteristic: string
  class: string | null
  severity?: number | string | null
  rpn?: number | null
  current_prevention: string | null
  current_detection: string | null
  control_method: string | null
  sample_size: string | null
  frequency: string | null
  reaction_plan: string | null
  source: string
  status: string
  created_at: string
  updated_at: string
  operations?: PcpOperation | null
  __placeholder?: boolean
  __sortIndex?: number
}

export type PcpHistoryEntry = {
  id: string
  at: string
  revisionLabel: string
  author: string
  controlCount: number | null
  description: string
}

export type PcpEditSession = {
  projectId: string
  lockedBy: string
  startedAt: string
  lastActivityAt: string
}

export type PcpRevisionContext = {
  pcpHydrateSourceRevisionId: string | null
  pcpTargetIsDraft: boolean
  pcpTargetRevisionId: string | null
  pfmeaDraftIsActive: boolean
  pfmeaSourceIsDraft: boolean
  pfmeaSourceRevisionId: string | null
  projectView: PcpProjectView
}

export type PfmeaPcpSeedRow = {
  id: string
  risk_uid?: string | null
  operation_id: string
  pcp: boolean | null
  failure_mode: string | null
  class: string | null
  characteristic: string | null
  detection?: number | string | null
  occurrence?: number | string | null
  oxd_current?: number | null
  severity: number | string | null
  rpn: number | null
  rpn_current?: number | null
  current_prevention: string | null
  current_detection: string | null
  created_at?: string | null
  operations?: PcpOperation | PcpOperation[] | null
}

type PcpEditSessionDbRow = {
  project_id: string
  locked_by: string
  started_at: string
  last_activity_at: string
}

type PcpRiskMatrixConfigRow = {
  id?: number | null
  mode?: SharedRiskMatrixMode | null
  organization_id?: string | null
  project_id?: string | null
  rpn_green_max?: number | null
  rpn_orange_max?: number | null
  rpn_yellow_max?: number | null
}

type PcpRiskMatrixCellRow = {
  color?: SharedRiskColor | null
  do_value?: number | null
  organization_id?: string | null
  project_id?: string | null
  severity?: number | null
}

export type PcpRiskMatrixContext = {
  cells: Record<string, SharedRiskColor>
  mode: SharedRiskMatrixMode
  thresholds: SharedRpnThresholds
}

const GLOBAL_PROJECT_ID = '00000000-0000-0000-0000-000000000000'

const PCP_PROJECT_VIEW_SELECT = 'id,name,status,current_open_revision_id,current_draft_revision_id,open_revision_label,draft_revision_label'
const PCP_ROW_SELECT = 'id,revision_id,risk_uid,operation_id,pfmea_row_id,failure_mode,characteristic,class,current_prevention,current_detection,control_method,sample_size,frequency,reaction_plan,source,status,created_at,updated_at,operations!inner(id,project_id,operation_number,name,machine,operation,active)'
const PCP_ROW_COPY_SELECT = 'risk_uid,operation_id,pfmea_row_id,failure_mode,characteristic,class,current_prevention,current_detection,control_method,sample_size,frequency,reaction_plan,source,status'
const PCP_ROW_DRAFT_HYDRATE_SELECT = `id,${PCP_ROW_COPY_SELECT}`
const PFMEA_PCP_SEED_SELECT = 'id,risk_uid,operation_id,pcp,failure_mode,class,characteristic,severity,occurrence,detection,oxd_current,rpn_current,rpn,current_prevention,current_detection,created_at,operations!inner(id,project_id,operation_number,name,machine,operation,active)'
const PCP_PFMEA_CLONE_FIELDS = [
  'risk_uid',
  'operation_id',
  'row_no',
  'failure_mode_group_id',
  'failure_block_group_id',
  'action_plan_group_id',
  'failure_mode',
  'effect',
  'severity',
  'characteristic',
  'pcp',
  'class',
  'cause',
  'occurrence',
  'current_prevention',
  'current_detection',
  'detection',
  'rpn',
  'oxd',
  'recommended_action',
  'responsible',
  'target_date',
  'action_status',
  'occurrence2',
  'detection2',
  'rpn2',
  'oxd2',
  'rpn_current',
  'oxd_current',
  'created_at',
] as const

function getPcpOperationCharacteristicKey(row: Partial<PcpPayloadSource>) {
  const operationId = normalizeText(row.operation_id)
  const characteristic = normalizeText(row.characteristic).toLowerCase()
  return operationId && characteristic ? `${operationId}\u001f${characteristic}` : ''
}

function getPcpCarryoverInsertKey(row: Partial<PcpPayloadSource>) {
  const revisionId = normalizeText(row.revision_id)
  const riskUid = normalizeText(row.risk_uid)
  if (revisionId && riskUid) return `risk:${revisionId}\u001f${riskUid}`

  const pfmeaRowId = normalizeText(row.pfmea_row_id)
  if (revisionId && pfmeaRowId) return `pfmea:${revisionId}\u001f${pfmeaRowId}`

  const operationCharacteristicKey = getPcpOperationCharacteristicKey(row)
  return operationCharacteristicKey ? `legacy:${operationCharacteristicKey}` : ''
}

function isPcpAutoSource(row: Partial<PcpPayloadSource>) {
  return normalizeText(row.source).toUpperCase() === 'AUTO'
}

function isSamePcpAutoConstraintContext(a: Partial<PcpPayloadSource>, b: Partial<PcpPayloadSource>) {
  if (!isPcpAutoSource(a) && !isPcpAutoSource(b)) return false

  const riskUidA = normalizeText(a.risk_uid)
  const riskUidB = normalizeText(b.risk_uid)
  if (riskUidA && riskUidB) {
    const revisionA = normalizeText(a.revision_id)
    const revisionB = normalizeText(b.revision_id)
    return riskUidA === riskUidB && (!revisionA || !revisionB || revisionA === revisionB)
  }

  const aKey = getPcpOperationCharacteristicKey(a)
  return !!aKey && aKey === getPcpOperationCharacteristicKey(b)
}

function buildPcpDraftHydrateInsertPayload(row: Partial<PcpRow> & { operation_id: string }, draftRevisionId: string) {
  return buildPcpRowPayload({
    ...row,
    revision_id: draftRevisionId,
    source: isPcpAutoSource(row) ? 'MANUAL' : row.source,
  })
}

function normalizeJoinedOperation<T extends { operations?: PcpOperation | PcpOperation[] | null }>(row: T): T & { operations: PcpOperation | null } {
  return {
    ...row,
    operations: Array.isArray(row.operations) ? (row.operations[0] ?? null) : (row.operations ?? null),
  }
}

function isDuplicatePcpRiskUidError(error: unknown) {
  const err = error as { code?: string | null; message?: string | null } | null
  return err?.code === '23505' || normalizeText(err?.message).includes('ux_control_plan_rows_revision_risk_uid')
}

function buildPcpExistingRowRestorePatch(
  existingRow: Partial<PcpRow>,
  payload: ReturnType<typeof buildPcpRowPayload>,
  options?: { overwriteControlFields?: boolean }
) {
  const patch: Partial<PcpRow> = {
    pfmea_row_id: payload.pfmea_row_id,
    operation_id: payload.operation_id,
    risk_uid: payload.risk_uid,
    failure_mode: payload.failure_mode,
    characteristic: payload.characteristic,
    class: payload.class,
    current_prevention: payload.current_prevention,
    current_detection: payload.current_detection,
  }
  const controlFields: Array<keyof Pick<PcpRow, 'control_method' | 'sample_size' | 'frequency' | 'reaction_plan'>> = [
    'control_method',
    'sample_size',
    'frequency',
    'reaction_plan',
  ]

  for (const field of controlFields) {
    if (options?.overwriteControlFields || !normalizeText(existingRow[field])) {
      patch[field] = payload[field] ?? ''
    }
  }

  if (!normalizeText(existingRow.source)) patch.source = payload.source
  if (!normalizeText(existingRow.status)) patch.status = payload.status
  return patch
}

async function fetchPcpRowByRevisionRiskUid(
  supabase: SupabaseClient,
  revisionId: string,
  riskUid: string
): Promise<(Partial<PcpRow> & { id: string; created_at?: string | null; updated_at?: string | null }) | null> {
  const { data, error } = await supabase
    .from('control_plan_rows')
    .select('id,revision_id,risk_uid,operation_id,pfmea_row_id,failure_mode,characteristic,class,current_prevention,current_detection,control_method,sample_size,frequency,reaction_plan,source,status,created_at,updated_at')
    .eq('revision_id', revisionId)
    .eq('risk_uid', riskUid)
    .maybeSingle()

  if (error) throw error
  const row = data as (Partial<PcpRow> & { id?: string | null }) | null
  return row?.id ? { ...row, id: row.id } : null
}

async function upsertPcpPayloadByRevisionRiskUid(
  supabase: SupabaseClient,
  payload: ReturnType<typeof buildPcpRowPayload>,
  options?: { overwriteControlFields?: boolean }
) {
  const revisionId = normalizeText(payload.revision_id)
  const riskUid = normalizeText(payload.risk_uid)
  if (!revisionId || !riskUid) {
    const insertRes = await supabase.from('control_plan_rows').insert([payload]).select('id,created_at,updated_at').single()
    if (insertRes.error) throw insertRes.error
    return insertRes.data as { id: string; created_at: string | null; updated_at: string | null }
  }

  const existing = await fetchPcpRowByRevisionRiskUid(supabase, revisionId, riskUid)
  if (existing) {
    const patch = buildPcpExistingRowRestorePatch(existing, payload, options)
    const updateRes = await supabase
      .from('control_plan_rows')
      .update(patch)
      .eq('id', existing.id)
      .eq('revision_id', revisionId)
      .select('id,created_at,updated_at')
      .maybeSingle()
    if (updateRes.error) throw updateRes.error
    return (updateRes.data ?? existing) as { id: string; created_at: string | null; updated_at: string | null }
  }

  const insertRes = await supabase.from('control_plan_rows').insert([payload]).select('id,created_at,updated_at').single()
  if (!insertRes.error) return insertRes.data as { id: string; created_at: string | null; updated_at: string | null }
  if (!isDuplicatePcpRiskUidError(insertRes.error)) throw insertRes.error

  const racedExisting = await fetchPcpRowByRevisionRiskUid(supabase, revisionId, riskUid)
  if (!racedExisting) throw insertRes.error
  const patch = buildPcpExistingRowRestorePatch(racedExisting, payload, options)
  const updateRes = await supabase
    .from('control_plan_rows')
    .update(patch)
    .eq('id', racedExisting.id)
    .eq('revision_id', revisionId)
    .select('id,created_at,updated_at')
    .maybeSingle()
  if (updateRes.error) throw updateRes.error
  return (updateRes.data ?? racedExisting) as { id: string; created_at: string | null; updated_at: string | null }
}

export async function fetchPcpProjectView(supabase: SupabaseClient, projectId: string): Promise<PcpProjectView> {
  const { data, error } = await supabase
    .from('projects_with_revision')
    .select(PCP_PROJECT_VIEW_SELECT)
    .eq('id', projectId)
    .single()

  if (error) throw error
  return data as PcpProjectView
}

export async function fetchPcpEditSession(supabase: SupabaseClient, projectId: string): Promise<PcpEditSession | null> {
  const { data, error } = await supabase
    .from('pcp_edit_sessions')
    .select('project_id,locked_by,started_at,last_activity_at')
    .eq('project_id', projectId)
    .maybeSingle()

  if (error || !data) return null
  const row = data as PcpEditSessionDbRow
  return { projectId: row.project_id, lockedBy: row.locked_by, startedAt: row.started_at, lastActivityAt: row.last_activity_at }
}

export async function fetchPcpSelectionThreshold(supabase: SupabaseClient, projectId: string): Promise<number> {
  const { data, error } = await supabase
    .from('risk_matrix_config')
    .select('project_id,rpn_yellow_max')
    .in('project_id', [projectId, GLOBAL_PROJECT_ID])

  if (error) return 168
  const rows = (data ?? []) as Array<{ project_id?: string | null; rpn_yellow_max?: number | null }>
  const exact = rows.find((row) => row.project_id === projectId)
  const fallback = rows.find((row) => row.project_id === GLOBAL_PROJECT_ID)
  const raw = exact?.rpn_yellow_max ?? fallback?.rpn_yellow_max ?? 168
  return typeof raw === 'number' && Number.isFinite(raw) && raw >= 1 ? Math.trunc(raw) : 168
}

function normalizeRiskThreshold(value: unknown, fallback: number) {
  const numberValue = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numberValue)) return fallback
  return Math.max(1, Math.min(1000, Math.trunc(numberValue)))
}

function mapPcpRiskMatrixCells(rows: PcpRiskMatrixCellRow[]) {
  const map: Record<string, SharedRiskColor> = {}
  for (const row of rows) {
    const severity = Number(row.severity)
    const doValue = Number(row.do_value)
    const color = row.color
    if (!Number.isFinite(severity) || !Number.isFinite(doValue) || !color) continue
    map[riskCellKey(severity, doValue)] = color
  }
  return map
}

export async function fetchPcpRiskMatrixContext(supabase: SupabaseClient, projectId: string): Promise<PcpRiskMatrixContext> {
  const projectRes = await supabase.from('projects').select('organization_id').eq('id', projectId).maybeSingle()
  const organizationId = normalizeText((projectRes.data as { organization_id?: string | null } | null)?.organization_id)

  let config: PcpRiskMatrixConfigRow | null = null
  if (organizationId) {
    const orgConfigRes = await supabase
      .from('risk_matrix_config')
      .select('id,organization_id,mode,rpn_green_max,rpn_yellow_max,rpn_orange_max')
      .eq('organization_id', organizationId)
      .maybeSingle()
    if (!orgConfigRes.error) config = (orgConfigRes.data as PcpRiskMatrixConfigRow | null) ?? null
  }

  if (!config) {
    const defaultConfigRes = await supabase
      .from('risk_matrix_config')
      .select('id,project_id,mode,rpn_green_max,rpn_yellow_max,rpn_orange_max')
      .eq('id', 1)
      .maybeSingle()
    if (!defaultConfigRes.error) config = (defaultConfigRes.data as PcpRiskMatrixConfigRow | null) ?? null
  }

  let cells: Record<string, SharedRiskColor> = {}
  if (organizationId) {
    const orgCellsRes = await supabase
      .from('risk_matrix_cells')
      .select('organization_id,severity,do_value,color')
      .eq('organization_id', organizationId)
    if (!orgCellsRes.error) cells = mapPcpRiskMatrixCells((orgCellsRes.data ?? []) as PcpRiskMatrixCellRow[])
  }

  if (!Object.keys(cells).length) {
    const cellsRes = await supabase
      .from('risk_matrix_cells')
      .select('project_id,severity,do_value,color')
      .eq('project_id', GLOBAL_PROJECT_ID)
    if (!cellsRes.error) cells = mapPcpRiskMatrixCells((cellsRes.data ?? []) as PcpRiskMatrixCellRow[])
  }

  return {
    cells,
    mode: config?.mode ?? 'rpn',
    thresholds: {
      greenMax: normalizeRiskThreshold(config?.rpn_green_max, DEFAULT_RPN_THRESHOLDS.greenMax),
      yellowMax: normalizeRiskThreshold(config?.rpn_yellow_max, DEFAULT_RPN_THRESHOLDS.yellowMax),
      orangeMax: normalizeRiskThreshold(config?.rpn_orange_max, DEFAULT_RPN_THRESHOLDS.orangeMax),
    },
  }
}

export function getPcpSeedRiskColor(row: PfmeaPcpSeedRow, context: PcpRiskMatrixContext): SharedRiskColor | null {
  const severity = asInt1to10(row.severity)
  const occurrence = asInt1to10(row.occurrence)
  const detection = asInt1to10(row.detection)
  const currentDoValue = typeof row.oxd_current === 'number' && Number.isFinite(row.oxd_current)
    ? row.oxd_current
    : null
  const doValue = currentDoValue ?? (occurrence != null && detection != null ? occurrence * detection : null)

  if (severity != null && doValue != null) {
    return riskColorForMatrixCell(severity, doValue, context.mode, context.thresholds, context.cells)
  }

  const rpn = typeof row.rpn_current === 'number' && Number.isFinite(row.rpn_current)
    ? row.rpn_current
    : (typeof row.rpn === 'number' && Number.isFinite(row.rpn) ? row.rpn : null)
  return rpn == null ? null : riskColorFromRpnValue(rpn, context.thresholds)
}

export async function hydratePcpDraftRows(
  supabase: SupabaseClient,
  draftRevisionId: string | null | undefined,
  sourceRevisionId: string | null | undefined
) {
  const draftId = normalizeText(draftRevisionId)
  const sourceId = normalizeText(sourceRevisionId)
  if (!draftId || !sourceId || draftId === sourceId) return

  const draftRowsRes = await supabase
    .from('control_plan_rows')
    .select(PCP_ROW_DRAFT_HYDRATE_SELECT)
    .eq('revision_id', draftId)
    .order('created_at', { ascending: true })
  if (draftRowsRes.error) throw draftRowsRes.error

  const { data, error } = await supabase
    .from('control_plan_rows')
    .select(PCP_ROW_COPY_SELECT)
    .eq('revision_id', sourceId)
    .order('created_at', { ascending: true })
  if (error) throw error

  const sourceRows = (data ?? []) as Array<Partial<PcpRow> & { operation_id: string }>
  if (sourceRows.length === 0) return

  const draftRows = (draftRowsRes.data ?? []) as Array<Partial<PcpRow> & { id: string; operation_id: string }>
  const usedDraftRowIds = new Set<string>()
  const insertPayload: ReturnType<typeof buildPcpRowPayload>[] = []
  const pendingInsertKeys = new Set<string>()
  const restoreUpdates: Array<{ id: string; patch: Partial<PcpRow> }> = []
  const controlFields: Array<keyof Pick<PcpRow, 'control_method' | 'sample_size' | 'frequency' | 'reaction_plan'>> = [
    'control_method',
    'sample_size',
    'frequency',
    'reaction_plan',
  ]

  for (const sourceRow of sourceRows) {
    const matchingDraftRow = draftRows.find((candidate) => {
      if (usedDraftRowIds.has(candidate.id)) return false
      return (
        isEquivalentPcpRow(candidate, sourceRow) ||
        isSamePcpRiskContext(candidate, sourceRow) ||
        isSamePcpAutoConstraintContext(candidate, sourceRow)
      )
    })

    if (!matchingDraftRow) {
      const payload = buildPcpDraftHydrateInsertPayload(sourceRow, draftId)
      const insertKey = getPcpCarryoverInsertKey(payload)
      if (insertKey && pendingInsertKeys.has(insertKey)) continue
      if (insertKey) pendingInsertKeys.add(insertKey)
      insertPayload.push(payload)
      continue
    }

    usedDraftRowIds.add(matchingDraftRow.id)
    const restorePatch: Partial<PcpRow> = {}

    for (const field of controlFields) {
      const draftValue = normalizeText(matchingDraftRow[field])
      const sourceValue = normalizeText(sourceRow[field])
      if (!draftValue && sourceValue) {
        restorePatch[field] = sourceRow[field] ?? ''
      }
    }

    if (!normalizeText(matchingDraftRow.pfmea_row_id) && normalizeText(sourceRow.pfmea_row_id)) restorePatch.pfmea_row_id = sourceRow.pfmea_row_id ?? null
    if (!normalizeText(matchingDraftRow.failure_mode) && normalizeText(sourceRow.failure_mode)) restorePatch.failure_mode = sourceRow.failure_mode ?? ''
    if (!normalizeText(matchingDraftRow.characteristic) && normalizeText(sourceRow.characteristic)) restorePatch.characteristic = sourceRow.characteristic ?? ''
    if (!normalizeClassValue(matchingDraftRow.class) && normalizeClassValue(sourceRow.class)) restorePatch.class = normalizeClassValue(sourceRow.class)
    if (!normalizeText(matchingDraftRow.current_prevention) && normalizeText(sourceRow.current_prevention)) restorePatch.current_prevention = sourceRow.current_prevention ?? ''
    if (!normalizeText(matchingDraftRow.current_detection) && normalizeText(sourceRow.current_detection)) restorePatch.current_detection = sourceRow.current_detection ?? ''

    if (Object.keys(restorePatch).length > 0) {
      restoreUpdates.push({ id: matchingDraftRow.id, patch: restorePatch })
    }
  }

  if (insertPayload.length > 0) {
    for (const payload of insertPayload) {
      await upsertPcpPayloadByRevisionRiskUid(supabase, payload)
    }
  }

  for (const update of restoreUpdates) {
    const updateRes = await supabase.from('control_plan_rows').update(update.patch).eq('id', update.id).eq('revision_id', draftId)
    if (updateRes.error) throw updateRes.error
  }
}

export async function findEquivalentPcpRowInRevision(
  supabase: SupabaseClient,
  row: PcpRow,
  revisionId: string
): Promise<PcpRow | null> {
  const { data, error } = await supabase
    .from('control_plan_rows')
    .select(PCP_ROW_SELECT)
    .eq('revision_id', revisionId)
    .eq('operation_id', row.operation_id)
    .order('created_at', { ascending: true })
  if (error) throw error

  const revisionRows = ((data ?? []) as Array<PcpRow & { operations?: PcpOperation[] | PcpOperation | null }>).map(normalizeJoinedOperation)
  return revisionRows.find((candidate) => isEquivalentPcpRow(candidate, row) || isSamePcpRiskContext(candidate, row)) ?? null
}

export async function fetchPcpUserProjectRole(
  supabase: SupabaseClient,
  projectId: string,
  userId: string
): Promise<string | null> {
  const projectRes = await supabase.from('projects').select('organization_id').eq('id', projectId).maybeSingle()
  const organizationId = (projectRes.data as { organization_id?: string | null } | null)?.organization_id ?? null
  if (!organizationId) return null

  const memberRes = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .maybeSingle()

  return ((memberRes.data as { role?: string | null } | null)?.role ?? null)
}

export async function ensurePcpProcessDraft(
  supabase: SupabaseClient,
  projectId: string,
  userId: string
): Promise<string | null> {
  const { data, error } = await supabase.rpc('ensure_process_draft', {
    p_project_id: projectId,
    p_user_id: userId,
  })
  if (error) throw error
  return (data as string | null) ?? null
}

export async function fetchPcpOperations(supabase: SupabaseClient, projectId: string): Promise<PcpOperation[]> {
  const { data, error } = await supabase
    .from('operations')
    .select('id,project_id,operation_number,name,machine,operation,active')
    .eq('project_id', projectId)
    .eq('active', true)
    .order('operation_number', { ascending: true })

  if (error) throw error
  return (data ?? []) as PcpOperation[]
}

export async function fetchPcpRowsForRevision(
  supabase: SupabaseClient,
  projectId: string,
  revisionId: string
): Promise<PcpRow[]> {
  const { data, error } = await supabase
    .from('control_plan_rows')
    .select(PCP_ROW_SELECT)
    .eq('operations.project_id', projectId)
    .eq('revision_id', revisionId)
    .order('operation_number', { foreignTable: 'operations', ascending: true })
    .order('created_at', { ascending: true })

  if (error) throw error
  return ((data ?? []) as Array<PcpRow & { operations?: PcpOperation[] | PcpOperation | null }>).map(normalizeJoinedOperation)
}

const PCP_DRAFT_DIRTY_FIELDS: Array<keyof Pick<PcpRow, 'control_method' | 'sample_size' | 'frequency' | 'reaction_plan'>> = [
  'control_method',
  'sample_size',
  'frequency',
  'reaction_plan',
]

function getPcpDraftCompareKey(row: Partial<PcpRow>) {
  const riskUid = normalizeText(row.risk_uid)
  if (riskUid) return `risk:${riskUid}`

  const pfmeaRowId = normalizeText(row.pfmea_row_id)
  if (pfmeaRowId) return `pfmea:${pfmeaRowId}`

  return ''
}

function hasMeaningfulPcpControlFields(row: Partial<PcpRow>) {
  return PCP_DRAFT_DIRTY_FIELDS.some((field) => !!normalizeText(row[field]))
}

function getPcpControlSnapshot(row: Partial<PcpRow>) {
  return PCP_DRAFT_DIRTY_FIELDS.map((field) => normalizeText(row[field])).join('\u001f')
}

function choosePreferredPcpCompareRow<T extends Partial<PcpRow>>(a: T, b: T) {
  const aControlCount = PCP_DRAFT_DIRTY_FIELDS.filter((field) => !!normalizeText(a[field])).length
  const bControlCount = PCP_DRAFT_DIRTY_FIELDS.filter((field) => !!normalizeText(b[field])).length
  if (aControlCount !== bControlCount) return aControlCount > bControlCount ? a : b

  const aUpdated = getComparableTime(a.updated_at)
  const bUpdated = getComparableTime(b.updated_at)
  if (aUpdated !== bUpdated) return aUpdated > bUpdated ? a : b

  const aCreated = getComparableTime(a.created_at)
  const bCreated = getComparableTime(b.created_at)
  if (aCreated !== bCreated) return aCreated > bCreated ? a : b

  return normalizeText(a.id).localeCompare(normalizeText(b.id)) <= 0 ? a : b
}

function mapPcpRowsForDraftCompare<T extends Partial<PcpRow>>(rows: T[]) {
  const byKey = new Map<string, T>()

  for (const row of rows) {
    const key = getPcpDraftCompareKey(row)
    if (!key) continue
    const existing = byKey.get(key)
    byKey.set(key, existing ? choosePreferredPcpCompareRow(existing, row) : row)
  }

  return byKey
}

export function computePcpDraftDirtyStateFromRows(
  draftRows: Array<Partial<PcpRow>>,
  openRows: Array<Partial<PcpRow>>
) {
  const draftByKey = mapPcpRowsForDraftCompare(draftRows)
  const openByKey = mapPcpRowsForDraftCompare(openRows)
  let differenceCount = 0

  for (const [key, draftRow] of draftByKey) {
    const openRow = openByKey.get(key)
    if (!openRow) {
      if (hasMeaningfulPcpControlFields(draftRow)) differenceCount += 1
      continue
    }

    if (getPcpControlSnapshot(draftRow) !== getPcpControlSnapshot(openRow)) {
      differenceCount += 1
    }
  }

  for (const [key, openRow] of openByKey) {
    if (draftByKey.has(key)) continue
    if (hasMeaningfulPcpControlFields(openRow)) differenceCount += 1
  }

  return {
    differenceCount,
    isDirty: differenceCount > 0,
  }
}

export async function fetchPcpDraftDirtyState(
  supabase: SupabaseClient,
  params: {
    draftRevisionId: string | null | undefined
    openRevisionId: string | null | undefined
    projectId: string
  }
) {
  const draftRevisionId = normalizeText(params.draftRevisionId)
  const openRevisionId = normalizeText(params.openRevisionId)
  if (!draftRevisionId || !openRevisionId || draftRevisionId === openRevisionId) {
    return { differenceCount: 0, isDirty: false }
  }

  const [draftRows, openRows] = await Promise.all([
    fetchPcpRowsForRevision(supabase, params.projectId, draftRevisionId),
    fetchPcpRowsForRevision(supabase, params.projectId, openRevisionId),
  ])

  return computePcpDraftDirtyStateFromRows(draftRows, openRows)
}

async function fetchRevisionHasPfmeaRows(supabase: SupabaseClient, revisionId: string | null | undefined) {
  const normalizedRevisionId = normalizeText(revisionId)
  if (!normalizedRevisionId) return false
  const { data, error } = await supabase
    .from('pfmea_rows')
    .select('id')
    .eq('revision_id', normalizedRevisionId)
    .limit(1)

  if (error) throw error
  return (data?.length ?? 0) > 0
}

async function fetchActivePfmeaEditSession(
  supabase: SupabaseClient,
  projectId: string,
  nowMs: number,
  editLockMs: number
) {
  const { data, error } = await supabase
    .from('pfmea_edit_sessions')
    .select('project_id,locked_by,last_activity_at')
    .eq('project_id', projectId)
    .maybeSingle()

  if (error || !data) return false
  const row = data as { last_activity_at?: string | null; locked_by?: string | null }
  const lastActivity = row.last_activity_at ? new Date(row.last_activity_at).getTime() : 0
  return !!row.locked_by && Number.isFinite(lastActivity) && nowMs - lastActivity < editLockMs
}

export async function resolvePcpRevisionContext(
  supabase: SupabaseClient,
  params: {
    editLockMs: number
    forcePcpRevisionId?: string | null
    nowMs: number
    pcpDraftRevisionIdOverride?: string | null
    pcpIsEditOwner: boolean
    projectId: string
  }
): Promise<PcpRevisionContext> {
  const projectView = await fetchPcpProjectView(supabase, params.projectId)
  const openRevId = projectView.current_open_revision_id ?? null
  const draftRevId = params.pcpDraftRevisionIdOverride ?? projectView.current_draft_revision_id ?? null

  const pcpTargetRevisionId =
    params.forcePcpRevisionId ??
    (params.pcpIsEditOwner ? draftRevId ?? openRevId : openRevId ?? draftRevId)

  const pfmeaSessionIsActive = await fetchActivePfmeaEditSession(
    supabase,
    params.projectId,
    params.nowMs,
    params.editLockMs
  )
  const pfmeaDraftHasRows = pfmeaSessionIsActive && draftRevId
    ? await fetchRevisionHasPfmeaRows(supabase, draftRevId)
    : false
  const pfmeaSourceRevisionId = pfmeaDraftHasRows ? draftRevId : openRevId ?? draftRevId

  return {
    pcpHydrateSourceRevisionId:
      params.pcpIsEditOwner && draftRevId && pcpTargetRevisionId === draftRevId && openRevId && openRevId !== draftRevId
        ? openRevId
        : null,
    pcpTargetIsDraft: !!draftRevId && pcpTargetRevisionId === draftRevId,
    pcpTargetRevisionId,
    pfmeaDraftIsActive: !!pfmeaDraftHasRows,
    pfmeaSourceIsDraft: !!pfmeaDraftHasRows,
    pfmeaSourceRevisionId,
    projectView,
  }
}

export async function fetchPfmeaPcpSeedRows(
  supabase: SupabaseClient,
  projectId: string,
  revisionId: string
): Promise<PfmeaPcpSeedRow[]> {
  const { data, error } = await supabase
    .from('pfmea_rows')
    .select(PFMEA_PCP_SEED_SELECT)
    .eq('operations.project_id', projectId)
    .eq('revision_id', revisionId)
    .order('operation_number', { foreignTable: 'operations', ascending: true })
    .order('created_at', { ascending: true })

  if (error) throw error
  return ((data ?? []) as Array<PfmeaPcpSeedRow>).map(normalizeJoinedOperation)
}

export async function fetchLatestPfmeaRevisionIdForPcp(supabase: SupabaseClient, projectId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('pfmea_rows')
    .select('revision_id,created_at,operations!inner(project_id)')
    .eq('operations.project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) throw error
  const rows = (data ?? []) as Array<{ revision_id?: string | null }>
  return rows.find((row) => normalizeText(row.revision_id))?.revision_id ?? null
}

export async function fetchLatestPcpRevisionIdForPcp(
  supabase: SupabaseClient,
  projectId: string,
  excludedRevisionIds: Array<string | null | undefined> = []
): Promise<string | null> {
  const excluded = new Set(excludedRevisionIds.map(normalizeText).filter(Boolean))
  const { data, error } = await supabase
    .from('control_plan_rows')
    .select('revision_id,control_method,sample_size,frequency,reaction_plan,updated_at,created_at,operations!inner(project_id)')
    .eq('operations.project_id', projectId)
    .order('updated_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) throw error
  const rows = (data ?? []) as Array<{
    control_method?: string | null
    frequency?: string | null
    reaction_plan?: string | null
    revision_id?: string | null
    sample_size?: string | null
  }>
  const candidates = rows.filter((row) => {
    const revisionId = normalizeText(row.revision_id)
    return !!revisionId && !excluded.has(revisionId)
  })
  const rowWithControls = candidates.find((row) =>
    normalizeText(row.control_method) ||
    normalizeText(row.sample_size) ||
    normalizeText(row.frequency) ||
    normalizeText(row.reaction_plan)
  )
  return rowWithControls?.revision_id ?? candidates[0]?.revision_id ?? null
}

export async function backfillPcpRowsFromPfmea(
  supabase: SupabaseClient,
  revisionId: string,
  candidates: Array<{
    id: string
    patch: Pick<PcpRow, 'risk_uid' | 'pfmea_row_id' | 'failure_mode' | 'characteristic' | 'class' | 'current_prevention' | 'current_detection'>
  }>
) {
  const targetRevisionId = normalizeText(revisionId)
  if (!targetRevisionId || candidates.length === 0) return

  const updates = await Promise.all(
    candidates.map((candidate) =>
      supabase
        .from('control_plan_rows')
        .update(candidate.patch)
        .eq('id', candidate.id)
        .eq('revision_id', targetRevisionId)
    )
  )

  const failedUpdate = updates.find((result) => result.error)
  if (failedUpdate?.error) throw failedUpdate.error
}

export async function fetchPcpRevisionHistory(supabase: SupabaseClient, projectId: string): Promise<PcpHistoryEntry[]> {
  const { data, error } = await supabase
    .from('pcp_change_history')
    .select('id,created_at,revision_label,change_description,author_name,control_count')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(200)

  if (error || (data?.length ?? 0) === 0) return []

  const rows = (data ?? []) as Array<{ id?: string | null; created_at?: string | null; revision_label?: string | null; change_description?: string | null; author_name?: string | null; control_count?: number | null }>
  return rows.map((x, idx) => ({
    id: x.id ?? `pcp-h-db-${idx}`,
    at: x.created_at ?? new Date(0).toISOString(),
    revisionLabel: (x.revision_label ?? '0.0.0').toString(),
    author: normalizeText(x.author_name) || 'Unknown user',
    controlCount: x.control_count ?? null,
    description: x.change_description ?? '',
  }))
}

export async function fetchCurrentPcpDraftRevisionId(
  supabase: SupabaseClient,
  projectId: string
): Promise<string | null> {
  const projectRes = await supabase
    .from('projects_with_revision')
    .select('current_draft_revision_id')
    .eq('id', projectId)
    .maybeSingle()

  return (projectRes.data?.current_draft_revision_id as string | null | undefined) ?? null
}

export async function fetchPcpSessionLock(
  supabase: SupabaseClient,
  projectId: string
): Promise<{ lockedBy: string | null; lastActivityAt: string | null } | null> {
  const { data, error } = await supabase
    .from('pcp_edit_sessions')
    .select('project_id,locked_by,last_activity_at')
    .eq('project_id', projectId)
    .maybeSingle()

  if (error || !data) return null
  const row = data as { locked_by?: string | null; last_activity_at?: string | null }
  return { lockedBy: row.locked_by ?? null, lastActivityAt: row.last_activity_at ?? null }
}

export async function upsertPcpEditSession(
  supabase: SupabaseClient,
  projectId: string,
  userId: string,
  nowIso: string
) {
  const res = await supabase
    .from('pcp_edit_sessions')
    .upsert([{ project_id: projectId, locked_by: userId, started_at: nowIso, last_activity_at: nowIso, updated_at: nowIso }], { onConflict: 'project_id' })
  if (res.error) throw new Error(res.error.message)
}

export async function deletePcpDraftRows(supabase: SupabaseClient, revisionId: string) {
  const { error } = await supabase.from('control_plan_rows').delete().eq('revision_id', revisionId)
  if (error) throw error
}

export async function deletePcpEditSession(supabase: SupabaseClient, projectId: string, userId: string) {
  const { error } = await supabase.from('pcp_edit_sessions').delete().eq('project_id', projectId).eq('locked_by', userId)
  if (error) throw error
}

export async function touchPcpEditSession(supabase: SupabaseClient, projectId: string, userId: string, nowIso: string) {
  await supabase
    .from('pcp_edit_sessions')
    .update({ last_activity_at: nowIso, updated_at: nowIso })
    .eq('project_id', projectId)
    .eq('locked_by', userId)
}

export async function insertPcpRow(
  supabase: SupabaseClient,
  row: PcpPayloadSource
): Promise<{ id: string; created_at: string | null; updated_at: string | null }> {
  const insertPayload = buildPcpRowPayload(row)
  const ins = await upsertPcpPayloadByRevisionRiskUid(supabase, insertPayload, { overwriteControlFields: true })
  const id = (ins as { id?: string | null } | null)?.id
  if (!id) throw new Error('Failed to create PCP row.')
  return ins
}

export async function updatePcpRow(supabase: SupabaseClient, rowId: string, revisionId: string, patch: Partial<PcpRow>) {
  const res = await supabase.from('control_plan_rows').update(patch).eq('id', rowId).eq('revision_id', revisionId).select('id').maybeSingle()
  if (res.error) throw res.error
  const updatedId = (res.data as { id?: string | null } | null)?.id
  if (!updatedId) throw new Error(`PCP row update did not persist for row ${rowId} in revision ${revisionId}.`)
}

async function replacePfmeaRowsInRevisionFromOpen(
  supabase: SupabaseClient,
  params: {
    draftRevisionId: string
    openRevisionId: string | null
  }
) {
  if (!params.openRevisionId || params.openRevisionId === params.draftRevisionId) return

  const sourceRowsRes = await supabase
    .from('pfmea_rows')
    .select(PCP_PFMEA_CLONE_FIELDS.join(','))
    .eq('revision_id', params.openRevisionId)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
  if (sourceRowsRes.error) throw sourceRowsRes.error

  const deleteRes = await supabase
    .from('pfmea_rows')
    .delete()
    .eq('revision_id', params.draftRevisionId)
  if (deleteRes.error) throw deleteRes.error

  const sourceRows = ((sourceRowsRes.data ?? []) as unknown) as Array<Record<string, unknown>>
  if (sourceRows.length === 0) return

  const insertPayload = sourceRows.map((row) => ({
    ...row,
    revision_id: params.draftRevisionId,
  }))
  const insertRes = await supabase.from('pfmea_rows').insert(insertPayload)
  if (insertRes.error) throw insertRes.error
}

async function prunePcpRowsWithoutStablePfmeaRisk(
  supabase: SupabaseClient,
  params: {
    pcpRevisionId: string
    stablePfmeaRevisionId: string | null
  }
) {
  if (!params.stablePfmeaRevisionId || params.stablePfmeaRevisionId === params.pcpRevisionId) return

  const pfmeaRiskRes = await supabase
    .from('pfmea_rows')
    .select('risk_uid')
    .eq('revision_id', params.stablePfmeaRevisionId)
  if (pfmeaRiskRes.error) throw pfmeaRiskRes.error

  const stableRiskUids = new Set(
    ((pfmeaRiskRes.data ?? []) as Array<{ risk_uid?: string | null }>)
      .map((row) => normalizeText(row.risk_uid))
      .filter(Boolean)
  )

  const pcpRowsRes = await supabase
    .from('control_plan_rows')
    .select('id,risk_uid')
    .eq('revision_id', params.pcpRevisionId)
  if (pcpRowsRes.error) throw pcpRowsRes.error

  const idsToDelete = ((pcpRowsRes.data ?? []) as Array<{ id?: string | null; risk_uid?: string | null }>)
    .filter((row) => {
      const riskUid = normalizeText(row.risk_uid)
      return !!riskUid && !stableRiskUids.has(riskUid)
    })
    .map((row) => normalizeText(row.id))
    .filter(Boolean)

  for (let index = 0; index < idsToDelete.length; index += 100) {
    const batch = idsToDelete.slice(index, index + 100)
    const deleteRes = await supabase.from('control_plan_rows').delete().in('id', batch)
    if (deleteRes.error) throw deleteRes.error
  }
}

export async function preparePcpDraftForPublish(
  supabase: SupabaseClient,
  params: {
    editLockMs: number
    nowMs: number
    projectId: string
    userId: string
  }
) {
  const projectView = await fetchPcpProjectView(supabase, params.projectId)
  const draftRevisionId = projectView.current_draft_revision_id ?? await ensurePcpProcessDraft(supabase, params.projectId, params.userId)
  if (!draftRevisionId) throw new Error('PCP draft revision could not be prepared for publish.')

  const pfmeaSessionIsActive = await fetchActivePfmeaEditSession(
    supabase,
    params.projectId,
    params.nowMs,
    params.editLockMs
  )
  const activePfmeaDraftHasRows = pfmeaSessionIsActive && await fetchRevisionHasPfmeaRows(supabase, draftRevisionId)
  if (activePfmeaDraftHasRows) {
    throw new Error('PFMEA draft is active. Save or discard PFMEA changes before saving PCP.')
  }

  await replacePfmeaRowsInRevisionFromOpen(supabase, {
    draftRevisionId,
    openRevisionId: projectView.current_open_revision_id,
  })
  await prunePcpRowsWithoutStablePfmeaRisk(supabase, {
    pcpRevisionId: draftRevisionId,
    stablePfmeaRevisionId: projectView.current_open_revision_id,
  })

  return draftRevisionId
}

export async function publishPcpRevision(
  supabase: SupabaseClient,
  params: {
    authorId: string
    authorName: string
    changeDescription: string
    controlCount: number
    projectId: string
  }
) {
  const { error } = await supabase.rpc('publish_process_module_revision', {
    p_project_id: params.projectId,
    p_module: 'PCP',
    p_change_description: params.changeDescription,
    p_user_id: params.authorId,
  })
  if (error) throw error

  const revRes = await supabase
    .from('projects_with_revision')
    .select('open_revision_label,draft_revision_label')
    .eq('id', params.projectId)
    .maybeSingle()
  const row = (revRes.data ?? null) as { open_revision_label?: string | null; draft_revision_label?: string | null } | null
  const revisionLabel = (row?.draft_revision_label ?? row?.open_revision_label ?? '0.0.0').toString()

  const historyRes = await supabase.from('pcp_change_history').insert([{
    project_id: params.projectId,
    revision_label: revisionLabel || '0.0.0',
    change_description: params.changeDescription,
    author_id: params.authorId,
    author_name: params.authorName || 'Unknown user',
    control_count: params.controlCount,
    created_at: new Date().toISOString(),
  }])
  if (historyRes.error) throw historyRes.error
}
