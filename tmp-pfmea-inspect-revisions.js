const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://piewgtoldsnyynueztos.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_MFnW7t6GZhW_UR8rEbsODA__dt-NoKb'
const EMAIL = process.env.PFMEA_DEBUG_EMAIL || 'zientek.adam.az@gmail.com'
const PASSWORD = process.env.PFMEA_DEBUG_PASSWORD || 'Riskflow360!'

async function countRowsForRevision(supabase, revisionId) {
  if (!revisionId) return 0
  const res = await supabase
    .from('pfmea_rows')
    .select('id', { count: 'exact', head: true })
    .eq('revision_id', revisionId)
  if (res.error) throw res.error
  return res.count ?? 0
}

async function listRecentHistory(supabase, projectId) {
  const historyRes = await supabase
    .from('pfmea_change_history')
    .select('id,project_id,revision_label,created_at,change_description,risk_count,avg_rpn')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(10)
  if (historyRes.error) throw historyRes.error

  return (historyRes.data ?? []).map((row) => ({
      id: row.id,
      revision_label: row.revision_label,
      created_at: row.created_at,
      change_description: row.change_description,
      risk_count: row.risk_count,
      avg_rpn: row.avg_rpn,
    }))
}

async function listPfmeaRowRevisions(supabase, projectId) {
  const res = await supabase
    .from('pfmea_rows')
    .select('revision_id,created_at,operations!inner(project_id)')
    .eq('operations.project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(2000)
  if (res.error) throw res.error

  const grouped = new Map()
  for (const row of res.data ?? []) {
    const revisionId = String(row.revision_id || '').trim()
    if (!revisionId) continue
    const existing = grouped.get(revisionId)
    if (!existing) {
      grouped.set(revisionId, {
        revision_id: revisionId,
        count: 1,
        latest_created_at: row.created_at || null,
      })
      continue
    }
    existing.count += 1
    if ((row.created_at || '') > (existing.latest_created_at || '')) {
      existing.latest_created_at = row.created_at || null
    }
  }

  return [...grouped.values()].sort((a, b) => String(b.latest_created_at || '').localeCompare(String(a.latest_created_at || '')))
}

async function listProcessRevisions(supabase, projectId) {
  const res = await supabase
    .from('process_revisions')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(20)
  if (res.error) {
    return { error: res.error.message }
  }
  return res.data ?? []
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  const signInRes = await supabase.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  })
  if (signInRes.error) throw signInRes.error

  const projectsRes = await supabase
    .from('projects_with_revision')
    .select('id,name,status,current_open_revision_id,current_draft_revision_id,open_revision_label,draft_revision_label')
    .order('updated_at', { ascending: false })
    .limit(20)
  if (projectsRes.error) throw projectsRes.error

  const out = []
  for (const project of projectsRes.data ?? []) {
    const openCount = await countRowsForRevision(supabase, project.current_open_revision_id)
    const draftCount = await countRowsForRevision(supabase, project.current_draft_revision_id)
    const recentHistory = await listRecentHistory(supabase, project.id)
    const pfmeaRowRevisions = await listPfmeaRowRevisions(supabase, project.id)
    const processRevisions = await listProcessRevisions(supabase, project.id)
    out.push({
      id: project.id,
      name: project.name,
      status: project.status,
      open_revision_label: project.open_revision_label,
      draft_revision_label: project.draft_revision_label,
      current_open_revision_id: project.current_open_revision_id,
      current_draft_revision_id: project.current_draft_revision_id,
      open_row_count: openCount,
      draft_row_count: draftCount,
      total_pfmea_row_count: pfmeaRowRevisions.reduce((acc, item) => acc + item.count, 0),
      pfmea_row_revisions: pfmeaRowRevisions.slice(0, 10),
      recent_history: recentHistory,
      process_revisions: processRevisions,
    })
  }

  console.log(JSON.stringify(out, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
