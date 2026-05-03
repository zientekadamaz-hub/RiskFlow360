import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeHistoryText, toFiniteNumber } from './pfmea-display-utils'
import {
  PFMEA_SELECT_FIELDS,
  PFMEA_SELECT_FIELDS_LEGACY,
  buildPfmeaInsertPayloadForRevision,
  isMissingPfmeaGroupIdColumnError,
  stripPfmeaGroupIdsFromPayload,
  type PfmeaPayloadRow,
} from './pfmea-payload-utils'
import { isPlaceholderRowId } from './pfmea-hierarchy-utils'
import { getPfmeaRowOperationIds, sortPfmeaRows } from './pfmea-row-order-utils'

export type PfmeaProjectView = {
  id: string
  name: string
  standard?: string | null
  status: 'DRAFT' | 'OPEN' | 'OBSOLETE'
  current_open_revision_id: string | null
  current_draft_revision_id: string | null
  open_revision_label: string | null
  draft_revision_label: string | null
}

export type PfmeaEditSession = {
  projectId: string
  lockedBy: string
  startedAt: string
  lastActivityAt: string
}

export type PfmeaHistoryEntry = {
  id: string
  at: string
  revisionLabel: string
  author: string
  riskCount: number | null
  avgRpn: number | null
  description: string
}

export type PfmeaRevisionRowsResult<Row extends PfmeaPayloadRow = PfmeaPayloadRow> = {
  groupIdsSupported: boolean
  rows: Row[]
}

export type PfmeaEditSessionStartResult =
  | {
      blocked: true
      message: string
    }
  | {
      blocked: false
      draftRevisionId: string | null
      draftRowsDeleted: boolean
      openRevisionId: string | null
      projectView: PfmeaProjectView
      shouldRefreshExistingDraftFromOpen: boolean
    }

type ProfileNameRow = {
  first_name?: string | null
  last_name?: string | null
}

type PfmeaEditSessionLockRow = {
  locked_by?: string | null
  last_activity_at?: string | null
}

const PFMEA_PROJECT_VIEW_SELECT = 'id,name,standard,status,current_open_revision_id,current_draft_revision_id,open_revision_label,draft_revision_label'

function fullName(row: ProfileNameRow | null | undefined) {
  return `${(row?.first_name ?? '').trim()} ${(row?.last_name ?? '').trim()}`.trim()
}

export async function fetchPfmeaAuthorName(supabase: SupabaseClient, userId: string): Promise<string> {
  if (!userId) return 'Unknown user'

  try {
    const res = await supabase
      .from('profiles')
      .select('first_name,last_name')
      .eq('id', userId)
      .maybeSingle()

    return fullName(res.data as ProfileNameRow | null) || 'Unknown user'
  } catch {
    return 'Unknown user'
  }
}

export async function fetchPfmeaProjectRole(
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

export async function fetchPfmeaEditSession(supabase: SupabaseClient, projectId: string): Promise<PfmeaEditSession | null> {
  if (!projectId) return null

  const res = await supabase
    .from('pfmea_edit_sessions')
    .select('project_id,locked_by,started_at,last_activity_at')
    .eq('project_id', projectId)
    .maybeSingle()

  if (res.error || !res.data) return null

  const row = res.data as {
    project_id: string
    locked_by: string
    started_at: string
    last_activity_at: string
  }

  return {
    projectId: row.project_id,
    lockedBy: row.locked_by,
    startedAt: row.started_at,
    lastActivityAt: row.last_activity_at,
  }
}

export async function fetchPfmeaProjectView(
  supabase: SupabaseClient,
  projectId: string
): Promise<PfmeaProjectView> {
  const res = await supabase
    .from('projects_with_revision')
    .select(PFMEA_PROJECT_VIEW_SELECT)
    .eq('id', projectId)
    .single()

  if (res.error) throw res.error
  return res.data as PfmeaProjectView
}

export async function fetchPfmeaCurrentDraftRevisionId(
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

export async function fetchPfmeaRowsForRevision<Row extends PfmeaPayloadRow = PfmeaPayloadRow>(
  supabase: SupabaseClient,
  params: {
    groupIdsSupported?: boolean | null
    operationIds?: string[]
    revisionId: string
  }
): Promise<PfmeaRevisionRowsResult<Row>> {
  if (!params.revisionId) return { groupIdsSupported: params.groupIdsSupported !== false, rows: [] }

  const scopedOperationIds = Array.from(new Set((params.operationIds ?? []).map((id) => String(id || '').trim()).filter(Boolean)))
  const selectFields = params.groupIdsSupported === false ? PFMEA_SELECT_FIELDS_LEGACY : PFMEA_SELECT_FIELDS
  let query = supabase.from('pfmea_rows').select(selectFields).eq('revision_id', params.revisionId)

  if (scopedOperationIds.length > 0) {
    query = query.in('operation_id', scopedOperationIds)
  }

  let response = await query
    .order('operation_number', { foreignTable: 'operations', ascending: true })
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })

  if (response.error && isMissingPfmeaGroupIdColumnError(response.error)) {
    let legacyQuery = supabase.from('pfmea_rows').select(PFMEA_SELECT_FIELDS_LEGACY).eq('revision_id', params.revisionId)
    if (scopedOperationIds.length > 0) {
      legacyQuery = legacyQuery.in('operation_id', scopedOperationIds)
    }
    response = await legacyQuery
      .order('operation_number', { foreignTable: 'operations', ascending: true })
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })

    if (response.error) throw response.error
    return {
      groupIdsSupported: false,
      rows: (response.data ?? []) as unknown as Row[],
    }
  }

  if (response.error) throw response.error
  return {
    groupIdsSupported: params.groupIdsSupported !== false,
    rows: (response.data ?? []) as unknown as Row[],
  }
}

