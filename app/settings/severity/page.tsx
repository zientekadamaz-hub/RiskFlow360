'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@app/lib/supabaseBrowser'

type SeverityEffectiveRow = {
  level: number
  name: string
  description?: string | null
  active: boolean
  modified_by?: string | null
  modified_by_name?: string | null
  modified_at?: string | null
}

type SeverityRowUi = {
  level: number
  name: string
  description?: string | null
  active: boolean
  modified_by_name?: string | null
  modified_at?: string | null
}

const SESSION_RETRY_COUNT = 8
const SESSION_RETRY_DELAY_MS = 250
const QUERY_TIMEOUT_MS = 1800
const SEVERITY_CACHE_KEY = '__SETTINGS_SEVERITY_CACHE__'
const SEVERITY_CACHE_TTL_MS = 5 * 60 * 1000
const SEVERITY_LEVELS = 10
const SEVERITY_DEFAULTS: Record<number, { name: string; description: string }> = {
  10: {
    name: 'Safety hazard – Failure affects safe operation of the product or user safety.',
    description:
      'Risk of injury / hazardous event\nLoss of a safety function or protective lockout\nOverheating, short circuit, electric shock, fire (product dependent)\nUnsafe mechanical behavior (e.g., uncontrolled movement)\nBreach of customer safety requirements / safety standards',
  },
  9: {
    name: 'Critical compliance or customer damage – Non-compliance with regulations and/or risk of damage to the customer’s installation/equipment.',
    description:
      'Regulatory / legal non-compliance\nDamage to customer equipment or connected systems\nHigh-cost customer failure (without direct safety hazard)\nCustomer line stoppage caused by the product\nCritical customer complaint / escalation',
  },
  8: {
    name: 'Loss of primary function – Loss of the primary function required for normal use within the expected period.',
    description:
      'Product cannot perform its core function\nNo start-up / not usable in normal operation\nFailure within the expected life/usage period\nKey functional parameters not met\nCustomer repair/replacement required to restore usability',
  },
  7: {
    name: 'Degradation of primary function – Degradation of the primary function required for normal use within the expected period.',
    description:
      'Works but with clearly worse performance (output/speed/force)\nUnstable operation / intermittent primary-function faults\nReduced life of the primary function (before expected period)\nFrequent resets / interruptions during use\nUsable but does not meet customer expectations',
  },
  6: {
    name: 'Loss of secondary function – Loss of a secondary function (product works but loses an auxiliary function).',
    description:
      'Missing auxiliary feature (e.g., indication, communication, extra mode)\nSome options/modes unavailable while core function works\nWorkaround required by the user\nReduced convenience/ergonomics without loss of primary function\nAdditional service action needed to restore the auxiliary function',
  },
  5: {
    name: 'Degradation of secondary function – Degradation of a secondary function (works but noticeably worse in an auxiliary function).',
    description:
      'Lower quality/performance of an auxiliary function (accuracy/signal)\nOccasional auxiliary-function disturbances\nLonger response/operation time for an auxiliary function\nIncreased noise/vibration in an auxiliary function\nMinor user adjustments/calibration required',
  },
  4: {
    name: 'Strongly objectionable appearance/feel – Very undesirable appearance, sound, vibration, roughness, or tactile sensation.',
    description:
      'Visible cosmetic defects on customer-visible surfaces\nClearly noticeable noise/vibration perceived as a defect\nSharp edges / very unpleasant tactile feel\nHigh customer dissatisfaction despite function being OK\nHigh risk of cosmetic complaint/return',
  },
  3: {
    name: 'Moderately objectionable appearance/feel – Moderately undesirable appearance, sound, vibration, roughness, or tactile sensation.',
    description:
      'Medium cosmetic defects (often acceptable with agreement)\nModerate noise/vibration with no functional impact\nMinor finishing/fit issues\nUser notices but typically still accepts\nLow-to-moderate risk of cosmetic complaint',
  },
  2: {
    name: 'Slightly objectionable appearance/feel – Slightly undesirable appearance, sound, vibration, roughness, or tactile sensation.',
    description:
      'Minor cosmetic defects outside visible area\nSmall deviations in appearance/finish\nSubtle noise/vibration within acceptable limits\nMinor tactile differences with no functional relevance\nUsually no complaints or isolated cases',
  },
  1: {
    name: 'No noticeable effect – No discernible effect to the user.',
    description:
      'No noticeable difference in function or appearance\nDeviation has no impact on requirements or functional specification\nCosmetic deviation not detectable by the user\nFull user acceptance\nNo impact on safety, compliance, or functionality',
  },
}

