'use client'

import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  SettingsBackdrop,
  settingsCardStyle,
  settingsInputStyle,
  settingsPageStyle,
} from '@/components/rf-ui'

type RequestAccessResponse = {
  error?: string
  ok?: boolean
}

export default function RequestAccessPage() {
  const [loading, setLoading] = useState(false)
  const [ok, setOk] = useState(false)
  const [err, setErr] = useState('')

  const [companyName, setCompanyName] = useState('')
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [requestedInvites, setRequestedInvites] = useState<number | ''>('')
  const [companyWebsite, setCompanyWebsite] = useState('')

  const canSubmit = useMemo(() => companyName.trim().length >= 2 && email.trim().includes('@'), [companyName, email])

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!canSubmit) return
    setLoading(true)
    setErr('')
    try {
      const response = await fetch('/api/request-access', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          companyName,
          email,
          firstName,
          lastName,
          requestedInvites,
          companyWebsite,
        }),
      })

      const result = (await response.json().catch(() => ({}))) as RequestAccessResponse
      if (!response.ok) {
        setErr(result.error ?? 'Could not send request.')
        return
      }

      setOk(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={settingsPageStyle}>
      <SettingsBackdrop />
      <div style={{ position: 'relative', zIndex: 1, minHeight: 'calc(100vh - 56px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div
          style={{
            ...settingsCardStyle,
            width: 'min(760px, 94vw)',
            padding: 22,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#fff' }}>New organization</div>
              <div style={{ marginTop: 8, fontSize: 13, color: 'rgba(255,255,255,0.72)', lineHeight: 1.6 }}>
                Leave your company details. The global administrator will review the request, create the organization and send a secure champion invitation link so you can set your password.
              </div>
            </div>
            <Link href="/login" style={loginLink}>
              Log in
            </Link>
          </div>

          {ok ? (
            <div style={{ marginTop: 18, padding: 14, borderRadius: 12, background: 'rgba(20, 83, 45, 0.42)', border: '1px solid rgba(74,222,128,0.35)' }}>
              <div style={{ fontWeight: 900, color: '#dcfce7' }}>Request sent.</div>
              <div style={{ marginTop: 6, fontSize: 13, color: 'rgba(255,255,255,0.82)' }}>
                When the request is approved, the administrator will send you a champion invitation link. You will use that link to set your password and activate access.
              </div>
            </div>
          ) : (
            <form onSubmit={onSubmit} style={{ marginTop: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Company name *">
                <input value={companyName} onChange={(event) => setCompanyName(event.target.value)} style={settingsInputStyle} placeholder="e.g. ELMAX" />
              </Field>
              <Field label="Your email *">
                <input value={email} onChange={(event) => setEmail(event.target.value)} style={settingsInputStyle} placeholder="name@company.com" />
              </Field>

              <Field label="First name">
                <input value={firstName} onChange={(event) => setFirstName(event.target.value)} style={settingsInputStyle} />
              </Field>
              <Field label="Last name">
                <input value={lastName} onChange={(event) => setLastName(event.target.value)} style={settingsInputStyle} />
              </Field>

              <Field label="Requested invites">
                <input
                  value={requestedInvites}
                  onChange={(event) => {
                    const nextValue = event.target.value
                    if (nextValue === '') {
                      setRequestedInvites('')
                      return
                    }
                    const numericValue = Number(nextValue)
                    if (!Number.isFinite(numericValue)) return
                    setRequestedInvites(numericValue)
                  }}
                  style={settingsInputStyle}
                  placeholder="e.g. 10"
                  inputMode="numeric"
                />
              </Field>

              <div style={{ display: 'none' }} aria-hidden="true">
                <Field label="Company website">
                  <input value={companyWebsite} onChange={(event) => setCompanyWebsite(event.target.value)} style={settingsInputStyle} tabIndex={-1} autoComplete="off" />
                </Field>
              </div>

              <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
                {err ? <div style={{ color: '#fecaca', fontWeight: 800, fontSize: 13 }}>{err}</div> : <div />}
                <button type="submit" disabled={!canSubmit || loading} style={{ ...btn, opacity: !canSubmit || loading ? 0.6 : 1 }}>
                  {loading ? 'Sending...' : 'Send request'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'grid', gap: 6 }}>
      <div style={labelStyle}>{props.label}</div>
      {props.children}
    </label>
  )
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 0.5,
  color: 'rgba(255,255,255,0.64)',
  textTransform: 'uppercase',
}

const btn: React.CSSProperties = {
  height: 38,
  padding: '0 14px',
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.22)',
  background: 'rgba(255,255,255,0.10)',
  color: '#fff',
  fontSize: 13,
  fontWeight: 900,
  cursor: 'pointer',
}

const loginLink: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 34,
  padding: '0 14px',
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.16)',
  background: 'rgba(255,255,255,0.06)',
  color: '#fff',
  fontSize: 13,
  fontWeight: 900,
  textDecoration: 'none',
}
