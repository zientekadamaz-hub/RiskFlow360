import { useCallback, useEffect, useMemo, useState } from 'react'

const PFMEA_DIRTY_DRAFT_KEY_PREFIX = '__PFMEA_DIRTY_DRAFT__'

export function usePfmeaDirtyDraftPersistence(params: {
  hasProject: boolean
  projectId: string
  projectHasDraftRevision: boolean
}) {
  const dirtyDraftStorageKey = useMemo(
    () => (params.projectId ? `${PFMEA_DIRTY_DRAFT_KEY_PREFIX}:${params.projectId}` : ''),
    [params.projectId]
  )
  const [persistedDirtyDraft, setPersistedDirtyDraft] = useState(false)

  useEffect(() => {
    if (!dirtyDraftStorageKey || typeof window === 'undefined') {
      queueMicrotask(() => setPersistedDirtyDraft(false))
      return
    }
    try {
      const next = window.sessionStorage.getItem(dirtyDraftStorageKey) === '1'
      queueMicrotask(() => setPersistedDirtyDraft(next))
    } catch {
      queueMicrotask(() => setPersistedDirtyDraft(false))
    }
  }, [dirtyDraftStorageKey])

  const markDirtyDraftPersisted = useCallback(() => {
    setPersistedDirtyDraft(true)
    if (!dirtyDraftStorageKey || typeof window === 'undefined') return
    try {
      window.sessionStorage.setItem(dirtyDraftStorageKey, '1')
    } catch {}
  }, [dirtyDraftStorageKey])

  const clearDirtyDraftPersisted = useCallback(() => {
    setPersistedDirtyDraft(false)
    if (!dirtyDraftStorageKey || typeof window === 'undefined') return
    try {
      window.sessionStorage.removeItem(dirtyDraftStorageKey)
    } catch {}
  }, [dirtyDraftStorageKey])

  useEffect(() => {
    if (!params.hasProject) return
    if (params.projectHasDraftRevision) return
    queueMicrotask(clearDirtyDraftPersisted)
  }, [clearDirtyDraftPersisted, params.hasProject, params.projectHasDraftRevision])

  return {
    clearDirtyDraftPersisted,
    markDirtyDraftPersisted,
    persistedDirtyDraft,
  }
}
