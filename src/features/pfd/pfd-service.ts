import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  OperationRow,
  PfdEditSession,
  PfdHistoryEntry,
  PersistedPfdDiagram,
  PfdUserContext,
  ProjectProcessOptionRow,
} from './types'

type ProfileNameRow = {
  first_name?: string | null
  last_name?: string | null
}

type PfdEditSessionRow = {
  project_id?: string | null
  locked_by?: string | null
  started_at?: string | null
  last_activity_at?: string | null
}

type PfdSessionEventRow = {
  id: string
  message?: string | null
}

type ProjectRevisionRow = {
  open_revision_label?: string | null
  draft_revision_label?: string | null
}

type ProjectContextRow = {
  organization_id?: string | null
  site_department_id?: string | null
  name?: string | null
}

type PfdHistoryRow = {
  id?: string | null
  created_at?: string | null
  revision_label?: string | null
  change_description?: string | null
  author_name?: string | null
  node_count?: number | null
  edge_count?: number | null
}

type DiagramRow = {
  nodes?: unknown[] | null
  edges?: unknown[] | null
}

function fullName(row: ProfileNameRow | null | undefined) {
  return `${(row?.first_name ?? '').trim()} ${(row?.last_name ?? '').trim()}`.trim()
}

export async function fetchPfdUserContext(supabase: SupabaseClient): Promise<PfdUserContext> {
  try {
    const authRes = await supabase.auth.getUser()
    const user = authRes.data.user
    if (!user) {
      return { currentUserId: null, historyAuthor: 'Unknown user' }
    }

    const profileRes = await supabase
      .from('profiles')
      .select('first_name,last_name')
      .eq('id', user.id)
      .maybeSingle()

    const profile = (profileRes.data ?? null) as ProfileNameRow | null
    const profileFull = fullName(profile)
    if (profileFull) {
      return { currentUserId: user.id, historyAuthor: profileFull }
    }

    const metaFirst = (user.user_metadata?.first_name as string | undefined) ?? ''
    const metaLast = (user.user_metadata?.last_name as string | undefined) ?? ''
    const metaFull = `${metaFirst.trim()} ${metaLast.trim()}`.trim()

    return {
      currentUserId: user.id,
      historyAuthor: metaFull || 'Unknown user',
    }
  } catch {
    return { currentUserId: null, historyAuthor: 'Unknown user' }
  }
}

export async function fetchPfdEditSession(supabase: SupabaseClient, projectId: string): Promise<PfdEditSession | null> {
  if (!projectId) return null

  try {
    const res = await supabase
      .from('pfd_edit_sessions')
      .select('project_id,locked_by,started_at,last_activity_at')
      .eq('project_id', projectId)
      .maybeSingle()

    if (res.error || !res.data) return null

    const row = res.data as PfdEditSessionRow
    if (!row.locked_by) return null

    let lockedByName = 'Unknown user'
    const profileRes = await supabase
      .from('profiles')
      .select('first_name,last_name')
      .eq('id', row.locked_by)
      .maybeSingle()

    if (!profileRes.error && profileRes.data) {
      const full = fullName(profileRes.data as ProfileNameRow)
      if (full) lockedByName = full
    }

    return {
      projectId: row.project_id ?? projectId,
      lockedBy: row.locked_by,
      startedAt: row.started_at ?? new Date().toISOString(),
      lastActivityAt: row.last_activity_at ?? row.started_at ?? new Date().toISOString(),
      lockedByName,
    }
  } catch {
    return null
  }
}

