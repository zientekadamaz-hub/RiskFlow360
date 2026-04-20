const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://piewgtoldsnyynueztos.supabase.co'
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_MFnW7t6GZhW_UR8rEbsODA__dt-NoKb'
const EMAIL = process.env.PFMEA_DEBUG_EMAIL || 'zientek.adam.az@gmail.com'
const PASSWORD = process.env.PFMEA_DEBUG_PASSWORD || 'Riskflow360!'
const PROJECT_ID = process.argv[2] || 'b9887505-30a8-4440-b10d-ee1101480b8c'

const PFMEA_CLONE_FIELDS = [
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
]

async function signIn(supabase) {
  const res = await supabase.auth.signInWithPassword({ email: EMAIL, password: PASSWORD })
  if (res.error) throw res.error
}

async function getProjectView(supabase, projectId) {
  const res = await supabase
    .from('projects_with_revision')
    .select('id,name,status,current_open_revision_id,current_draft_revision_id,open_revision_label,draft_revision_label')
    .eq('id', projectId)
    .maybeSingle()
  if (res.error) throw res.error
  if (!res.data) throw new Error(`Project ${projectId} not found`)
  return res.data
}

async function getLatestNonEmptyRevisionId(supabase, projectId, excludedRevisionId) {
  const res = await supabase
    .from('pfmea_rows')
    .select('id,revision_id,created_at,operations!inner(project_id)')
    .eq('operations.project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(1000)
  if (res.error) throw res.error

  const grouped = new Map()
  for (const row of res.data ?? []) {
    const revisionId = String(row.revision_id || '').trim()
    if (!revisionId || revisionId === excludedRevisionId) continue
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

  const candidates = [...grouped.values()]
    .filter((item) => item.count > 0)
    .sort((a, b) => String(b.latest_created_at || '').localeCompare(String(a.latest_created_at || '')))

  return candidates[0] ?? null
}

async function fetchRowsForRevision(supabase, revisionId) {
  const res = await supabase
    .from('pfmea_rows')
    .select(['id', 'revision_id', ...PFMEA_CLONE_FIELDS].join(','))
    .eq('revision_id', revisionId)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
  if (res.error) throw res.error
  return res.data ?? []
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  await signIn(supabase)
  const project = await getProjectView(supabase, PROJECT_ID)
  const targetRevisionId = project.current_open_revision_id
  if (!targetRevisionId) throw new Error(`Project ${PROJECT_ID} has no current_open_revision_id`)

  const sourceRevision = await getLatestNonEmptyRevisionId(supabase, PROJECT_ID, targetRevisionId)
  if (!sourceRevision) throw new Error(`No non-empty PFMEA revision found for project ${PROJECT_ID}`)

  const sourceRows = await fetchRowsForRevision(supabase, sourceRevision.revision_id)
  if (sourceRows.length === 0) throw new Error(`Source revision ${sourceRevision.revision_id} returned 0 rows`)

  const currentOpenRows = await fetchRowsForRevision(supabase, targetRevisionId)
  if (currentOpenRows.length > 0) {
    throw new Error(`Refusing to overwrite non-empty open revision ${targetRevisionId}; it already has ${currentOpenRows.length} rows`)
  }

  const insertPayload = sourceRows.map((row) => {
    const clone = { revision_id: targetRevisionId }
    for (const field of PFMEA_CLONE_FIELDS) {
      clone[field] = row[field] ?? null
    }
    return clone
  })

  const insertRes = await supabase.from('pfmea_rows').insert(insertPayload)
  if (insertRes.error) throw insertRes.error

  const verifyRows = await fetchRowsForRevision(supabase, targetRevisionId)

  console.log(JSON.stringify({
    project_id: project.id,
    project_name: project.name,
    open_revision_label: project.open_revision_label,
    restored_to_revision_id: targetRevisionId,
    source_revision_id: sourceRevision.revision_id,
    source_row_count: sourceRows.length,
    restored_row_count: verifyRows.length,
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
