'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '@app/lib/supabaseBrowser'

type SiteDeptRow = {
  id: string
  organization_id: string
  site: string
  department: string
  active: boolean
  created_at: string
}

type UiSiteRow = {
  key: string
  site: string
  departments: string[]
  active: boolean
}

const SESSION_RETRY_COUNT = 8
const SESSION_RETRY_DELAY_MS = 250
const QUERY_TIMEOUT_MS = 1800

export default function SettingsSitesDepartmentsPage() {
  const [orgId, setOrgId] = useState<string | null>(null)
  const [orgName, setOrgName] = useState<string | null>(null)

  const [rows, setRows] = useState<SiteDeptRow[]>([])
  const [uiRows, setUiRows] = useState<UiSiteRow[]>([])

  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const [saving, setSaving] = useState(false)

  const hasOrg = useMemo(() => !!orgId, [orgId])

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

  const normalizeText = (v: string) => v.trim()
  const uniqueList = (list: string[]) => {
    const seen = new Set<string>()
    const out: string[] = []
    list.forEach((v) => {
      const k = normalizeText(v)
      if (!k) return
      if (seen.has(k.toLowerCase())) return
      seen.add(k.toLowerCase())
      out.push(k)
    })
    return out
  }

  const toUiRows = (list: SiteDeptRow[]): UiSiteRow[] => {
    const bySite = new Map<string, { departments: string[]; activeAll: boolean }>()
    list.forEach((r) => {
      const site = normalizeText(r.site)
      if (!site) return
      const dept = normalizeText(r.department ?? '')
      const entry = bySite.get(site) ?? { departments: [], activeAll: true }
      const arr = entry.departments
      if (dept) arr.push(dept)
      if (!r.active) entry.activeAll = false
      bySite.set(site, entry)
    })
    return Array.from(bySite.entries())
      .map(([site, data]) => ({
        key: site,
        site,
        departments: uniqueList(data.departments),
        active: data.activeAll,
      }))
      .sort((a, b) => a.site.localeCompare(b.site))
  }

  async function load(foreground = true) {
    if (foreground) setLoading(true)
    setErr(null)

    const user = await getSessionUser()
    if (!user) {
      setErr('Brak zalogowanego uĹĽytkownika.')
      setLoading(false)
      return
    }

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
      setErr('UĹĽytkownik nie ma ustawionej aktywnej organizacji.')
      setLoading(false)
      return
    }

    const [orgRes, listRes] = await Promise.all([
      withTimeout(
        supabase.from('organizations').select('name').eq('id', activeOrgId).maybeSingle(),
        QUERY_TIMEOUT_MS,
        { data: null, error: new Error('timeout') } as any
      ),
      withTimeout(
        supabase
          .from('site_departments')
          .select('id, organization_id, site, department, active, created_at')
          .eq('organization_id', activeOrgId)
          .order('site', { ascending: true })
          .order('department', { ascending: true }),
        QUERY_TIMEOUT_MS,
        { data: [], error: new Error('timeout') } as any
      ),
    ])

    if (!orgRes.error) setOrgName(orgRes.data?.name ?? null)

    if (listRes.error) {
      setErr(listRes.error.message === 'timeout' ? 'Sites read timeout. Try again.' : listRes.error.message)
      setLoading(false)
      return
    }

    const nextRows = (listRes.data ?? []) as SiteDeptRow[]
    setRows(nextRows)
    setUiRows(toUiRows(nextRows))

    setLoading(false)
  }

  useEffect(() => {
    void load(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const addUiRow = () => {
    const next: UiSiteRow = { key: `new-${Date.now()}`, site: '', departments: [], active: true }
    setUiRows((prev) => [next, ...prev])
  }

  const removeUiRow = (key: string) => {
    setUiRows((prev) => prev.filter((r) => r.key !== key))
  }

  async function saveSiteRow(originalSite: string | null, site: string, departments: string[]) {
    if (!orgId) return
    const siteName = normalizeText(site)
    const deptList = uniqueList(departments)
    if (!siteName) {
      setErr('Site name is required.')
      return
    }
    if (!deptList.length) {
      setErr('Add at least one department for the site.')
      return
    }

    setSaving(true)
    setErr(null)

    if (originalSite) {
      const delRes = await supabase
        .from('site_departments')
        .delete()
        .eq('organization_id', orgId)
        .eq('site', originalSite)
      if (delRes.error) {
        setErr(delRes.error.message)
        setSaving(false)
        return
      }
    }

    const payload = deptList.map((d) => ({
      organization_id: orgId,
      site: siteName,
      department: d,
      active: true,
    }))
    const insRes = await supabase.from('site_departments').insert(payload)
    if (insRes.error) {
      setErr(insRes.error.message)
      setSaving(false)
      return
    }

    setRows((prev) => {
      const filtered = originalSite ? prev.filter((r) => r.site !== originalSite) : prev
      const nextRows: SiteDeptRow[] = payload.map((p, idx) => ({
        id: `tmp-${Date.now()}-${idx}`,
        organization_id: p.organization_id,
        site: p.site,
        department: p.department,
        active: true,
        created_at: new Date().toISOString(),
      }))
      return [...filtered, ...nextRows]
    })
    setUiRows((prev) => {
      const filtered = originalSite ? prev.filter((r) => r.site !== originalSite) : prev
      const next: UiSiteRow = { key: siteName, site: siteName, departments: deptList, active: true }
      return [next, ...filtered].sort((a, b) => a.site.localeCompare(b.site))
    })

    void load(false)
    setSaving(false)
  }

  async function deleteSite(site: string) {
    if (!orgId) return
    setSaving(true)
    setErr(null)
    const res = await supabase
      .from('site_departments')
      .delete()
      .eq('organization_id', orgId)
      .eq('site', site)
    if (res.error) {
      setErr(res.error.message)
      setSaving(false)
      return
    }
    await load(false)
    setSaving(false)
  }

  async function toggleSiteActive(site: string, active: boolean) {
    if (!orgId) return
    setSaving(true)
    setErr(null)
    const res = await supabase
      .from('site_departments')
      .update({ active })
      .eq('organization_id', orgId)
      .eq('site', site)
    if (res.error) {
      setErr(res.error.message)
      setSaving(false)
      return
    }
    setRows((prev) => prev.map((r) => (r.site === site ? { ...r, active } : r)))
    setUiRows((prev) => prev.map((r) => (r.site === site ? { ...r, active } : r)))
    setSaving(false)
  }

  const frame: React.CSSProperties = { width: '80%', marginLeft: 'auto', marginRight: 'auto' }
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

  if (loading) {
    return (
      <div style={{ ...frame, paddingTop: 20 }}>
        <div style={titleStyle}>Sites & Departments</div>
        <div style={subtitleStyle}>Loading...</div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', paddingBottom: 14 }}>
      <div
        style={{
          ...frame,
          paddingTop: 20,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div style={titleStyle}>Sites & Departments</div>
          <div style={subtitleStyle}>Define sites and their departments (each department is saved as a separate row).</div>
        </div>
        <button
          onClick={addUiRow}
          disabled={!hasOrg || saving}
          className="rf-button"
          style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid #ddd', fontWeight: 650 }}
        >
          + Add site
        </button>
      </div>

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
                {orgName ?? orgId ?? 'â€”'}
              </div>
            </div>
            <div style={{ padding: 10, borderRadius: 10, background: '#fafafa', border: '1px solid #eee' }}>
              <div style={{ fontSize: 11, color: '#666' }}>Sites</div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{uiRows.length}</div>
            </div>
            <div style={{ padding: 10, borderRadius: 10, background: '#fafafa', border: '1px solid #eee' }}>
              <div style={{ fontSize: 11, color: '#666' }}>Departments</div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{rows.length}</div>
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
          <div style={{ padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 16, fontWeight: 800 }}>Sites & Departments</div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th
                  style={{
                    textAlign: 'left',
                    padding: 10,
                    fontSize: 12,
                    color: '#333',
                    fontWeight: 650,
                    background: '#fafafa',
                    borderBottom: '1px solid rgba(0,0,0,0.06)',
                    width: 220,
                  }}
                >
                  Site
                </th>
                <th
                  style={{
                    textAlign: 'left',
                    padding: 10,
                    fontSize: 12,
                    color: '#333',
                    fontWeight: 650,
                    background: '#fafafa',
                    borderBottom: '1px solid rgba(0,0,0,0.06)',
                    width: 220,
                  }}
                >
                  Departments
                </th>
                <th
                  style={{
                    textAlign: 'left',
                    padding: 10,
                    paddingLeft: 4,
                    paddingRight: 4,
                    fontSize: 12,
                    color: '#333',
                    fontWeight: 650,
                    background: '#fafafa',
                    borderBottom: '1px solid rgba(0,0,0,0.06)',
                    width: 70,
                  }}
                >
                  Active
                </th>
                <th
                  style={{
                    textAlign: 'left',
                    padding: 10,
                    paddingLeft: 4,
                    paddingRight: 4,
                    fontSize: 12,
                    color: '#333',
                    fontWeight: 650,
                    background: '#fafafa',
                    borderBottom: '1px solid rgba(0,0,0,0.06)',
                    width: 190,
                  }}
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {uiRows.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: 12, color: '#666' }}>
                    No sites defined.
                  </td>
                </tr>
              ) : (
                uiRows.map((r) => (
                  <SiteDeptRowItem
                    key={`${r.key}:${r.departments.join('|')}:${r.active ? '1' : '0'}`}
                    row={r}
                    onSave={saveSiteRow}
                    onDelete={deleteSite}
                    onRemove={removeUiRow}
                    onToggleActive={toggleSiteActive}
                    saving={saving}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <style jsx global>{`
        .inviteTrashBtn {
          min-height: 29px;
          min-width: 36px;
          padding: 6px 10px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
          border: 1px solid #ddd;
          background: white;
          cursor: pointer;
          transition: background 0.12s ease, transform 0.06s ease;
          box-shadow: none;
        }
        .inviteTrashBtn:hover {
          background: rgba(239, 68, 68, 0.1);
        }
        .inviteTrashBtn:active {
          transform: translateY(1px);
        }
        .inviteTrashIcon {
          width: 16px;
          height: 16px;
          color: rgba(0, 0, 0, 0.65);
        }
        .inviteTrashBtn:hover .inviteTrashIcon {
          color: rgba(239, 68, 68, 0.95);
        }
        .inviteTrashBtn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  )
}

function SiteDeptRowItem({
  row,
  onSave,
  onDelete,
  onRemove,
  onToggleActive,
  saving,
}: {
  row: UiSiteRow
  onSave: (originalSite: string | null, site: string, departments: string[]) => Promise<void>
  onDelete: (site: string) => Promise<void>
  onRemove: (key: string) => void
  onToggleActive: (site: string, active: boolean) => Promise<void>
  saving: boolean
}) {
  const [edit, setEdit] = useState(row.site.trim().length === 0)
  const [site, setSite] = useState(row.site)
  const [departmentsText, setDepartmentsText] = useState((row.departments ?? []).join(', '))
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState<null | { title: string; body: string; onConfirm: () => Promise<void> }>(null)

  const normalize = (v: string) => v.trim()

  async function save() {
    if (busy || saving) return
    setBusy(true)
    const siteName = normalize(site)
    const deptList = departmentsText
      .split(/[,;\n]+/)
      .map((d) => normalize(d))
      .filter(Boolean)
    await onSave(row.site || null, siteName, deptList)
    setBusy(false)
    setEdit(false)
  }

  return (
    <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
      <td style={{ padding: 10, verticalAlign: 'middle' }}>
        {edit ? (
          <input
            value={site}
            onChange={(e) => setSite(e.target.value)}
            placeholder="Site name..."
            style={{ width: '100%', padding: '6px 8px', borderRadius: 10, border: '1px solid #ddd' }}
          />
        ) : (
          <div style={{ fontWeight: 700 }}>{row.site}</div>
        )}
      </td>
      <td style={{ padding: 10, verticalAlign: 'top' }}>
        {edit ? (
          <input
            value={departmentsText}
            onChange={(e) => setDepartmentsText(e.target.value)}
            placeholder="Add departments, separated by commas"
            style={{ width: '100%', padding: '6px 8px', borderRadius: 10, border: '1px solid #ddd' }}
          />
        ) : (
          <div style={{ color: '#666', fontSize: 12 }}>{row.departments.join(', ')}</div>
        )}
      </td>
      <td style={{ padding: 10, paddingLeft: 4, paddingRight: 4, verticalAlign: 'middle' }}>
        <button
          onClick={() => onToggleActive(row.site, !row.active)}
          disabled={saving}
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
      <td style={{ padding: 10, paddingLeft: 4, paddingRight: 4, verticalAlign: 'middle' }}>
        {edit ? (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-start', alignItems: 'center' }}>
            <button
              onClick={save}
              disabled={busy || saving}
              className="rf-button"
              style={{ padding: '6px 10px', borderRadius: 10, border: '1px solid #ddd', fontWeight: 650 }}
            >
              Save
            </button>
            <button
              onClick={() => {
                if (!row.site) onRemove(row.key)
                else setEdit(false)
              }}
              disabled={busy || saving}
              className="rf-button"
              style={{ padding: '6px 10px', borderRadius: 10, border: '1px solid #ddd' }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-start', alignItems: 'center' }}>
            <button
              onClick={() => setEdit(true)}
              className="rf-button"
              style={{ padding: '6px 10px', borderRadius: 10, border: '1px solid #ddd', fontWeight: 650 }}
            >
              Edit
            </button>
            <button
              onClick={() =>
                setConfirm({
                  title: 'Caution',
                  body: 'This will delete the site and all its departments. This action cannot be undone.',
                  onConfirm: async () => {
                    setBusy(true)
                    await onDelete(row.site)
                    setBusy(false)
                  },
                })
              }
              disabled={saving}
              className="inviteTrashBtn"
              aria-label="Delete site"
              title="Delete site"
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

