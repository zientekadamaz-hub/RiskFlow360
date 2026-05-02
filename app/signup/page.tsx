'use client'

import Link from 'next/link'
import React, { Suspense, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseBrowser'
import {
  SettingsBackdrop,
  SettingsConfirmDialog,
  settingsCompactActionButtonStyle,
  settingsCompactInputStyle,
  settingsCompactPrimaryButtonStyle,
  settingsFormLabelStyle,
  settingsPageStyle,
  settingsProcessAccent,
  settingsTableWrapStyle,
} from '@/features/settings/invitation-shell'
import { PasswordRulesHelp } from '@/features/auth/PasswordRulesHelp'
import { StandardSelect } from '@/features/settings/StandardSelect'

type SubscriptionPlan = 'starter' | 'team' | 'business'

const subscriptionPlanOptions: Array<{ label: string; limit: number; value: SubscriptionPlan }> = [
  { label: 'Starter - up to 5 users', limit: 5, value: 'starter' },
  { label: 'Team - up to 20 users', limit: 20, value: 'team' },
  { label: 'Business - up to 100 users', limit: 100, value: 'business' },
]

export default function SignupPage() {
  return (
    <Suspense fallback={<SignupPageSkeleton />}>
      <SignupPageContent />
    </Suspense>
  )
}

function SignupPageContent() {
  const [loading, setLoading] = useState(false)
  const [organizationName, setOrganizationName] = useState('')
  const [subscriptionPlan, setSubscriptionPlan] = useState<SubscriptionPlan>('starter')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [earlyAccessAccepted, setEarlyAccessAccepted] = useState(false)
  const [err, setErr] = useState('')
  const [requestSentOpen, setRequestSentOpen] = useState(false)

  const rules = useMemo(
    () => [
      'Minimum 8 characters',
      'At least 1 uppercase letter (A-Z)',
      'At least 1 lowercase letter (a-z)',
      'At least 1 number (0-9)',
      'At least 1 special character (for example !@#$%^&*)',
    ],
    []
  )

  const validation = useMemo(() => validatePassword(password), [password])
  const selectedSubscriptionPlan = useMemo(
    () => subscriptionPlanOptions.find((option) => option.value === subscriptionPlan) ?? subscriptionPlanOptions[0],
    [subscriptionPlan]
  )
  const submitDisabled = loading || organizationName.trim().length < 2 || !email.trim() || !password || !password2 || !validation.ok || password !== password2 || !earlyAccessAccepted

  useEffect(() => {
    let mounted = true

    const check = async () => {
      const { data } = await supabase.auth.getSession()
      if (!mounted) return
      if (data.session) {
        window.location.assign('/projects')
      }
    }

    void check()

    return () => {
      mounted = false
    }
  }, [])

  async function onCreateAccount() {
    setErr('')
    setLoading(true)

    try {
      const safeOrganizationName = organizationName.trim()
      const safeEmail = email.trim().toLowerCase()
      if (safeOrganizationName.length < 2) {
        setErr('Organization name is required.')
        return
      }
      if (!safeEmail) {
        setErr('Email is required.')
        return
      }
      if (!password) {
        setErr('Password is required.')
        return
      }
      if (!validation.ok) {
        setErr('Password does not meet the rules.')
        return
      }
      if (password !== password2) {
        setErr('Passwords do not match.')
        return
      }
      if (!earlyAccessAccepted) {
        setErr('Confirm the Early Access information before creating an account.')
        return
      }

      const response = await fetch('/api/request-access', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          companyName: safeOrganizationName,
          email: safeEmail,
          firstName: null,
          lastName: null,
          requestedInvites: selectedSubscriptionPlan.limit,
          companyWebsite: '',
          subscriptionPlan: selectedSubscriptionPlan.value,
          subscriptionPlanLabel: selectedSubscriptionPlan.label,
        }),
      })

      if (!response.ok) {
        const result = (await response.json().catch(() => ({}))) as { error?: string }
        setErr(response.status === 409 ? result.error ?? 'A request for this organization or email is already pending.' : result.error ?? 'Request could not be sent right now.')
        return
      }

      setRequestSentOpen(true)
      setOrganizationName('')
      setSubscriptionPlan('starter')
      setEmail('')
      setPassword('')
      setPassword2('')
      setEarlyAccessAccepted(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={settingsPageStyle}>
      <SettingsBackdrop />
      <div style={authPageCenterStyle}>
        <div style={authCardStyle}>
          <div style={authHeaderStyle}>
            <div style={{ flex: '1 1 280px', minWidth: 0 }}>
              <div style={authTitleStyle}>Create account</div>
            </div>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault()
              void onCreateAccount()
            }}
            style={{ marginTop: 16 }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14 }}>
              <div style={fieldStyle}>
                <div style={settingsFormLabelStyle}>Organization name</div>
                <input
                  className="rf-login-input"
                  value={organizationName}
                  onChange={(event) => setOrganizationName(event.target.value.toUpperCase())}
                  style={{ ...settingsCompactInputStyle, textTransform: 'uppercase' }}
                  name="organizationName"
                  autoComplete="organization"
                />
              </div>

              <div style={fieldStyle}>
                <div style={settingsFormLabelStyle}>Subscription</div>
                <StandardSelect
                  compact
                  ariaLabel="Subscription"
                  onChange={(value) => setSubscriptionPlan(value as SubscriptionPlan)}
                  options={subscriptionPlanOptions.map((option) => ({ label: option.label, value: option.value }))}
                  style={settingsCompactInputStyle}
                  value={subscriptionPlan}
                />
              </div>

              <div style={fieldStyle}>
                <div style={settingsFormLabelStyle}>Email</div>
                <input
                  className="rf-login-input"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  style={settingsCompactInputStyle}
                  name="email"
                  autoComplete="email"
                  inputMode="email"
                />
              </div>

              <div style={fieldStyle}>
                <div style={labelWithHelpStyle}>
                  <span style={settingsFormLabelStyle}>Password</span>
                  <PasswordRulesHelp rules={rules} />
                </div>
                <input
                  className="rf-login-input"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  style={settingsCompactInputStyle}
                  name="newPassword"
                  type="password"
                  autoComplete="new-password"
                />
              </div>

              <div style={fieldStyle}>
                <div style={settingsFormLabelStyle}>Repeat password</div>
                <input
                  className="rf-login-input"
                  value={password2}
                  onChange={(event) => setPassword2(event.target.value)}
                  style={settingsCompactInputStyle}
                  name="repeatPassword"
                  type="password"
                  autoComplete="new-password"
                />
              </div>
            </div>

            <label style={earlyAccessRowStyle}>
              <input
                checked={earlyAccessAccepted}
                onChange={(event) => setEarlyAccessAccepted(event.target.checked)}
                required
                style={earlyAccessCheckboxStyle}
                type="checkbox"
              />
              <span style={earlyAccessTextStyle}>
                RiskFlow 360 is currently in <b>Early Access</b>.
                <br />
                The product is under active development and we are continuously improving it based on user feedback. Access is currently <b>FREE</b> during the rollout period. Paid plans will be introduced later. Early users will be informed in advance and will receive preferential commercial terms.
                <br />
                <br />
                By continuing, you acknowledge that once paid plans are introduced, access to saved projects may require an active subscription. You confirm that you have read and understood this information.
              </span>
            </label>

            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, marginTop: 18, flexWrap: 'wrap' }}>
              <Link href="/login?next=%2Fprojects" className="rf-button" style={{ ...settingsCompactActionButtonStyle, marginRight: 'auto', textDecoration: 'none' }}>
                Log in
              </Link>

              <button
                type="submit"
                disabled={submitDisabled}
                className="rf-button"
                style={{ ...settingsCompactPrimaryButtonStyle, opacity: submitDisabled ? 0.55 : 1 }}
              >
                {loading ? 'Please wait...' : 'Create account'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <SettingsConfirmDialog
        open={!!err}
        title="Error"
        body={err}
        cancelLabel="Cancel"
        hideConfirm
        onCancel={() => setErr('')}
        onConfirm={() => undefined}
      />

      <SettingsConfirmDialog
        open={requestSentOpen}
        title="Request sent"
        body="Your request has been sent and is waiting for administrator approval. You will be informed about access by email within 48 hours."
        cancelLabel="OK"
        hideConfirm
        onCancel={() => setRequestSentOpen(false)}
        onConfirm={() => undefined}
      />
    </div>
  )
}

