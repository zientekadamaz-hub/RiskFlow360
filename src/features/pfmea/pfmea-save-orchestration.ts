import type { SupabaseClient } from '@supabase/supabase-js'

import { normalizeHistoryText } from './pfmea-display-utils'
import { isPlaceholderRowId, normalizePfmeaRowNo } from './pfmea-hierarchy-utils'
import { getPfmeaRowOperationId, getPfmeaRowOperationIds, buildPfmeaStableOrderMetadata, sortPfmeaRows } from './pfmea-row-order-utils'
import { parsePfmeaPublishResult } from './pfmea-publish-utils'
import {
  buildPfmeaPublishedMetadataPatch,
  stripPfmeaGroupIdsFromPayload,
  summarizePfmeaRowsForError,
} from './pfmea-payload-utils'
import { findEquivalentPfmeaRow, findEquivalentPublishedPfmeaRow } from './pfmea-row-match-utils'
import { insertPfmeaHistoryFallback, persistPfmeaDirtyRevisionRows, type PfmeaRevisionPublishResult } from './pfmea-service'
import type { PfmeaRow, ProjectView } from './pfmea-types'

export type PfmeaEditorCommitTarget = {
  blur?: () => void
} | null

export type PfmeaPostPublishResult = {
  data: unknown
  integrityWarning: string | null
  postPublishWarning: string | null
  publishedRevisionId: string | null
  revisionLabel: string
}

export async function commitPfmeaEditorBeforeSave(editor: PfmeaEditorCommitTarget) {
  if (editor && typeof editor.blur === 'function') {
    editor.blur()
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
  }
}

export async function fetchAuthenticatedPfmeaSaveUserId(supabase: SupabaseClient) {
  const { data: sess } = await supabase.auth.getSession()
  const uid = sess?.session?.user?.id
  if (!uid) throw new Error('Not authenticated.')
  return uid
}