export async function restorePfmeaRowsSnapshotToRevision<Row extends PfmeaPayloadRow = PfmeaPayloadRow>(
  supabase: SupabaseClient,
  params: {
    batchSize?: number
    groupIdsSupported?: boolean | null
    revisionId: string
    sourceRows: Row[]
  }
): Promise<PfmeaRevisionRowsResult<Row>> {
  const snapshotRows = sortPfmeaRows(params.sourceRows).filter((row) => !isPlaceholderRowId(row.id)) as Row[]
  if (!params.revisionId || snapshotRows.length === 0) {
    return { groupIdsSupported: params.groupIdsSupported !== false, rows: [] }
  }

  const operationIds = getPfmeaRowOperationIds(snapshotRows)
  if (operationIds.length === 0) {
    throw new Error(`PFMEA safety restore failed for revision ${params.revisionId}: no operation ids were found in the snapshot.`)
  }

  const deleteRes = await supabase.from('pfmea_rows').delete().eq('revision_id', params.revisionId).in('operation_id', operationIds)
  if (deleteRes.error) throw deleteRes.error

  const batchSize = params.batchSize ?? 25
  for (let index = 0; index < snapshotRows.length; index += batchSize) {
    const batch = snapshotRows.slice(index, index + batchSize)
    const payload = batch.map((row) => {
      const insertPayload = buildPfmeaInsertPayloadForRevision(row, params.revisionId)
      return params.groupIdsSupported === false
        ? stripPfmeaGroupIdsFromPayload(insertPayload as Record<string, unknown>)
        : insertPayload
    })
    const insertRes = await supabase.from('pfmea_rows').insert(payload)
    if (insertRes.error) throw insertRes.error
  }

  return fetchPfmeaRowsForRevision<Row>(supabase, {
    groupIdsSupported: params.groupIdsSupported,
    operationIds,
    revisionId: params.revisionId,
  })
}

export async function ensurePfmeaProcessDraft(
  supabase: SupabaseClient,
  projectId: string,
  userId: string
): Promise<string | null> {
  const res = await supabase.rpc('ensure_process_draft', {
    p_project_id: projectId,
    p_user_id: userId,
  })
  if (res.error) throw res.error
  return (res.data as string | null) ?? null
}

