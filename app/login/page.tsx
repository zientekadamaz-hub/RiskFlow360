'use client'

import React, { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '../lib/supabaseBrowser'

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageSkeleton />}>
      <LoginPageContent />
    </Suspense>
  )
}

function LoginPageContent() {
  const sp = useSearchParams()
  const redirectTo = useMemo(() => sp.get('next') ?? '/', [sp])

  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [loading, setLoading] = useState(false)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  // signup only
  const [password2, setPassword2] = useState('')

  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')

  const rules = useMemo(
    () => [
      'Minimum 8 znaków',
      'Co najmniej 1 duża litera (A–Z)',
      'Co najmniej 1 mała litera (a–z)',
      'Co najmniej 1 cyfra (0–9)',
      'Co najmniej 1 znak specjalny (np. !@#$%^&*)',
    ],
    []
  )

  useEffect(() => {
    let mounted = true

    const check = async () => {
      const { data } = await supabase.auth.getSession()
      if (!mounted) return
      if (data.session) {
        window.location.assign(redirectTo)
      }
    }

    check()

    return () => {
      mounted = false
    }
  }, [redirectTo])

  function validatePassword(pw: string) {
    const okLen = pw.length >= 8
    const okUpper = /[A-Z]/.test(pw)
    const okLower = /[a-z]/.test(pw)
    const okDigit = /\d/.test(pw)
    const okSpecial = /[^A-Za-z0-9]/.test(pw)
    const ok = okLen && okUpper && okLower && okDigit && okSpecial
    return { ok, okLen, okUpper, okLower, okDigit, okSpecial }
  }

  const v = useMemo(() => validatePassword(password), [password])

  async function onLogin() {
    setErr('')
    setMsg('')
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (error) {
        setErr(error.message)
        return
      }

      // twardy redirect = stabilnie z guard/middleware
      window.location.assign(redirectTo)
    } finally {
      setLoading(false)
    }
  }

  async function onSignup() {
    setErr('')
    setMsg('')
    setLoading(true)

    try {
      const e = email.trim()
      if (!e) return setErr('Email jest wymagany.')
      if (!password) return setErr('Hasło jest wymagane.')
      if (!v.ok) return setErr('Hasło nie spełnia zasad.')
      if (password !== password2) return setErr('Hasła nie są identyczne.')

      const { error } = await supabase.auth.signUp({
        email: e,
        password,
      })

      if (error) {
        setErr(error.message)
        return
      }

      setMsg('Konto utworzone. Zaloguj się.')
      setMode('login')
      setPassword('')
      setPassword2('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: 'calc(100vh - 56px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: '#f6f6f7',
      }}
    >
      <div
        style={{
          width: 'min(820px, 96vw)',
          borderRadius: 16,
          border: '1px solid rgba(0,0,0,0.10)',
          background: '#fff',
          boxShadow: '0 18px 60px rgba(0,0,0,0.12)',
          padding: 22,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#111' }}>
            {mode === 'login' ? 'Log in' : 'Create account'}
          </div>

          <button
            type="button"
            onClick={() => {
              setErr('')
              setMsg('')
              setMode((m) => (m === 'login' ? 'signup' : 'login'))
              setPassword('')
              setPassword2('')
            }}
            style={ghostBtn}
          >
            {mode === 'login' ? 'Create account' : 'I have an account'}
          </button>
        </div>

        <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
          Redirect after success: <b>{redirectTo}</b>
        </div>

        {err && <div style={{ marginTop: 10, color: 'crimson', fontSize: 13, fontWeight: 800 }}>{err}</div>}
        {msg && <div style={{ marginTop: 10, color: '#0a7a2f', fontSize: 13, fontWeight: 800 }}>{msg}</div>}

        {mode === 'login' ? (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              onLogin()
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 16 }}>
              <div>
                <div style={label}>Email</div>
                <input
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={input}
                  autoComplete="email"
                  inputMode="email"
                />
              </div>
              <div>
                <div style={label}>Password</div>
                <input
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={input}
                  type="password"
                  autoComplete="current-password"
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
              <button type="submit" disabled={loading} style={{ ...primaryBtn, opacity: loading ? 0.6 : 1 }}>
                {loading ? 'Please wait…' : 'Log in'}
              </button>
            </div>
          </form>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              onSignup()
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 16 }}>
              <div>
                <div style={label}>Email</div>
                <input
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={input}
                  autoComplete="email"
                  inputMode="email"
                />
              </div>

              <div
                style={{
                  border: '1px solid rgba(0,0,0,0.08)',
                  borderRadius: 14,
                  padding: 12,
                  background: 'rgba(0,0,0,0.02)',
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 900, color: '#111', marginBottom: 6 }}>Password rules</div>
                <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: '#444', lineHeight: 1.6 }}>
                  {rules.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>

              <div>
                <div style={label}>Password</div>
                <input
                  name="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={input}
                  type="password"
                  autoComplete="new-password"
                />
                <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
                  Strength: <b>{v.ok ? 'OK' : 'Not valid yet'}</b>
                </div>
              </div>

              <div>
                <div style={label}>Repeat password</div>
                <input
                  name="new-password-repeat"
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  style={input}
                  type="password"
                  autoComplete="new-password"
                />
                <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
                  Match: <b>{password2 ? (password === password2 ? 'OK' : 'No') : '—'}</b>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
              <button
                type="submit"
                disabled={loading || !email.trim() || !password || !password2 || !v.ok || password !== password2}
                style={{
                  ...primaryBtn,
                  opacity: loading || !email.trim() || !password || !password2 || !v.ok || password !== password2 ? 0.55 : 1,
                }}
              >
                {loading ? 'Please wait…' : 'Create account'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function LoginPageSkeleton() {
  return (
    <div
      style={{
        minHeight: 'calc(100vh - 56px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: '#f6f6f7',
      }}
    >
      <div
        style={{
          width: 'min(820px, 96vw)',
          borderRadius: 16,
          border: '1px solid rgba(0,0,0,0.10)',
          background: '#fff',
          boxShadow: '0 18px 60px rgba(0,0,0,0.12)',
          padding: 22,
          color: '#666',
          fontSize: 14,
          fontWeight: 700,
        }}
      >
        Loading login...
      </div>
    </div>
  )
}

const label: React.CSSProperties = { fontSize: 12, fontWeight: 900, color: '#111', marginBottom: 6 }

const input: React.CSSProperties = {
  width: '100%',
  height: 44,
  borderRadius: 12,
  border: '1px solid rgba(0,0,0,0.14)',
  padding: '0 12px',
  outline: 'none',
  fontSize: 14,
  fontWeight: 650,
}

const primaryBtn: React.CSSProperties = {
  height: 44,
  padding: '0 16px',
  borderRadius: 12,
  border: '1px solid rgba(0,0,0,0.14)',
  background: '#fff',
  cursor: 'pointer',
  fontWeight: 900,
  boxShadow: '0 10px 26px rgba(0,0,0,0.10)',
}

const ghostBtn: React.CSSProperties = {
  height: 36,
  padding: '0 12px',
  borderRadius: 10,
  border: '1px solid rgba(0,0,0,0.10)',
  background: 'rgba(0,0,0,0.02)',
  cursor: 'pointer',
  fontWeight: 900,
  fontSize: 12,
}