export async function syncPublishedPfmeaRowMetadataAfterSave(params: {
  draftRevisionIdOverride: string | null
  fetchRowsForRevisionScope: (revisionId: string, operationIds?: string[]) => Promise<PfmeaRow[]>
  groupIdsSupported: boolean | null
  revisionId: string
  sourceRows: PfmeaRow[]
  supabase: SupabaseClient
  workingRevisionId: string | null
}) {
  const orderedSourceRows = sortPfmeaRows(params.sourceRows).filter(
    (row) =>
      !isPlaceholderRowId(row.id) &&
      (!row.revision_id || row.revision_id === params.draftRevisionIdOverride || row.revision_id === params.workingRevisionId)
  )
  if (!params.revisionId || orderedSourceRows.length === 0) return

  const publishedRows = await params.fetchRowsForRevisionScope(params.revisionId, getPfmeaRowOperationIds(orderedSourceRows))
  if (publishedRows.length === 0) return

  const sourceMeta = buildPfmeaStableOrderMetadata(orderedSourceRows)
  const metadataBySourceId = new Map(sourceMeta.map((item) => [item.id, item] as const))
  const updates: Array<{
    id: string
    patch: ReturnType<typeof buildPfmeaPublishedMetadataPatch>
  }> = []

  const unmatchedPublishedRows = [...publishedRows]
  const matchedSourceIds = new Set<string>()

  for (const sourceRow of orderedSourceRows) {
    const matchedPublishedRow = findEquivalentPublishedPfmeaRow(unmatchedPublishedRows, sourceRow)
    const meta = metadataBySourceId.get(sourceRow.id)
    if (!matchedPublishedRow || !meta) continue

    matchedSourceIds.add(sourceRow.id)
    const matchedIndex = unmatchedPublishedRows.findIndex((row) => row.id === matchedPublishedRow.id)
    if (matchedIndex >= 0) unmatchedPublishedRows.splice(matchedIndex, 1)

    updates.push({
      id: matchedPublishedRow.id,
      patch: buildPfmeaPublishedMetadataPatch(meta),
    })
  }

  const remainingSourceRows = orderedSourceRows.filter((row) => !matchedSourceIds.has(row.id))
  if (remainingSourceRows.length > 0 && unmatchedPublishedRows.length > 0) {
    const publishedByOperation = new Map<string, PfmeaRow[]>()
    const sourceByOperation = new Map<string, PfmeaRow[]>()

    for (const row of unmatchedPublishedRows) {
      const operationId = getPfmeaRowOperationId(row)
      if (!operationId) continue
      if (!publishedByOperation.has(operationId)) publishedByOperation.set(operationId, [])
      publishedByOperation.get(operationId)!.push(row)
    }
    for (const row of remainingSourceRows) {
      const operationId = getPfmeaRowOperationId(row)
      if (!operationId) continue
      if (!sourceByOperation.has(operationId)) sourceByOperation.set(operationId, [])
      sourceByOperation.get(operationId)!.push(row)
    }

    for (const [operationId, publishedGroup] of publishedByOperation.entries()) {
      const sourceGroup = sourceByOperation.get(operationId) ?? []
      const count = Math.min(publishedGroup.length, sourceGroup.length)
      for (let index = 0; index < count; index += 1) {
        const publishedRow = publishedGroup[index]
        const sourceRow = sourceGroup[index]
        const meta = metadataBySourceId.get(sourceRow.id)
        if (!meta) continue
        updates.push({
          id: publishedRow.id,
          patch: buildPfmeaPublishedMetadataPatch(meta),
        })
      }
    }
  }

  if (updates.length === 0) return

  const batchSize = 25
  for (let index = 0; index < updates.length; index += batchSize) {
    const batch = updates.slice(index, index + batchSize)
    const results = await Promise.all(
      batch.map((item) =>
        params.supabase
          .from('pfmea_rows')
          .update(
            params.groupIdsSupported === false
              ? stripPfmeaGroupIdsFromPayload(item.patch as Record<string, unknown>)
              : item.patch
          )
          .eq('id', item.id)
          .eq('revision_id', params.revisionId)
      )
    )

    for (const result of results) {
      if (result.error) throw result.error
    }
  }
}

export async function ensurePublishedPfmeaIntegrityAfterSave(params: {
  fetchRowsForRevisionScope: (revisionId: string, operationIds?: string[]) => Promise<PfmeaRow[]>
  restoreSnapshotToRevision: (revisionId: string, sourceRows: PfmeaRow[]) => Promise<PfmeaRow[]>
  revisionId: string
  sourceRows: PfmeaRow[]
}) {
  const snapshotRows = sortPfmeaRows(params.sourceRows).filter((row) => !isPlaceholderRowId(row.id))
  if (!params.revisionId || snapshotRows.length === 0) return null

  const operationIds = getPfmeaRowOperationIds(snapshotRows)
  if (operationIds.length === 0) return null

  const checkSnapshot = async () => {
    const publishedRows = await params.fetchRowsForRevisionScope(params.revisionId, operationIds)
    const usedIds = new Set<string>()
    const missingRows = snapshotRows.filter((sourceRow) => {
      const candidate = findEquivalentPfmeaRow(
        publishedRows.filter((row) => !usedIds.has(row.id)),
        sourceRow
      )
      if (!candidate) return true
      usedIds.add(candidate.id)
      return false
    })
    return { missingRows }
  }

  let { missingRows } = await checkSnapshot()
  if (missingRows.length === 0) return null

  await params.restoreSnapshotToRevision(params.revisionId, snapshotRows)
  ;({ missingRows } = await checkSnapshot())

  if (missingRows.length > 0) {
    throw new Error(
      `PFMEA publish integrity check failed for revision ${params.revisionId}. ${missingRows.length} row(s) are still missing or changed after automatic restore: ${summarizePfmeaRowsForError(missingRows)}.`
    )
  }

  return 'PFMEA publish returned incomplete or changed data. The affected rows were automatically restored from a safety snapshot.'
}

