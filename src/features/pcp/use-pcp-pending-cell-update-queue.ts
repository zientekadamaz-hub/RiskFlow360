import { useCallback, useRef } from 'react'

export function usePcpPendingCellUpdateQueue() {
  const pendingCellUpdatePromisesRef = useRef<Set<Promise<void>>>(new Set())

  const runPendingCellUpdate = useCallback(async (task: Promise<void>) => {
    pendingCellUpdatePromisesRef.current.add(task)
    try {
      await task
    } finally {
      pendingCellUpdatePromisesRef.current.delete(task)
    }
  }, [])

  const flushPendingCellUpdates = useCallback(async () => {
    const pending = Array.from(pendingCellUpdatePromisesRef.current)
    if (pending.length === 0) return
    await Promise.allSettled(pending)
  }, [])

  return {
    flushPendingCellUpdates,
    runPendingCellUpdate,
  }
}
