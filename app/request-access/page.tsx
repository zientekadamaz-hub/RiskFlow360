'use client'

import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@app/lib/supabaseBrowser'

export default function RequestAccessPage() {
  const [loading, setLoading] = useState(false)
  const [ok, setOk] = useState(false)
  const [err, setErr] = useState('')

  const [companyName, setCompanyName] = useState('')
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [requestedInvites, setRequestedInvites] = useState<number | ''>('')

  const canSubmit = useMemo(() => {
    return companyName.trim().length >= 2 && email.trim().includes('@')
  }, [companyName, email])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setLoading(true)
    setErr('')
    try {
      const payload: any = {
        company_name: companyName.trim(),
        requester_email: email.trim(),
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        requested_invites:
          requestedInvites === '' ? null : Math.max(0, Math.floor(Number(requestedInvites))),
      }

      const { error } = await supabase.from('access_requests').insert(payload)
      if (error) {
        setErr(error.message)
        return
      }
      setOk(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 56px)', padding: 24, background: '#f6f6f7' }}>
      <div
        style={{
          width: 'min(760px, 96vw)',
          margin: '0 auto',
          borderRadius: 16,
          border: '1px solid rgba(0,0,0,0.10)',
          background: '#fff',
          boxShadow: '0 18px 60px rgba(0,0,0,0.12)',
          padding: 22,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#111' }}>Request access</div>
          <Link href="/login" style={{ fontSize: 13, color: '#111', textDecoration: 'underline', textUnderlineOffset: 3 }}>
            Log in
          </Link>
        </div>

        <div style={{ marginTop: 8, fontSize: 13, color: '#666', lineHeight: 1.5 }}>
          Dostęp jest tylko przez zaproszenie. Zostaw dane — administrator skontaktuje się i utworzy konto Championa.
        </div>

        {ok ? (
          <div style={{ marginTop: 16, padding: 12, borderRadius: 12, background: 'rgba(10,122,47,0.08)', border: '1px solid rgba(10,122,47,0.18)' }}>
            <div style={{ fontWeight: 900, color: '#0a7a2f' }}>Wysłano.</div>
            <div style={{ marginTop: 6, fontSize: 13, color: '#333' }}>
              Jeśli Twoja firma zostanie zatwierdzona, otrzymasz zaproszenie e‑mail.
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Company name *">
              <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} style={input} placeholder="e.g. ELMAX" />
            </Field>
            <Field label="Your email *">
              <input value={email} onChange={(e) => setEmail(e.target.value)} style={input} placeholder="name@company.com" />
            </Field>

            <Field label="First name">
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} style={input} />
            </Field>
            <Field label="Last name">
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} style={input} />
            </Field>

            <Field label="Requested invites (optional)">
              <input
                value={requestedInvites}
                onChange={(e) => {
                  const v = e.target.value
                  if (v === '') return setRequestedInvites('')
                  const n = Number(v)
                  if (!Number.isFinite(n)) return
                  setRequestedInvites(n)
                }}
                style={input}
                placeholder="e.g. 10"
                inputMode="numeric"
              />
            </Field>

            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 6 }}>
              {err ? <div style={{ color: 'crimson', fontWeight: 800, fontSize: 13 }}>{err}</div> : <div />}
              <button type="submit" disabled={!canSubmit || loading} style={{ ...btn, opacity: !canSubmit || loading ? 0.6 : 1 }}>
                {loading ? 'Sending…' : 'Send request'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'grid', gap: 6 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: '#222' }}>{props.label}</div>
      {props.children}
    </label>
  )
}

const input: React.CSSProperties = {
  height: 38,
  borderRadius: 10,
  border: '1px solid rgba(0,0,0,0.14)',
  padding: '0 12px',
  fontSize: 13,
  outline: 'none',
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
