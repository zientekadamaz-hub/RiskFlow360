'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@app/lib/supabaseBrowser'

type ProjectRowDb = {
  id: string
  organization_id?: string | null

  name?: string | null
  products?: string | null
  product_names?: string | null

  site_department_id?: string | null

  status?: string | null
  open_revision_label?: string | null
  draft_revision_label?: string | null
  current_open_revision_id?: string | null
  current_draft_revision_id?: string | null

  created_at: string
  updated_at?: string | null
  updated_by?: string | null
  user_id?: string | null
}

type UiProjectRow = {
  id: string
  site: string
  department: string
  process: string
  products: string
  avgRpn: number | null
  riskCount: number
  updated: string // ISO
  revision: string
  status: string
}

type ProjectPfmeaStat = {
  avgRpn: number | null
  riskCount: number
}

type PfdHistoryTooltipRow = {
  project_id?: string | null
  created_at?: string | null
  revision_label?: string | null
  change_description?: string | null
  author_name?: string | null
}

type ModuleRevisionTooltipRow = {
  project_id?: string | null
  module?: string | null
  created_at?: string | null
  revision_label?: string | null
  change_description?: string | null
  author_name?: string | null
  updated_by_name?: string | null
  created_by_name?: string | null
  user_name?: string | null
  updated_by?: string | null
  created_by?: string | null
  user_id?: string | null
}

type RevisionPopupRow = {
  module: 'PFD' | 'PFMEA' | 'PCP'
  revisionLabel: string
  at: string
  author: string
  description: string
  hasData: boolean
}

type RevisionPopupData = {
  loading: boolean
  rows: RevisionPopupRow[]
  error?: boolean
}

type UserCtx = {
  userId: string
  orgId: string | null
  globalRole: string | null
  orgRole: string | null
  canDelete: boolean // Admin + Champion
  isChampion: boolean
}

type HeaderRpcRow = {
  org_name?: string | null
}

type Mode = 'manual' | 'rpn'
type RiskColor = 'green' | 'yellow' | 'orange' | 'red'
type RpnThresholds = { greenMax: number; yellowMax: number; orangeMax: number }

const SESSION_RETRY_COUNT = 8
const SESSION_RETRY_DELAY_MS = 250
const FILTERS_KEY_PREFIX = '__PROJECTS_FILTERS__'
const GLOBAL_PROJECT_ID = '00000000-0000-0000-0000-000000000000'

function errText(e: any) {
  if (!e) return 'unknown'
  return e?.message || e?.error_description || e?.details || e?.hint || String(e)
}

