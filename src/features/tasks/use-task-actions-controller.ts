import { useEffect, useState } from 'react'

import { supabase } from '@app/lib/supabaseBrowser'
import { getSessionUserWithRetries } from '@/lib/auth/client-session'
import {
  EMPTY_SUMMARY,
  getTaskErrorMessage,
  normalizeStatus,
  type TaskSummary,
} from './task-page-model'
import {
  fetchTaskActions,
  updateTaskActionDetails,
  updateTaskActionStatus,
  type TaskActionRow,
} from './task-service'

export function useTaskActionsController() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [rows, setRows] = useState<TaskActionRow[]>([])
  const [summary, setSummary] = useState<TaskSummary>(EMPTY_SUMMARY)
  const [customerBlocked, setCustomerBlocked] = useState(false)
  const [savingDetailsId, setSavingDetailsId] = useState<string | null>(null)
  const [savingStatusId, setSavingStatusId] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    const loadTaskActions = async ({ showLoading }: { showLoading: boolean }) => {
      if (showLoading) setLoading(true)
      setError('')
      try {
        const user = await getSessionUserWithRetries()
        if (!active) return
        if (!user) throw new Error('Cannot read user: Not authenticated.')

        const result = await fetchTaskActions(supabase, user.id)
        if (!active) return
        setCustomerBlocked(result.userCtx.isCustomer)
        setRows(result.rows)
        setSummary(result.summary)
      } catch (loadError) {
        if (!active) return
        setError(loadError instanceof Error ? loadError.message : 'Could not load task actions.')
        setRows([])
        setSummary(EMPTY_SUMMARY)
      } finally {
        if (active && showLoading) setLoading(false)
      }
    }

    void loadTaskActions({ showLoading: true })

    const refreshIfVisible = () => {
      if (document.visibilityState !== 'visible') return
      void loadTaskActions({ showLoading: false })
    }

    window.addEventListener('focus', refreshIfVisible)
    document.addEventListener('visibilitychange', refreshIfVisible)

    return () => {
      active = false
      window.removeEventListener('focus', refreshIfVisible)
      document.removeEventListener('visibilitychange', refreshIfVisible)
    }
  }, [])

  async function changeTaskStatus(row: TaskActionRow, nextStatus: string) {
    const normalizedStatus = normalizeStatus(nextStatus)
    const previousStatus = row.status
    setError('')
    setSavingStatusId(row.id)
    setRows((current) => current.map((item) => (item.id === row.id ? { ...item, status: normalizedStatus } : item)))

    try {
      await updateTaskActionStatus(supabase, {
        rowId: row.id,
        status: normalizedStatus,
      })
    } catch (updateError) {
      setRows((current) => current.map((item) => (item.id === row.id ? { ...item, status: previousStatus } : item)))
      setError(getTaskErrorMessage(updateError, 'Could not update task status.'))
    } finally {
      setSavingStatusId(null)
    }
  }

  async function changeTaskDetails(
    row: TaskActionRow,
    patch: Partial<Pick<TaskActionRow, 'responsible' | 'targetDate'>>
  ) {
    const responsible = 'responsible' in patch ? (patch.responsible?.trim() || '-') : row.responsible
    const targetDate = 'targetDate' in patch ? patch.targetDate || null : row.targetDate

    if (responsible === row.responsible && targetDate === row.targetDate) return

    const previous = row
    setError('')
    setSavingDetailsId(row.id)
    setRows((current) =>
      current.map((item) => (item.id === row.id ? { ...item, responsible, targetDate } : item))
    )

    try {
      const detailsPatch: {
        responsible?: string | null
        rowId: string
        targetDate?: string | null
      } = { rowId: row.id }

      if ('responsible' in patch) detailsPatch.responsible = responsible === '-' ? null : responsible
      if ('targetDate' in patch) detailsPatch.targetDate = targetDate

      await updateTaskActionDetails(supabase, detailsPatch)
    } catch (updateError) {
      setRows((current) => current.map((item) => (item.id === row.id ? previous : item)))
      setError(getTaskErrorMessage(updateError, 'Could not update task details.'))
    } finally {
      setSavingDetailsId(null)
    }
  }

  return {
    changeTaskDetails,
    changeTaskStatus,
    customerBlocked,
    error,
    loading,
    rows,
    savingDetailsId,
    savingStatusId,
    summary,
  }
}
