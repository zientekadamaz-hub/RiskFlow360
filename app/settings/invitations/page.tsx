'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '@app/lib/supabaseBrowser'

type AppRole = 'admin' | 'champion' | 'engineer' | 'viewer' | 'customer' | string
type InviteStatus = 'PENDING' | 'ACTIVE' | 'NOACTIVE' | 'EXPIRED' | string

type LicenseRow = {
  invites_allowed_total: number | null
  valid_to: string | null
}

type InviteRow = {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  role: AppRole
  status: InviteStatus
  created_at: string | null
  accepted_at: string | null
}

type HeaderRpcRow = {
  org_name?: string | null
  org_role?: string | null
  global_role?: AppRole | null
}

type TimeoutErrorResult = {
  data: null
  error: Error
  count: null
  status: number
  statusText: string
}

type ActiveProfileRow = {
  active_organization_id?: string | null
}

const SESSION_RETRY_COUNT = 8
const SESSION_RETRY_DELAY_MS = 250
const QUERY_TIMEOUT_MS = 1800
const DATA_QUERY_RETRY_COUNT = 3
const DATA_QUERY_RETRY_DELAY_MS = 250
const INVITATIONS_CACHE_KEY = '__INVITATIONS_CACHE__'
const INVITATIONS_CACHE_TTL_MS = 5 * 60 * 1000

function normalizeText(value: string | null | undefined) {
  return (value ?? '').toString().trim()
}

function formatDateTime(value: string | null) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleString('pl-PL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function displayStatus(row: InviteRow) {
  const raw = normalizeText(row.status).toUpperCase()
  return raw || '-'
}

function formatRole(role: AppRole) {
  const raw = normalizeText(role).toLowerCase()
  if (!raw) return '-'
  return raw.toUpperCase()
}

