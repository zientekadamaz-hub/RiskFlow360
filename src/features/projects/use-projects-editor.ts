'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  createProjectRecord,
  deleteProjectRecord,
  updateProjectRecord,
} from './projects-service'
import type { ProjectRowDb, SiteDepartmentOption, UiProjectRow, UserCtx } from './types'
import { errText, parseProductList } from './utils'

export type ProjectDeleteConfirmState = null | {
  step: 1 | 2
  title: string
  body: string
  onConfirm: () => Promise<void>
}

export function useProjectsEditor({
  rawProjects,
  refreshProjects,
  setError,
  siteDeptRows,
  supabase,
  userCtx,
}: {
  rawProjects: ProjectRowDb[]
  refreshProjects: (opts?: { soft?: boolean }) => Promise<void>
  setError: Dispatch<SetStateAction<string>>
  siteDeptRows: SiteDepartmentOption[]
  supabase: SupabaseClient
  userCtx: UserCtx
}) {
  const [creating, setCreating] = useState(false)
  const [createRowOpen, setCreateRowOpen] = useState(false)
  const [newProcess, setNewProcess] = useState('')
  const [newSite, setNewSite] = useState('')
  const [newDept, setNewDept] = useState('')
  const [newProducts, setNewProducts] = useState<string[]>([''])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editProcess, setEditProcess] = useState('')
  const [editSite, setEditSite] = useState('')
  const [editDept, setEditDept] = useState('')
  const [editStatus, setEditStatus] = useState('')
  const [editProducts, setEditProducts] = useState<string[]>([''])
  const [editSaving, setEditSaving] = useState(false)
  const [confirm, setConfirm] = useState<ProjectDeleteConfirmState>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)

  const deptOptionsForSite = useMemo(() => {
    if (!newSite) return []
    const departments = siteDeptRows.filter((row) => row.site === newSite).map((row) => row.department)
    return Array.from(new Set(departments)).sort((left, right) => left.localeCompare(right))
  }, [newSite, siteDeptRows])

  const deptOptionsForEditSite = useMemo(() => {
    if (!editSite) return []
    const departments = siteDeptRows.filter((row) => row.site === editSite).map((row) => row.department)
    return Array.from(new Set(departments)).sort((left, right) => left.localeCompare(right))
  }, [editSite, siteDeptRows])

  const canCreate = useMemo(() => {
    return newProcess.trim().length >= 2 && newSite.trim().length >= 1 && newDept.trim().length >= 1
  }, [newProcess, newSite, newDept])

  const canEdit = useMemo(() => {
    return editProcess.trim().length >= 2 && editSite.trim().length >= 1 && editDept.trim().length >= 1 && editStatus.trim().length >= 1
  }, [editProcess, editSite, editDept, editStatus])

  useEffect(() => {
    if (!newSite) {
      if (newDept) queueMicrotask(() => setNewDept(''))
      return
    }
    if (!deptOptionsForSite.includes(newDept)) {
      queueMicrotask(() => setNewDept(''))
    }
  }, [newSite, newDept, deptOptionsForSite])

  useEffect(() => {
    if (!editSite) {
      if (editDept) queueMicrotask(() => setEditDept(''))
      return
    }
    if (!deptOptionsForEditSite.includes(editDept)) {
      queueMicrotask(() => setEditDept(''))
    }
  }, [editSite, editDept, deptOptionsForEditSite])

  const resetCreateRow = () => {
    setCreateRowOpen(false)
    setNewProcess('')
    setNewSite('')
    setNewDept('')
    setNewProducts([''])
  }

  const resetEditRow = () => {
    setEditingId(null)
    setEditProcess('')
    setEditSite('')
    setEditDept('')
    setEditStatus('')
    setEditProducts([''])
    setEditSaving(false)
  }

  async function createProject() {
    if (!canCreate || creating) return
    setCreating(true)
    setError('')

    try {
      await createProjectRecord(supabase, {
        orgId: userCtx.orgId,
        userId: userCtx.userId,
        rawProjects,
        siteDeptRows,
        processName: newProcess,
        siteName: newSite,
        departmentName: newDept,
        products: newProducts,
      })

      resetCreateRow()
      await refreshProjects({ soft: true })
    } catch (error: unknown) {
      setError(errText(error))
    } finally {
      setCreating(false)
    }
  }

  async function deleteProject(projectId: string) {
    if (!userCtx.canDelete) return
    setError('')

    try {
      await deleteProjectRecord(supabase, projectId, userCtx.orgId)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not delete project.')
      return
    }

    await refreshProjects({ soft: true })
  }

  const requestDeleteProject = (projectId: string, processName: string) => {
    if (!userCtx.canDelete) return
    setConfirm({
      step: 1,
      title: 'Delete process',
      body: `Are you sure you want to delete "${processName}"? This will remove the entire project, including PFD/PFMEA/PCP and all defined actions.`,
      onConfirm: async () => {
        setConfirm({
          step: 2,
          title: 'Final confirmation',
          body: 'Are you absolutely sure you want to proceed?',
          onConfirm: async () => {
            await deleteProject(projectId)
          },
        })
      },
    })
  }

  const startEditRow = (row: UiProjectRow) => {
    setEditingId(row.id)
    setEditProcess(row.process === '-' ? '' : row.process)
    setEditSite(row.site === '-' ? '' : row.site)
    setEditDept(row.department === '-' ? '' : row.department)
    setEditStatus(row.status === '-' ? '' : row.status)
    setEditProducts(parseProductList(row.products))
  }

  const saveEdit = async () => {
    if (!editingId || !canEdit || editSaving) return
    setEditSaving(true)
    setError('')

    try {
      await updateProjectRecord(supabase, {
        editingId,
        orgId: userCtx.orgId,
        userId: userCtx.userId,
        rawProjects,
        siteDeptRows,
        processName: editProcess,
        siteName: editSite,
        departmentName: editDept,
        status: editStatus,
        products: editProducts,
      })

      await refreshProjects({ soft: true })
      resetEditRow()
    } catch (error: unknown) {
      setError(errText(error))
    } finally {
      setEditSaving(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!confirm || confirmBusy) return
    const step = confirm.step
    setConfirmBusy(true)
    await confirm.onConfirm()
    setConfirmBusy(false)
    if (step === 2) setConfirm(null)
  }

  return {
    canCreate,
    canEdit,
    confirm,
    confirmBusy,
    createProject,
    createRowOpen,
    creating,
    deptOptionsForEditSite,
    deptOptionsForSite,
    editDept,
    editProducts,
    editProcess,
    editSaving,
    editSite,
    editStatus,
    editingId,
    handleConfirmDelete,
    newDept,
    newProcess,
    newProducts,
    newSite,
    requestDeleteProject,
    resetCreateRow,
    resetEditRow,
    saveEdit,
    setConfirm,
    setCreateRowOpen,
    setEditDept,
    setEditProducts,
    setEditProcess,
    setEditSite,
    setEditStatus,
    setNewDept,
    setNewProcess,
    setNewProducts,
    setNewSite,
    startEditRow,
  }
}