export async function fetchUnreadPfdSessionNotice(
  supabase: SupabaseClient,
  projectId: string,
  currentUserId: string
): Promise<string | null> {
  if (!projectId || !currentUserId) return null

  try {
    const res = await supabase
      .from('pfd_session_events')
      .select('id,message')
      .eq('project_id', projectId)
      .eq('user_id', currentUserId)
      .is('read_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (res.error || !res.data) return null

    const event = res.data as PfdSessionEventRow
    await supabase.from('pfd_session_events').update({ read_at: new Date().toISOString() }).eq('id', event.id)
    return (event.message ?? '').trim() || 'Your draft session is no longer available.'
  } catch {
    return null
  }
}

export async function fetchPfdRevisionLabel(supabase: SupabaseClient, projectId: string): Promise<string> {
  if (!projectId) return '0.0.0'

  try {
    const res = await supabase
      .from('projects_with_revision')
      .select('open_revision_label,draft_revision_label')
      .eq('id', projectId)
      .maybeSingle()

    if (res.error) return '0.0.0'
    const row = (res.data ?? null) as ProjectRevisionRow | null
    return (row?.draft_revision_label ?? row?.open_revision_label ?? '0.0.0').toString() || '0.0.0'
  } catch {
    return '0.0.0'
  }
}

export async function fetchPfdProcessOptions(supabase: SupabaseClient, projectId: string): Promise<string[]> {
  if (!projectId) return []

  try {
    const projectRes = await supabase
      .from('projects')
      .select('organization_id,site_department_id,name')
      .eq('id', projectId)
      .maybeSingle()

    const projectRow = (projectRes.data as ProjectContextRow | null) ?? null
    const organizationId = projectRow?.organization_id ?? null
    const siteDepartmentId = projectRow?.site_department_id ?? null
    if (!organizationId) return []

    let query = supabase
      .from('projects')
      .select('name')
      .eq('organization_id', organizationId)
      .not('name', 'is', null)
      .order('name', { ascending: true })

    if (siteDepartmentId) query = query.eq('site_department_id', siteDepartmentId)

    const optionsRes = await query
    if (optionsRes.error) return []

    return Array.from(
      new Set(
        ((optionsRes.data ?? []) as ProjectProcessOptionRow[])
          .map((row) => (row.name ?? '').trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b))
  } catch {
    return []
  }
}

export async function fetchPfdHistory(supabase: SupabaseClient, projectId: string): Promise<PfdHistoryEntry[]> {
  if (!projectId) return []

  try {
    const dbRes = await supabase
      .from('pfd_change_history')
      .select('id,created_at,revision_label,change_description,author_name,node_count,edge_count')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(200)

    if (dbRes.error || (dbRes.data?.length ?? 0) === 0) return []

    const rows = (dbRes.data ?? []) as PfdHistoryRow[]
    return rows.map((row, index) => {
      const revisionLabel = (row.revision_label ?? '').toString() || '0.0.0'
      const revision = Number.parseInt(revisionLabel.split('.')[0] ?? '', 10)
      return {
        id: row.id ?? `pfd-h-db-${index}`,
        at: row.created_at ?? new Date(0).toISOString(),
        revision: Number.isFinite(revision) ? revision : 0,
        revisionLabel,
        author: (row.author_name ?? '').trim() || 'Unknown user',
        description: row.change_description ?? '',
        nodeCount: Number.isFinite(row.node_count) ? Number(row.node_count) : 0,
        edgeCount: Number.isFinite(row.edge_count) ? Number(row.edge_count) : 0,
      }
    })
  } catch {
    return []
  }
}

export async function fetchPfdCanvasData(
  supabase: SupabaseClient,
  projectId: string
): Promise<{ diagram: PersistedPfdDiagram | null; operations: OperationRow[] }> {
  const diagRes = await supabase
    .from('pfd_diagrams')
    .select('project_id,nodes,edges')
    .eq('project_id', projectId)
    .maybeSingle()

  if (diagRes.error) throw new Error(diagRes.error.message)

  const opsRes = await supabase
    .from('operations')
    .select('id,project_id,operation_number,name,machine,operation,active')
    .eq('project_id', projectId)
    .eq('active', true)
    .order('operation_number', { ascending: true })

  if (opsRes.error) throw new Error(opsRes.error.message)

  const diagramRow = (diagRes.data ?? null) as DiagramRow | null
  let operations = (opsRes.data ?? []) as OperationRow[]

  if ((!diagramRow?.nodes || !diagramRow?.edges) && operations.length === 0) {
    const insertRes = await supabase
      .from('operations')
      .insert([{ project_id: projectId, operation_number: 10, name: '', machine: '', operation: '', active: true }])
      .select('id,project_id,operation_number,name,machine,operation,active')
      .single()

    if (insertRes.error) throw new Error(insertRes.error.message)
    operations = [insertRes.data as OperationRow]
  }

  const diagram =
    diagramRow?.nodes && diagramRow?.edges
      ? { nodes: diagramRow.nodes, edges: diagramRow.edges }
      : null

  return { diagram, operations }
}

export async function publishPfdDiagram(
  supabase: SupabaseClient,
  params: {
    projectId: string
    currentUserId: string
    historyAuthor: string
    description: string
    nodes: unknown[]
    edges: unknown[]
  }
) {
  const payload = {
    project_id: params.projectId,
    nodes: params.nodes,
    edges: params.edges,
    updated_at: new Date().toISOString(),
  }

  const upsertRes = await supabase.from('pfd_diagrams').upsert([payload], { onConflict: 'project_id' })
  if (upsertRes.error) throw new Error(upsertRes.error.message)

  const publishRes = await supabase.rpc('publish_process_module_revision', {
    p_project_id: params.projectId,
    p_module: 'PFD',
    p_change_description: params.description,
    p_user_id: params.currentUserId,
  })
  if (publishRes.error) throw new Error(publishRes.error.message)

  const revisionLabel = await fetchPfdRevisionLabel(supabase, params.projectId)

  await supabase.from('pfd_change_history').insert([
    {
      project_id: params.projectId,
      revision_label: revisionLabel || '0.0.0',
      change_description: params.description,
      author_id: params.currentUserId,
      author_name: params.historyAuthor || 'Unknown user',
      node_count: params.nodes.length,
      edge_count: params.edges.length,
      created_at: new Date().toISOString(),
    },
  ])

  await supabase.from('pfd_drafts').delete().eq('project_id', params.projectId).eq('user_id', params.currentUserId)
  await supabase.from('pfd_edit_sessions').delete().eq('project_id', params.projectId).eq('locked_by', params.currentUserId)

  return { revisionLabel }
}

export async function startPfdEditSession(
  supabase: SupabaseClient,
  params: {
    projectId: string
    currentUserId: string
    nodes: unknown[]
    edges: unknown[]
    editLockMs: number
  }
) {
  const nowIso = new Date().toISOString()
  const res = await supabase
    .from('pfd_edit_sessions')
    .select('project_id,locked_by,last_activity_at')
    .eq('project_id', params.projectId)
    .maybeSingle()

  if (res.error) throw new Error(res.error.message)

  const row = (res.data ?? null) as { locked_by?: string | null; last_activity_at?: string | null } | null
  const otherOwner = row?.locked_by ?? null
  const last = row?.last_activity_at ? new Date(row.last_activity_at).getTime() : 0
  const hasActiveOther =
    !!otherOwner &&
    otherOwner !== params.currentUserId &&
    Date.now() - last < params.editLockMs

  if (hasActiveOther) {
    return { blocked: true as const, message: 'This PFD is currently locked by another user.' }
  }

  if (otherOwner && otherOwner !== params.currentUserId) {
    const deleteDraftRes = await supabase
      .from('pfd_drafts')
      .delete()
      .eq('project_id', params.projectId)
      .neq('user_id', params.currentUserId)

    if (deleteDraftRes.error) throw new Error(deleteDraftRes.error.message)

    const reason = Date.now() - last >= params.editLockMs ? '48h inactivity timeout' : 'session takeover'
    const notifyRes = await supabase.from('pfd_session_events').insert([
      {
        project_id: params.projectId,
        user_id: otherOwner,
        message: `Your PFD draft session was taken over by another user (${reason}).`,
      },
    ])

    if (notifyRes.error) throw new Error(notifyRes.error.message)
  }

  const upsertRes = await supabase.from('pfd_edit_sessions').upsert(
    [
      {
        project_id: params.projectId,
        locked_by: params.currentUserId,
        started_at: nowIso,
        last_activity_at: nowIso,
        updated_at: nowIso,
      },
    ],
    { onConflict: 'project_id' }
  )
  if (upsertRes.error) throw new Error(upsertRes.error.message)

  const ownDraftRes = await supabase
    .from('pfd_drafts')
    .select('project_id')
    .eq('project_id', params.projectId)
    .eq('user_id', params.currentUserId)
    .maybeSingle()

  if (ownDraftRes.error) throw new Error(ownDraftRes.error.message)

  if (!ownDraftRes.data) {
    const createDraftRes = await supabase.from('pfd_drafts').upsert(
      [
        {
          project_id: params.projectId,
          user_id: params.currentUserId,
          nodes: params.nodes,
          edges: params.edges,
          updated_at: nowIso,
        },
      ],
      { onConflict: 'project_id,user_id' }
    )

    if (createDraftRes.error) throw new Error(createDraftRes.error.message)
  }

  return { blocked: false as const }
}

export async function fetchOwnPfdDraft(
  supabase: SupabaseClient,
  params: { projectId: string; currentUserId: string }
): Promise<PersistedPfdDiagram | null> {
  const res = await supabase
    .from('pfd_drafts')
    .select('nodes,edges')
    .eq('project_id', params.projectId)
    .eq('user_id', params.currentUserId)
    .maybeSingle()

  if (res.error || !res.data) return null

  const row = res.data as DiagramRow
  if (!row.nodes || !row.edges) return null
  return { nodes: row.nodes, edges: row.edges }
}

export async function discardPfdDraftAndCloseSession(
  supabase: SupabaseClient,
  params: { projectId: string; currentUserId: string }
) {
  const deleteDraftRes = await supabase
    .from('pfd_drafts')
    .delete()
    .eq('project_id', params.projectId)
    .eq('user_id', params.currentUserId)
  if (deleteDraftRes.error) throw new Error(deleteDraftRes.error.message)

  const deleteSessionRes = await supabase
    .from('pfd_edit_sessions')
    .delete()
    .eq('project_id', params.projectId)
    .eq('locked_by', params.currentUserId)
  if (deleteSessionRes.error) throw new Error(deleteSessionRes.error.message)
}

export async function heartbeatPfdEditSession(
  supabase: SupabaseClient,
  params: { projectId: string; currentUserId: string; at?: string }
) {
  const nowIso = params.at ?? new Date().toISOString()
  const res = await supabase
    .from('pfd_edit_sessions')
    .update({ last_activity_at: nowIso, updated_at: nowIso })
    .eq('project_id', params.projectId)
    .eq('locked_by', params.currentUserId)

  if (res.error) throw new Error(res.error.message)
}

export async function savePfdDraft(
  supabase: SupabaseClient,
  params: {
    projectId: string
    currentUserId: string
    nodes: unknown[]
    edges: unknown[]
    touchSession?: boolean
  }
) {
  const nowIso = new Date().toISOString()
  const draftRes = await supabase.from('pfd_drafts').upsert(
    [
      {
        project_id: params.projectId,
        user_id: params.currentUserId,
        nodes: params.nodes,
        edges: params.edges,
        updated_at: nowIso,
      },
    ],
    { onConflict: 'project_id,user_id' }
  )

  if (draftRes.error) throw new Error(draftRes.error.message)

  if (params.touchSession !== false) {
    await heartbeatPfdEditSession(supabase, {
      projectId: params.projectId,
      currentUserId: params.currentUserId,
      at: nowIso,
    })
  }
}
