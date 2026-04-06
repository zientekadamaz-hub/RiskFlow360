'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@app/lib/supabaseBrowser'


import { DO_VALUES, SEVERITIES, defaultColor, cellKey } from './_lib/matrixConfig'
import { nextColor, type RiskColor } from './_lib/matrixColors'

type Mode = 'manual' | 'rpn'

type DbCell = {
  organization_id: string
  severity: number
  do_value: number
  color: RiskColor
}

type DbConfig = {
  id: number
  mode: Mode
  rpn_green_max: number
  rpn_yellow_max: number
  rpn_orange_max: number
  updated_at?: string
  organization_id: string
}

type RpnThresholds = { greenMax: number; yellowMax: number; orangeMax: number }
type RiskMatrixCache = {
  ts: number
  orgId: string
  mode: Mode
  rpn: RpnThresholds
  cells: Record<string, RiskColor>
}

const LEGEND_ROW_HEIGHT = 46
const SESSION_RETRY_COUNT = 8
const SESSION_RETRY_DELAY_MS = 250
const QUERY_TIMEOUT_MS = 1800
const RISK_MATRIX_CACHE_KEY = '__SETTINGS_RISK_MATRIX_CACHE__'
const RISK_MATRIX_CACHE_TTL_MS = 5 * 60 * 1000

function errText(e: any) {
  if (!e) return 'unknown'
  return e?.message || e?.error_description || e?.details || e?.hint || String(e)
}

function isTimeoutErr(e: any) {
  const msg = (e?.message ?? '').toString().toLowerCase()
  return msg.includes('timeout')
}

function clampInt(v: number, min: number, max: number) {
  if (!Number.isFinite(v)) return min
  return Math.max(min, Math.min(max, Math.trunc(v)))
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))
const withTimeout = async <T,>(p: PromiseLike<T>, ms: number, fallback: T): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  try {
    return await Promise.race([
      p,
      new Promise<T>((resolve) => {
        timeoutId = setTimeout(() => resolve(fallback), ms)
      }),
    ])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}
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

function rgba(hex: string, alpha: number) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

const COLOR_HEX: Record<RiskColor, string> = {
  green: '#7bd77b',
  yellow: '#fff06a',
  orange: '#ffb347',
  red: '#ff4d4d',
}

function colorFill(c: RiskColor) {
  // requested: opacity 0.3
  return rgba(COLOR_HEX[c], 0.3)
}

function colorBorder(c: RiskColor) {
  return rgba(COLOR_HEX[c], 0.55)
}

function colorFromRpn(sev: number, doVal: number, t: RpnThresholds): RiskColor {
  const rpn = sev * doVal
  if (rpn <= t.greenMax) return 'green'
  if (rpn <= t.yellowMax) return 'yellow'
  if (rpn <= t.orangeMax) return 'orange'
  return 'red'
}

const legendRows: { color: RiskColor; title: string; desc: string }[] = [
  { color: 'green', title: 'GREEN', desc: 'Action not required.' },
  { color: 'yellow', title: 'YELLOW', desc: 'Action not required unless the team decides otherwise.' },
  { color: 'orange', title: 'ORANGE', desc: 'Action required unless the team decides otherwise.' },
  { color: 'red', title: 'RED', desc: 'Action must be implemented.' },
]

