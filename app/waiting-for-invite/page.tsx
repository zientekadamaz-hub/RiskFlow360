'use client'

import React, { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@app/lib/supabaseBrowser'
import { fetchInvitationPreview, type InvitationPreview } from '@/lib/auth/invitation-auth'
import { buildLoginRedirect } from '@/lib/routing'

function normalizeToken(value: string | null) {
  const next = value?.trim() ?? ''
  return next || null
}

function WaitingForInvitePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [acceptAttemptedFor, setAcceptAttemptedFor] = useState<string | null>(null)
  const [preview, setPreview] = useState<InvitationPreview | null>(null)

  const token = useMemo(() => normalizeToken(searchParams.get('token')), [searchParams])
  const isAuthenticated = !!email
  const loginHref = useMemo(
    () => buildLoginRedirect('/waiting-for-invite', token ? `?token=${encodeURIComponent(token)}` : ''),
    [token]
  )

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const { data } = await supabase.auth.getSession()
      const sessionEmail = data?.session?.user?.email ?? null
      if (mounted) setEmail(sessionEmail)
    })()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    if (!token) {
      setPreview(null)
      return
    }

    const loadPreview = async () => {
      try {
        const nextPreview = await fetchInvitationPreview(supabase, token)
        if (cancelled) return
        setPreview(nextPreview)
      } catch (error) {
        if (cancelled) return
        setPreview(null)
        setErr((current) => current || (error instanceof Error ? error.message : 'Invitation could not be loaded.'))
      }
    }

    void loadPreview()

    return () => {
      cancelled = true
    }
  }, [token])

  useEffect(() => {
    if (!token || !isAuthenticated || acceptAttemptedFor === token) return

    let cancelled = false

    const run = async () => {
      setAcceptAttemptedFor(token)
      setLoading(true)
      setErr('')
      setMsg('')
      try {
        const { error } = await supabase.rpc('accept_invitation', { p_token: token })
        if (cancelled) return
        if (error) {
          setErr(error.message)
          return
        }
        setMsg('Invitation accepted. Redirecting to the application...')
        router.replace('/')
        router.refresh()
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [acceptAttemptedFor, isAuthenticated, router, token])

  async function onLogout() {
    setLoading(true)
    try {
      await supabase.auth.signOut()
    } finally {
      router.replace('/login')
      router.refresh()
      setLoading(false)
    }
  }

  async function retryAccept() {
    if (!token || !isAuthenticated) return
    setAcceptAttemptedFor(null)
    setErr('')
    setMsg('')
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 56px)', padding: 24, background: '#f6f6f7' }}>
      <div
        style={{
          width: 'min(820px, 100%)',
          boxSizing: 'border-box',
          margin: '0 auto',
          borderRadius: 16,
          border: '1px solid rgba(0,0,0,0.10)',
          background: '#fff',
          boxShadow: '0 18px 60px rgba(0,0,0,0.12)',
          padding: 22,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#111' }}>Waiting for invitation</div>
          {isAuthenticated ? (
            <button type="button" onClick={onLogout} style={ghostBtn} disabled={loading}>
              Log out
            </button>
          ) : null}
        </div>

        <div style={{ marginTop: 10, fontSize: 13, color: '#666', lineHeight: 1.55 }}>
          Access to the system is granted through an invitation link sent by your organization champion.
        </div>

        {preview ? (
          <div style={{ marginTop: 12, fontSize: 13, color: '#111', lineHeight: 1.55 }}>
            Invitation for: <b>{preview.email}</b>
            {preview.organization_name ? (
              <>
                {' '}to organization <b>{preview.organization_name}</b>
              </>
            ) : null}
          </div>
        ) : null}

        <div style={{ marginTop: 12, fontSize: 13, color: '#111' }}>
          Logged in email: <b>{email ?? 'Not signed in'}</b>
        </div>

        {!token ? (
          <div style={{ marginTop: 18, padding: 12, borderRadius: 12, background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.08)' }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: '#111' }}>Invitation link required</div>
            <div style={{ marginTop: 6, fontSize: 13, color: '#444' }}>
              This page now expects a secure invitation link with a token. Ask your champion to resend the invitation and open the exact link from the message.
            </div>
          </div>
        ) : null}

        {!isAuthenticated && token ? (
          <div style={{ marginTop: 18, padding: 12, borderRadius: 12, background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.08)' }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: '#111' }}>Continue with your invitation</div>
            <div style={{ marginTop: 6, fontSize: 13, color: '#444' }}>
              Sign in with the same email address that received the invitation. If this is your first access, the login screen lets you set the first password directly from this secure token before coming back here automatically.
            </div>
          </div>
        ) : null}

        {err && <div style={{ marginTop: 12, color: 'crimson', fontSize: 13, fontWeight: 900 }}>{err}</div>}
        {msg && <div style={{ marginTop: 12, color: '#0a7a2f', fontSize: 13, fontWeight: 900 }}>{msg}</div>}

        <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {!isAuthenticated && token ? (
            <Link href={loginHref} style={primaryLink}>
              Sign in or set password
            </Link>
          ) : null}

          {isAuthenticated && token && err ? (
            <button type="button" onClick={retryAccept} disabled={loading} style={{ ...btn, opacity: loading ? 0.6 : 1 }}>
              {loading ? 'Working...' : 'Try again'}
            </button>
          ) : null}

          <Link href="/request-access" style={{ fontSize: 13, color: '#111', textDecoration: 'underline', textUnderlineOffset: 3 }}>
            Request access for my company
          </Link>
        </div>

        <div style={{ marginTop: 18, padding: 12, borderRadius: 12, background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: '#111' }}>Tip</div>
          <div style={{ marginTop: 6, fontSize: 13, color: '#444' }}>
            Champions should share the dedicated invitation link for each user. Resending an invitation now refreshes the token and creates a new secure link.
          </div>
        </div>
      </div>
    </div>
  )
}

export default function WaitingForInvitePage() {
  return (
    <Suspense fallback={<WaitingForInviteFallback />}>
      <WaitingForInvitePageContent />
    </Suspense>
  )
}

function WaitingForInviteFallback() {
  return (
    <div style={{ minHeight: 'calc(100vh - 56px)', padding: 24, background: '#f6f6f7' }}>
      <div
        style={{
          width: 'min(820px, 100%)',
          boxSizing: 'border-box',
          margin: '0 auto',
          borderRadius: 16,
          border: '1px solid rgba(0,0,0,0.10)',
          background: '#fff',
          boxShadow: '0 18px 60px rgba(0,0,0,0.12)',
          padding: 22,
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 900, color: '#111' }}>Waiting for invitation</div>
        <div style={{ marginTop: 10, fontSize: 13, color: '#666', lineHeight: 1.55 }}>
          Loading invitation details...
        </div>
      </div>
    </div>
  )
}

const btn: React.CSSProperties = {
  height: 34,
  padding: '0 14px',
  borderRadius: 10,
  border: '1px solid rgba(0,0,0,0.16)',
  background: '#111',
  color: '#fff',
  fontSize: 13,
  fontWeight: 900,
  cursor: 'pointer',
}

const ghostBtn: React.CSSProperties = {
  height: 29,
  padding: '0 10px',
  borderRadius: 10,
  border: '1px solid rgba(0,0,0,0.14)',
  background: '#fff',
  color: '#111',
  fontSize: 13,
  fontWeight: 800,
  cursor: 'pointer',
}

const primaryLink: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 34,
  padding: '0 14px',
  borderRadius: 10,
  border: '1px solid rgba(0,0,0,0.16)',
  background: '#111',
  color: '#fff',
  fontSize: 13,
  fontWeight: 900,
  textDecoration: 'none',
}
