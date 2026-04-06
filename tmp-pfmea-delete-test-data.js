const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const EMAIL = 'zientek.adam.az@gmail.com'
const PASSWORD = 'Riskflow360!'
const PROJECT_ID = 'b9887505-30a8-4440-b10d-ee1101480b8c'

async function main() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Missing Supabase env vars.')
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const signInRes = await supabase.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  })
  if (signInRes.error) throw signInRes.error

  const opsRes = await supabase
    .from('operations')
    .select('id')
    .eq('project_id', PROJECT_ID)
  if (opsRes.error) throw opsRes.error

  const operationIds = (opsRes.data ?? []).map((row) => row.id).filter(Boolean)
  if (operationIds.length === 0) {
    console.log(JSON.stringify({ deleted_pfmea_rows: 0, deleted_history_rows: 0, deleted_revision_rows: 0, note: 'No operations found.' }, null, 2))
    return
  }

  const pfmeaRowsRes = await supabase
    .from('pfmea_rows')
    .select('id,revision_id,operation_id')
    .in('operation_id', operationIds)
  if (pfmeaRowsRes.error) throw pfmeaRowsRes.error

  const pfmeaRows = pfmeaRowsRes.data ?? []
  const pfmeaRowIds = pfmeaRows.map((row) => row.id).filter(Boolean)
  const revisionIds = [...new Set(pfmeaRows.map((row) => row.revision_id).filter(Boolean))]

  let deletedPfmeaRows = 0
  if (pfmeaRowIds.length > 0) {
    const delPfmeaRes = await supabase
      .from('pfmea_rows')
      .delete()
      .in('id', pfmeaRowIds)
      .select('id')
    if (delPfmeaRes.error) throw delPfmeaRes.error
    deletedPfmeaRows = (delPfmeaRes.data ?? []).length
  }

  let deletedHistoryRows = 0
  const delHistoryRes = await supabase
    .from('pfmea_change_history')
    .delete()
    .eq('project_id', PROJECT_ID)
    .select('id')
  if (delHistoryRes.error) throw delHistoryRes.error
  deletedHistoryRows = (delHistoryRes.data ?? []).length

  let deletedRevisionRows = 0
  if (revisionIds.length > 0) {
    const delRevisionRes = await supabase
      .from('process_module_revisions')
      .delete()
      .eq('project_id', PROJECT_ID)
      .eq('module', 'PFMEA')
      .in('revision_id', revisionIds)
      .select('id')
    if (delRevisionRes.error) {
      if (delRevisionRes.error.code !== 'PGRST205') throw delRevisionRes.error
    } else {
      deletedRevisionRows = (delRevisionRes.data ?? []).length
    }
  }

  console.log(
    JSON.stringify(
      {
        project_id: PROJECT_ID,
        operation_count: operationIds.length,
        deleted_pfmea_rows: deletedPfmeaRows,
        deleted_history_rows: deletedHistoryRows,
        deleted_revision_rows: deletedRevisionRows,
        revision_ids: revisionIds,
      },
      null,
      2
    )
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