export default function InvitationsPage() {
  const [orgId, setOrgId] = useState<string | null>(null)
  const [orgName, setOrgName] = useState<string | null>(null)
  const [orgRole, setOrgRole] = useState<AppRole | null>(null)
  const [globalRole, setGlobalRole] = useState<AppRole | null>(null)

  const [license, setLicense] = useState<LicenseRow | null>(null)
  const [invites, setInvites] = useState<InviteRow[]>([])

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [sending, setSending] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [role, setRole] = useState<AppRole>('engineer')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editEmail, setEditEmail] = useState('')
  const [editFirstName, setEditFirstName] = useState('')
  const [editLastName, setEditLastName] = useState('')
  const [editRole, setEditRole] = useState<AppRole>('engineer')
  const [rowBusyId, setRowBusyId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'ACTIVE' | 'NOACTIVE'>('ALL')
  const [search, setSearch] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<InviteRow | null>(null)

  const canInviteChampion = orgRole === 'admin' || orgRole === 'champion' || globalRole === 'admin'
  const allowedRoles = useMemo<AppRole[]>(
    () => (canInviteChampion ? ['engineer', 'viewer', 'champion'] : ['engineer', 'viewer']),
    [canInviteChampion]
  )

  const usedSeats = useMemo(() => invites.filter((i) => ['PENDING', 'ACTIVE'].includes(displayStatus(i))).length, [invites])
  const allowedSeats = license?.invites_allowed_total ?? null
  const freeSeats = allowedSeats === null ? null : Math.max(0, allowedSeats - usedSeats)
  const validToText = useMemo(() => {
    if (!license?.valid_to) return '-'
    const d = new Date(license.valid_to)
    if (Number.isNaN(d.getTime())) return '-'
    return d.toLocaleDateString('pl-PL', { year: 'numeric', month: '2-digit', day: '2-digit' })
  }, [license?.valid_to])

  const canSend = !!orgId && !!email.trim() && !!firstName.trim() && !!lastName.trim() && !sending
  const canSendWithLicense = freeSeats === null ? canSend : canSend && freeSeats > 0

  const filteredInvites = useMemo(() => {
    const q = search.trim().toLowerCase()
    return invites.filter((row) => {
      const matchesStatus = statusFilter === 'ALL' ? true : displayStatus(row) === statusFilter
      if (!matchesStatus) return false
      if (!q) return true
      const haystack = [row.first_name, row.last_name, row.email, row.role, row.status].map((v) =>
        normalizeText(String(v ?? '')).toLowerCase()
      )
      return haystack.some((part) => part.includes(q))
    })
  }, [invites, search, statusFilter])

  const pendingCount = useMemo(() => invites.filter((i) => displayStatus(i) === 'PENDING').length, [invites])
  const activeCount = useMemo(() => invites.filter((i) => displayStatus(i) === 'ACTIVE').length, [invites])
  const inactiveCount = useMemo(() => invites.filter((i) => displayStatus(i) === 'NOACTIVE').length, [invites])

  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))
  const withTimeout = async <T, F>(p: PromiseLike<T>, ms: number, fallback: F): Promise<T | F> => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    try {
      return await Promise.race([
        p,
        new Promise<F>((resolve) => {
          timeoutId = setTimeout(() => resolve(fallback), ms)
        }),
      ])
    } finally {
      if (timeoutId) clearTimeout(timeoutId)
    }
  }
  const isTimeoutErr = (e: unknown) => {
    const msg = e instanceof Error ? e.message.toLowerCase() : ''
    return msg.includes('timeout')
  }
  const mapDataError = (e: unknown, fallback: string) => {
    if (isTimeoutErr(e)) return `${fallback} timeout. Try again.`
    return e instanceof Error ? e.message : fallback
  }
  const timeoutResult = (): TimeoutErrorResult => ({
    data: null,
    error: new Error('timeout'),
    count: null,
    status: 408,
    statusText: 'timeout',
  })
  const readCache = () => {
    if (typeof window === 'undefined') return null
    try {
      const raw = window.sessionStorage.getItem(INVITATIONS_CACHE_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw) as {
        ts?: number
        orgId?: string | null
        orgName?: string | null
        orgRole?: AppRole | null
        globalRole?: AppRole | null
        license?: LicenseRow | null
        invites?: InviteRow[]
      }
      if (!parsed || typeof parsed.ts !== 'number') return null
      if (Date.now() - parsed.ts > INVITATIONS_CACHE_TTL_MS) return null
      return parsed
    } catch {
      return null
    }
  }
  const writeCache = (data: {
    orgId: string | null
    orgName: string | null
    orgRole: AppRole | null
    globalRole: AppRole | null
    license: LicenseRow | null
    invites: InviteRow[]
  }) => {
    if (typeof window === 'undefined') return
    try {
      window.sessionStorage.setItem(INVITATIONS_CACHE_KEY, JSON.stringify({ ...data, ts: Date.now() }))
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

  useEffect(() => {
    let mounted = true

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (!mounted) return
      if (event === 'SIGNED_OUT') {
        try {
          window.sessionStorage.removeItem(INVITATIONS_CACHE_KEY)
        } catch {}
        window.location.assign('/')
      }
    })

    return () => {
      mounted = false
      try {
        sub?.subscription?.unsubscribe?.()
      } catch {}
    }
  }, [])

  function mapInviteError(message: string) {
    const m = message.toLowerCase()
    if (m.includes('license') || m.includes('limit') || m.includes('seats')) {
      return 'License limit reached for your organization.'
    }
    if (m.includes('already exists') && m.includes('email')) {
      return 'A user with this email already exists. Use a different email address.'
    }
    if (m.includes('invitation') && (m.includes('exists') || m.includes('duplicate') || m.includes('unique'))) {
      return 'An invitation for this email already exists in your organization.'
    }
    if (m.includes('duplicate') && m.includes('organization')) {
      return 'An invitation for this email already exists in your organization.'
    }
    return message
  }

  async function loadLicense(activeOrgId: string) {
    for (let i = 0; i < DATA_QUERY_RETRY_COUNT; i += 1) {
      const res = await withTimeout(
        supabase
          .from('organization_license')
          .select('invites_allowed_total, valid_to')
          .eq('organization_id', activeOrgId)
          .maybeSingle(),
        QUERY_TIMEOUT_MS,
        timeoutResult()
      )
      if (!res.error) {
        const nextLicense = (res.data as LicenseRow) ?? null
        setLicense(nextLicense)
        return nextLicense
      }
      if (i < DATA_QUERY_RETRY_COUNT - 1) {
        await delay(DATA_QUERY_RETRY_DELAY_MS)
        continue
      }
      setErr((prev) => prev ?? mapDataError(res.error, 'License read failed'))
      return undefined
    }
    return undefined
  }

  async function loadInvites(activeOrgId: string) {
    for (let i = 0; i < DATA_QUERY_RETRY_COUNT; i += 1) {
      const res = await withTimeout(
        supabase
          .from('organization_invitations')
          .select('id, email, first_name, last_name, role, status, created_at, accepted_at')
          .eq('organization_id', activeOrgId)
          .order('created_at', { ascending: false }),
        QUERY_TIMEOUT_MS,
        timeoutResult()
      )
      if (!res.error) {
        const nextInvites = (res.data ?? []) as InviteRow[]
        setInvites(nextInvites)
        return nextInvites
      }
      if (i < DATA_QUERY_RETRY_COUNT - 1) {
        await delay(DATA_QUERY_RETRY_DELAY_MS)
        continue
      }
      setErr((prev) => prev ?? mapDataError(res.error, 'Invitations read failed'))
      return undefined
    }
    return undefined
  }

  async function loadAll(options?: { foreground?: boolean }) {
    const foreground = options?.foreground ?? true
    if (foreground) setLoading(true)
    else setRefreshing(true)
    setErr(null)

    const user = await getSessionUser()
    if (!user) {
      window.location.assign('/')
      return
    }

    const profileRes = await withTimeout(
      supabase.from('profiles').select('active_organization_id').eq('id', user.id).maybeSingle(),
      QUERY_TIMEOUT_MS,
      timeoutResult()
    )

    if (profileRes.error) {
      setErr(profileRes.error.message === 'timeout' ? 'Session read timeout. Try again.' : profileRes.error.message)
      setLoading(false)
      setRefreshing(false)
      return
    }

    const activeOrgId = (profileRes.data as ActiveProfileRow | null)?.active_organization_id ?? null
    setOrgId(activeOrgId)

    if (!activeOrgId) {
      setErr('User has no active organization.')
      setLoading(false)
      setRefreshing(false)
      return
    }

    let nextOrgName: string | null = null
    let nextOrgRole: AppRole | null = null
    let nextGlobalRole: AppRole | null = null

    const headerTask = (async () => {
      const headerRes = await withTimeout(
        supabase.rpc('get_my_header').maybeSingle(),
        QUERY_TIMEOUT_MS,
        timeoutResult()
      )

      if (!headerRes.error && headerRes.data) {
        const h = headerRes.data as HeaderRpcRow
        nextOrgName = h.org_name ?? null
        nextOrgRole = (h.org_role as AppRole | null) ?? null
        nextGlobalRole = (h.global_role as AppRole | null) ?? null
        setOrgName(nextOrgName)
        setOrgRole(nextOrgRole)
        setGlobalRole(nextGlobalRole)
        return { orgName: nextOrgName, orgRole: nextOrgRole, globalRole: nextGlobalRole }
      }

      const orgRes = await withTimeout(
        supabase.from('organizations').select('name').eq('id', activeOrgId).maybeSingle(),
        QUERY_TIMEOUT_MS,
        timeoutResult()
      )
      if (!orgRes.error) {
        nextOrgName = orgRes.data?.name ?? null
        setOrgName(nextOrgName)
      }
      return { orgName: nextOrgName, orgRole: nextOrgRole, globalRole: nextGlobalRole }
    })()

    const [licenseData, invitesData] = await Promise.all([loadLicense(activeOrgId), loadInvites(activeOrgId)])
    setLoading(false)
    setRefreshing(false)

    if (licenseData !== undefined && invitesData !== undefined) {
      writeCache({
        orgId: activeOrgId,
        orgName: nextOrgName,
        orgRole: nextOrgRole,
        globalRole: nextGlobalRole,
        license: licenseData ?? null,
        invites: invitesData,
      })
    }

    void headerTask.then((h) => {
      if (licenseData === undefined || invitesData === undefined) return
      writeCache({
        orgId: activeOrgId,
        orgName: h.orgName ?? null,
        orgRole: h.orgRole ?? null,
        globalRole: h.globalRole ?? null,
        license: licenseData ?? null,
        invites: invitesData,
      })
    })
  }

  useEffect(() => {
    const cached = readCache()
    if (cached) {
      setOrgId(cached.orgId ?? null)
      setOrgName(cached.orgName ?? null)
      setOrgRole(cached.orgRole ?? null)
      setGlobalRole(cached.globalRole ?? null)
      setLicense(cached.license ?? null)
      setInvites(Array.isArray(cached.invites) ? cached.invites : [])
      setLoading(false)
      void loadAll({ foreground: false })
    } else {
      void loadAll({ foreground: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!orgId || loading) return
    writeCache({ orgId, orgName, orgRole, globalRole, license, invites })
  }, [orgId, orgName, orgRole, globalRole, license, invites, loading])

  async function sendInvite() {
    setErr(null)
    setOk(null)
    if (!orgId || !email.trim()) return
    if (!firstName.trim() || !lastName.trim()) return

    if (freeSeats !== null && freeSeats <= 0) {
      setErr('License limit reached for your organization.')
      return
    }

    setSending(true)
    const { data, error } = await supabase.rpc('create_org_invitation', {
      p_org: orgId,
      p_email: email.trim(),
      p_role: role,
    })

    if (error) {
      setErr(mapInviteError(error.message))
      setSending(false)
      return
    }

    const created = Array.isArray(data) ? data[0] : data
    if (created?.id) {
      const upd = await supabase
        .from('organization_invitations')
        .update({ first_name: firstName.trim(), last_name: lastName.trim() })
        .eq('id', created.id)
      if (upd.error) {
        setErr(upd.error.message)
        setSending(false)
        return
      }
    }

    setOk('Invitation sent. Status: PENDING.')
    setEmail('')
    setFirstName('')
    setLastName('')
    await Promise.all([loadLicense(orgId), loadInvites(orgId)])
    setSending(false)
  }

  function startEdit(row: InviteRow) {
    setEditingId(row.id)
    setEditEmail(row.email)
    setEditFirstName(row.first_name ?? '')
    setEditLastName(row.last_name ?? '')
    setEditRole(row.role)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditEmail('')
    setEditFirstName('')
    setEditLastName('')
    setEditRole('engineer')
  }

  async function saveEdit(row: InviteRow) {
    const nextEmail = editEmail.trim()
    const nextFirst = editFirstName.trim()
    const nextLast = editLastName.trim()
    if (!nextEmail || !nextFirst || !nextLast) return

    setErr(null)
    setOk(null)
    setRowBusyId(row.id)

    const res = await supabase
      .from('organization_invitations')
      .update({ email: nextEmail, role: editRole, first_name: nextFirst, last_name: nextLast })
      .eq('id', row.id)

    if (res.error) {
      setErr(mapInviteError(res.error.message))
      setRowBusyId(null)
      return
    }

    setInvites((prev) =>
      prev.map((r) =>
        r.id === row.id ? { ...r, email: nextEmail, role: editRole, first_name: nextFirst, last_name: nextLast } : r
      )
    )
    setOk('Invitation updated.')
    setRowBusyId(null)
    cancelEdit()
  }

  async function updateStatus(row: InviteRow, nextStatus: 'NOACTIVE' | 'ACTIVE' | 'PENDING') {
    setErr(null)
    setOk(null)
    setRowBusyId(row.id)

    const { error } = await supabase.rpc('set_invitation_status', {
      p_invite_id: row.id,
      p_status: nextStatus,
    })

    if (error) {
      setErr(mapInviteError(error.message))
      setRowBusyId(null)
      return
    }

    setInvites((prev) => prev.map((r) => (r.id === row.id ? { ...r, status: nextStatus } : r)))
    setOk(nextStatus === 'NOACTIVE' ? 'Invitation deactivated.' : 'Invitation activated.')
    setRowBusyId(null)
  }

  async function resendInvite(row: InviteRow) {
    setErr(null)
    setOk(null)
    setRowBusyId(row.id)

    const res = await supabase
      .from('organization_invitations')
      .update({ status: 'PENDING' })
      .eq('id', row.id)

    if (res.error) {
      setErr(mapInviteError(res.error.message))
      setRowBusyId(null)
      return
    }

    setInvites((prev) => prev.map((r) => (r.id === row.id ? { ...r, status: 'PENDING' } : r)))
    setOk('Invitation resent (status set to PENDING).')
    setRowBusyId(null)
  }

  async function confirmDeleteInvite(row: InviteRow) {
    setErr(null)
    setOk(null)
    setRowBusyId(row.id)

    const res = await supabase.from('organization_invitations').delete().eq('id', row.id)
    if (res.error) {
      setErr(mapInviteError(res.error.message))
      setRowBusyId(null)
      return
    }

    setInvites((prev) => prev.filter((r) => r.id !== row.id))
    setOk('Invitation deleted.')
    setConfirmDelete(null)
    if (orgId) await loadLicense(orgId)
    setRowBusyId(null)
  }

  const hairline = 0.5
  const surfaceRadius = 8
  const sharedOverlayBorder = 'rgba(255,255,255,0.16)'
  const sharedOverlayBg = 'rgb(40, 39, 47)'

  const page: React.CSSProperties = {
    minHeight: '100vh',
    paddingBottom: 14,
    position: 'relative',
    overflow: 'hidden',
    background: '#171f33',
    color: '#f8fafc',
    fontFamily: 'Arial, sans-serif',
  }

  const frame: React.CSSProperties = {
    width: '94%',
    marginLeft: 'auto',
    marginRight: 'auto',
  }

  const card: React.CSSProperties = {
    background: 'rgba(255,255,255,0.08)',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: sharedOverlayBorder,
    borderRadius: surfaceRadius,
    boxShadow: '0 18px 40px rgba(0,0,0,0.18)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
  }

  const heroCard: React.CSSProperties = {
    ...card,
    background: 'rgba(255,255,255,0.08)',
    borderStyle: 'solid',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: surfaceRadius,
    boxShadow: '0 18px 40px rgba(0,0,0,0.18)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
  }

  const titleStyle: React.CSSProperties = { fontSize: 28, fontWeight: 700, letterSpacing: -0.3, color: '#fff' }
  const subtitleStyle: React.CSSProperties = { marginTop: 4, fontSize: 13, color: 'rgba(255,255,255,0.72)' }
  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 0.5,
    color: 'rgba(255,255,255,0.64)',
    textTransform: 'uppercase',
  }
  const statValue: React.CSSProperties = { marginTop: 6, fontSize: 24, fontWeight: 800, color: '#fff' }
  const summaryTile: React.CSSProperties = {
    minHeight: 82,
    padding: '10px 12px',
    borderRadius: surfaceRadius,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    textAlign: 'center',
  }
  const buttonBase: React.CSSProperties = { fontFamily: 'inherit' }
  const actionBtn: React.CSSProperties = {
    ...buttonBase,
    padding: '6px 10px',
    borderRadius: surfaceRadius,
    border: '1px solid rgba(255,255,255,0.2)',
    fontWeight: 650,
    fontSize: 12,
    cursor: 'pointer',
    minHeight: 30,
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
    cursor: 'pointer',
    padding: '0 12px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  }
  const inputSm: React.CSSProperties = {
    height: 36,
    borderRadius: surfaceRadius,
    border: `1px solid ${sharedOverlayBorder}`,
    padding: '0 10px',
    fontSize: 13,
    color: '#fff',
    background: 'rgba(255,255,255,0.06)',
    outline: 'none',
    width: '100%',
  }
  const th: React.CSSProperties = {
    textAlign: 'left',
    padding: '10px 12px',
    fontSize: 12,
    color: 'rgba(255,255,255,0.72)',
    fontWeight: 700,
    background: 'rgba(255,255,255,0.06)',
    borderBottom: `1px solid rgba(255,255,255,${hairline * 0.28})`,
    whiteSpace: 'nowrap',
  }
  const td: React.CSSProperties = {
    padding: '10px 12px',
    verticalAlign: 'middle',
    fontSize: 13,
    color: '#fff',
    borderBottom: `1px solid rgba(255,255,255,${hairline * 0.22})`,
  }
  const statusPill = (status: string): React.CSSProperties => {
    const s = normalizeText(status).toUpperCase()
    const base: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 28,
      padding: '4px 10px',
      borderRadius: surfaceRadius,
      border: `1px solid ${sharedOverlayBorder}`,
      fontSize: 12,
      fontWeight: 800,
      letterSpacing: 0.3,
    }
    if (s === 'ACTIVE') return { ...base, color: '#bbf7d0', background: 'rgba(22,163,74,0.18)', borderColor: 'rgba(74,222,128,0.36)' }
    if (s === 'PENDING') return { ...base, color: '#fde68a', background: 'rgba(217,119,6,0.18)', borderColor: 'rgba(251,191,36,0.34)' }
    if (s === 'NOACTIVE') return { ...base, color: '#fecaca', background: 'rgba(239,68,68,0.18)', borderColor: 'rgba(248,113,113,0.34)' }
    return { ...base, color: '#e5e7eb', background: 'rgba(148,163,184,0.14)', borderColor: 'rgba(203,213,225,0.24)' }
  }
  const rolePill = (): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 28,
    padding: '4px 10px',
    borderRadius: surfaceRadius,
    border: `1px solid ${sharedOverlayBorder}`,
    background: 'rgba(59,130,246,0.15)',
    color: '#dbeafe',
    fontWeight: 700,
    fontSize: 12,
    letterSpacing: 0.25,
  })

  if (loading) {
    return (
      <div style={page}>
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
            <div style={titleStyle}>Invitations</div>
            <div style={subtitleStyle}>Loading invitations and license usage...</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={page}>
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
                <div style={titleStyle}>Invitations</div>
                <div style={subtitleStyle}>
                  Manage access for your organization in the same workflow style as the Projects view.
                  {refreshing ? <span style={{ marginLeft: 8, color: 'rgba(255,255,255,0.78)' }}>Refreshing...</span> : null}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                  <button
                    onClick={() => void loadAll({ foreground: false })}
                    disabled={refreshing}
                    className="rf-button"
                    style={{ ...buttonPrimary, opacity: refreshing ? 0.6 : 1 }}
                  >
                    {refreshing ? 'Refreshing...' : 'Refresh'}
                  </button>
                  <button
                    onClick={() => {
                      setErr(null)
                      setOk(null)
                    }}
                    className="rf-button"
                    style={buttonPrimary}
                  >
                    Clear messages
                  </button>
                </div>
              </div>

              <div
                style={{
                  width: '100%',
                  maxWidth: 920,
                  marginLeft: 'auto',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
                  gap: 10,
                  alignSelf: 'flex-start',
                }}
              >
                <div style={{ ...summaryTile, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.22)' }}>
                  <div style={{ fontSize: 12, color: '#f8fafc' }}>Organization</div>
                  <div style={{ ...statValue, fontSize: 18, lineHeight: 1.25, wordBreak: 'break-word' }}>{orgName ?? orgId ?? '-'}</div>
                </div>
                <div style={{ ...summaryTile, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.22)' }}>
                  <div style={{ fontSize: 12, color: '#f8fafc' }}>Allowed seats</div>
                  <div style={statValue}>{allowedSeats ?? '-'}</div>
                </div>
                <div style={{ ...summaryTile, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.22)' }}>
                  <div style={{ fontSize: 12, color: '#f8fafc' }}>Used seats</div>
                  <div style={statValue}>{usedSeats}</div>
                </div>
                <div style={{ ...summaryTile, background: 'rgba(34,197,94,0.18)', border: '1px solid rgba(34,197,94,0.45)' }}>
                  <div style={{ fontSize: 12, color: '#f8fafc' }}>Free seats</div>
                  <div style={statValue}>{freeSeats ?? '-'}</div>
                </div>
                <div style={{ ...summaryTile, background: 'rgba(251,146,60,0.18)', border: '1px solid rgba(251,146,60,0.45)' }}>
                  <div style={{ fontSize: 12, color: '#f8fafc' }}>License valid to</div>
                  <div style={{ ...statValue, fontSize: 20 }}>{validToText}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ ...frame, marginTop: 12 }}>
        <div style={{ ...card, padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>Send invitation</div>
              <div style={{ marginTop: 4, fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
                Invite engineers, viewers and, if permitted, champions.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span style={statusPill('ACTIVE')}>ACTIVE {activeCount}</span>
              <span style={statusPill('PENDING')}>PENDING {pendingCount}</span>
              <span style={statusPill('NOACTIVE')}>NOACTIVE {inactiveCount}</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, alignItems: 'end' }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={labelStyle}>First Name</span>
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" style={inputSm} />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={labelStyle}>Last Name</span>
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" style={inputSm} />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={labelStyle}>Email</span>
              <input value={email} onChange={(e) => setEmail(e.target.value.toLowerCase())} placeholder="user@example.com" style={inputSm} />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={labelStyle}>Role</span>
              <select value={role} onChange={(e) => setRole(e.target.value as AppRole)} style={inputSm} className="inviteSelect">
                {allowedRoles.map((r) => (
                  <option key={r} value={r}>
                    {formatRole(r)}
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={sendInvite}
              disabled={!canSendWithLicense}
              className="rf-button"
              style={{ ...buttonPrimary, height: 36, opacity: canSendWithLicense ? 1 : 0.55 }}
            >
              {sending ? 'Sending...' : 'Send'}
            </button>
          </div>

          {freeSeats !== null && freeSeats <= 0 ? (
            <div style={{ marginTop: 10, fontSize: 12, color: '#fecaca' }}>License limit reached for your organization.</div>
          ) : null}
        </div>
      </div>

      <div style={{ ...frame, marginTop: 12 }}>
        <div style={{ ...card, padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>Invitation list</div>
              <div style={{ marginTop: 4, fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
                Track pending, active and deactivated invitations.
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email or role" style={{ ...inputSm, width: 220 }} />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                style={{ ...inputSm, width: 150 }}
                className="inviteSelect"
              >
                <option value="ALL">ALL STATUSES</option>
                <option value="PENDING">PENDING</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="NOACTIVE">NOACTIVE</option>
              </select>
            </div>
          </div>

          <div style={{ marginTop: 12, overflowX: 'auto', borderRadius: surfaceRadius, border: `1px solid ${sharedOverlayBorder}` }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980, background: 'rgba(255,255,255,0.04)' }}>
              <thead>
                <tr>
                  <th style={th}>First name</th>
                  <th style={th}>Last name</th>
                  <th style={th}>Email</th>
                  <th style={th}>Role</th>
                  <th style={th}>Status</th>
                  <th style={th}>Sent</th>
                  <th style={th}>Accepted</th>
                  <th style={{ ...th, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvites.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ ...td, padding: 14, color: 'rgba(255,255,255,0.72)' }}>
                      No invitations match the current filters.
                    </td>
                  </tr>
                ) : (
                  filteredInvites.map((row) => {
                    const busy = rowBusyId === row.id
                    const editing = editingId === row.id
                    const nextActivationStatus: 'ACTIVE' | 'PENDING' = row.accepted_at ? 'ACTIVE' : 'PENDING'

                    return (
                      <tr key={row.id} className="rowHover">
                        <td style={td}>{editing ? <input value={editFirstName} onChange={(e) => setEditFirstName(e.target.value)} style={inputSm} /> : normalizeText(row.first_name) || '-'}</td>
                        <td style={td}>{editing ? <input value={editLastName} onChange={(e) => setEditLastName(e.target.value)} style={inputSm} /> : normalizeText(row.last_name) || '-'}</td>
                        <td style={{ ...td, minWidth: 220 }}>
                          {editing ? <input value={editEmail} onChange={(e) => setEditEmail(e.target.value.toLowerCase())} style={inputSm} /> : <span style={{ color: 'rgba(255,255,255,0.78)' }}>{row.email}</span>}
                        </td>
                        <td style={td}>
                          {editing ? (
                            <select value={editRole} onChange={(e) => setEditRole(e.target.value as AppRole)} style={inputSm} className="inviteSelect">
                              {allowedRoles.map((allowedRole) => (
                                <option key={allowedRole} value={allowedRole}>
                                  {formatRole(allowedRole)}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span style={rolePill()}>{formatRole(row.role)}</span>
                          )}
                        </td>
                        <td style={td}>
                          <span style={statusPill(displayStatus(row))}>{displayStatus(row)}</span>
                        </td>
                        <td style={{ ...td, color: 'rgba(255,255,255,0.72)' }}>{formatDateTime(row.created_at)}</td>
                        <td style={{ ...td, color: 'rgba(255,255,255,0.72)' }}>{formatDateTime(row.accepted_at)}</td>
                        <td style={{ ...td, textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
                            {editing ? (
                              <>
                                <button onClick={() => saveEdit(row)} disabled={busy} className="rf-button" style={{ ...actionBtn, opacity: busy ? 0.6 : 1 }}>
                                  Save
                                </button>
                                <button onClick={cancelEdit} disabled={busy} className="rf-button" style={actionBtn}>
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => startEdit(row)} disabled={busy} className="rf-button" style={actionBtn}>
                                  Edit
                                </button>
                                {displayStatus(row) === 'NOACTIVE' ? (
                                  <button onClick={() => updateStatus(row, nextActivationStatus)} disabled={busy} className="rf-button" style={actionBtn}>
                                    Activate
                                  </button>
                                ) : (
                                  <button onClick={() => updateStatus(row, 'NOACTIVE')} disabled={busy} className="rf-button" style={actionBtn}>
                                    Deactivate
                                  </button>
                                )}
                                <button onClick={() => resendInvite(row)} disabled={busy} className="rf-button" style={actionBtn}>
                                  Resend
                                </button>
                                <button onClick={() => setConfirmDelete(row)} disabled={busy} className="inviteTrashBtn" aria-label="Delete invitation" title="Delete invitation">
                                  <svg className="inviteTrashIcon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                    <path d="M9 3h6m-8 4h10m-9 0 1 15h6l1-15M10 7v13m4-13v13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {err && (
        <div style={{ ...frame, marginTop: 12 }}>
          <div
            style={{
              fontSize: 12,
              padding: '10px 12px',
              borderRadius: surfaceRadius,
              background: 'rgba(127, 29, 29, 0.42)',
              color: '#fee2e2',
              borderStyle: 'solid',
              borderWidth: 1,
              borderColor: 'rgba(248,113,113,0.35)',
            }}
          >
            <b>Error:</b> {err}
          </div>
        </div>
      )}

      {ok && (
        <div style={{ ...frame, marginTop: 12 }}>
          <div
            style={{
              fontSize: 12,
              padding: '10px 12px',
              borderRadius: surfaceRadius,
              background: 'rgba(20, 83, 45, 0.42)',
              color: '#dcfce7',
              borderStyle: 'solid',
              borderWidth: 1,
              borderColor: 'rgba(74,222,128,0.35)',
            }}
          >
            {ok}
          </div>
        </div>
      )}

      {confirmDelete && (
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
          onClick={() => (rowBusyId ? null : setConfirmDelete(null))}
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
            <div style={{ fontSize: 19, fontWeight: 700, marginBottom: 10, color: '#fff' }}>Delete invitation</div>
            <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.8)', lineHeight: 1.5, marginBottom: 10 }}>
              Are you sure you want to delete invitation for <b>{confirmDelete.email}</b>? This user will be removed from all data they authored.
            </div>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.4, color: '#ef4444', marginBottom: 16 }}>
              DATA WILL BE PERMANENTLY LOST
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => (rowBusyId ? null : setConfirmDelete(null))}
                disabled={!!rowBusyId}
                className="rf-button"
                style={{ padding: '8px 12px', borderRadius: surfaceRadius, border: `1px solid ${sharedOverlayBorder}` }}
              >
                Cancel
              </button>
              <button
                onClick={() => void confirmDeleteInvite(confirmDelete)}
                disabled={!!rowBusyId}
                className="rf-button"
                style={{ padding: '8px 12px', borderRadius: surfaceRadius, border: `1px solid ${sharedOverlayBorder}`, fontWeight: 650 }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .rowHover:hover {
          background: rgba(255, 255, 255, 0.06) !important;
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
          min-height: 30px;
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
        .inviteSelect option {
          color: #f8fafc;
          background: rgb(40, 39, 47);
        }
      `}</style>
    </div>
  )
}