export default function SettingsSeverityPage() {
  const [orgId, setOrgId] = useState<string | null>(null)
  const [orgName, setOrgName] = useState<string | null>(null)
  const [currentUserName, setCurrentUserName] = useState<string | null>(null)

  const [rows, setRows] = useState<SeverityRowUi[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const frame: React.CSSProperties = {
    width: '80%',
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
  const readCache = () => {
    if (typeof window === 'undefined') return null
    try {
      const raw = window.sessionStorage.getItem(SEVERITY_CACHE_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw) as {
        ts?: number
        orgId?: string | null
        orgName?: string | null
        rows?: SeverityRowUi[]
      }
      if (!parsed || typeof parsed.ts !== 'number') return null
      if (Date.now() - parsed.ts > SEVERITY_CACHE_TTL_MS) return null
      return parsed
    } catch {
      return null
    }
  }
  const writeCache = (data: { orgId: string | null; orgName: string | null; rows: SeverityRowUi[] }) => {
    if (typeof window === 'undefined') return
    try {
      window.sessionStorage.setItem(SEVERITY_CACHE_KEY, JSON.stringify({ ...data, ts: Date.now() }))
    } catch {}
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

  const toUiRow = (row: SeverityEffectiveRow): SeverityRowUi => {
    const defaults = SEVERITY_DEFAULTS[row.level]
    const name = (row.name ?? '').trim()
    const description = (row.description ?? '').trim()
    return {
      level: row.level,
      name: name || defaults?.name || '',
      description: description || defaults?.description || '',
      active: !!row.active,
      modified_by_name: row.modified_by_name ?? null,
      modified_at: row.modified_at ?? null,
    }
  }

  const normalizeEffectiveRows = (list: SeverityEffectiveRow[]): SeverityRowUi[] => {
    const byLevel = new Map<number, SeverityEffectiveRow>()
    list.forEach((r) => {
      if (Number.isFinite(r.level)) byLevel.set(r.level, r)
    })
    const merged: SeverityRowUi[] = []
    for (let level = 1; level <= SEVERITY_LEVELS; level += 1) {
      const found = byLevel.get(level)
      const defaults = SEVERITY_DEFAULTS[level]
      if (found) {
        merged.push(toUiRow(found))
      } else {
        merged.push({
          level,
          name: defaults?.name ?? '',
          description: defaults?.description ?? '',
          active: true,
          modified_by_name: null,
          modified_at: null,
        })
      }
    }
    return merged
  }

  const normalizeUiRows = (list: SeverityRowUi[]): SeverityRowUi[] => {
    const byLevel = new Map<number, SeverityRowUi>()
    list.forEach((r) => {
      if (Number.isFinite(r.level)) byLevel.set(r.level, r)
    })
    const merged: SeverityRowUi[] = []
    for (let level = 1; level <= SEVERITY_LEVELS; level += 1) {
      const found = byLevel.get(level)
      const defaults = SEVERITY_DEFAULTS[level]
      if (found) {
        const name = (found.name ?? '').trim()
        const description = (found.description ?? '').trim()
        merged.push({
          ...found,
          name: name || defaults?.name || '',
          description: description || defaults?.description || '',
        })
      } else {
        merged.push({
          level,
          name: defaults?.name ?? '',
          description: defaults?.description ?? '',
          active: true,
          modified_by_name: null,
          modified_at: null,
        })
      }
    }
    return merged
  }

  const fmtDateOnly = (value: string | null | undefined) => {
    if (!value) return '—'
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return '—'
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' })
  }

  const getDisplayName = (first: string | null | undefined, last: string | null | undefined) => {
    const fn = (first ?? '').trim()
    const ln = (last ?? '').trim()
    const full = `${fn} ${ln}`.trim()
    return full || null
  }

  async function load(foreground = true) {
    if (foreground) setLoading(true)
    setErr(null)

    const user = await getSessionUser()
    if (!user) {
      setErr('No authenticated user.')
      setLoading(false)
      return
    }

    const headerTask = (async () => {
      const headerRes = await withTimeout(
        supabase.rpc('get_my_header').maybeSingle(),
        QUERY_TIMEOUT_MS,
        { data: null, error: new Error('timeout') } as any
      )
      if (!headerRes.error && headerRes.data) {
        const h = headerRes.data as { first_name?: string | null; last_name?: string | null }
        setCurrentUserName(getDisplayName(h.first_name ?? null, h.last_name ?? null))
      }
    })()

    const profRes = await withTimeout(
      supabase
        .from('profiles')
        .select('active_organization_id')
        .eq('id', user.id)
        .maybeSingle(),
      QUERY_TIMEOUT_MS,
      { data: null, error: new Error('timeout') } as any
    )

    if (profRes.error) {
      setErr(profRes.error.message === 'timeout' ? 'Session read timeout. Try again.' : profRes.error.message)
      setLoading(false)
      return
    }

    const activeOrgId = (profRes.data as any)?.active_organization_id as string | null
    setOrgId(activeOrgId)

    if (!activeOrgId) {
      setErr('User has no active organization selected.')
      setLoading(false)
      return
    }

    const [orgRes, listRes] = await Promise.all([
      withTimeout(
        supabase
          .from('organizations')
          .select('name')
          .eq('id', activeOrgId)
          .maybeSingle(),
        QUERY_TIMEOUT_MS,
        { data: null, error: new Error('timeout') } as any
      ),
      withTimeout(
        supabase.rpc('get_severity_effective', { p_org: activeOrgId }),
        QUERY_TIMEOUT_MS,
        { data: [], error: new Error('timeout') } as any
      ),
    ])

    if (!orgRes.error) {
      setOrgName(orgRes.data?.name ?? null)
    }

    if (listRes.error) {
      setErr(listRes.error.message === 'timeout' ? 'Severity read timeout. Try again.' : listRes.error.message)
      setLoading(false)
      return
    }

    const nextRows = (listRes.data ?? []) as SeverityEffectiveRow[]
    const normalized = normalizeEffectiveRows(nextRows)
    setRows(normalized)
    writeCache({
      orgId: activeOrgId,
      orgName: orgRes.error ? null : orgRes.data?.name ?? null,
      rows: normalized,
    })
    setLoading(false)
    void headerTask
  }

  useEffect(() => {
    const cached = readCache()
    if (cached) {
      setOrgId(cached.orgId ?? null)
      setOrgName(cached.orgName ?? null)
      const cachedRows = Array.isArray(cached.rows) ? cached.rows : []
      setRows(normalizeUiRows(cachedRows))
      setLoading(false)
      void load(false)
    } else {
      void load(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!orgId) return
    writeCache({ orgId, orgName, rows })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, orgName, rows])

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== 'SIGNED_OUT') return
      try {
        window.sessionStorage.removeItem(SEVERITY_CACHE_KEY)
      } catch {}
    })
    return () => {
      try {
        // @ts-ignore
        sub?.subscription?.unsubscribe?.()
      } catch {}
    }
  }, [])

  async function updateSeverity(row: SeverityRowUi, changes: Partial<SeverityEffectiveRow>) {
    setErr(null)
    if (!orgId) return
    const payload: any = {
      organization_id: orgId,
      level: row.level,
    }
    if (changes.name !== undefined) payload.name = changes.name
    if (changes.description !== undefined) payload.description = changes.description
    if (changes.active !== undefined) payload.active = changes.active

    if (payload.name !== undefined && !String(payload.name).trim()) {
      setErr('Name is required.')
      return
    }

    const res = await supabase
      .from('severity_overrides')
      .upsert(payload, { onConflict: 'organization_id,level' })
    if (res.error) {
      setErr(res.error.message)
      return
    }

    const nowIso = new Date().toISOString()
    setRows((prev) =>
      prev
        .map((r) =>
          r.level === row.level
            ? {
                ...r,
                name: changes.name !== undefined ? String(changes.name) : r.name,
                description: changes.description !== undefined ? String(changes.description) : r.description,
                active: changes.active !== undefined ? !!changes.active : r.active,
                modified_by_name: currentUserName ?? r.modified_by_name ?? null,
                modified_at: nowIso,
              }
            : r
        )
        .sort((a, b) => a.level - b.level)
    )
  }

  async function restoreRowDefaults(row: SeverityRowUi) {
    if (!orgId) return
    setErr(null)

    const res = await supabase
      .from('severity_overrides')
      .delete()
      .eq('organization_id', orgId)
      .eq('level', row.level)
    if (res.error) {
      setErr(res.error.message)
      return
    }

    const defaults = SEVERITY_DEFAULTS[row.level]
    setRows((prev) =>
      prev.map((r) =>
        r.level === row.level
          ? {
              ...r,
              name: defaults?.name ?? '',
              description: defaults?.description ?? '',
              active: true,
              modified_by_name: null,
              modified_at: null,
            }
          : r
      )
    )
  }

  if (loading) {
    return (
      <div style={{ ...frame, paddingTop: 20 }}>
        <div style={titleStyle}>Severity</div>
        <div style={subtitleStyle}>Loading...</div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 14 }}>
      {/* Title */}
      <div style={{ ...frame, paddingTop: 20 }}>
        <div style={titleStyle}>Severity</div>
        <div style={subtitleStyle}>Define severity scale values and descriptions.</div>
      </div>

      {/* Organization */}
      <div style={{ ...frame, marginTop: 12 }}>
        <div style={{ ...card, padding: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10 }}>Organization</div>
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
          </div>
        </div>
      </div>

      {err && (
        <div style={{ ...frame, marginTop: 12 }}>
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
            <b>Error:</b> {err}
          </div>
        </div>
      )}

      <div style={{ ...frame, marginTop: 12 }}>
        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'center', padding: 10, fontSize: 12, color: '#333', fontWeight: 650, background: '#fafafa', borderBottom: '1px solid rgba(0,0,0,0.06)', width: 70 }}>Level</th>
              <th style={{ textAlign: 'left', padding: 10, fontSize: 12, color: '#333', fontWeight: 650, background: '#fafafa', borderBottom: '1px solid rgba(0,0,0,0.06)', width: '35%' }}>Definition</th>
              <th style={{ textAlign: 'left', padding: 10, fontSize: 12, color: '#333', fontWeight: 650, background: '#fafafa', borderBottom: '1px solid rgba(0,0,0,0.06)', width: '35%' }}>Examples</th>
              <th style={{ textAlign: 'left', padding: 10, fontSize: 12, color: '#333', fontWeight: 650, background: '#fafafa', borderBottom: '1px solid rgba(0,0,0,0.06)', width: 100 }}>Active</th>
              <th style={{ textAlign: 'left', padding: 10, fontSize: 12, color: '#333', fontWeight: 650, background: '#fafafa', borderBottom: '1px solid rgba(0,0,0,0.06)', width: 180 }}>Modified</th>
              <th style={{ textAlign: 'left', padding: 10, fontSize: 12, color: '#333', fontWeight: 650, background: '#fafafa', borderBottom: '1px solid rgba(0,0,0,0.06)', width: 1, whiteSpace: 'nowrap' }}>Actions</th>
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: 14, color: '#666' }}>
                  No severity levels defined.
                </td>
              </tr>
            ) : (
              rows
                .slice(0, SEVERITY_LEVELS)
                .sort((a, b) => b.level - a.level)
                .map((r) => (
                <SeverityRowItem
                  key={`sev-${r.level}`}
                  row={r}
                  onUpdate={updateSeverity}
                  fmtDateOnly={fmtDateOnly}
                  onRestoreDefaults={restoreRowDefaults}
                />
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}

function SeverityRowItem({
  row,
  onUpdate,
  fmtDateOnly,
  onRestoreDefaults,
}: {
  row: SeverityRowUi
  onUpdate: (row: SeverityRowUi, changes: Partial<SeverityEffectiveRow>) => Promise<void>
  fmtDateOnly: (value: string | null | undefined) => string
  onRestoreDefaults: (row: SeverityRowUi) => Promise<void>
}) {
  const capFirst = (value: string) => {
    if (!value) return value
    return value.charAt(0).toUpperCase() + value.slice(1)
  }
  const [edit, setEdit] = useState(false)
  const [title, setTitle] = useState('')
  const [definition, setDefinition] = useState('')
  const [examples, setExamples] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState<null | { title: string; body: string; onConfirm: () => Promise<void> }>(null)

  const resetLocalFromRow = () => {
    const rawName = row.name ?? ''
    const nameParts = rawName.split('–')
    if (nameParts.length >= 2) {
      setTitle(capFirst(nameParts[0].trim()))
      setDefinition(capFirst(nameParts.slice(1).join('–').trim()))
    } else {
      setTitle(capFirst(rawName.trim()))
      setDefinition('')
    }
    const exampleParts = (row.description ?? '')
      .split('\n')
      .map((line) => line.replace(/^\s*[-•]\s?/, '').trim())
      .filter((line) => line.length > 0)
    setExamples([...exampleParts.map(capFirst), ''])
  }

  useEffect(() => {
    resetLocalFromRow()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row])

  async function save() {
    const t = title.trim()
    const d = definition.trim()
    if (!t) {
      setEdit(false)
      return
    }
    const combinedName = d ? `${t} – ${d}` : t
    setConfirm({
      title: 'Caution',
      body:
        'You are overwriting the current version. You cannot restore the previous version except by editing again.',
      onConfirm: async () => {
        setBusy(true)
        const joinedExamples = examples.map((e) => e.trim()).filter(Boolean).join('\n')
        await onUpdate(row, { name: combinedName, description: joinedExamples })
        setBusy(false)
        setEdit(false)
      },
    })
  }

  return (
    <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
      <td style={{ padding: 10, textAlign: 'center' }}>
        <strong>{row.level}</strong>
      </td>
      <td style={{ padding: 10 }}>
        {edit ? (
          <div style={{ display: 'grid', gap: 6 }}>
            <input
              id={`severity-title-${row.level}`}
              name={`severity-title-${row.level}`}
              value={title}
              onChange={(e) => setTitle(capFirst(e.target.value))}
              placeholder="Title"
              style={{
                width: '100%',
                padding: '4px 6px',
                borderRadius: 10,
                border: '1px solid #ddd',
                fontWeight: 650,
                fontSize: 12,
              }}
            />
            <input
              id={`severity-definition-${row.level}`}
              name={`severity-definition-${row.level}`}
              value={definition}
              onChange={(e) => setDefinition(capFirst(e.target.value))}
              placeholder="Definition"
              style={{
                width: '100%',
                padding: '4px 6px',
                borderRadius: 10,
                border: '1px solid #ddd',
                fontSize: 12,
              }}
            />
          </div>
        ) : (
          (() => {
            const raw = row.name || ''
            const parts = raw.split('–')
            const t = parts[0]?.trim() ?? ''
            const d = parts.slice(1).join('–').trim()
            return (
              <div>
                {t ? <div style={{ fontWeight: 700 }}>{t}</div> : <div>—</div>}
                {d ? <div style={{ color: '#666', fontSize: 12, marginTop: 2 }}>{d}</div> : null}
              </div>
            )
          })()
        )}
      </td>
      <td style={{ padding: 10 }}>
        {edit ? (
          <div style={{ display: 'grid', gap: 6 }}>
            {examples.map((ex, idx) => (
              <input
                key={`${row.level}-ex-${idx}`}
                id={`severity-desc-${row.level}-${idx}`}
                name={`severity-desc-${row.level}-${idx}`}
                value={ex}
                onChange={(e) => {
                  const next = [...examples]
                  next[idx] = e.target.value.replace(/^\s*[-•]\s?/, '')
                  next[idx] = capFirst(next[idx])
                  // ensure one empty row at the end
                  const trimmed = next.map((v) => v.trim()).filter(Boolean)
                  setExamples([...trimmed, ''])
                }}
                placeholder={idx === 0 ? 'Add example…' : ''}
                style={{
                  width: '100%',
                  padding: '4px 6px',
                  borderRadius: 10,
                  border: '1px solid #ddd',
                  fontSize: 12,
                }}
              />
            ))}
          </div>
        ) : (
          <ul
            style={{
              margin: 0,
              paddingLeft: 18,
              color: '#666',
              display: 'grid',
              gap: 4,
              fontSize: 12,
              listStyleType: 'disc',
              listStylePosition: 'outside',
            }}
          >
            {(row.description || '')
              .split('\n')
              .map((line) => line.trim())
              .filter(Boolean)
              .map((line, idx) => (
                <li key={`${row.level}-ex-${idx}`}>{line}</li>
              ))}
          </ul>
        )}
      </td>
      <td style={{ padding: 10, whiteSpace: 'nowrap' }}>
        <button
          onClick={async () => {
            if (!row.name.trim()) return
            setBusy(true)
            await onUpdate(row, { active: !row.active })
            setBusy(false)
          }}
          disabled={busy || !row.name.trim()}
          className="rf-button"
          aria-label={`Set active ${row.active ? 'off' : 'on'}`}
          style={{
            position: 'relative',
            width: 40,
            height: 20,
            padding: 2,
            borderRadius: 999,
            border: '1px solid rgba(16, 26, 64, 0.28)',
            background: row.active ? 'rgba(16, 26, 64, 0.18)' : 'rgba(16, 26, 64, 0.06)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: row.active ? 'flex-end' : 'flex-start',
            transition: 'background 140ms ease, border-color 140ms ease',
          }}
        >
          <span
            style={{
              width: 16,
              height: 16,
              borderRadius: 999,
              background: row.active ? 'rgba(16, 26, 64, 0.95)' : 'rgba(16, 26, 64, 0.45)',
              boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
            }}
          />
        </button>
      </td>
          <td style={{ padding: 10, color: '#333' }}>
        {row.modified_by_name ? (
          <>
            <div style={{ fontWeight: 600, lineHeight: 1.2 }}>{row.modified_by_name}</div>
            <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
              {fmtDateOnly(row.modified_at)}
            </div>
          </>
        ) : null}
      </td>
      <td style={{ padding: 10 }}>
        {edit ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'nowrap' }}>
            <button
              onClick={save}
              disabled={busy}
              className="rf-button"
              style={{ padding: '6px 10px', borderRadius: 10, border: '1px solid #ddd', fontWeight: 650 }}
            >
              Save
            </button>
            <button
              onClick={() => {
                resetLocalFromRow()
                setEdit(false)
              }}
              disabled={busy}
              className="rf-button"
              style={{ padding: '6px 10px', borderRadius: 10, border: '1px solid #ddd' }}
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                if (busy) return
                setConfirm({
                  title: 'Caution',
                  body: 'This will restore factory defaults. To change them again, edit the row.',
                  onConfirm: async () => {
                    setBusy(true)
                    await onRestoreDefaults(row)
                    setBusy(false)
                    setEdit(false)
                  },
                })
              }}
              disabled={busy}
              className="rf-button"
              style={{ padding: '6px 10px', borderRadius: 10, border: '1px solid #ddd', whiteSpace: 'nowrap' }}
            >
              Restore defaults
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'nowrap' }}>
            <button
              onClick={() => setEdit(true)}
              className="rf-button"
              style={{ padding: '6px 10px', borderRadius: 10, border: '1px solid #ddd', fontWeight: 650 }}
            >
              Edit
            </button>
          </div>
        )}
      </td>
      {confirm && (
        <td style={{ padding: 0 }}>
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 80,
            }}
            onClick={() => (busy ? null : setConfirm(null))}
          >
            <div
              style={{
                width: 520,
                maxWidth: '92vw',
                background: '#fff',
                borderRadius: 16,
                border: '1px solid rgba(0,0,0,0.12)',
                boxShadow: '0 16px 36px rgba(0,0,0,0.2)',
                padding: 20,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ fontSize: 19, fontWeight: 700, marginBottom: 10 }}>{confirm.title}</div>
              <div style={{ fontSize: 15, color: '#333', lineHeight: 1.5, marginBottom: 16 }}>
                {confirm.body}
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setConfirm(null)}
                  disabled={busy}
                  className="rf-button"
                  style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid #ddd' }}
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (busy) return
                    await confirm.onConfirm()
                    setConfirm(null)
                  }}
                  disabled={busy}
                  className="rf-button"
                  style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid #ddd', fontWeight: 650 }}
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </td>
      )}
    </tr>
  )
}