function SignupPageSkeleton() {
  return (
    <div style={settingsPageStyle}>
      <SettingsBackdrop />
      <div style={authPageCenterStyle}>
        <div style={{ ...authCardStyle, color: 'rgba(255,255,255,0.78)', fontSize: 13, fontWeight: 700 }}>Loading create account...</div>
      </div>
    </div>
  )
}

function validatePassword(pw: string) {
  const okLen = pw.length >= 8
  const okUpper = /[A-Z]/.test(pw)
  const okLower = /[a-z]/.test(pw)
  const okDigit = /\d/.test(pw)
  const okSpecial = /[^A-Za-z0-9]/.test(pw)
  const ok = okLen && okUpper && okLower && okDigit && okSpecial
  return { ok, okLen, okUpper, okLower, okDigit, okSpecial }
}

const authPageCenterStyle: React.CSSProperties = {
  position: 'relative',
  zIndex: 1,
  minHeight: 'calc(100vh - 56px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
  boxSizing: 'border-box',
}

const authCardStyle: React.CSSProperties = {
  ...settingsTableWrapStyle,
  width: 'min(460px, 96vw)',
  padding: 22,
  color: '#f8fafc',
  boxSizing: 'border-box',
}

const authHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 12,
  flexWrap: 'wrap',
}

const authTitleStyle: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 800,
  letterSpacing: -0.2,
  color: settingsProcessAccent,
}

const fieldStyle: React.CSSProperties = { display: 'grid', gap: 6 }

const labelWithHelpStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
}

const earlyAccessTextStyle: React.CSSProperties = {
  color: settingsProcessAccent,
  fontSize: 12,
  fontWeight: 400,
  lineHeight: 1.45,
}

const earlyAccessRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '18px 1fr',
  alignItems: 'flex-start',
  gap: 10,
  marginTop: 14,
}

const earlyAccessCheckboxStyle: React.CSSProperties = {
  width: 15,
  height: 15,
  margin: '2px 0 0',
  accentColor: settingsProcessAccent,
  cursor: 'pointer',
}
