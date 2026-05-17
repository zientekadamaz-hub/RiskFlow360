import type { SupabaseClient } from '@supabase/supabase-js'
import { useCallback, useEffect, useState } from 'react'

import {
  fetchPfdHistory,
  fetchPfdProcessOptions,
  fetchPfdRevisionLabel,
} from './pfd-service'
import type { PfdHistoryEntry } from './types'

export function usePfdProjectDataController({
  projectId,
  supabase,
}: {
  projectId: string
  supabase: SupabaseClient
}) {
  const [currentRevisionLabel, setCurrentRevisionLabel] = useState('0.0.0')
  const [historyEntries, setHistoryEntries] = useState<PfdHistoryEntry[]>([])
  const [processOptions, setProcessOptions] = useState<string[]>([])

  const loadRevisionLabel = useCallback(async () => {
    try {
      const label = await fetchPfdRevisionLabel(supabase, projectId)
      setCurrentRevisionLabel(label)
    } catch {}
  }, [projectId, supabase])

  const loadProcessOptions = useCallback(async () => {
    try {
      const values = await fetchPfdProcessOptions(supabase, projectId)
      setProcessOptions(values)
    } catch {
      setProcessOptions([])
    }
  }, [projectId, supabase])

  const loadHistory = useCallback(async () => {
    try {
      const entries = await fetchPfdHistory(supabase, projectId)
      setHistoryEntries(entries)
    } catch {
      setHistoryEntries([])
    }
  }, [projectId, supabase])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadHistory()
      void loadRevisionLabel()
      void loadProcessOptions()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadHistory, loadProcessOptions, loadRevisionLabel])

  return {
    currentRevisionLabel,
    historyEntries,
    loadHistory,
    loadProcessOptions,
    loadRevisionLabel,
    processOptions,
  }
}
