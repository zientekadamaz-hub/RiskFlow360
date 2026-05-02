'use client'

import { useEffect, useMemo, useState } from 'react'
import type { SiteDepartmentOption, UiProjectRow } from './types'
import type { ProjectsTableColumnKey } from './table-layout'
import { normalizeProjectText } from './utils'

const FILTERS_KEY_PREFIX = '__PROJECTS_FILTERS__'

export type ProjectsSortColumn =
  | 'process'
  | 'site'
  | 'department'
  | 'products'
  | 'avgRpn'
  | 'risks'
  | 'updated'
  | 'revision'
  | 'status'

export type ProjectsSortState = { column: ProjectsSortColumn; direction: 'asc' | 'desc' } | null
export type ProjectsColumnKey = ProjectsTableColumnKey

type PendingFilters = {
  departments: string[]
  processNames: string[]
  productCells: string[]
  revisions: string[]
  sites: string[]
  statuses: string[]
}

const DEFAULT_HIDDEN_COLUMNS: Record<ProjectsColumnKey, boolean> = {
  process: false,
  site: false,
  department: false,
  products: false,
  avgRpn: false,
  risks: false,
  updated: false,
  revision: false,
  status: false,
}

function arraysEqual(left: string[], right: string[]) {
  if (left.length !== right.length) return false
  return left.every((value, index) => value === right[index])
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.map(normalizeProjectText).filter(Boolean))).sort((left, right) => left.localeCompare(right))
}

