const { createClient } = require('@supabase/supabase-js')
const { getRequiredEnv, loadLocalEnv } = require('./_shared/env')

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

async function countRows(supabase, table, revisionId) {
  const result = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('revision_id', revisionId)

  if (result.error) {
    throw new Error(`Cannot read ${table}: ${result.error.message}`)
  }

  return result.count ?? 0
}

async function verifyProject(supabase, projectId, label) {
  const projectResult = await supabase
    .from('projects_with_revision')
    .select('id,name,status,current_open_revision_id,current_draft_revision_id,open_revision_label,draft_revision_label')
    .eq('id', projectId)
    .maybeSingle()

  if (projectResult.error) {
    throw new Error(`Cannot read ${label} project: ${projectResult.error.message}`)
  }

  const project = projectResult.data
  if (!project) {
    throw new Error(`${label} project is not visible for the regression user: ${projectId}`)
  }

  const openRevisionId = normalizeText(project.current_open_revision_id)
  const draftRevisionId = normalizeText(project.current_draft_revision_id)
  const revisionId = openRevisionId || draftRevisionId

  if (!revisionId) {
    throw new Error(`${label} project has no open or draft revision: ${project.name ?? project.id}`)
  }

  const pfmeaRowCount = await countRows(supabase, 'pfmea_rows', revisionId)
  if (pfmeaRowCount <= 0) {
    throw new Error(`${label} project revision has no PFMEA rows: ${project.name ?? project.id}`)
  }

  let controlPlanRowCount = null
  try {
    controlPlanRowCount = await countRows(supabase, 'control_plan_rows', revisionId)
  } catch (error) {
    process.stdout.write(`[regression:verify-project] WARNING: ${error instanceof Error ? error.message : String(error)}\n`)
  }

  process.stdout.write(
    [
      `[regression:verify-project] ${label} OK`,
      `project="${project.name ?? project.id}"`,
      `status="${project.status ?? 'unknown'}"`,
      `revision="${openRevisionId ? project.open_revision_label ?? 'open' : project.draft_revision_label ?? 'draft'}"`,
      `pfmea_rows=${pfmeaRowCount}`,
      controlPlanRowCount === null ? null : `control_plan_rows=${controlPlanRowCount}`,
    ]
      .filter(Boolean)
      .join(' | ') + '\n'
  )
}

async function main() {
  loadLocalEnv()

  const supabaseUrl = getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL')
  const supabaseAnonKey = getRequiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  const email = getRequiredEnv('REGRESSION_EMAIL')
  const password = getRequiredEnv('REGRESSION_PASSWORD')
  const pfmeaProjectId = getRequiredEnv('PFMEA_REGRESSION_PROJECT_ID')
  const pcpProjectId = normalizeText(process.env.PCP_REGRESSION_PROJECT_ID)

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  const signInResult = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (signInResult.error) {
    throw new Error(`Cannot sign in regression user: ${signInResult.error.message}`)
  }

  await verifyProject(supabase, pfmeaProjectId, 'PFMEA')

  if (pcpProjectId && pcpProjectId !== pfmeaProjectId) {
    await verifyProject(supabase, pcpProjectId, 'PCP')
  }
}

main().catch((error) => {
  process.stderr.write(`[regression:verify-project] ERROR: ${error instanceof Error ? error.message : String(error)}\n`)
  process.exit(1)
})
