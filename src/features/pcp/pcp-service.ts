import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildPcpRowPayload,
  isEquivalentPcpRow,
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

export type PfmeaPcpSeedRow = {
  id: string
  operation_id: string
  pcp: boolean | null
  failure_mode: string | null
  class: string | null
  characteristic: string | null
  severity: number | string | null
  rpn: number | null
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

const GLOBAL_PROJECT_ID = '00000000-0000-0000-0000-000000000000'

const PCP_PROJECT_VIEW_SELECT = 'id,name,status,current_open_revision_id,current_draft_revision_id,open_revision_label,draft_revision_label'
const PCP_ROW_SELECT = 'id,revision_id,operation_id,pfmea_row_id,failure_mode,characteristic,class,current_prevention,current_detection,control_method,sample_size,frequency,reaction_plan,source,status,created_at,updated_at,operations!inner(id,project_id,operation_number,name,machine,operation,active)'
const PCP_ROW_COPY_SELECT = 'operation_id,pfmea_row_id,failure_mode,characteristic,class,current_prevention,current_detection,control_method,sample_size,frequency,reaction_plan,source,status'
const PFMEA_PCP_SEED_SELECT = 'id,operation_id,pcp,failure_mode,class,characteristic,severity,rpn,current_prevention,current_detection,created_at,operations!inner(id,project_id,operation_number,name,machine,operation,active)'

function normalizeJoinedOperation<T extends { operations?: PcpOperation | PcpOperation[] | null }>(row: T): T & { operations: PcpOperation | null } {
  return {
    ...row,
    operations: Array.isArray(row.operations) ? (row.operations[0] ?? null) : (row.operations ?? null),
  }
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

export async function hydratePcpDraftRows(
  supabase: SupabaseClient,
  draftRevisionId: string | null | undefined,
  sourceRevisionId: string | null | undefined
) {
  const draftId = normalizeText(draftRevisionId)
  const sourceId = normalizeText(sourceRevisionId)
  if (!draftId || !sourceId || draftId === sourceId) return

  const draftCountRes = await supabase
    .from('control_plan_rows')
    .select('id', { count: 'exact', head: true })
    .eq('revision_id', draftId)
  if ((draftCountRes.count ?? 0) > 0) return

  const { data, error } = await supabase
    .from('control_plan_rows')
    .select(PCP_ROW_COPY_SELECT)
    .eq('revision_id', sourceId)
    .order('created_at', { ascending: true })
  if (error) throw error

  const sourceRows = (data ?? []) as Array<Partial<PcpRow> & { operation_id: string }>
  if (sourceRows.length === 0) return

  const insertPayload = sourceRows.map((row) => buildPcpRowPayload({ ...row, revision_id: draftId }))
  const insertRes = await supabase.from('control_plan_rows').insert(insertPayload)
  if (insertRes.error) throw insertRes.error
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
  return revisionRows.find((candidate) => isEquivalentPcpRow(candidate, row)) ?? null
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

export async function backfillPcpRowsFromPfmea(
  supabase: SupabaseClient,
  candidates: Array<{
    id: string
    patch: Pick<PcpRow, 'pfmea_row_id' | 'failure_mode' | 'characteristic' | 'class' | 'current_prevention' | 'current_detection'>
  }>
) {
  if (candidates.length === 0) return

  const updates = await Promise.all(
    candidates.map((candidate) =>
      supabase
        .from('control_plan_rows')
        .update(candidate.patch)
        .eq('id', candidate.id)
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
  const ins = await supabase.from('control_plan_rows').insert([insertPayload]).select('id,created_at,updated_at').single()
  if (ins.error) throw ins.error
  const id = (ins.data as { id?: string | null } | null)?.id
  if (!id) throw new Error('Failed to create PCP row.')
  return ins.data as { id: string; created_at: string | null; updated_at: string | null }
}

export async function updatePcpRow(supabase: SupabaseClient, rowId: string, revisionId: string, patch: Partial<PcpRow>) {
  const res = await supabase.from('control_plan_rows').update(patch).eq('id', rowId).eq('revision_id', revisionId)
  if (res.error) throw res.error
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