export function useProjectsTableState({
  loading,
  siteDeptRows,
  siteOptions,
  uiProjects,
  userId,
}: {
  loading: boolean
  siteDeptRows: SiteDepartmentOption[]
  siteOptions: string[]
  uiProjects: UiProjectRow[]
  userId: string
}) {
  const [filtersReady, setFiltersReady] = useState(false)
  const [pendingFilters, setPendingFilters] = useState<PendingFilters | null>(null)
  const [selectedSites, setSelectedSites] = useState<string[]>([])
  const [selectedDepts, setSelectedDepts] = useState<string[]>([])
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])
  const [selectedProcessNames, setSelectedProcessNames] = useState<string[]>([])
  const [selectedProductCells, setSelectedProductCells] = useState<string[]>([])
  const [selectedRevisions, setSelectedRevisions] = useState<string[]>([])
  const [sortState, setSortState] = useState<ProjectsSortState>(null)
  const [hiddenColumns, setHiddenColumns] = useState<Record<ProjectsColumnKey, boolean>>(DEFAULT_HIDDEN_COLUMNS)

  const siteOptionsMerged = useMemo(() => uniqueSorted(siteOptions), [siteOptions])
  const deptOptionsMerged = useMemo(() => uniqueSorted(siteDeptRows.map((row) => row.department)), [siteDeptRows])
  const statusOptionsMerged = useMemo(() => uniqueSorted(uiProjects.map((row) => row.status)), [uiProjects])
  const processOptionsMerged = useMemo(() => uniqueSorted(uiProjects.map((row) => row.process)), [uiProjects])
  const productCellOptionsMerged = useMemo(() => uniqueSorted(uiProjects.map((row) => row.products)), [uiProjects])
  const revisionOptionsMerged = useMemo(() => uniqueSorted(uiProjects.map((row) => row.revision)), [uiProjects])

  const siteDeptFiltered = useMemo(() => {
    const siteSet = selectedSites.length ? new Set(selectedSites) : null
    const deptSet = selectedDepts.length ? new Set(selectedDepts) : null

    return uiProjects.filter((row) => {
      const siteOk = siteSet ? siteSet.has(row.site) : true
      const deptOk = deptSet ? deptSet.has(row.department) : true
      return siteOk && deptOk
    })
  }, [uiProjects, selectedSites, selectedDepts])

  const filtered = useMemo(() => {
    const statusSet = selectedStatuses.length ? new Set(selectedStatuses) : null
    const processSet = selectedProcessNames.length ? new Set(selectedProcessNames) : null
    const productSet = selectedProductCells.length ? new Set(selectedProductCells) : null
    const revisionSet = selectedRevisions.length ? new Set(selectedRevisions) : null
    const statusPriority: Record<string, number> = {
      OPEN: 0,
      DRAFT: 1,
      OBSOLETE: 2,
    }

    return siteDeptFiltered
      .filter((row) => {
        const statusOk = statusSet ? statusSet.has(row.status) : true
        const processValueOk = processSet ? processSet.has(row.process) : true
        const productValueOk = productSet ? productSet.has(row.products) : true
        const revisionValueOk = revisionSet ? revisionSet.has(row.revision) : true
        return statusOk && processValueOk && productValueOk && revisionValueOk
      })
      .map((row, index) => ({ row, index }))
      .sort((left, right) => {
        const leftStatus = normalizeProjectText(left.row.status).toUpperCase()
        const rightStatus = normalizeProjectText(right.row.status).toUpperCase()
        const priorityDiff = (statusPriority[leftStatus] ?? 9) - (statusPriority[rightStatus] ?? 9)
        if (priorityDiff) return priorityDiff

        if (sortState) {
          let comparison = 0
          if (sortState.column === 'process') comparison = left.row.process.localeCompare(right.row.process, undefined, { sensitivity: 'base' })
          if (sortState.column === 'site') comparison = left.row.site.localeCompare(right.row.site, undefined, { sensitivity: 'base' })
          if (sortState.column === 'department') comparison = left.row.department.localeCompare(right.row.department, undefined, { sensitivity: 'base' })
          if (sortState.column === 'products') comparison = left.row.products.localeCompare(right.row.products, undefined, { sensitivity: 'base' })
          if (sortState.column === 'revision') comparison = left.row.revision.localeCompare(right.row.revision, undefined, { numeric: true, sensitivity: 'base' })
          if (sortState.column === 'status') comparison = left.row.status.localeCompare(right.row.status, undefined, { sensitivity: 'base' })
          if (sortState.column === 'avgRpn') comparison = (left.row.avgRpn ?? -1) - (right.row.avgRpn ?? -1)
          if (sortState.column === 'risks') comparison = left.row.riskCount - right.row.riskCount
          if (sortState.column === 'updated') comparison = Date.parse(left.row.updated || '') - Date.parse(right.row.updated || '')

          if (comparison !== 0) {
            return sortState.direction === 'asc' ? comparison : -comparison
          }
        }

        return left.index - right.index
      })
      .map(({ row }) => row)
  }, [siteDeptFiltered, selectedStatuses, selectedProcessNames, selectedProductCells, selectedRevisions, sortState])

  const openProjectsBySiteDept = useMemo(() => {
    return siteDeptFiltered.filter((project) => normalizeProjectText(project.status).toLowerCase() === 'open')
  }, [siteDeptFiltered])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!userId) return

    try {
      const raw = window.localStorage.getItem(`${FILTERS_KEY_PREFIX}:${userId}`)
      if (!raw) {
        queueMicrotask(() => {
          setPendingFilters(null)
          setFiltersReady(true)
        })
        return
      }

      const parsed = JSON.parse(raw) as Partial<PendingFilters>
      if (!parsed || typeof parsed !== 'object') return

      queueMicrotask(() => {
        setPendingFilters({
          departments: Array.isArray(parsed.departments) ? parsed.departments : [],
          processNames: Array.isArray(parsed.processNames) ? parsed.processNames : [],
          productCells: Array.isArray(parsed.productCells) ? parsed.productCells : [],
          revisions: Array.isArray(parsed.revisions) ? parsed.revisions : [],
          sites: Array.isArray(parsed.sites) ? parsed.sites : [],
          statuses: Array.isArray(parsed.statuses) ? parsed.statuses : [],
        })
      })
    } catch {
      queueMicrotask(() => {
        setPendingFilters(null)
        setFiltersReady(true)
      })
    }
  }, [userId])

  useEffect(() => {
    if (loading) return
    if (!pendingFilters) {
      queueMicrotask(() => setFiltersReady(true))
      return
    }

    const allowedSites = new Set(siteOptionsMerged)
    const allowedDepts = new Set(deptOptionsMerged)
    const allowedStatuses = new Set(statusOptionsMerged)
    const allowedProcesses = new Set(processOptionsMerged)
    const allowedProductCells = new Set(productCellOptionsMerged)
    const allowedRevisions = new Set(revisionOptionsMerged)

    queueMicrotask(() => {
      setSelectedSites(pendingFilters.sites.filter((value) => allowedSites.has(value)))
      setSelectedDepts(pendingFilters.departments.filter((value) => allowedDepts.has(value)))
      setSelectedStatuses(pendingFilters.statuses.filter((value) => allowedStatuses.has(value)))
      setSelectedProcessNames(pendingFilters.processNames.filter((value) => allowedProcesses.has(value)))
      setSelectedProductCells(pendingFilters.productCells.filter((value) => allowedProductCells.has(value)))
      setSelectedRevisions(pendingFilters.revisions.filter((value) => allowedRevisions.has(value)))
      setPendingFilters(null)
      setFiltersReady(true)
    })
  }, [pendingFilters, loading, siteOptionsMerged, deptOptionsMerged, statusOptionsMerged, processOptionsMerged, productCellOptionsMerged, revisionOptionsMerged])

  useEffect(() => {
    const pruneSelection = (current: string[], allowedValues: string[], setNext: (value: string[]) => void) => {
      if (!current.length) return
      const allowed = new Set(allowedValues)
      const next = current.filter((value) => allowed.has(value))
      if (!arraysEqual(current, next)) setNext(next)
    }

    pruneSelection(selectedDepts, deptOptionsMerged, setSelectedDepts)
    pruneSelection(selectedStatuses, statusOptionsMerged, setSelectedStatuses)
    pruneSelection(selectedProcessNames, processOptionsMerged, setSelectedProcessNames)
    pruneSelection(selectedProductCells, productCellOptionsMerged, setSelectedProductCells)
    pruneSelection(selectedRevisions, revisionOptionsMerged, setSelectedRevisions)
  }, [
    selectedDepts,
    selectedStatuses,
    selectedProcessNames,
    selectedProductCells,
    selectedRevisions,
    deptOptionsMerged,
    statusOptionsMerged,
    processOptionsMerged,
    productCellOptionsMerged,
    revisionOptionsMerged,
  ])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!userId) return

    try {
      window.localStorage.setItem(
        `${FILTERS_KEY_PREFIX}:${userId}`,
        JSON.stringify({
          departments: selectedDepts,
          processNames: selectedProcessNames,
          productCells: selectedProductCells,
          revisions: selectedRevisions,
          sites: selectedSites,
          statuses: selectedStatuses,
        })
      )
    } catch {}
  }, [userId, selectedSites, selectedDepts, selectedStatuses, selectedProcessNames, selectedProductCells, selectedRevisions])

  return {
    deptOptionsMerged,
    filtered,
    filtersReady,
    hiddenColumns,
    openProjectsBySiteDept,
    processOptionsMerged,
    productCellOptionsMerged,
    revisionOptionsMerged,
    selectedDepts,
    selectedProcessNames,
    selectedProductCells,
    selectedRevisions,
    selectedSites,
    selectedStatuses,
    setHiddenColumns,
    setSelectedDepts,
    setSelectedProcessNames,
    setSelectedProductCells,
    setSelectedRevisions,
    setSelectedSites,
    setSelectedStatuses,
    setSortState,
    siteDeptFiltered,
    siteOptionsMerged,
    sortState,
    statusOptionsMerged,
  }
}