export async function remapPfmeaSnapshotRowsToRevisionAfterSave(params: {
  fetchRowsForRevisionScope: (revisionId: string, operationIds?: string[]) => Promise<PfmeaRow[]>
  revisionId: string
  sourceRows: PfmeaRow[]
}) {
  const snapshotRows = sortPfmeaRows(params.sourceRows).filter((row) => !isPlaceholderRowId(row.id))
  if (!params.revisionId || snapshotRows.length === 0) return snapshotRows

  const operationIds = getPfmeaRowOperationIds(snapshotRows)
  const revisionRows = await params.fetchRowsForRevisionScope(params.revisionId, operationIds)
  const revisionRowsById = new Map(revisionRows.map((row) => [row.id, row] as const))
  const usedIds = new Set<string>()
  const missingRows: PfmeaRow[] = []

  const mappedRows = snapshotRows
    .map((sourceRow) => {
      const directTarget = revisionRowsById.get(sourceRow.id)
      if (directTarget && !usedIds.has(directTarget.id)) {
        usedIds.add(directTarget.id)
        return {
          ...sourceRow,
          id: directTarget.id,
          revision_id: params.revisionId,
          operation_id: getPfmeaRowOperationId(directTarget) || getPfmeaRowOperationId(sourceRow),
          operations: directTarget.operations ?? sourceRow.operations,
        } as PfmeaRow
      }

      const inferredRowNo = normalizePfmeaRowNo(sourceRow.row_no)
      const rowForMapping =
        inferredRowNo && inferredRowNo !== sourceRow.row_no ? ({ ...sourceRow, row_no: inferredRowNo } as PfmeaRow) : sourceRow

      const candidate = findEquivalentPfmeaRow(
        revisionRows.filter((row) => !usedIds.has(row.id)),
        rowForMapping
      )

      if (!candidate) {
        missingRows.push(sourceRow)
        return null
      }

      usedIds.add(candidate.id)
      return {
        ...sourceRow,
        id: candidate.id,
        revision_id: params.revisionId,
        operation_id: getPfmeaRowOperationId(candidate) || getPfmeaRowOperationId(sourceRow),
        operations: candidate.operations ?? sourceRow.operations,
      } as PfmeaRow
    })
    .filter(Boolean) as PfmeaRow[]

  if (missingRows.length > 0) {
    throw new Error(
      `PFMEA draft integrity check failed. ${missingRows.length} row(s) could not be mapped into draft revision ${params.revisionId}: ${summarizePfmeaRowsForError(missingRows)}.`
    )
  }

  return mappedRows
}

export async function persistPfmeaDraftSnapshotAfterSave(params: {
  applyPendingCellValues: (row: PfmeaRow) => PfmeaRow
  computeDerivedForRow: (row: PfmeaRow) => Partial<PfmeaRow>
  dirtyIds: Iterable<string>
  groupIdsSupported: boolean | null
  remapRowsToRevision: (revisionId: string, sourceRows: PfmeaRow[]) => Promise<PfmeaRow[]>
  revisionId: string
  sourceRows: PfmeaRow[]
  supabase: SupabaseClient
}) {
  const dirtyIdsBeforeRemap = new Set(params.dirtyIds)
  const snapshotRows = sortPfmeaRows(params.sourceRows)
    .filter((row) => !isPlaceholderRowId(row.id))
    .map((row) => {
      const effectiveRow = params.applyPendingCellValues(row)
      const derived = params.computeDerivedForRow(effectiveRow)
      return {
        ...effectiveRow,
        ...derived,
      } as PfmeaRow
    })

  if (snapshotRows.length === 0) return snapshotRows

  const mappedSnapshotRows = await params.remapRowsToRevision(params.revisionId, snapshotRows)
  await persistPfmeaDirtyRevisionRows<PfmeaRow>(params.supabase, {
    dirtyIds: dirtyIdsBeforeRemap,
    groupIdsSupported: params.groupIdsSupported,
    mappedRows: mappedSnapshotRows,
    revisionId: params.revisionId,
    sourceRows: snapshotRows,
  })

  return mappedSnapshotRows
}

