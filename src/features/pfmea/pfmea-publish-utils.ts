export type PfmeaPublishResult = {
  revisionId: string | null
  revisionLabel: string | null
}

export function isMissingRpcFunctionError(error: unknown, functionName: string) {
  const message = ((error as { message?: string } | null)?.message ?? String(error ?? '')).toLowerCase()
  const details = ((error as { details?: string } | null)?.details ?? '').toLowerCase()
  const hint = ((error as { hint?: string } | null)?.hint ?? '').toLowerCase()
  const code = ((error as { code?: string } | null)?.code ?? '').toUpperCase()
  const text = `${message} ${details} ${hint}`
  return code === 'PGRST202' || (text.includes(functionName.toLowerCase()) && (text.includes('not find') || text.includes('does not exist')))
}

export function parsePfmeaPublishResult(data: unknown): PfmeaPublishResult {
  if (typeof data === 'string') return { revisionId: data, revisionLabel: null }

  const row = Array.isArray(data) ? data[0] : data
  if (!row || typeof row !== 'object') return { revisionId: null, revisionLabel: null }

  const record = row as Record<string, unknown>
  const revisionId =
    typeof record.revision_id === 'string'
      ? record.revision_id
      : typeof record.id === 'string'
        ? record.id
        : null
  const revisionLabel = typeof record.revision_label === 'string' ? record.revision_label : null

  return { revisionId, revisionLabel }
}