function formatDatePL(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('pl-PL', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

function formatAvgRpn(value: number | null) {
  if (value == null || !Number.isFinite(value)) return '-'
  return String(Math.round(value))
}

function formatAvgRpnInt(value: number | null) {
  if (value == null || !Number.isFinite(value)) return '-'
  return String(Math.round(value))
}

function formatDateTimePL(iso: string | null | undefined) {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  const date = d.toLocaleDateString('pl-PL', { year: 'numeric', month: '2-digit', day: '2-digit' })
  const time = d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  return `${date} ${time}`
}

function sectionRevisionFromLabel(revisionLabel: string | null | undefined, moduleName: 'PFD' | 'PFMEA' | 'PCP') {
  const raw = (revisionLabel ?? '').toString().trim()
  if (!raw) return '-'
  const parts = raw
    .split('.')
    .map((v) => v.trim())
    .filter(Boolean)

  const normalized = parts
    .map((part) => {
      const numeric = part.match(/\d+/)?.[0] ?? ''
      return numeric || part
    })
    .filter(Boolean)

  if (normalized.length === 0) return '-'
  if (normalized.length === 1) return normalized[0]

  const targetIndex = moduleName === 'PFD' ? 0 : moduleName === 'PFMEA' ? 1 : 2
  const direct = normalized[targetIndex]
  if (direct && direct !== '0') return direct

  const nonZero = normalized.find((part) => part !== '0')
  return nonZero || direct || '-'
}

function emptyRevisionRows(): RevisionPopupRow[] {
  return ['PFD', 'PFMEA', 'PCP'].map((moduleName) => ({
    module: moduleName as RevisionPopupRow['module'],
    revisionLabel: '-',
    at: '-',
    author: '-',
    description: 'No updates yet',
    hasData: false,
  }))
}

function clampInt(v: number, min: number, max: number) {
  if (!Number.isFinite(v)) return min
  return Math.max(min, Math.min(max, Math.trunc(v)))
}

function cellKey(sev: number, doVal: number) {
  return `${sev}|${doVal}`
}

function colorFromRpn(sev: number, doVal: number, t: RpnThresholds): RiskColor {
  const rpn = sev * doVal
  if (rpn <= t.greenMax) return 'green'
  if (rpn <= t.yellowMax) return 'yellow'
  if (rpn <= t.orangeMax) return 'orange'
  return 'red'
}

function getRiskColorFor(
  sevRaw: number | null,
  doValRaw: number | null,
  rmMode: Mode,
  rmRpn: RpnThresholds,
  rmCells: Record<string, RiskColor>
): RiskColor | null {
  if (sevRaw == null || doValRaw == null) return null

  const sev = clampInt(sevRaw, 1, 10)
  const doVal = clampInt(doValRaw, 1, 100)

  if (rmMode === 'manual') {
    const hit = rmCells[cellKey(sev, doVal)]
    if (hit) return hit
    return colorFromRpn(sev, doVal, rmRpn)
  }
  return colorFromRpn(sev, doVal, rmRpn)
}

function FilterIcon({ active }: { active: boolean }) {
  const stroke = active ? '#16a34a' : '#9ca3af'
  const fill = active ? 'rgba(22,163,74,0.35)' : 'none'

  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 5h18l-7 8v5l-4 1v-6L3 5z"
        stroke={stroke}
        fill={fill}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function RevisionHintIcon({ active }: { active: boolean }) {
  const stroke = '#9ca3af'
  const fill = active ? 'rgba(156,163,175,0.16)' : 'none'

  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" stroke={stroke} fill={fill} strokeWidth="1.5" />
      <path d="M4.5 7l7.5 6L19.5 7" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const FILTER_ACTIVE_BG = 'rgba(156,163,175,0.18)'
const FILTER_ACTIVE_BORDER = 'rgba(156,163,175,0.42)'
const FILTER_CHIP_WIDTH = 120

function normalizeStr(v: any) {
  return (v ?? '').toString().trim()
}

function normalizeProductInputs(list: string[]) {
  const next = list.map((v) => (v ?? '').toString())
  const trimmed = next.filter((v, idx) => v.trim() !== '' || idx === next.length - 1)
  if (!trimmed.length || trimmed[trimmed.length - 1].trim() !== '') trimmed.push('')
  return trimmed
}

function cleanProductList(list: string[]) {
  return list.map((v) => v.trim()).filter(Boolean)
}

function parseProductList(value: string) {
  if (!value || value === '-') return ['']
  const parts = value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
  if (!parts.length) return ['']
  return [...parts, '']
}

export default function ProjectsPage() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filtersReady, setFiltersReady] = useState(false)
  const [error, setError] = useState('')
  const [orgName, setOrgName] = useState<string | null>(null)
  const [riskCount, setRiskCount] = useState<number>(0)
  const [openRiskAvgRpn, setOpenRiskAvgRpn] = useState<number | null>(null)
  const [pendingFilters, setPendingFilters] = useState<{
    sites: string[]
    departments: string[]
    statuses: string[]
    process?: string
    products?: string
  } | null>(null)

  const [userCtx, setUserCtx] = useState<UserCtx>({
    userId: '',
    orgId: null,
    globalRole: null,
    orgRole: null,
    canDelete: false,
    isChampion: false,
  })

  const [rawProjects, setRawProjects] = useState<ProjectRowDb[]>([])
  const [projectPfmeaStats, setProjectPfmeaStats] = useState<Record<string, ProjectPfmeaStat>>({})
  const [revisionPopupByProject, setRevisionPopupByProject] = useState<Record<string, RevisionPopupData>>({})
  const [rmMode, setRmMode] = useState<Mode>('rpn')
  const [rmRpn, setRmRpn] = useState<RpnThresholds>({ greenMax: 100, yellowMax: 168, orangeMax: 360 })
  const [rmCells, setRmCells] = useState<Record<string, RiskColor>>({})
  const [riskColorCounts, setRiskColorCounts] = useState<Record<RiskColor, number>>({
    red: 0,
    orange: 0,
    yellow: 0,
    green: 0,
  })

  const [siteDeptRows, setSiteDeptRows] = useState<Array<{ id: string; site: string; department: string }>>([])
  const [siteDeptMap, setSiteDeptMap] = useState<Record<string, { site: string; department: string }>>({})

  // --- Site filter (single) ---
  const [siteOptions, setSiteOptions] = useState<string[]>([])
  const [selectedSites, setSelectedSites] = useState<string[]>([]) // [] = all
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]) // [] = all
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]) // [] = all
  const [processQuery, setProcessQuery] = useState('')
  const [productsQuery, setProductsQuery] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)

  // --- Create card ---
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
  const [confirm, setConfirm] = useState<null | { step: 1 | 2; title: string; body: string; onConfirm: () => Promise<void> }>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)

  const deptOptionsForSite = useMemo(() => {
    if (!newSite) return []
    const depts = siteDeptRows.filter((r) => r.site === newSite).map((r) => r.department)
    return Array.from(new Set(depts)).sort((a, b) => a.localeCompare(b))
  }, [newSite, siteDeptRows])

  const deptOptionsForEditSite = useMemo(() => {
    if (!editSite) return []
    const depts = siteDeptRows.filter((r) => r.site === editSite).map((r) => r.department)
    return Array.from(new Set(depts)).sort((a, b) => a.localeCompare(b))
  }, [editSite, siteDeptRows])

  const canCreate = useMemo(() => {
    return newProcess.trim().length >= 2 && newSite.trim().length >= 1 && newDept.trim().length >= 1
  }, [newProcess, newSite, newDept])

  useEffect(() => {
    if (!newSite) {
      if (newDept) setNewDept('')
      return
    }
    if (!deptOptionsForSite.includes(newDept)) {
      setNewDept('')
    }
  }, [newSite, newDept, deptOptionsForSite])

  useEffect(() => {
    if (!editSite) {
      if (editDept) setEditDept('')
      return
    }
    if (!deptOptionsForEditSite.includes(editDept)) {
      setEditDept('')
    }
  }, [editSite, editDept, deptOptionsForEditSite])

  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))
  const hasAuthCookie = () => {
    if (typeof document === 'undefined') return false
    return document.cookie
      .split(';')
      .map((c) => c.trim().split('=')[0])
      .some((n) => n.startsWith('sb-') && n.includes('auth-token'))
  }
  const getSessionUser = async () => {
    for (let i = 0; i < SESSION_RETRY_COUNT; i += 1) {
      const { data } = await supabase.auth.getSession()
      const user = data.session?.user ?? null
      if (user) return user
      if (!hasAuthCookie()) return null
      if (i === 2 || i === 5) {
        try {
          await supabase.auth.refreshSession()
        } catch {}
      }
      await delay(SESSION_RETRY_DELAY_MS)
    }
    return null
  }

  async function loadUserContext(): Promise<UserCtx> {
    const user = await getSessionUser()
    if (!user) throw new Error('Cannot read user: Not authenticated.')
    const userId = user.id

    let globalRole: string | null = null
    try {
      const { data } = await supabase.from('user_profiles').select('role').eq('id', userId).maybeSingle()
      globalRole = (data as any)?.role ?? null
    } catch {
      globalRole = null
    }

    let orgId: string | null = null
    let orgRole: string | null = null
    try {
      const { data, error } = await supabase
        .from('organization_members')
        .select('organization_id,role')
        .eq('user_id', userId)
        .limit(1)

      if (!error && data?.length) {
        orgId = (data[0] as any)?.organization_id ?? null
        orgRole = (data[0] as any)?.role ?? null
      }
    } catch {
      orgId = null
      orgRole = null
    }

    const isAdmin = (globalRole ?? '').toLowerCase() === 'admin'
    const isChampion = (orgRole ?? '').toLowerCase() === 'champion'

    return { userId, orgId, globalRole, orgRole, canDelete: isAdmin || isChampion, isChampion }
  }

  async function loadSiteAndDeptLists(orgId: string | null) {
    if (!orgId) {
      setSiteOptions([])
      setSiteDeptRows([])
      setSiteDeptMap({})
      return
    }

    try {
      const { data, error } = await supabase
        .from('site_departments')
        .select('id,site,department,active')
        .eq('organization_id', orgId)
        .order('site')
        .order('department')
      if (error) {
        setSiteOptions([])
        setSiteDeptRows([])
        setSiteDeptMap({})
        return
      }
      const rows = (data ?? [])
        .filter((r: any) => r?.active !== false)
        .map((r: any) => ({
          id: String(r?.id),
          site: normalizeStr(r?.site),
          department: normalizeStr(r?.department),
        }))
        .filter((r: any) => r.site && r.department)

      const sites = Array.from(new Set(rows.map((r) => r.site))).sort((a, b) => a.localeCompare(b))
      const map: Record<string, { site: string; department: string }> = {}
      for (const r of rows) map[r.id] = { site: r.site, department: r.department }

      setSiteDeptRows(rows)
      setSiteDeptMap(map)
      setSiteOptions(sites)
    } catch {
      setSiteOptions([])
      setSiteDeptRows([])
      setSiteDeptMap({})
    }
  }

  async function loadOrgName(orgId: string | null) {
    if (!orgId) {
      setOrgName(null)
      return
    }
    try {
      const headerRes = await supabase.rpc('get_my_header').maybeSingle()
      if (!headerRes.error && headerRes.data) {
        const header = headerRes.data as HeaderRpcRow
        if (header.org_name) {
          setOrgName(header.org_name)
          return
        }
      }
    } catch {}

    try {
      const orgRes = await supabase.from('organizations').select('name').eq('id', orgId).maybeSingle()
      if (!orgRes.error) setOrgName(orgRes.data?.name ?? null)
    } catch {
      setOrgName(null)
    }
  }

  async function loadProjects(ctx: UserCtx, opts?: { soft?: boolean }) {
    const soft = !!opts?.soft
    if (soft) setRefreshing(true)
    else setLoading(true)
    setError('')

    let q = supabase
      .from('projects_with_revision')
      .select(
        'id,organization_id,name,site_department_id,status,created_at,updated_at,user_id,updated_by,products,open_revision_label,draft_revision_label,current_open_revision_id,current_draft_revision_id'
      )
      .order('updated_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })

    if (ctx.orgId) q = q.eq('organization_id', ctx.orgId)

    const { data, error } = await q
    if (error) {
      setError(error.message)
      setRawProjects([])
      if (soft) setRefreshing(false)
      else setLoading(false)
      return
    }

    setRawProjects((data ?? []) as ProjectRowDb[])
    if (soft) setRefreshing(false)
    else setLoading(false)
  }

  async function createProject() {
    if (!canCreate || creating) return
    setCreating(true)
    setError('')

    try {
      const processName = newProcess.trim()
      const nameKey = processName.toLowerCase()
      const existsLocal = rawProjects.some((p) => normalizeStr(p.name).toLowerCase() === nameKey)
      if (existsLocal) throw new Error('Process name already exists.')

      const siteDeptId =
        siteDeptRows.find((r) => r.site === newSite.trim() && r.department === newDept.trim())?.id ?? null
      if (!siteDeptId) throw new Error('Invalid Site + Department selection.')

      const dupCheck = await supabase
        .from('projects')
        .select('id')
        .eq('organization_id', userCtx.orgId)
        .eq('name', processName)
        .limit(1)
      if (dupCheck.error) throw dupCheck.error
      if (dupCheck.data && dupCheck.data.length) throw new Error('Process name already exists.')

      const payload: any = {
        organization_id: userCtx.orgId,
        site_department_id: siteDeptId,
        status: 'DRAFT',
        updated_at: new Date().toISOString(),

        name: newProcess.trim(),
        standard: 'GENERIC',
        user_id: userCtx.userId || null,
        updated_by: userCtx.userId || null,
      }

      const productsList = cleanProductList(newProducts)
      if (productsList.length) payload.products = productsList.join(', ')

      let insertRes = await supabase.from('projects').insert([payload])
      if (insertRes.error && /products?/i.test(insertRes.error.message)) {
        // retry without products column if schema doesn't support it
        const { products, ...fallback } = payload
        insertRes = await supabase.from('projects').insert([fallback])
      }
      if (insertRes.error) throw new Error(insertRes.error.message)

      setCreateRowOpen(false)
      setNewProcess('')
      setNewSite('')
      setNewDept('')
      setNewProducts([''])

      await loadProjects(userCtx, { soft: true })
    } catch (e: any) {
      setError(errText(e))
    } finally {
      setCreating(false)
    }
  }

  async function deleteProject(projectId: string) {
    if (!userCtx.canDelete) return
    setError('')
    const { error } = await supabase.from('projects').delete().eq('id', projectId)
    if (error) {
      setError(error.message)
      return
    }
    await loadProjects(userCtx, { soft: true })
  }

  async function updateProjectStatus(projectId: string, nextStatus: string) {
    setError('')
    const { error } = await supabase
      .from('projects')
      .update({
        status: nextStatus,
        updated_at: new Date().toISOString(),
        updated_by: userCtx.userId || null,
      })
      .eq('id', projectId)
    if (error) {
      setError(error.message)
      return
    }
    await loadProjects(userCtx, { soft: true })
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

  const canEdit = useMemo(() => {
    return editProcess.trim().length >= 2 && editSite.trim().length >= 1 && editDept.trim().length >= 1 && editStatus.trim()
  }, [editProcess, editSite, editDept, editStatus])

  const saveEdit = async () => {
    if (!editingId || !canEdit || editSaving) return
    setEditSaving(true)
    setError('')
    try {
      const processName = editProcess.trim()
      const nameKey = processName.toLowerCase()
      const existsLocal = rawProjects.some((p) => p.id !== editingId && normalizeStr(p.name).toLowerCase() === nameKey)
      if (existsLocal) throw new Error('Process name already exists.')

      const siteDeptId =
        siteDeptRows.find((r) => r.site === editSite.trim() && r.department === editDept.trim())?.id ?? null
      if (!siteDeptId) throw new Error('Invalid Site + Department selection.')

      const dupCheck = await supabase
        .from('projects')
        .select('id')
        .eq('organization_id', userCtx.orgId)
        .eq('name', processName)
        .neq('id', editingId)
        .limit(1)
      if (dupCheck.error) throw dupCheck.error
      if (dupCheck.data && dupCheck.data.length) throw new Error('Process name already exists.')

      const productsList = cleanProductList(editProducts)
      const payload: any = {
        name: processName,
        site_department_id: siteDeptId,
        status: editStatus.trim(),
        updated_at: new Date().toISOString(),
        updated_by: userCtx.userId || null,
      }
      if (productsList.length) payload.products = productsList.join(', ')
      else payload.products = null

      let updateRes = await supabase.from('projects').update(payload).eq('id', editingId)
      if (updateRes.error && /products?/i.test(updateRes.error.message)) {
        const { products, ...fallback } = payload
        updateRes = await supabase.from('projects').update(fallback).eq('id', editingId)
      }
      if (updateRes.error) throw new Error(updateRes.error.message)

      await loadProjects(userCtx, { soft: true })
      resetEditRow()
    } catch (e: any) {
      setError(errText(e))
    } finally {
      setEditSaving(false)
    }
  }

  useEffect(() => {
    ;(async () => {
      try {
        setFiltersReady(false)
        const ctx = await loadUserContext()
        setUserCtx(ctx)
        await Promise.all([loadProjects(ctx), loadOrgName(ctx.orgId), loadSiteAndDeptLists(ctx.orgId)])
      } catch (e: any) {
        setError(errText(e))
        setLoading(false)
      }
    })()
  }, [])

  useEffect(() => {
    let alive = true

    ;(async () => {
      try {
        const cfg = await supabase
          .from('risk_matrix_config')
          .select('id,mode,rpn_green_max,rpn_yellow_max,rpn_orange_max')
          .eq('id', 1)
          .maybeSingle()
        if (!cfg.error && cfg.data && alive) {
          const c = cfg.data as any
          setRmMode((c?.mode as Mode) ?? 'rpn')
          setRmRpn({
            greenMax: clampInt(Number(c?.rpn_green_max), 1, 1000),
            yellowMax: clampInt(Number(c?.rpn_yellow_max), 1, 1000),
            orangeMax: clampInt(Number(c?.rpn_orange_max), 1, 1000),
          })
        }
      } catch {}

      try {
        const cellsRes = await supabase
          .from('risk_matrix_cells')
          .select('project_id,severity,do_value,color')
          .eq('project_id', GLOBAL_PROJECT_ID)
        if (!cellsRes.error && alive) {
          const map: Record<string, RiskColor> = {}
          for (const row of (cellsRes.data ?? []) as any[]) {
            const sev = Number((row as any)?.severity)
            const doVal = Number((row as any)?.do_value)
            const color = (row as any)?.color as RiskColor
            if (!Number.isFinite(sev) || !Number.isFinite(doVal) || !color) continue
            map[cellKey(sev, doVal)] = color
          }
          setRmCells(map)
        }
      } catch {}
    })()

    return () => {
      alive = false
    }
  }, [])

  const siteOptionsMerged = useMemo(() => {
    return (siteOptions ?? []).filter(Boolean)
  }, [siteOptions])

  const deptOptionsMerged = useMemo(() => {
    const depts = Array.from(new Set(siteDeptRows.map((r) => r.department))).filter(Boolean)
    return depts.sort((a, b) => a.localeCompare(b))
  }, [siteDeptRows])

  const uiProjects = useMemo<UiProjectRow[]>(() => {
    return rawProjects.map((p) => {
      const process = normalizeStr(p.name) || '-'
      const products = normalizeStr(p.products ?? p.product_names) || '-'
      const siteDept = p.site_department_id ? siteDeptMap[p.site_department_id] : null
      const site = normalizeStr(siteDept?.site) || '-'
      const department = normalizeStr(siteDept?.department) || '-'
      const updated = p.updated_at ?? p.created_at
      const revision = normalizeStr(p.draft_revision_label) || normalizeStr(p.open_revision_label) || '0.0.0'
      const status = normalizeStr(p.status) || 'DRAFT'
      const stats = projectPfmeaStats[p.id] ?? { avgRpn: null, riskCount: 0 }
      return {
        id: p.id,
        site,
        department,
        process,
        products,
        avgRpn: stats.avgRpn,
        riskCount: stats.riskCount,
        updated,
        revision,
        status,
      }
    })
  }, [rawProjects, siteDeptMap, projectPfmeaStats])

  const statusOptionsMerged = useMemo(() => {
    const statuses = Array.from(new Set(uiProjects.map((r) => normalizeStr(r.status)).filter(Boolean)))
    return statuses.sort((a, b) => a.localeCompare(b))
  }, [uiProjects])
  const editStatusOptions = useMemo(() => {
    const current = normalizeStr(editStatus).toUpperCase()
    if (current === 'DRAFT') return ['DRAFT']
    if (current === 'OPEN' || current === 'OBSOLETE') return ['OPEN', 'OBSOLETE']
    const base = ['DRAFT', 'OPEN', 'OBSOLETE']
    const set = new Set<string>(base)
    for (const s of statusOptionsMerged) {
      if (s) set.add(s)
    }
    return Array.from(set)
  }, [statusOptionsMerged, editStatus])

  const siteDeptFiltered = useMemo(() => {
    const siteSet = selectedSites.length ? new Set(selectedSites) : null
    const deptSet = selectedDepts.length ? new Set(selectedDepts) : null
    return uiProjects.filter((r) => {
      const siteOk = siteSet ? siteSet.has(r.site) : true
      const deptOk = deptSet ? deptSet.has(r.department) : true
      return siteOk && deptOk
    })
  }, [uiProjects, selectedSites, selectedDepts])

  // Filtered rows by selectedSites + selectedDepts + selectedStatuses
  const filtered = useMemo(() => {
    const statusSet = selectedStatuses.length ? new Set(selectedStatuses) : null
    const q = processQuery.trim().toLowerCase()
    const pq = productsQuery.trim().toLowerCase()
    return siteDeptFiltered.filter((r) => {
      const statusOk = statusSet ? statusSet.has(r.status) : true
      const processOk = q ? r.process.toLowerCase().includes(q) : true
      const productsOk = pq ? r.products.toLowerCase().includes(pq) : true
      return statusOk && processOk && productsOk
    })
  }, [siteDeptFiltered, selectedStatuses, processQuery, productsQuery])

  useEffect(() => {
    const projectIds = Array.from(new Set(rawProjects.map((p) => normalizeStr(p.id)).filter(Boolean)))
    if (!projectIds.length) {
      setProjectPfmeaStats({})
      return
    }

    const revisionByProject: Record<string, string> = {}
    for (const p of rawProjects) {
      const projectId = normalizeStr(p.id)
      if (!projectId) continue
      const revisionId = normalizeStr(p.current_draft_revision_id) || normalizeStr(p.current_open_revision_id)
      if (revisionId) revisionByProject[projectId] = revisionId
    }

    let cancelled = false

    ;(async () => {
      try {
        const { data, error } = await supabase
          .from('pfmea_rows')
          .select('revision_id,rpn,rpn_current,severity,occurrence,detection,created_at,operations!inner(project_id,active)')
          .eq('operations.active', true)
        if (error) throw error

        const toNum = (v: any) => {
          const n = Number(v)
          return Number.isFinite(n) ? n : null
        }

        type RevAgg = { riskCount: number; rpnCount: number; rpnSum: number; lastCreatedAt: number }
        const aggregateByProjectRev: Record<string, Record<string, RevAgg>> = {}

        for (const row of (data ?? []) as any[]) {
          const opRel = (row as any)?.operations
          const op = Array.isArray(opRel) ? opRel[0] : opRel
          const projectId = normalizeStr(op?.project_id)
          const revisionId = normalizeStr((row as any)?.revision_id)
          if (!projectId || !revisionId) continue
          const byRev = (aggregateByProjectRev[projectId] ??= {})
          const createdAtMs = new Date((row as any)?.created_at ?? 0).getTime()
          const slot = byRev[revisionId] ?? { riskCount: 0, rpnCount: 0, rpnSum: 0, lastCreatedAt: 0 }
          slot.riskCount += 1
          if (Number.isFinite(createdAtMs)) slot.lastCreatedAt = Math.max(slot.lastCreatedAt, createdAtMs)

          const rpnCurrent = toNum((row as any)?.rpn_current)
          const rpn = toNum((row as any)?.rpn)
          const sev = toNum((row as any)?.severity)
          const occ = toNum((row as any)?.occurrence)
          const det = toNum((row as any)?.detection)
          const rowRpn = rpnCurrent ?? rpn ?? (sev != null && occ != null && det != null ? sev * occ * det : null)
          if (rowRpn != null) {
            slot.rpnCount += 1
            slot.rpnSum += rowRpn
          }

          byRev[revisionId] = slot
        }

        const next: Record<string, ProjectPfmeaStat> = {}
        for (const projectId of projectIds) {
          const byRev = aggregateByProjectRev[projectId] ?? {}
          const preferredRev = revisionByProject[projectId] ?? ''
          let slot = preferredRev ? byRev[preferredRev] : undefined
          if (!slot) {
            let latest: RevAgg | undefined
            for (const rev of Object.keys(byRev)) {
              const cur = byRev[rev]
              if (!latest || cur.lastCreatedAt > latest.lastCreatedAt) latest = cur
            }
            slot = latest
          }
          next[projectId] = {
            riskCount: slot?.riskCount ?? 0,
            avgRpn: slot && slot.rpnCount > 0 ? Number((slot.rpnSum / slot.rpnCount).toFixed(1)) : null,
          }
        }
        if (!cancelled) setProjectPfmeaStats(next)
      } catch {
        if (!cancelled) {
          const fallback: Record<string, ProjectPfmeaStat> = {}
          for (const projectId of projectIds) fallback[projectId] = { avgRpn: null, riskCount: 0 }
          setProjectPfmeaStats(fallback)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [rawProjects])

  useEffect(() => {
    const projectIds = Array.from(new Set(rawProjects.map((p) => normalizeStr(p.id)).filter(Boolean)))
    if (!projectIds.length) {
      setRevisionPopupByProject({})
      return
    }

    const loading: Record<string, RevisionPopupData> = {}
    for (const projectId of projectIds) {
      loading[projectId] = { loading: true, rows: emptyRevisionRows() }
    }
    setRevisionPopupByProject(loading)

    let cancelled = false

    ;(async () => {
      try {
        const pfdLatest: Record<string, PfdHistoryTooltipRow> = {}
        const pfdRes = await supabase
          .from('pfd_change_history')
          .select('project_id,created_at,revision_label,change_description,author_name')
          .in('project_id', projectIds)
          .order('created_at', { ascending: false })
          .limit(2000)

        if (!pfdRes.error) {
          for (const row of (pfdRes.data ?? []) as PfdHistoryTooltipRow[]) {
            const projectId = normalizeStr(row.project_id)
            if (!projectId || pfdLatest[projectId]) continue
            pfdLatest[projectId] = row
          }
        }

        const pfmeaLatest: Record<string, PfdHistoryTooltipRow> = {}
        const pfmeaRes = await supabase
          .from('pfmea_change_history')
          .select('project_id,created_at,revision_label,change_description,author_name')
          .in('project_id', projectIds)
          .order('created_at', { ascending: false })
          .limit(2000)

        if (!pfmeaRes.error) {
          for (const row of (pfmeaRes.data ?? []) as PfdHistoryTooltipRow[]) {
            const projectId = normalizeStr(row.project_id)
            if (!projectId || pfmeaLatest[projectId]) continue
            pfmeaLatest[projectId] = row
          }
        }

        const moduleLatest: Record<string, ModuleRevisionTooltipRow> = {}
        const modRes = await supabase
          .from('process_module_revisions')
          .select('*')
          .in('project_id', projectIds)
          .in('module', ['PFD', 'PFMEA', 'PCP'])
          .order('created_at', { ascending: false })
          .limit(4000)

        if (!modRes.error) {
          for (const row of (modRes.data ?? []) as ModuleRevisionTooltipRow[]) {
            const projectId = normalizeStr(row.project_id)
            const moduleName = normalizeStr(row.module).toUpperCase()
            if (!projectId || !moduleName) continue
            const key = `${projectId}|${moduleName}`
            if (!moduleLatest[key]) moduleLatest[key] = row
          }
        }

        const projectRevisionById: Record<string, string> = {}
        for (const project of rawProjects) {
          const projectId = normalizeStr(project.id)
          if (!projectId) continue
          projectRevisionById[projectId] =
            normalizeStr(project.draft_revision_label) || normalizeStr(project.open_revision_label) || '0.0.0'
        }

        const pickAuthor = (row: PfdHistoryTooltipRow | ModuleRevisionTooltipRow) => {
          return (
            normalizeStr(row.author_name) ||
            normalizeStr((row as ModuleRevisionTooltipRow).updated_by_name) ||
            normalizeStr((row as ModuleRevisionTooltipRow).created_by_name) ||
            normalizeStr((row as ModuleRevisionTooltipRow).user_name) ||
            normalizeStr((row as ModuleRevisionTooltipRow).updated_by) ||
            normalizeStr((row as ModuleRevisionTooltipRow).created_by) ||
            normalizeStr((row as ModuleRevisionTooltipRow).user_id) ||
            'Unknown user'
          )
        }

        const moduleRow = (
          moduleName: 'PFD' | 'PFMEA' | 'PCP',
          row: PfdHistoryTooltipRow | ModuleRevisionTooltipRow | null,
          projectRevisionLabel: string
        ): RevisionPopupRow => {
          const resolvedRevisionLabel = sectionRevisionFromLabel(projectRevisionLabel, moduleName)
          if (!row) {
            return {
              module: moduleName,
              revisionLabel: resolvedRevisionLabel,
              at: '-',
              author: '-',
              description: 'No updates yet',
              hasData: false,
            }
          }
          return {
            module: moduleName,
            revisionLabel: resolvedRevisionLabel,
            at: formatDateTimePL(row.created_at),
            author: pickAuthor(row),
            description: normalizeStr(row.change_description) || '-',
            hasData: true,
          }
        }

        const next: Record<string, RevisionPopupData> = {}
        for (const projectId of projectIds) {
          const pfdRow = pfdLatest[projectId] ?? moduleLatest[`${projectId}|PFD`] ?? null
          const pfmeaRow = pfmeaLatest[projectId] ?? moduleLatest[`${projectId}|PFMEA`] ?? null
          const pcpRow = moduleLatest[`${projectId}|PCP`] ?? null
          const projectRevisionLabel = projectRevisionById[projectId] || '0.0.0'
          next[projectId] = {
            loading: false,
            rows: [
              moduleRow('PFD', pfdRow, projectRevisionLabel),
              moduleRow('PFMEA', pfmeaRow, projectRevisionLabel),
              moduleRow('PCP', pcpRow, projectRevisionLabel),
            ],
          }
        }

        if (!cancelled) setRevisionPopupByProject(next)
      } catch {
        if (!cancelled) {
          const fallback: Record<string, RevisionPopupData> = {}
          for (const projectId of projectIds) {
            fallback[projectId] = { loading: false, rows: emptyRevisionRows(), error: true }
          }
          setRevisionPopupByProject(fallback)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [rawProjects])

  // restore saved filters (per user)
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!userCtx.userId) return
    try {
      const raw = window.localStorage.getItem(`${FILTERS_KEY_PREFIX}:${userCtx.userId}`)
      if (!raw) {
        setPendingFilters(null)
        setFiltersReady(true)
        return
      }
      const parsed = JSON.parse(raw) as {
        sites?: string[]
        departments?: string[]
        statuses?: string[]
        process?: string
        products?: string
      }
      if (!parsed || typeof parsed !== 'object') return
      setPendingFilters({
        sites: Array.isArray(parsed.sites) ? parsed.sites : [],
        departments: Array.isArray(parsed.departments) ? parsed.departments : [],
        statuses: Array.isArray(parsed.statuses) ? parsed.statuses : [],
        process: typeof parsed.process === 'string' ? parsed.process : '',
        products: typeof parsed.products === 'string' ? parsed.products : '',
      })
    } catch {
      setPendingFilters(null)
      setFiltersReady(true)
    }
  }, [userCtx.userId])

  useEffect(() => {
    if (loading) return
    if (!pendingFilters) {
      setFiltersReady(true)
      return
    }
    const allowedSites = new Set(siteOptionsMerged)
    const allowedDepts = new Set(deptOptionsMerged)
    const allowedStatuses = new Set(statusOptionsMerged)
    const nextSites = pendingFilters.sites.filter((s) => allowedSites.has(s))
    const nextDepts = pendingFilters.departments.filter((d) => allowedDepts.has(d))
    const nextStatuses = pendingFilters.statuses.filter((s) => allowedStatuses.has(s))
    setSelectedSites(nextSites)
    setSelectedDepts(nextDepts)
    setSelectedStatuses(nextStatuses)
    if (typeof pendingFilters.process === 'string') setProcessQuery(pendingFilters.process)
    if (typeof pendingFilters.products === 'string') setProductsQuery(pendingFilters.products)
    setPendingFilters(null)
    setFiltersReady(true)
  }, [pendingFilters, loading, siteOptionsMerged, deptOptionsMerged, statusOptionsMerged])

  const uiLoading = loading || !filtersReady

  useEffect(() => {
    if (!selectedDepts.length) return
    const allowed = new Set(deptOptionsMerged)
    const next = selectedDepts.filter((d) => allowed.has(d))
    if (next.length !== selectedDepts.length) setSelectedDepts(next)
  }, [deptOptionsMerged, selectedDepts])

  useEffect(() => {
    if (!selectedStatuses.length) return
    const allowed = new Set(statusOptionsMerged)
    const next = selectedStatuses.filter((s) => allowed.has(s))
    if (next.length !== selectedStatuses.length) setSelectedStatuses(next)
  }, [statusOptionsMerged, selectedStatuses])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!userCtx.userId) return
    try {
      window.localStorage.setItem(
        `${FILTERS_KEY_PREFIX}:${userCtx.userId}`,
        JSON.stringify({
          sites: selectedSites,
          departments: selectedDepts,
          statuses: selectedStatuses,
          process: processQuery,
          products: productsQuery,
        })
      )
    } catch {}
  }, [userCtx.userId, selectedSites, selectedDepts, selectedStatuses, processQuery, productsQuery])

  // risk count for selected sites
  const openProjectsBySiteDept = useMemo(() => {
    return siteDeptFiltered.filter((p) => normalizeStr(p.status).toLowerCase() === 'open')
  }, [siteDeptFiltered])

  useEffect(() => {
    const loadRiskCount = async () => {
      if (loading || !filtersReady) return
      const projectIds = openProjectsBySiteDept.map((p) => p.id).filter(Boolean)
      if (!projectIds.length) {
        setRiskCount(0)
        setOpenRiskAvgRpn(null)
        setRiskColorCounts({ red: 0, orange: 0, yellow: 0, green: 0 })
        return
      }
      try {
        const { data, error } = await supabase
          .from('pfmea_rows')
          .select('severity,occurrence,detection,oxd_current,rpn_current,rpn,operations!inner(project_id)')
          .in('operations.project_id', projectIds)
        if (error) throw error
        const rows = (data ?? []) as any[]
        const counts: Record<RiskColor, number> = { red: 0, orange: 0, yellow: 0, green: 0 }
        let rpnSum = 0
        let rpnCount = 0
        const toNum = (v: any) => {
          const n = Number(v)
          return Number.isFinite(n) ? n : null
        }
        for (const row of rows) {
          const sev = toNum((row as any)?.severity)
          const oxdCurrent = toNum((row as any)?.oxd_current)
          const occ = toNum((row as any)?.occurrence)
          const det = toNum((row as any)?.detection)
          const rpnCurrent = toNum((row as any)?.rpn_current)
          const rpn = toNum((row as any)?.rpn)
          const doVal = oxdCurrent ?? (occ != null && det != null ? occ * det : null)
          const rowRpn = rpnCurrent ?? rpn ?? (sev != null && doVal != null ? sev * doVal : null)
          const color = getRiskColorFor(sev, doVal, rmMode, rmRpn, rmCells)
          if (color) counts[color] += 1
          if (rowRpn != null) {
            rpnSum += rowRpn
            rpnCount += 1
          }
        }
        setRiskCount(rows.length)
        setOpenRiskAvgRpn(rpnCount > 0 ? Number((rpnSum / rpnCount).toFixed(1)) : null)
        setRiskColorCounts(counts)
      } catch {
        setRiskCount(0)
        setOpenRiskAvgRpn(null)
        setRiskColorCounts({ red: 0, orange: 0, yellow: 0, green: 0 })
      }
    }
    void loadRiskCount()
  }, [openProjectsBySiteDept, loading, filtersReady, rmMode, rmRpn, rmCells])

  // ===== Styles (match Risk Matrix) =====
  const hairline = 0.5
  const surfaceRadius = 8
  const sharedOverlayBorder = 'rgba(255,255,255,0.16)'
  const sharedOverlayBg = 'rgb(40, 39, 47)'

  const frame: React.CSSProperties = {
    width: '96%',
    marginLeft: 'auto',
    marginRight: 'auto',
  }

  const card: React.CSSProperties = {
    background: 'rgba(255,255,255,0.08)',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: surfaceRadius,
    boxShadow: '0 18px 40px rgba(0,0,0,0.18)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    color: '#fff',
  }

  const heroCard: React.CSSProperties = {
    background: 'rgba(255,255,255,0.08)',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: surfaceRadius,
    boxShadow: '0 18px 40px rgba(0,0,0,0.18)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
  }

  const titleStyle: React.CSSProperties = { fontSize: 28, fontWeight: 600, letterSpacing: -0.3, color: '#fff' }
  const subtitleStyle: React.CSSProperties = { marginTop: 4, fontSize: 13.5, color: 'rgba(255,255,255,0.78)' }

  const table: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    tableLayout: 'fixed',
    fontFamily: 'Arial, sans-serif',
  }

  const th: React.CSSProperties = {
    textAlign: 'center',
    padding: '10px 12px',
    fontSize: 13,
    color: 'rgba(255,255,255,0.78)',
    fontWeight: 650,
    background: 'rgba(255,255,255,0.08)',
    borderBottomStyle: 'solid',
    borderBottomWidth: hairline,
    borderBottomColor: 'rgba(255,255,255,0.12)',
    whiteSpace: 'nowrap',
  }

  const td: React.CSSProperties = {
    padding: '10px 12px',
    verticalAlign: 'middle',
    fontSize: 14,
    color: '#f8fafc',
    overflow: 'hidden',
    borderBottomStyle: 'solid',
    borderBottomWidth: hairline,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.03)',
  }

  const processCell: React.CSSProperties = {
    fontWeight: 600,
    fontSize: 15,
    color: '#fdba74',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  }

  const statusPill = (status: string): React.CSSProperties => {
    const s = status.toLowerCase()
    const base: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      fontSize: 12,
      fontWeight: 700,
      color: '#111',
      whiteSpace: 'nowrap',
    }

    if (s === 'open') return { ...base, color: '#16a34a' }
    if (s === 'draft') return { ...base, color: '#6b7280' }
    if (s === 'obsolete') return { ...base, color: '#b91c1c' }

    return base
  }

  const avgRpnPill = (value: number | null): React.CSSProperties => {
    const base: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 72,
    minHeight: 30,
    padding: '4px 12px',
      borderRadius: surfaceRadius,
      border: `1px solid ${sharedOverlayBorder}`,
      fontSize: 14,
      fontWeight: 700,
      lineHeight: 1,
      textAlign: 'center',
      verticalAlign: 'middle',
    }

    if (value == null || !Number.isFinite(value)) {
      return { ...base, color: '#f8fafc', background: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.16)' }
    }
    if (value <= rmRpn.greenMax) {
      return { ...base, color: '#f8fafc', background: 'rgba(34,197,94,0.18)', borderColor: 'rgba(34,197,94,0.45)' }
    }
    if (value <= rmRpn.yellowMax) {
      return { ...base, color: '#f8fafc', background: 'rgba(250,204,21,0.22)', borderColor: 'rgba(250,204,21,0.55)' }
    }
    if (value <= rmRpn.orangeMax) {
      return { ...base, color: '#f8fafc', background: 'rgba(251,146,60,0.18)', borderColor: 'rgba(251,146,60,0.45)' }
    }
    return { ...base, color: '#f8fafc', background: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.35)' }
  }

  const revisionDataFor = (projectId: string): RevisionPopupData => {
    return revisionPopupByProject[projectId] ?? { loading: true, rows: emptyRevisionRows() }
  }

  const renderRevisionInfo = (projectId: string, revisionLabel: string) => {
    const popup = revisionDataFor(projectId)
    const hasData = popup.rows.some((r) => r.hasData)

    return (
      <div className="revisionWrap">
        <span className="revisionTrigger" role="button" tabIndex={0} aria-label={`Revision ${revisionLabel} details`}>
          <span>{revisionLabel}</span>
          <span className="revisionHintIcon">
            <RevisionHintIcon active={hasData || popup.loading} />
          </span>
        </span>
        <div className="revisionPopover">
          <div
            style={{
              fontSize: 19,
              fontWeight: 700,
              marginBottom: 10,
              color: '#f4f7fb',
              textAlign: 'left',
            }}
          >
            Revision details
          </div>
          <table
            className="revisionPopoverTable"
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: surfaceRadius,
            }}
          >
            <thead>
              <tr>
                <th style={{ width: 84, textAlign: 'center', padding: '8px 10px', fontSize: 14, color: '#b9c0cf', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.08)' }}>Module</th>
                <th style={{ width: 72, textAlign: 'center', padding: '8px 10px', fontSize: 14, color: '#b9c0cf', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.08)' }}>Revision</th>
                <th style={{ width: 150, textAlign: 'center', padding: '8px 10px', fontSize: 14, color: '#b9c0cf', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.08)' }}>Date</th>
                <th style={{ width: 130, textAlign: 'center', padding: '8px 10px', fontSize: 14, color: '#b9c0cf', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.08)' }}>Author</th>
                <th style={{ textAlign: 'center', padding: '8px 10px', fontSize: 14, color: '#b9c0cf', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.08)' }}>Description</th>
              </tr>
            </thead>
            <tbody>
              {popup.loading ? (
                <tr>
                  <td colSpan={5} style={{ padding: '8px 10px', fontSize: 14, color: '#b9c0cf', borderBottom: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>Loading revision details...</td>
                </tr>
              ) : popup.error ? (
                <tr>
                  <td colSpan={5} style={{ padding: '8px 10px', fontSize: 14, color: '#b9c0cf', borderBottom: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>Revision details unavailable.</td>
                </tr>
              ) : (
                popup.rows.map((r) => (
                  <tr key={`${projectId}-${r.module}`}>
                    <td style={{ textAlign: 'center', padding: '8px 10px', fontSize: 14, color: '#b9c0cf', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{r.module}</td>
                    <td style={{ textAlign: 'center', padding: '8px 10px', fontSize: 15, color: '#f4f7fb', borderBottom: '1px solid rgba(255,255,255,0.06)', fontWeight: 700 }}>{r.revisionLabel}</td>
                    <td style={{ padding: '8px 10px', fontSize: 14, color: '#b9c0cf', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{r.at}</td>
                    <td style={{ padding: '8px 10px', fontSize: 14, color: '#b9c0cf', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{r.author}</td>
                    <td style={{ padding: '8px 10px', fontSize: 15, color: '#f4f7fb', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{r.description}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  const buttonBase: React.CSSProperties = { fontFamily: 'inherit' }

  const actionBtn: React.CSSProperties = {
    ...buttonBase,
    padding: '6px 10px',
    borderRadius: surfaceRadius,
    border: '1px solid rgba(255,255,255,0.2)',
    fontWeight: 650,
    fontSize: 12,
    color: '#fff',
    background: 'rgba(255,255,255,0.08)',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  }

  const buttonPrimary: React.CSSProperties = {
    ...buttonBase,
    height: 34,
    borderRadius: surfaceRadius,
    border: '1px solid rgba(255,255,255,0.3)',
    fontWeight: 650,
    fontSize: 12,
    color: '#fff',
    background: 'rgba(255,255,255,0.16)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1,
    boxShadow: '0 8px 20px rgba(0,0,0,0.18)',
  }

  const iconSquareSm: React.CSSProperties = { minWidth: 36 }

  const inputSm: React.CSSProperties = {
    height: 32,
    borderRadius: surfaceRadius,
    border: `1px solid ${sharedOverlayBorder}`,
    padding: '0 8px',
    fontSize: 12,
    width: '100%',
    outline: 'none',
    color: '#fff',
    background: 'rgb(40, 39, 47)',
  }

  const actions: React.CSSProperties = {
    display: 'inline-flex',
    gap: 8,
    justifyContent: 'flex-end',
    alignItems: 'center',
    flexWrap: 'nowrap',
  }

  const errorBox: React.CSSProperties = {
    marginTop: 8,
    fontSize: 12,
    padding: '10px 12px',
    borderRadius: surfaceRadius,
    background: 'rgba(127, 29, 29, 0.42)',
    color: '#fee2e2',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.4)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
  }

  const summaryTile: React.CSSProperties = {
    minHeight: 82,
    padding: '10px 12px',
    borderRadius: surfaceRadius,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    textAlign: 'center',
  }

  const summaryValue: React.CSSProperties = {
    fontSize: 24,
    fontWeight: 800,
    lineHeight: 1,
  }

  const toggleSite = (site: string, checked: boolean) => {
    const isAll = selectedSites.length === 0
    const base = isAll ? siteOptionsMerged : selectedSites
    const next = new Set(base)
    if (checked) next.add(site)
    else next.delete(site)
    const arr = Array.from(next)
    setSelectedSites(arr.length === siteOptionsMerged.length ? [] : arr)
  }

  const toggleDept = (dept: string, checked: boolean) => {
    const isAll = selectedDepts.length === 0
    const base = isAll ? deptOptionsMerged : selectedDepts
    const next = new Set(base)
    if (checked) next.add(dept)
    else next.delete(dept)
    const arr = Array.from(next)
    setSelectedDepts(arr.length === deptOptionsMerged.length ? [] : arr)
  }

  const toggleStatus = (status: string, checked: boolean) => {
    const isAll = selectedStatuses.length === 0
    const base = isAll ? statusOptionsMerged : selectedStatuses
    const next = new Set(base)
    if (checked) next.add(status)
    else next.delete(status)
    const arr = Array.from(next)
    setSelectedStatuses(arr.length === statusOptionsMerged.length ? [] : arr)
  }

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

  if (uiLoading) {
    return (
      <div style={{ minHeight: '100vh', paddingBottom: 14, position: 'relative', overflow: 'hidden', background: '#171f33', fontFamily: 'Arial, sans-serif' }}>
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: "url('/home-hero-bg.svg')",
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
        />
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg, rgba(101, 69, 46, 0.58), rgba(23, 31, 51, 0.86))',
          }}
        />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ ...frame, paddingTop: 20 }}>
            <div style={titleStyle}>Projects List</div>
            <div style={subtitleStyle}>Loading projects...</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 14, position: 'relative', overflow: 'hidden', background: '#171f33', fontFamily: 'Arial, sans-serif' }}>
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: "url('/home-hero-bg.svg')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(101, 69, 46, 0.58), rgba(23, 31, 51, 0.86))',
        }}
      />

      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ ...frame, marginTop: 20 }}>
          <div style={{ ...heroCard, padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 360px', maxWidth: 520 }}>
                <div style={titleStyle}>Projects List</div>
                <div style={subtitleStyle}>
                  Manage your processes and open PFD / PFMEA / PCP modules.
                  {refreshing ? <span style={{ marginLeft: 8, color: 'rgba(255,255,255,0.78)' }}>Refreshing...</span> : null}
                </div>
              </div>

              <div
                style={{
                  width: '100%',
                  maxWidth: 920,
                  marginLeft: 'auto',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
                  gap: 10,
                  alignSelf: 'flex-start',
                }}
              >
            <div style={{ ...summaryTile, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.22)' }}>
              <div style={{ fontSize: 12, color: '#f8fafc' }}>Open projects</div>
              <div style={{ ...summaryValue, color: '#f8fafc' }}>{uiLoading ? '-' : openProjectsBySiteDept.length}</div>
            </div>
            <div style={{ ...summaryTile, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.22)' }}>
              <div style={{ fontSize: 12, color: '#f8fafc' }}>Open risks</div>
              <div style={{ ...summaryValue, color: '#f8fafc' }}>{uiLoading ? '-' : riskCount}</div>
            </div>
            <div style={{ ...summaryTile, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.22)' }}>
              <div style={{ fontSize: 12, color: '#f8fafc' }}>Average RPN</div>
              <div style={{ ...summaryValue, color: '#f8fafc' }}>{uiLoading ? '-' : formatAvgRpnInt(openRiskAvgRpn)}</div>
            </div>
            <div
              style={{
                ...summaryTile,
                background: 'rgba(239,68,68,0.12)',
                border: '1px solid rgba(239,68,68,0.35)',
              }}
            >
              <div style={{ fontSize: 12, color: '#f8fafc' }}>Actions must be defined</div>
              <div style={{ ...summaryValue, color: '#f8fafc' }}>{uiLoading ? '-' : riskColorCounts.red}</div>
            </div>
            <div
              style={{
                ...summaryTile,
                background: 'rgba(251,146,60,0.18)',
                border: '1px solid rgba(251,146,60,0.45)',
              }}
            >
              <div style={{ fontSize: 12, color: '#f8fafc' }}>Action plan required</div>
              <div style={{ ...summaryValue, color: '#f8fafc' }}>{uiLoading ? '-' : riskColorCounts.orange}</div>
            </div>
            <div
              style={{
                ...summaryTile,
                background: 'rgba(250,204,21,0.22)',
                border: '1px solid rgba(250,204,21,0.55)',
              }}
            >
              <div style={{ fontSize: 12, color: '#f8fafc' }}>Actions recommended</div>
              <div style={{ ...summaryValue, color: '#f8fafc' }}>{uiLoading ? '-' : riskColorCounts.yellow}</div>
            </div>
            <div
              style={{
                ...summaryTile,
                background: 'rgba(34,197,94,0.18)',
                border: '1px solid rgba(34,197,94,0.45)',
              }}
            >
              <div style={{ fontSize: 12, color: '#f8fafc' }}>Acceptable risk</div>
              <div style={{ ...summaryValue, color: '#f8fafc' }}>{uiLoading ? '-' : riskColorCounts.green}</div>
            </div>
              </div>
            </div>
          </div>
        </div>
      {error && (
        <div style={{ ...frame, marginTop: 8 }}>
          <div style={errorBox}>
            <b>Error:</b> {error}
          </div>
        </div>
      )}

      <div style={{ ...frame, marginTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          <button
            onClick={() => setFiltersOpen((v) => !v)}
            className="rf-button"
            style={{ ...buttonPrimary, padding: '8px 12px', borderRadius: surfaceRadius, height: 29 }}
          >
            {filtersOpen ? 'Hide filters' : 'Set filters'}
          </button>
          <button
            onClick={() => setCreateRowOpen(true)}
            disabled={createRowOpen || !userCtx.orgId}
            className="rf-button"
            style={{ ...buttonPrimary, padding: '8px 12px', borderRadius: surfaceRadius, height: 29 }}
          >
            Create project
          </button>
        </div>

        {filtersOpen && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ ...card, padding: 12 }}>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ ...card, padding: '8px 12px', flex: 1, borderRadius: surfaceRadius }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      marginBottom: 6,
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.72)' }}>Process name</div>
                    <button
                      onClick={() => setProcessQuery('')}
                      className="rf-button"
                      style={{ padding: '2px 8px', borderRadius: surfaceRadius, border: `1px solid ${sharedOverlayBorder}`, fontSize: 11 }}
                    >
                      Clear
                    </button>
                  </div>
                  <input
                    value={processQuery}
                    onChange={(e) => setProcessQuery(e.target.value)}
                    placeholder="Search process..."
                    style={inputSm}
                  />
                </div>

                <div style={{ ...card, padding: '8px 12px', flex: 1, borderRadius: surfaceRadius }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      marginBottom: 6,
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.72)' }}>Products</div>
                    <button
                      onClick={() => setProductsQuery('')}
                      className="rf-button"
                      style={{ padding: '2px 8px', borderRadius: surfaceRadius, border: `1px solid ${sharedOverlayBorder}`, fontSize: 11 }}
                    >
                      Clear
                    </button>
                  </div>
                  <input
                    value={productsQuery}
                    onChange={(e) => setProductsQuery(e.target.value)}
                    placeholder="Search products..."
                    style={inputSm}
                  />
                </div>

                <div style={{ ...card, padding: '8px 12px', flex: 1, borderRadius: surfaceRadius }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      marginBottom: 6,
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.72)' }}>Site filter</div>
                    <button
                      onClick={() => setSelectedSites([])}
                      className="rf-button"
                      style={{ padding: '2px 8px', borderRadius: surfaceRadius, border: `1px solid ${sharedOverlayBorder}`, fontSize: 11 }}
                    >
                      Clear
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    {siteOptionsMerged.length === 0 && <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>No sites</span>}
                    {siteOptionsMerged.map((s) => {
                      const isAll = selectedSites.length === 0
                      const checked = isAll ? true : selectedSites.includes(s)
                      return (
                        <label
                          key={s}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'flex-start',
                            gap: 6,
                            fontSize: 11,
                            padding: '4px 8px',
                            width: FILTER_CHIP_WIDTH,
                            minHeight: 34,
                            boxSizing: 'border-box',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            borderRadius: surfaceRadius,
                            border: '1px solid rgba(255,255,255,0.14)',
                            background: checked ? FILTER_ACTIVE_BG : 'rgba(255,255,255,0.05)',
                            color: '#fff',
                            borderColor: checked ? FILTER_ACTIVE_BORDER : 'rgba(255,255,255,0.14)',
                          }}
                        >
                          <input type="checkbox" checked={checked} onChange={(e) => toggleSite(s, e.target.checked)} style={{ accentColor: '#fdba74' }} />
                          {s}
                        </label>
                      )
                    })}
                  </div>
                </div>

                <div style={{ ...card, padding: '8px 12px', flex: 1, borderRadius: surfaceRadius }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      marginBottom: 6,
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.72)' }}>Department filter</div>
                    <button
                      onClick={() => setSelectedDepts([])}
                      className="rf-button"
                      style={{ padding: '2px 8px', borderRadius: surfaceRadius, border: `1px solid ${sharedOverlayBorder}`, fontSize: 11 }}
                    >
                      Clear
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    {deptOptionsMerged.length === 0 && <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>No departments</span>}
                    {deptOptionsMerged.map((d) => {
                      const isAll = selectedDepts.length === 0
                      const checked = isAll ? true : selectedDepts.includes(d)
                      return (
                        <label
                          key={d}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'flex-start',
                            gap: 6,
                            fontSize: 11,
                            padding: '4px 8px',
                            width: FILTER_CHIP_WIDTH,
                            minHeight: 34,
                            boxSizing: 'border-box',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            borderRadius: surfaceRadius,
                            border: '1px solid rgba(255,255,255,0.14)',
                            background: checked ? FILTER_ACTIVE_BG : 'rgba(255,255,255,0.05)',
                            color: '#fff',
                            borderColor: checked ? FILTER_ACTIVE_BORDER : 'rgba(255,255,255,0.14)',
                          }}
                        >
                          <input type="checkbox" checked={checked} onChange={(e) => toggleDept(d, e.target.checked)} style={{ accentColor: '#fdba74' }} />
                          {d}
                        </label>
                      )
                    })}
                  </div>
                </div>

                <div style={{ ...card, padding: '8px 12px', flex: 1, borderRadius: surfaceRadius }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      marginBottom: 6,
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.72)' }}>Status filter</div>
                    <button
                      onClick={() => setSelectedStatuses([])}
                      className="rf-button"
                      style={{ padding: '2px 8px', borderRadius: surfaceRadius, border: `1px solid ${sharedOverlayBorder}`, fontSize: 11 }}
                    >
                      Clear
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    {statusOptionsMerged.length === 0 && <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>No statuses</span>}
                    {statusOptionsMerged.map((s) => {
                      const isAll = selectedStatuses.length === 0
                      const checked = isAll ? true : selectedStatuses.includes(s)
                      return (
                        <label
                          key={s}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'flex-start',
                            gap: 6,
                            fontSize: 11,
                            padding: '4px 8px',
                            width: FILTER_CHIP_WIDTH,
                            minHeight: 34,
                            boxSizing: 'border-box',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            borderRadius: surfaceRadius,
                            border: '1px solid rgba(255,255,255,0.14)',
                            background: checked ? FILTER_ACTIVE_BG : 'rgba(255,255,255,0.05)',
                            color: '#fff',
                            borderColor: checked ? FILTER_ACTIVE_BORDER : 'rgba(255,255,255,0.14)',
                          }}
                        >
                          <input type="checkbox" checked={checked} onChange={(e) => toggleStatus(s, e.target.checked)} style={{ accentColor: '#fdba74' }} />
                          {s}
                        </label>
                      )
                    })}
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: 'rgba(255,255,255,0.68)' }}>Your settings will be remembered.</div>
            </div>
          </div>
        )}

        <div style={{ ...card, padding: 0, overflow: 'visible' }}>
          <table style={table}>
            <thead>
              <tr>
                <th style={{ ...th, width: 160 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    Process name
                    <FilterIcon active={processQuery.trim().length > 0} />
                  </span>
                </th>
                <th style={{ ...th, width: 130 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    Site
                    <FilterIcon active={selectedSites.length > 0} />
                  </span>
                </th>
                <th style={{ ...th, width: 150 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    Department
                    <FilterIcon active={selectedDepts.length > 0} />
                  </span>
                </th>
                <th style={{ ...th, width: 170 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    Products
                    <FilterIcon active={productsQuery.trim().length > 0} />
                  </span>
                </th>
                <th style={{ ...th, width: 90, textAlign: 'center' }}>Avg RPN</th>
                <th style={{ ...th, width: 90, textAlign: 'center' }}>Risks</th>
                <th style={{ ...th, width: 110, textAlign: 'center' }}>Updated</th>
                <th style={{ ...th, width: 80 }}>Revision</th>
                <th style={{ ...th, width: 90 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    Status
                    <FilterIcon active={selectedStatuses.length > 0} />
                  </span>
                </th>
                <th style={{ ...th, width: 280, textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {uiLoading &&
                !createRowOpen &&
                Array.from({ length: 6 }).map((_, idx) => (
                  <tr key={`loading-row-${idx}`}>
                    <td colSpan={10} style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                      <div
                        style={{
                          height: 16,
                          borderRadius: surfaceRadius,
                          background: 'linear-gradient(90deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.18) 50%, rgba(255,255,255,0.08) 100%)',
                        }}
                      />
                    </td>
                  </tr>
                ))}

              {createRowOpen && (
                <tr>
                  <td style={td}>
                    <input
                      value={newProcess}
                      onChange={(e) => setNewProcess(e.target.value)}
                      placeholder="Process name"
                      style={inputSm}
                    />
                  </td>
                  <td style={td}>
                    <select value={newSite} onChange={(e) => setNewSite(e.target.value)} style={inputSm} className="projectSelect">
                      <option value="">Select...</option>
                      {siteOptionsMerged.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={td}>
                    <select
                      value={newDept}
                      onChange={(e) => setNewDept(e.target.value)}
                      disabled={!newSite}
                      className="projectSelect"
                      style={{ ...inputSm, background: newSite ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)', color: newSite ? '#fff' : 'rgba(255,255,255,0.45)' }}
                    >
                      <option value="">{newSite ? 'Select...' : 'Select site first'}</option>
                      {deptOptionsForSite.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={td}>
                    <div style={{ display: 'grid', gap: 6 }}>
                      {newProducts.map((val, idx) => (
                        <input
                          key={idx}
                          value={val}
                          onChange={(e) => {
                            const value = e.target.value
                            setNewProducts((prev) => {
                              const next = [...prev]
                              next[idx] = value
                              if (idx === next.length - 1 && value.trim()) next.push('')
                              return normalizeProductInputs(next)
                            })
                          }}
                          placeholder="Product name"
                          style={inputSm}
                        />
                      ))}
                    </div>
                  </td>
                  <td style={{ ...td, textAlign: 'center' }}>-</td>
                  <td style={{ ...td, textAlign: 'center' }}>0</td>
                  <td style={{ ...td, textAlign: 'center' }}>-</td>
                  <td style={td}>-</td>
                  <td style={td}>
                    <span style={statusPill('DRAFT')}>DRAFT</span>
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <div style={actions}>
                      <button
                        onClick={createProject}
                        disabled={!canCreate || creating}
                        className="rf-button"
                        style={{ ...actionBtn, opacity: canCreate && !creating ? 1 : 0.6 }}
                      >
                        {creating ? 'Creating...' : 'Create'}
                      </button>
                      <button onClick={resetCreateRow} className="rf-button" style={actionBtn}>
                        Cancel
                      </button>
                    </div>
                  </td>
                </tr>
              )}

              {!uiLoading && rawProjects.length === 0 && !createRowOpen && (
                <tr>
                  <td colSpan={10} style={{ padding: 14 }}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>No processes yet</div>
                    <div style={{ color: 'rgba(255,255,255,0.68)' }}>Create your first process to start building PFD/PFMEA/PCP.</div>
                  </td>
                </tr>
              )}

              {filtered.map((p) =>
                editingId === p.id ? (
                  <tr key={p.id}>
                    <td style={td}>
                      <input value={editProcess} onChange={(e) => setEditProcess(e.target.value)} style={inputSm} />
                    </td>
                    <td style={td}>
                      <select value={editSite} onChange={(e) => setEditSite(e.target.value)} style={inputSm} className="projectSelect">
                        <option value="">Select...</option>
                        {siteOptionsMerged.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={td}>
                      <select
                        value={editDept}
                        onChange={(e) => setEditDept(e.target.value)}
                        disabled={!editSite}
                        className="projectSelect"
                        style={{ ...inputSm, background: editSite ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)', color: editSite ? '#fff' : 'rgba(255,255,255,0.45)' }}
                      >
                        <option value="">{editSite ? 'Select...' : 'Select site first'}</option>
                        {deptOptionsForEditSite.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={td}>
                      <div style={{ display: 'grid', gap: 6 }}>
                        {editProducts.map((val, idx) => (
                          <input
                            key={idx}
                            value={val}
                            onChange={(e) => {
                              const value = e.target.value
                              setEditProducts((prev) => {
                                const next = [...prev]
                                next[idx] = value
                                if (idx === next.length - 1 && value.trim()) next.push('')
                                return normalizeProductInputs(next)
                              })
                            }}
                            placeholder="Product name"
                            style={inputSm}
                          />
                        ))}
                      </div>
                    </td>
                    <td style={{ ...td, textAlign: 'center' }}>
                      <span style={avgRpnPill(p.avgRpn)}>{formatAvgRpn(p.avgRpn)}</span>
                    </td>
                    <td style={{ ...td, textAlign: 'center' }}>{p.riskCount}</td>
                    <td style={{ ...td, textAlign: 'center' }}>-</td>
                    <td style={{ ...td, overflow: 'visible', textAlign: 'center' }}>{renderRevisionInfo(p.id, p.revision)}</td>
                    <td style={{ ...td, textAlign: 'center' }}>
                      <select
                        value={editStatus}
                        onChange={(e) => setEditStatus(e.target.value)}
                        disabled={normalizeStr(editStatus).toUpperCase() === 'DRAFT'}
                        className="projectSelect"
                        style={{
                          ...inputSm,
                          background: normalizeStr(editStatus).toUpperCase() === 'DRAFT' ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.08)',
                          color: normalizeStr(editStatus).toUpperCase() === 'DRAFT' ? 'rgba(255,255,255,0.45)' : '#fff',
                        }}
                      >
                        <option value="">Select...</option>
                        {editStatusOptions.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <div style={actions}>
                        <button
                          onClick={saveEdit}
                          disabled={!canEdit || editSaving}
                          className="rf-button"
                          style={{ ...actionBtn, opacity: canEdit && !editSaving ? 1 : 0.6 }}
                        >
                          {editSaving ? 'Saving...' : 'Save'}
                        </button>
                        <button onClick={resetEditRow} className="rf-button" style={actionBtn}>
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr
                    key={p.id}
                    className={normalizeStr(p.status).toUpperCase() === 'OPEN' ? 'rowHover rowOpen' : 'rowHover'}
                    style={undefined}
                  >
                    <td style={td}>
                      <div style={processCell} title={p.process}>
                        {p.process}
                      </div>
                    </td>
                    <td style={td}>{p.site}</td>
                    <td style={td}>{p.department}</td>
                    <td style={{ ...td, color: 'rgba(255,255,255,0.68)', fontSize: 11 }}>{p.products}</td>
                    <td style={{ ...td, textAlign: 'center' }}>
                      <span style={avgRpnPill(p.avgRpn)}>{formatAvgRpn(p.avgRpn)}</span>
                    </td>
                    <td style={{ ...td, textAlign: 'center' }}>{p.riskCount}</td>
                    <td style={{ ...td, textAlign: 'center' }}>{formatDatePL(p.updated)}</td>
                    <td style={{ ...td, overflow: 'visible', textAlign: 'center' }}>{renderRevisionInfo(p.id, p.revision)}</td>
                    <td style={{ ...td, textAlign: 'center' }}>
                      <span style={statusPill(p.status)}>{p.status}</span>
                    </td>

                    <td style={{ ...td, textAlign: 'right' }}>
                      <div style={actions}>
                        <Link href={`/pfd?project=${p.id}`} className="rf-button" style={actionBtn} title="Open PFD">
                          PFD
                        </Link>
                        <Link href={`/pfmea?project=${p.id}`} className="rf-button" style={actionBtn} title="Open PFMEA">
                          PFMEA
                        </Link>
                        <Link href={`/pcp?project=${p.id}`} className="rf-button" style={actionBtn} title="Open PCP">
                          PCP
                        </Link>

                        {userCtx.isChampion && (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginLeft: 14 }}>
                            <button onClick={() => startEditRow(p)} className="rf-button" style={actionBtn}>
                              Edit
                            </button>
                            <button
                              onClick={() => requestDeleteProject(p.id, p.process)}
                              className="inviteTrashBtn"
                              title="Delete process"
                              aria-label="Delete process"
                            >
                              <svg className="inviteTrashIcon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                <path
                                  d="M9 3h6m-8 4h10m-9 0 1 15h6l1-15M10 7v13m4-13v13"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </div>

      </div>

      <style jsx global>{`
        .rowHover:hover {
          background: rgba(255, 255, 255, 0.06) !important;
        }
        .rowOpen {
          background: transparent;
        }
        .rowOpen:hover {
          background: rgba(255, 255, 255, 0.06) !important;
        }

        .revisionWrap {
          position: relative;
          display: inline-flex;
          align-items: center;
        }
        .revisionTrigger {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: #f8fafc;
          font-weight: 650;
          cursor: help;
          user-select: none;
          white-space: nowrap;
        }
        .revisionTrigger:hover,
        .revisionWrap:focus-within .revisionTrigger {
          font-weight: 800;
        }
        .revisionHintIcon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .revisionPopover {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          z-index: 70;
          width: 840px;
          max-width: min(94vw, 840px);
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.16);
          background: rgb(40, 39, 47);
          box-shadow: 0 16px 30px rgba(0, 0, 0, 0.2);
          padding: 10px;
          opacity: 0;
          pointer-events: none;
          transform: translateY(4px);
          transition: opacity 120ms ease, transform 120ms ease;
        }
        .revisionWrap:hover .revisionPopover,
        .revisionWrap:focus-within .revisionPopover {
          opacity: 1;
          pointer-events: auto;
          transform: translateY(0);
        }
        .revisionPopoverTable {
          width: 100%;
          border-collapse: collapse;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .revisionPopoverTable th {
          text-align: left;
          font-size: 12px;
          font-weight: 650;
          color: rgba(255, 255, 255, 0.72);
          padding: 8px 10px;
          background: rgba(255, 255, 255, 0.08);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }
        .revisionPopoverTable td {
          text-align: left;
          font-size: 12px;
          color: #f8fafc;
          padding: 8px 10px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          vertical-align: top;
        }
        .revisionPopoverTable tr:last-child td {
          border-bottom: 0;
        }
        .revisionPopoverTable td:nth-child(5) {
          min-width: 330px;
          white-space: normal;
          overflow-wrap: anywhere;
        }

        .rf-button {
          background: rgba(255, 255, 255, 0.08);
          color: #f8fafc;
          font-family: inherit;
          font-weight: 650;
          border: 1px solid rgba(255, 255, 255, 0.18);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
        }
        .rf-button:hover {
          background: rgba(59, 130, 246, 0.18) !important;
          border-color: rgba(96, 165, 250, 0.45) !important;
          box-shadow: 0 10px 24px rgba(37, 99, 235, 0.18) !important;
        }
        .rf-button:disabled {
          background: rgba(255, 255, 255, 0.05);
          color: rgba(255, 255, 255, 0.35);
          cursor: not-allowed;
        }

        .inviteTrashBtn {
          min-height: 26px;
          min-width: 36px;
          padding: 6px 10px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.18);
          background: rgba(255, 255, 255, 0.08);
          cursor: pointer;
          transition: background 0.12s ease, transform 0.06s ease;
          box-shadow: none;
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
        }
        .inviteTrashBtn:hover {
          background: rgba(239, 68, 68, 0.18);
        }
        .inviteTrashBtn:active {
          transform: translateY(1px);
        }
        .inviteTrashIcon {
          width: 16px;
          height: 16px;
          color: rgba(255, 255, 255, 0.72);
        }
        .inviteTrashBtn:hover .inviteTrashIcon {
          color: #fecaca;
        }
        .inviteTrashBtn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .projectSelect option {
          color: #f8fafc;
          background: rgb(40, 39, 47);
        }
        .projectSelect:disabled option {
          color: rgba(248, 250, 252, 0.45);
          background: rgb(40, 39, 47);
        }
      `}</style>

      {confirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(4, 8, 20, 0.52)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 80,
          }}
          onClick={() => (confirmBusy ? null : setConfirm(null))}
        >
          <div
            style={{
              width: 520,
              maxWidth: '92vw',
              background: sharedOverlayBg,
              borderRadius: surfaceRadius,
              border: `1px solid ${sharedOverlayBorder}`,
              boxShadow: '0 16px 36px rgba(0,0,0,0.2)',
              padding: 20,
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 19, fontWeight: 700, marginBottom: 10, color: '#fff' }}>{confirm.title}</div>
            <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.8)', lineHeight: 1.5, marginBottom: 10 }}>{confirm.body}</div>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.4, color: '#ef4444', marginBottom: 16 }}>
              DATA WILL BE PERMANENTLY LOST
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => (confirmBusy ? null : setConfirm(null))}
                disabled={confirmBusy}
                className="rf-button"
                style={{ padding: '8px 12px', borderRadius: surfaceRadius, border: `1px solid ${sharedOverlayBorder}` }}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (confirmBusy) return
                  const step = confirm.step
                  setConfirmBusy(true)
                  await confirm.onConfirm()
                  setConfirmBusy(false)
                  if (step === 2) setConfirm(null)
                }}
                disabled={confirmBusy}
                className="rf-button"
                style={{ padding: '8px 12px', borderRadius: surfaceRadius, border: `1px solid ${sharedOverlayBorder}`, fontWeight: 650 }}
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