export default function RiskMatrixPage() {
  const defaultRpn: RpnThresholds = { greenMax: 100, yellowMax: 200, orangeMax: 360 }
  const [loading, setLoading] = useState(true)
  const [uiError, setUiError] = useState<string | null>(null)

  const [orgId, setOrgId] = useState<string | null>(null)
  const [orgName, setOrgName] = useState<string | null>(null)

  const [mode, setMode] = useState<Mode>('manual')
  const [rpn, setRpn] = useState<RpnThresholds>(defaultRpn)
  const [rpnInput, setRpnInput] = useState<{ green: string; yellow: string; orange: string }>({
    green: String(defaultRpn.greenMax),
    yellow: String(defaultRpn.yellowMax),
    orange: String(defaultRpn.orangeMax),
  })

  const [cells, setCells] = useState<Record<string, RiskColor>>({})

  // saving manual changes (FIX: always save latest)
  const [dirty, setDirty] = useState<Record<string, RiskColor>>({})
  const dirtyRef = useRef<Record<string, RiskColor>>({})
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // saving config
  const cfgTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // hover to show RPN in cell
  const [hoverKey, setHoverKey] = useState<string | null>(null)

  const readCache = (): RiskMatrixCache | null => {
    if (typeof window === 'undefined') return null
    try {
      const raw = window.sessionStorage.getItem(RISK_MATRIX_CACHE_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw) as RiskMatrixCache
      if (!parsed || typeof parsed.ts !== 'number') return null
      if (!parsed.orgId || typeof parsed.orgId !== 'string') return null
      if (Date.now() - parsed.ts > RISK_MATRIX_CACHE_TTL_MS) return null
      return parsed
    } catch {
      return null
    }
  }

  const writeCache = (data: Omit<RiskMatrixCache, 'ts'>) => {
    if (typeof window === 'undefined') return
    try {
      window.sessionStorage.setItem(RISK_MATRIX_CACHE_KEY, JSON.stringify({ ...data, ts: Date.now() }))
    } catch {}
  }

  // ----------- Layout / Styles -----------
  const frame: React.CSSProperties = {
    width: '80%', // 10% left & right
    marginLeft: 'auto',
    marginRight: 'auto',
  }

  const card: React.CSSProperties = {
    background: '#fff',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    borderRadius: 16,
    boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
  }

  const titleStyle: React.CSSProperties = { fontSize: 28, fontWeight: 600, letterSpacing: -0.3, color: '#111' }
  const subtitleStyle: React.CSSProperties = { marginTop: 4, fontSize: 13.5, color: '#6e6e73' }

  // legend table
  const legendCard: React.CSSProperties = { ...card, padding: 0, overflow: 'hidden' }
  const legendTable: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }

  const ltTh: React.CSSProperties = {
    textAlign: 'left',
    padding: '8px 10px',
    color: '#333',
    fontWeight: 650,
    background: '#fafafa',
    whiteSpace: 'nowrap',
    borderBottomStyle: 'solid',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  }

  const ltTd: React.CSSProperties = {
    padding: '0 10px',
    height: LEGEND_ROW_HEIGHT,
    borderBottomStyle: 'solid',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    verticalAlign: 'middle',
  }

  const inputBox: React.CSSProperties = {
    width: 100,
    padding: '6px 8px',
    borderRadius: 12,
    fontSize: 13,
    outline: 'none',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.14)',
    background: '#fff',
  }

  const colorCard = (hex: string): React.CSSProperties => ({
    padding: 12,
    borderRadius: 12,
    border: '1px solid rgba(0,0,0,0.08)',
    background: rgba(hex, 0.18),
    display: 'grid',
    gap: 8,
    minHeight: 86,
  })

  const colorLabel: React.CSSProperties = { fontSize: 11, fontWeight: 600, letterSpacing: 0.2, color: '#111' }

  const modeBtn = (active: boolean): React.CSSProperties => ({
    padding: '6px 12px',
    borderRadius: 10,
    border: '1px solid rgba(0,0,0,0.14)',
    background: active ? 'rgba(16, 26, 64, 0.12)' : '#fff',
    color: '#111',
    fontWeight: 800,
    fontSize: 12,
    cursor: 'pointer',
  })

  // matrix table styles
  const hairline = 0.5
  const thinBorderColor = 'rgba(0,0,0,0.10)'
  const cellW = 38
  const cellH = 33

  const th: React.CSSProperties = {
    position: 'sticky',
    top: 0,
    zIndex: 3,
    background: '#fff',
    fontSize: 12,
    padding: '5px 6px',
    textAlign: 'center',
    whiteSpace: 'nowrap',
    borderBottomStyle: 'solid',
    borderBottomWidth: hairline,
    borderBottomColor: thinBorderColor,
  }

  const thLeft: React.CSSProperties = {
    position: 'sticky',
    left: 0,
    zIndex: 4,
    background: '#fff',
    fontSize: 12,
    padding: '5px 8px',
    textAlign: 'center',
    width: 88,
    minWidth: 88,
    borderRightStyle: 'solid',
    borderRightWidth: hairline,
    borderRightColor: thinBorderColor,
    borderBottomStyle: 'solid',
    borderBottomWidth: hairline,
    borderBottomColor: thinBorderColor,
  }

  const tdBase: React.CSSProperties = {
    width: cellW,
    height: cellH,
    userSelect: 'none',
    textAlign: 'center',
    verticalAlign: 'middle',
    fontSize: 12,
    fontWeight: 800,
    color: 'rgba(0,0,0,0.65)',
    borderStyle: 'solid',
    borderWidth: hairline,
    borderColor: thinBorderColor,
  }

  const axisLabelOxd: React.CSSProperties = {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 12.5,
    fontWeight: 600,
    color: '#111',
    whiteSpace: 'nowrap',
  }

  // ----------- Helpers -----------
  const statusText = useMemo(() => {
    if (loading) return 'Loadingâ€¦'
    return mode === 'manual' ? 'Manual: click cells to set colors.' : 'RPN: colors are calculated from thresholds.'
  }, [loading, mode])

  const buildDefaultCells = () => {
    const next: Record<string, RiskColor> = {}
    for (const sev of SEVERITIES) for (const doVal of DO_VALUES) next[cellKey(sev, doVal)] = defaultColor(sev, doVal)
    return next
  }

  const loadOrgId = async (): Promise<string | null> => {
    const user = await getSessionUser()
    if (!user) {
      setUiError('Cannot read user: Not authenticated.')
      return null
    }

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const { data, error, status, statusText } = await withTimeout(
        supabase
          .from('profiles')
          .select('active_organization_id')
          .eq('id', user.id)
          .maybeSingle(),
        QUERY_TIMEOUT_MS,
        { data: null, error: new Error('timeout'), status: 408, statusText: 'timeout' } as any
      )

      if (error) {
        if (isTimeoutErr(error)) {
          const cached = readCache()
          if (cached?.orgId) return cached.orgId
          if (attempt === 0) {
            await delay(QUERY_TIMEOUT_MS / 3)
            continue
          }
          setUiError('Cannot load organization: timeout. Try again.')
          return null
        }

        console.error(`LOAD ORG ERROR | HTTP ${status ?? '??'} ${statusText ?? ''} | ${errText(error)}`, error)
        setUiError(`Cannot load organization: ${errText(error)}`)
        return null
      }

      const id = (data as any)?.active_organization_id as string | undefined
      if (!id) {
        setUiError('No active organization selected for this user.')
        return null
      }
      return id
    }

    return null
  }

  // ----------- DB load / save -----------
  const loadConfig = async (organizationId: string): Promise<{ mode: Mode; rpn: RpnThresholds } | null> => {
    const { data, error, status, statusText } = await withTimeout(
      supabase
        .from('risk_matrix_config')
        .select('id,mode,rpn_green_max,rpn_yellow_max,rpn_orange_max,organization_id')
        .eq('organization_id', organizationId)
        .maybeSingle(),
      QUERY_TIMEOUT_MS,
      { data: null, error: new Error('timeout'), status: 408, statusText: 'timeout' } as any
    )

    if (error) {
      console.error(`LOAD CONFIG ERROR | HTTP ${status ?? '??'} ${statusText ?? ''} | ${errText(error)}`, error)
      setUiError(`Cannot load config: ${errText(error)}`)
      return null
    }

    if (data) {
      const c = data as DbConfig
      const next = { mode: c.mode, rpn: { greenMax: c.rpn_green_max, yellowMax: c.rpn_yellow_max, orangeMax: c.rpn_orange_max } }
      setMode(next.mode)
      setRpn(next.rpn)
      return next
    }

    // If config doesn't exist yet, keep defaults; saving will create it.
    return { mode: 'manual', rpn: defaultRpn }
  }

  const saveConfig = async (organizationId: string, nextMode: Mode, nextRpn: RpnThresholds) => {
    // IMPORTANT: risk_matrix_config is per ORG, but table schema still has integer id.
    // We keep id=1 in the payload for compatibility, but conflict must be organization_id.
    const payload = {
      id: 1,
      organization_id: organizationId,
      mode: nextMode,
      rpn_green_max: nextRpn.greenMax,
      rpn_yellow_max: nextRpn.yellowMax,
      rpn_orange_max: nextRpn.orangeMax,
      updated_at: new Date().toISOString(),
    }

    const { error, status, statusText } = await supabase
      .from('risk_matrix_config')
      .upsert(payload as any, { onConflict: 'organization_id' })

    if (error) {
      console.error(`SAVE CONFIG ERROR | HTTP ${status ?? '??'} ${statusText ?? ''} | ${errText(error)}`, error)
      setUiError(`Cannot save config: ${errText(error)}`)
    }
  }

  const queueSaveConfig = (organizationId: string, nextMode: Mode, nextRpn: RpnThresholds) => {
    if (cfgTimer.current) clearTimeout(cfgTimer.current)
    cfgTimer.current = setTimeout(() => saveConfig(organizationId, nextMode, nextRpn), 250)
  }

  const loadManualCells = async (organizationId: string): Promise<Record<string, RiskColor> | null> => {
    const base = buildDefaultCells()
    setCells(base)

    const { data, error, status, statusText } = await withTimeout(
      supabase
        .from('risk_matrix_cells')
        .select('organization_id,severity,do_value,color')
        .eq('organization_id', organizationId),
      QUERY_TIMEOUT_MS,
      { data: null, error: new Error('timeout'), status: 408, statusText: 'timeout' } as any
    )

    if (error) {
      console.error(`LOAD MATRIX ERROR | HTTP ${status ?? '??'} ${statusText ?? ''} | ${errText(error)}`, error)
      setUiError(`Cannot load matrix: ${errText(error)}`)
      return null
    }

    if (data && data.length) {
      const next = { ...base }
      for (const row of data as DbCell[]) next[cellKey(row.severity, row.do_value)] = row.color
      setCells(next)
      return next
    }

    return base
  }

  const loadAll = async (foreground = true) => {
    if (foreground) setLoading(true)
    setUiError(null)
    try {
      const organizationId = await loadOrgId()
      if (!organizationId) return
      setOrgId(organizationId)

      const orgTask = (async () => {
        const orgRes = await withTimeout(
          supabase.from('organizations').select('name').eq('id', organizationId).maybeSingle(),
          QUERY_TIMEOUT_MS,
          { data: null, error: new Error('timeout') } as any
        )
        if (!orgRes.error) setOrgName(orgRes.data?.name ?? null)
      })()

      const [cfg, loadedCells] = await Promise.all([loadConfig(organizationId), loadManualCells(organizationId)])
      if (cfg && loadedCells) {
        writeCache({ orgId: organizationId, mode: cfg.mode, rpn: cfg.rpn, cells: loadedCells })
      }
      void orgTask
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const cached = readCache()
    if (cached) {
      setOrgId(cached.orgId)
      setMode(cached.mode)
      setRpn(cached.rpn)
      setCells(cached.cells)
      setLoading(false)
      void loadAll(false)
    } else {
      void loadAll(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!orgId) return
    writeCache({ orgId, mode, rpn, cells })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, mode, rpn, cells])

  useEffect(() => {
    setRpnInput({
      green: String(rpn.greenMax),
      yellow: String(rpn.yellowMax),
      orange: String(rpn.orangeMax),
    })
  }, [rpn.greenMax, rpn.yellowMax, rpn.orangeMax])

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== 'SIGNED_OUT') return
      try {
        window.sessionStorage.removeItem(RISK_MATRIX_CACHE_KEY)
      } catch {}
    })
    return () => {
      try {
        // @ts-ignore
        sub?.subscription?.unsubscribe?.()
      } catch {}
    }
  }, [])

  // FIX: flush reads from dirtyRef (latest), not state closure
  const flushDirty = async () => {
    if (!orgId) return

    const snapshot = dirtyRef.current
    const entries = Object.entries(snapshot)
    if (!entries.length) return

    // clear immediately (new clicks during save won't be lost)
    dirtyRef.current = {}
    setDirty({})

    const payload: DbCell[] = entries.map(([k, color]) => {
      const [sevStr, doStr] = k.split('|')
      return { organization_id: orgId, severity: Number(sevStr), do_value: Number(doStr), color }
    })

    const { error, status, statusText } = await supabase
      .from('risk_matrix_cells')
      .upsert(payload as any, { onConflict: 'organization_id,severity,do_value' })

    if (error) {
      console.error(`UPSERT ERROR | HTTP ${status ?? '??'} ${statusText ?? ''} | ${errText(error)}`, error)
      setUiError(`Cannot save manual changes: ${errText(error)}`)

      // restore back (retry later)
      const restored: Record<string, RiskColor> = {}
      for (const row of payload) restored[cellKey(row.severity, row.do_value)] = row.color
      dirtyRef.current = restored
      setDirty(restored)
    }
  }

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden') flushDirty()
    }
    const onPageHide = () => flushDirty()
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('pagehide', onPageHide)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId])

  const queueManualChange = (sev: number, doVal: number, color: RiskColor) => {
    const k = cellKey(sev, doVal)

    dirtyRef.current = { ...dirtyRef.current, [k]: color }
    setDirty(dirtyRef.current)

    if (flushTimer.current) clearTimeout(flushTimer.current)
    flushTimer.current = setTimeout(() => flushDirty(), 250)
  }

  // ----------- UI actions -----------
  const handleCellClick = (sev: number, doVal: number) => {
    if (mode !== 'manual') return
    const k = cellKey(sev, doVal)
    const current = cells[k] ?? defaultColor(sev, doVal)
    const updated = nextColor(current)
    setCells((prev) => ({ ...prev, [k]: updated }))
    queueManualChange(sev, doVal, updated)
  }

  const setModeSafe = (m: Mode) => {
    if (!orgId) return
    setUiError(null)
    setMode(m)
    queueSaveConfig(orgId, m, rpn)
  }

  const updateRpn = (patch: Partial<RpnThresholds>) => {
    if (!orgId) return

    const next: RpnThresholds = {
      greenMax: clampInt(patch.greenMax ?? rpn.greenMax, 1, 1000),
      yellowMax: clampInt(patch.yellowMax ?? rpn.yellowMax, 1, 1000),
      orangeMax: clampInt(patch.orangeMax ?? rpn.orangeMax, 1, 1000),
    }
    if (next.yellowMax < next.greenMax) next.yellowMax = next.greenMax
    if (next.orangeMax < next.yellowMax) next.orangeMax = next.yellowMax

    setRpn(next)
    queueSaveConfig(orgId, mode, next)
  }

  const commitRpnInput = (kind: 'green' | 'yellow' | 'orange') => {
    const raw = rpnInput[kind].trim()
    if (!raw) {
      setRpnInput((prev) => ({ ...prev, [kind]: String(rpn[kind + 'Max' as keyof RpnThresholds]) }))
      return
    }
    const num = Number(raw.replace(',', '.'))
    if (!Number.isFinite(num)) {
      setRpnInput((prev) => ({ ...prev, [kind]: String(rpn[kind + 'Max' as keyof RpnThresholds]) }))
      return
    }
    if (kind === 'green') updateRpn({ greenMax: num })
    if (kind === 'yellow') updateRpn({ yellowMax: num })
    if (kind === 'orange') updateRpn({ orangeMax: num })
  }

  const adjustRpnInput = (kind: 'green' | 'yellow' | 'orange', delta: number) => {
    const raw = rpnInput[kind].trim()
    const base = Number(raw.replace(',', '.'))
    const current = Number.isFinite(base) ? base : rpn[kind + 'Max' as keyof RpnThresholds]
    const next = clampInt(current + delta, 1, 1000)
    setRpnInput((prev) => ({ ...prev, [kind]: String(next) }))
    if (kind === 'green') updateRpn({ greenMax: next })
    if (kind === 'yellow') updateRpn({ yellowMax: next })
    if (kind === 'orange') updateRpn({ orangeMax: next })
  }

  if (!loading && !orgId) {
    return (
      <div style={{ ...frame, paddingTop: 24 }}>
        <div style={titleStyle}>Risk Matrix</div>
        <div style={subtitleStyle}>No organization selected / found for this user.</div>
        {uiError && (
          <div style={{ marginTop: 10, fontSize: 12, color: '#7a1111', background: '#fff1f1', padding: 10, borderRadius: 12 }}>
            <b>Error:</b> {uiError}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 14 }}>
      {/* Title */}
      <div style={{ ...frame, paddingTop: 20 }}>
        <div style={titleStyle}>Risk Matrix</div>
        <div style={subtitleStyle}>Configure risk classification using Manual matrix colors or RPN thresholds.</div>
      </div>

      {/* Organization + RPN + Mode */}
      <div style={{ ...frame, marginTop: 12 }}>
        <div style={{ ...card, padding: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10 }}>Organization & RPN</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
            <div style={{ padding: 10, borderRadius: 10, background: '#fafafa', border: '1px solid #eee' }}>
              <div style={{ fontSize: 11, color: '#666' }}>Organization</div>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 800,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {orgName ?? orgId ?? '—'}
              </div>
            </div>
            <div style={colorCard('#eef1f6')}>
              <div style={colorLabel}>{statusText}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                <button className="rf-button" onClick={() => setModeSafe('manual')} style={modeBtn(mode === 'manual')}>
                  MANUAL
                </button>
                <button className="rf-button" onClick={() => setModeSafe('rpn')} style={modeBtn(mode === 'rpn')}>
                  RPN
                </button>
              </div>
            </div>
            <div style={colorCard(COLOR_HEX.red)}>
              <div style={colorLabel}>{legendRows[3].desc}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    color: '#1f2937',
                    fontSize: 12,
                    fontWeight: 700,
                    visibility: mode === 'rpn' ? 'visible' : 'hidden',
                  }}
                >
                  RPN &gt;
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#1f2937',
                    visibility: mode === 'rpn' ? 'visible' : 'hidden',
                  }}
                >
                  {rpn.orangeMax}
                </span>
              </div>
            </div>
            <div style={colorCard(COLOR_HEX.orange)}>
              <div style={colorLabel}>{legendRows[2].desc}</div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  visibility: mode === 'rpn' ? 'visible' : 'hidden',
                  pointerEvents: mode === 'rpn' ? 'auto' : 'none',
                }}
              >
                <span style={{ color: '#1f2937', fontSize: 12, fontWeight: 700 }}>RPN ≤</span>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={rpnInput.orange}
                  onChange={(e) => {
                    const v = e.target.value
                    setRpnInput((prev) => ({ ...prev, orange: v }))
                    const num = Number(v)
                    if (Number.isFinite(num)) updateRpn({ orangeMax: num })
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.currentTarget.blur()
                      return
                    }
                    if (e.key === 'ArrowUp') {
                      e.preventDefault()
                      adjustRpnInput('orange', e.shiftKey ? 10 : 1)
                    }
                    if (e.key === 'ArrowDown') {
                      e.preventDefault()
                      adjustRpnInput('orange', e.shiftKey ? -10 : -1)
                    }
                  }}
                  onBlur={() => commitRpnInput('orange')}
                  style={{ ...inputBox, background: mode !== 'rpn' ? '#f3f3f3' : '#fff' }}
                />
              </div>
            </div>
            <div style={colorCard(COLOR_HEX.yellow)}>
              <div style={colorLabel}>{legendRows[1].desc}</div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  visibility: mode === 'rpn' ? 'visible' : 'hidden',
                  pointerEvents: mode === 'rpn' ? 'auto' : 'none',
                }}
              >
                <span style={{ color: '#1f2937', fontSize: 12, fontWeight: 700 }}>RPN ≤</span>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={rpnInput.yellow}
                  onChange={(e) => {
                    const v = e.target.value
                    setRpnInput((prev) => ({ ...prev, yellow: v }))
                    const num = Number(v)
                    if (Number.isFinite(num)) updateRpn({ yellowMax: num })
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.currentTarget.blur()
                      return
                    }
                    if (e.key === 'ArrowUp') {
                      e.preventDefault()
                      adjustRpnInput('yellow', e.shiftKey ? 10 : 1)
                    }
                    if (e.key === 'ArrowDown') {
                      e.preventDefault()
                      adjustRpnInput('yellow', e.shiftKey ? -10 : -1)
                    }
                  }}
                  onBlur={() => commitRpnInput('yellow')}
                  style={{ ...inputBox, background: mode !== 'rpn' ? '#f3f3f3' : '#fff' }}
                />
              </div>
            </div>
            <div style={colorCard(COLOR_HEX.green)}>
              <div style={colorLabel}>{legendRows[0].desc}</div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  visibility: mode === 'rpn' ? 'visible' : 'hidden',
                  pointerEvents: mode === 'rpn' ? 'auto' : 'none',
                }}
              >
                <span style={{ color: '#1f2937', fontSize: 12, fontWeight: 700 }}>RPN ≤</span>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={rpnInput.green}
                  onChange={(e) => {
                    const v = e.target.value
                    setRpnInput((prev) => ({ ...prev, green: v }))
                    const num = Number(v)
                    if (Number.isFinite(num)) updateRpn({ greenMax: num })
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.currentTarget.blur()
                      return
                    }
                    if (e.key === 'ArrowUp') {
                      e.preventDefault()
                      adjustRpnInput('green', e.shiftKey ? 10 : 1)
                    }
                    if (e.key === 'ArrowDown') {
                      e.preventDefault()
                      adjustRpnInput('green', e.shiftKey ? -10 : -1)
                    }
                  }}
                  onBlur={() => commitRpnInput('green')}
                  style={{ ...inputBox, background: mode !== 'rpn' ? '#f3f3f3' : '#fff' }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Error */}
      {uiError && (
        <div style={{ ...frame, marginTop: 8 }}>
          <div
            style={{
              fontSize: 12,
              padding: '10px 12px',
              borderRadius: 12,
              background: '#fff1f1',
              color: '#7a1111',
              borderStyle: 'solid',
              borderWidth: 1,
              borderColor: '#f2b6b6',
            }}
          >
            <b>Database error:</b> {uiError}
          </div>
        </div>
      )}

      {/* Matrix */}
      <div style={{ ...frame, marginTop: 12 }}>
        <div style={{ ...card, padding: 0 }}>
          <div style={{ overflow: 'auto', padding: 10 }}>
            <table style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thLeft}>Severity</th>
                  {DO_VALUES.map((v) => (
                    <th key={v} style={th}>
                      {v}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {SEVERITIES.map((sev) => (
                  <tr key={sev}>
                    <th style={{ ...thLeft, top: 'auto' }}>{sev}</th>

                    {DO_VALUES.map((doVal) => {
                      const k = cellKey(sev, doVal)
                      const cellColor: RiskColor =
                        mode === 'manual'
                          ? (cells[k] ?? defaultColor(sev, doVal))
                          : colorFromRpn(sev, doVal, rpn)

                      const rpnVal = sev * doVal
                      const isHover = hoverKey === k

                      return (
                        <td
                          key={doVal}
                          onMouseEnter={() => setHoverKey(k)}
                          onMouseLeave={() => setHoverKey((prev) => (prev === k ? null : prev))}
                          onClick={() => handleCellClick(sev, doVal)}
                          title={`Severity: ${sev} | Occurrence × Detection: ${doVal} | RPN: ${rpnVal}`}
                          style={{
                            ...tdBase,
                            background: colorFill(cellColor),
                            borderColor: thinBorderColor,
                            cursor: mode === 'manual' ? 'pointer' : 'default',
                          }}
                        >
                          {isHover ? rpnVal : ''}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={axisLabelOxd}>Occurrence × Detection</div>
          </div>
        </div>
      </div>

      <div style={{ ...frame, marginTop: 8, fontSize: 12, color: '#6e6e73' }}>
        Changes are saved automatically.
      </div>
    </div>
  )
}


