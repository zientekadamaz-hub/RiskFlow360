'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@app/lib/supabaseBrowser'

export default function WaitingForInvitePage() {
  const router = useRouter()
  const [email, setEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const canTryAccept = useMemo(() => !!email, [email])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const { data } = await supabase.auth.getSession()
      const e = data?.session?.user?.email ?? null
      if (mounted) setEmail(e)
    })()
    return () => {
      mounted = false
    }
  }, [])

  async function onAccept() {
    if (!canTryAccept) return
    setLoading(true)
    setErr('')
    setMsg('')
    try {
      const { error } = await supabase.rpc('accept_invitation')
      if (error) {
        setErr(error.message)
        return
      }
      setMsg('Zaproszenie zaakceptowane. Przechodzę do aplikacji…')
      router.replace('/')
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

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

  return (
    <div style={{ minHeight: 'calc(100vh - 56px)', padding: 24, background: '#f6f6f7' }}>
      <div
        style={{
          width: 'min(820px, 96vw)',
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
          <button type="button" onClick={onLogout} style={ghostBtn} disabled={loading}>
            Log out
          </button>
        </div>

        <div style={{ marginTop: 10, fontSize: 13, color: '#666', lineHeight: 1.55 }}>
          Twoje konto jest aktywne, ale nie ma jeszcze przypisanej organizacji. Dostęp do systemu jest tylko przez zaproszenie.
        </div>

        <div style={{ marginTop: 12, fontSize: 13, color: '#111' }}>
          Zalogowany email: <b>{email ?? '…'}</b>
        </div>

        {err && <div style={{ marginTop: 12, color: 'crimson', fontSize: 13, fontWeight: 900 }}>{err}</div>}
        {msg && <div style={{ marginTop: 12, color: '#0a7a2f', fontSize: 13, fontWeight: 900 }}>{msg}</div>}

        <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" onClick={onAccept} disabled={!canTryAccept || loading} style={{ ...btn, opacity: !canTryAccept || loading ? 0.6 : 1 }}>
            {loading ? 'Working…' : 'Accept invitation'}
          </button>

          <Link href="/request-access" style={{ fontSize: 13, color: '#111', textDecoration: 'underline', textUnderlineOffset: 3 }}>
            Request access for my company
          </Link>
        </div>

        <div style={{ marginTop: 18, padding: 12, borderRadius: 12, background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: '#111' }}>Tip</div>
          <div style={{ marginTop: 6, fontSize: 13, color: '#444' }}>
            Jeśli właśnie dostałeś zaproszenie, kliknij “Accept invitation”. Jeśli zaproszenie jeszcze nie dotarło, poproś Championa o wysyłkę ponownie.
          </div>
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
