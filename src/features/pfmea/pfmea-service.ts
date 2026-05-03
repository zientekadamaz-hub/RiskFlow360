import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizeHistoryText, toFiniteNumber } from './pfmea-display-utils'

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

type ProfileNameRow = {
  first_name?: string | null
  last_name?: string | null
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