export async function completePfmeaPostPublish(params: {
  avgRpn: number | null
  changeDescription: string
  draftRevisionId: string
  ensurePublishedIntegrity: (revisionId: string, persistedRows: PfmeaRow[]) => Promise<string | null>
  historyAuthor: string
  mark: (label: string) => void
  orderedPersistedRows: PfmeaRow[]
  projectId: string
  publishResultWithHistory: PfmeaRevisionPublishResult
  reloadProjectView: () => Promise<ProjectView>
  riskCount: number
  supabase: SupabaseClient
  syncPublishedRowMetadata: (revisionId: string, persistedRows: PfmeaRow[]) => Promise<void>
  userId: string
}): Promise<PfmeaPostPublishResult> {
  const historyAlreadyInserted = params.publishResultWithHistory.historyAlreadyInserted
  const data = params.publishResultWithHistory.data
  const publishResult = parsePfmeaPublishResult(data)
  let publishedRevisionId = publishResult.revisionId
  let publishedOpenRevisionLabel = publishResult.revisionLabel
  let integrityWarning: string | null = null
  let postPublishWarning: string | null = null
  let revisionLabel = normalizeHistoryText(publishedOpenRevisionLabel) || '0.0.0'

  try {
    if (!publishedRevisionId) {
      try {
        const publishedView = await params.reloadProjectView()
        publishedRevisionId = publishedView.current_open_revision_id ?? null
        publishedOpenRevisionLabel = publishedView.open_revision_label ?? null
      } catch {}
      params.mark('resolve published project view')
    } else {
      try {
        const publishedView = await params.reloadProjectView()
        publishedOpenRevisionLabel = publishedView.open_revision_label ?? null
      } catch {}
      params.mark('load published project view')
    }

    if (publishedRevisionId && publishedRevisionId !== params.draftRevisionId) {
      try {
        await params.syncPublishedRowMetadata(publishedRevisionId, params.orderedPersistedRows)
      } catch (syncError: unknown) {
        console.warn('PFMEA published row metadata sync skipped:', (syncError as { message?: string } | null)?.message ?? String(syncError))
      }
      params.mark('sync published row metadata')
    } else {
      params.mark('skip published row metadata sync')
    }

    if (publishedRevisionId && publishedRevisionId !== params.draftRevisionId && params.orderedPersistedRows.length > 0) {
      integrityWarning = await params.ensurePublishedIntegrity(publishedRevisionId, params.orderedPersistedRows)
      params.mark('published integrity check')
    } else {
      params.mark('skip published integrity check')
    }

    revisionLabel = normalizeHistoryText(publishedOpenRevisionLabel) || '0.0.0'

    if (!historyAlreadyInserted) {
      const historyInsert = await insertPfmeaHistoryFallback(params.supabase, {
        authorId: params.userId,
        authorName: params.historyAuthor,
        avgRpn: params.avgRpn,
        changeDescription: params.changeDescription,
        projectId: params.projectId,
        revisionLabel,
        riskCount: params.riskCount,
      })
      params.mark('insert pfmea history fallback')
      if (historyInsert.errorMessage) {
        // Optional table; keep publish successful even if custom history insert is unavailable.
        console.warn('PFMEA history insert skipped:', historyInsert.errorMessage)
      }
    } else {
      params.mark('skip client history insert')
    }
  } catch (postPublishError: unknown) {
    postPublishWarning = `PFMEA was published, but post-save verification did not finish cleanly. ${(postPublishError as { message?: string } | null)?.message ?? String(postPublishError)}`
    console.warn('PFMEA post-publish warning:', (postPublishError as { message?: string } | null)?.message ?? String(postPublishError))
  }

  return {
    data,
    integrityWarning,
    postPublishWarning,
    publishedRevisionId,
    revisionLabel,
  }
}
