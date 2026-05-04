import { useCallback, useRef } from 'react'

import { supabase } from '@app/lib/supabaseBrowser'

export function usePfmeaTransientTracking() {
  const transientCauseContinuationIdsRef = useRef<Set<string>>(new Set())
  const transientRecommendedActionContinuationIdsRef = useRef<Set<string>>(new Set())
  const transientFailureModeContinuationIdsRef = useRef<Set<string>>(new Set())
  const transientEffectContinuationIdsRef = useRef<Set<string>>(new Set())
  const pendingTransientDeletePromisesRef = useRef<Record<string, Promise<void>>>({})

  const clearRecommendedActionTransientIfFilled = useCallback((rowId: string, value: string | null | undefined) => {
    if (!transientRecommendedActionContinuationIdsRef.current.has(rowId)) return
    if (!(value ?? '').toString().trim()) return
    transientRecommendedActionContinuationIdsRef.current.delete(rowId)
  }, [])

  const scheduleTransientRowDeletion = useCallback((rowId: string) => {
    const existing = pendingTransientDeletePromisesRef.current[rowId]
    if (existing) return existing

    const task = (async () => {
      const res = await supabase.from('pfmea_rows').delete().eq('id', rowId)
      if (res.error) throw res.error
    })()

    pendingTransientDeletePromisesRef.current[rowId] = task
    task.finally(() => {
      delete pendingTransientDeletePromisesRef.current[rowId]
    })
    return task
  }, [])

  const clearPfmeaTransientTracking = useCallback(() => {
    transientCauseContinuationIdsRef.current.clear()
    transientRecommendedActionContinuationIdsRef.current.clear()
    transientFailureModeContinuationIdsRef.current.clear()
    transientEffectContinuationIdsRef.current.clear()
    pendingTransientDeletePromisesRef.current = {}
  }, [])

  const flushPendingTransientDeletes = useCallback(async () => {
    const pending = Object.values(pendingTransientDeletePromisesRef.current)
    if (pending.length === 0) return
    await Promise.all(pending)
  }, [])

  return {
    clearPfmeaTransientTracking,
    clearRecommendedActionTransientIfFilled,
    flushPendingTransientDeletes,
    scheduleTransientRowDeletion,
    transientCauseContinuationIdsRef,
    transientEffectContinuationIdsRef,
    transientFailureModeContinuationIdsRef,
    transientRecommendedActionContinuationIdsRef,
  }
}