export async function startPfmeaEditSession(
  supabase: SupabaseClient,
  params: {
    draftRevisionIdOverride?: string | null
    editLockMs: number
    hasExistingDraftRevision: boolean
    isChampion: boolean
    nowIso?: string
    nowMs?: number
    projectId: string
    userId: string
  }
): Promise<PfmeaEditSessionStartResult> {
  const nowMs = params.nowMs ?? Date.now()
  const nowIso = params.nowIso ?? new Date(nowMs).toISOString()
  const lockRes = await supabase
    .from('pfmea_edit_sessions')
    .select('project_id,locked_by,last_activity_at')
    .eq('project_id', params.projectId)
    .maybeSingle()
  if (lockRes.error) throw lockRes.error

  const lock = (lockRes.data ?? null) as PfmeaEditSessionLockRow | null
  const otherOwner = lock?.locked_by ?? null
  const last = lock?.last_activity_at ? new Date(lock.last_activity_at).getTime() : 0
  const hasActiveOwnedSession = !!otherOwner && otherOwner === params.userId && nowMs - last < params.editLockMs
  const hasActiveOther = !!otherOwner && otherOwner !== params.userId && nowMs - last < params.editLockMs
  let shouldRefreshExistingDraftFromOpen = params.hasExistingDraftRevision && !hasActiveOwnedSession
  let draftRowsDeleted = false

  if (hasActiveOther && !params.isChampion) {
    return { blocked: true, message: 'This PFMEA is currently locked by another user.' }
  }

  if (otherOwner && otherOwner !== params.userId) {
    const draftId = await fetchPfmeaCurrentDraftRevisionId(supabase, params.projectId) ?? params.draftRevisionIdOverride ?? null
    if (draftId) {
      await deletePfmeaRowsByRevision(supabase, draftId)
      draftRowsDeleted = true
    }
    shouldRefreshExistingDraftFromOpen = false
  }

  if (!hasActiveOther && !hasActiveOwnedSession && params.hasExistingDraftRevision) {
    const draftId = await fetchPfmeaCurrentDraftRevisionId(supabase, params.projectId) ?? params.draftRevisionIdOverride ?? null
    if (draftId) {
      await deletePfmeaRowsByRevision(supabase, draftId)
      draftRowsDeleted = true
    }
  }

  const upsertRes = await supabase.from('pfmea_edit_sessions').upsert(
    [
      {
        project_id: params.projectId,
        locked_by: params.userId,
        started_at: nowIso,
        last_activity_at: nowIso,
        updated_at: nowIso,
      },
    ],
    { onConflict: 'project_id' }
  )
  if (upsertRes.error) throw new Error(upsertRes.error.message)

  const ensuredDraftId = await ensurePfmeaProcessDraft(supabase, params.projectId, params.userId)
  const projectView = await fetchPfmeaProjectView(supabase, params.projectId)
  const draftRevisionId = projectView.current_draft_revision_id ?? ensuredDraftId

  return {
    blocked: false,
    draftRevisionId,
    draftRowsDeleted,
    openRevisionId: projectView.current_open_revision_id ?? null,
    projectView,
    shouldRefreshExistingDraftFromOpen,
  }
}

export async function fetchPfmeaRevisionHistory(
  supabase: SupabaseClient,
  projectId: string
): Promise<PfmeaHistoryEntry[]> {
  if (!projectId) return []

  const customRes = await supabase
    .from('pfmea_change_history')
    .select('id,created_at,revision_label,change_description,author_name,risk_count,avg_rpn')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(200)

  if (customRes.error || (customRes.data?.length ?? 0) === 0) return []

  const rowsRaw = (customRes.data ?? []) as Array<{
    id?: string | null
    created_at?: string | null
    revision_label?: string | null
    change_description?: string | null
    author_name?: string | null
    risk_count?: number | null
    avg_rpn?: number | string | null
  }>

  return rowsRaw.map((x, idx) => ({
    id: x.id ?? `pfmea-h-db-${idx}`,
    at: x.created_at ?? new Date(0).toISOString(),
    revisionLabel: (x.revision_label ?? '0.0.0').toString(),
    author: normalizeHistoryText(x.author_name) || 'Unknown user',
    riskCount: toFiniteNumber(x.risk_count),
    avgRpn: toFiniteNumber(x.avg_rpn),
    description: x.change_description ?? '',
  }))
}

export async function deletePfmeaRowsByRevision(supabase: SupabaseClient, revisionId: string) {
  const res = await supabase.from('pfmea_rows').delete().eq('revision_id', revisionId)
  if (res.error) throw res.error
}

export async function deletePfmeaEditSession(supabase: SupabaseClient, projectId: string, userId: string) {
  const res = await supabase.from('pfmea_edit_sessions').delete().eq('project_id', projectId).eq('locked_by', userId)
  if (res.error) throw res.error
}
