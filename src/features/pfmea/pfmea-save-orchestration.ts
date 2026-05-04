import type { SupabaseClient } from '@supabase/supabase-js'

import { normalizeHistoryText } from './pfmea-display-utils'
import { parsePfmeaPublishResult } from './pfmea-publish-utils'
import { insertPfmeaHistoryFallback, type PfmeaRevisionPublishResult } from './pfmea-service'
import type { PfmeaRow, ProjectView } from './pfmea-types'

export type PfmeaPostPublishResult = {
  data: unknown
  integrityWarning: string | null
  postPublishWarning: string | null
  publishedRevisionId: string | null
  revisionLabel: string
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
