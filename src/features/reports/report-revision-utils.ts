export type ReportRevisionProject = {
  current_draft_revision_id?: string | null
  current_open_revision_id?: string | null
  status?: string | null
}

function normalizeRevisionId(value: string | null | undefined) {
  return (value ?? '').trim()
}

export function getReportRevisionId(project: ReportRevisionProject) {
  const openRevisionId = normalizeRevisionId(project.current_open_revision_id)
  const draftRevisionId = normalizeRevisionId(project.current_draft_revision_id)
  const status = (project.status ?? '').trim().toUpperCase()

  if (status === 'OPEN') return openRevisionId || draftRevisionId
  return draftRevisionId || openRevisionId
}
