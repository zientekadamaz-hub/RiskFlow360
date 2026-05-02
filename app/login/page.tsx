'use client'

import React, { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '../lib/supabaseBrowser'
import { activateInvitedUser, fetchInvitationPreview, type InvitationPreview } from '@/lib/auth/invitation-auth'
import { getSafeRedirectTarget } from '@/lib/auth/client-session'
import { PasswordRulesHelp } from '@/features/auth/PasswordRulesHelp'
import {
  SettingsBackdrop,
  SettingsConfirmDialog,
  settingsCompactActionButtonStyle,
  settingsCompactInputStyle,
  settingsCompactPrimaryButtonStyle,
  settingsFormLabelStyle,
  settingsMutedTileStyle,
  settingsPageStyle,
  settingsProcessAccent,
  settingsTableWrapStyle,
} from '@/components/rf-ui'

type Mode = 'login' | 'activate' | 'forgot' | 'reset'

function getInvitationTokenFromRedirect(redirectTo: string) {
  if (!redirectTo.includes('/waiting-for-invite?token=')) return null

  try {
    if (typeof window === 'undefined') return null
    const url = new URL(redirectTo, window.location.origin)
    const token = url.searchParams.get('token')?.trim() ?? ''
    return token || null
  } catch {
    return null
  }
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageSkeleton />}>
      <LoginPageContent />
    </Suspense>
  )
}

function LoginPageContent() {
  const sp = useSearchParams()
  const redirectTo = useMemo(() => getSafeRedirectTarget(sp.get('next'), '/projects'), [sp])
  const initialMode = useMemo<Mode>(() => {
    if (sp.get('mode') === 'recovery') return 'reset'
    return 'login'
  }, [sp])

  const inviteFlow = useMemo(() => redirectTo.includes('/waiting-for-invite?token='), [redirectTo])
  const inviteToken = useMemo(() => getInvitationTokenFromRedirect(redirectTo), [redirectTo])
  const [mode, setMode] = useState<Mode>(initialMode)
  const [loading, setLoading] = useState(false)
  const [invitationPreview, setInvitationPreview] = useState<InvitationPreview | null>(null)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')

  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')

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

  useEffect(() => {
    let mounted = true

    const check = async () => {
      const { data } = await supabase.auth.getSession()
      if (!mounted) return
      if (data.session && mode !== 'reset') {
        window.location.assign(redirectTo)
      }
    }

    void check()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (!mounted) return
      if (event === 'PASSWORD_RECOVERY') {
        setMode('reset')
        setErr('')
        setMsg('')
      }
    })

    if (typeof window !== 'undefined' && window.location.hash.includes('type=recovery')) {
      setMode('reset')
    }

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [mode, redirectTo])

  useEffect(() => {
    if (inviteFlow && mode === 'login') {
      setMsg('Use your existing password to sign in, or choose "Set password" if this is your first access.')
    } else if (mode !== 'login') {
      setMsg('')
    }
  }, [inviteFlow, mode])

  useEffect(() => {
    let cancelled = false

    if (!inviteToken) {
      setInvitationPreview(null)
      return
    }

    const loadInvitationPreview = async () => {
      try {
        const preview = await fetchInvitationPreview(supabase, inviteToken)
        if (cancelled) return
        setInvitationPreview(preview)
        setEmail((currentEmail) => currentEmail || preview.email)
      } catch (error) {
        if (cancelled) return
        setInvitationPreview(null)
        setErr(error instanceof Error ? error.message : 'Invitation could not be loaded.')
      }
    }

    void loadInvitationPreview()

    return () => {
      cancelled = true
    }
  }, [inviteToken])

  function validatePassword(pw: string) {
    const okLen = pw.length >= 8
    const okUpper = /[A-Z]/.test(pw)
    const okLower = /[a-z]/.test(pw)
    const okDigit = /\d/.test(pw)
    const okSpecial = /[^A-Za-z0-9]/.test(pw)
    const ok = okLen && okUpper && okLower && okDigit && okSpecial
    return { ok, okLen, okUpper, okLower, okDigit, okSpecial }
  }

  const validation = useMemo(() => validatePassword(password), [password])

  const authRedirectUrl = useMemo(() => {
    if (typeof window === 'undefined') return undefined
    const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? '').trim()
    const normalizedBasePath = !basePath || basePath === '/' ? '' : basePath.startsWith('/') ? basePath.replace(/\/+$/, '') : `/${basePath.replace(/\/+$/, '')}`
    return `${window.location.origin}${normalizedBasePath}/login?mode=recovery`
  }, [])

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

      window.location.assign(redirectTo)
    } finally {
      setLoading(false)
    }
  }

  async function onActivateAccount() {
    setErr('')
    setMsg('')
    setLoading(true)

    try {
      if (!inviteToken) {
        setErr('Secure invitation link is required to set your first password.')
        return
      }
      if (!password) return setErr('Password is required.')
      if (!validation.ok) return setErr('Password does not meet the rules.')
      if (password !== password2) return setErr('Passwords do not match.')

      const activation = await activateInvitedUser(supabase, inviteToken, password)
      setEmail(activation.email)

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: activation.email,
        password,
      })

      if (!signInError) {
        window.location.assign(redirectTo)
        return
      }

      setErr('Account was created, but automatic sign-in failed. Use your new password to sign in manually.')
      setMode('login')
    } finally {
      setLoading(false)
    }
  }

  async function onForgotPassword() {
    setErr('')
    setMsg('')
    setLoading(true)

    try {
      const safeEmail = email.trim().toLowerCase()
      if (!safeEmail) {
        setErr('Enter your email first.')
        return
      }

      const { error } = await supabase.auth.resetPasswordForEmail(safeEmail, {
        redirectTo: authRedirectUrl,
      })

      if (error) {
        setErr(error.message)
        return
      }

      setMsg('Password recovery link sent. Check your inbox.')
    } finally {
      setLoading(false)
    }
  }

  async function onResetPassword() {
    setErr('')
    setMsg('')
    setLoading(true)

    try {
      if (!password) return setErr('Password is required.')
      if (!validation.ok) return setErr('Password does not meet the rules.')
      if (password !== password2) return setErr('Passwords do not match.')

      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        setErr(error.message)
        return
      }

      setMsg('Password updated. You can now sign in.')
      setMode('login')
      setPassword('')
      setPassword2('')
      if (typeof window !== 'undefined') {
        window.history.replaceState({}, document.title, '/login')
      }
    } finally {
      setLoading(false)
    }
  }

  const title =
    mode === 'reset'
      ? 'Reset password'
      : mode === 'forgot'
        ? 'Recover password'
        : mode === 'activate'
          ? 'Set password'
          : 'Log in'

  const subtitle =
    mode === 'reset'
      ? 'Create a new password for your account.'
      : mode === 'forgot'
        ? 'We will send you a secure password recovery link.'
        : inviteFlow
          ? 'This invitation lets you either sign in or set your first password before access is granted.'
          : 'Sign in to continue working in RiskFlow 360.'

  const submitDisabled =
    loading ||
    (mode === 'login'
      ? !email.trim() || !password
      : mode === 'forgot'
        ? !email.trim()
        : !password || !password2 || !validation.ok || password !== password2)

  const submitLabel = loading
    ? 'Please wait...'
    : mode === 'forgot'
      ? 'Send recovery link'
      : mode === 'reset'
        ? 'Save new password'
        : mode === 'activate'
          ? 'Set password'
          : 'Log in'

  return (
    <div style={settingsPageStyle}>
      <SettingsBackdrop />
      <div style={loginPageCenterStyle}>
        <div style={loginCardStyle}>
          <div style={loginHeaderStyle}>
            <div style={{ flex: '1 1 280px', minWidth: 0 }}>
              <div style={loginTitleStyle}>{title}</div>
              <div style={loginSubtitleStyle}>{subtitle}</div>
            </div>

            <div style={loginHeaderActionsStyle}>
              {inviteFlow && mode !== 'activate' && mode !== 'reset' ? (
                <button
                  type="button"
                  onClick={() => {
                    setErr('')
                    setMsg('')
                    setMode('activate')
                    setPassword('')
                    setPassword2('')
                  }}
                  className="rf-button"
                  style={settingsCompactActionButtonStyle}
                >
                  Set password
                </button>
              ) : null}

              {mode !== 'login' && mode !== 'reset' ? (
                <button
                  type="button"
                  onClick={() => {
                    setErr('')
                    setMsg('')
                    setMode('login')
                    setPassword('')
                    setPassword2('')
                  }}
                  className="rf-button"
                  style={settingsCompactActionButtonStyle}
                >
                  I have a password
                </button>
              ) : null}

              {mode === 'forgot' ? (
                <button
                  type="button"
                  onClick={() => {
                    setErr('')
                    setMsg('')
                    setMode('login')
                  }}
                  className="rf-button"
                  style={settingsCompactActionButtonStyle}
                >
                  Back to login
                </button>
              ) : null}
            </div>
          </div>

          {msg ? <div style={successTextStyle}>{msg}</div> : null}

          <form
            onSubmit={(event) => {
              event.preventDefault()
              if (mode === 'login') {
                void onLogin()
                return
              }
              if (mode === 'reset') {
                void onResetPassword()
                return
              }
              if (mode === 'forgot') {
                void onForgotPassword()
                return
              }
              void onActivateAccount()
            }}
            style={{ marginTop: 16 }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14 }}>
              <div style={fieldStyle}>
                <div style={settingsFormLabelStyle}>{mode === 'activate' ? 'Invitation' : 'Email'}</div>
                {mode === 'activate' ? (
                  <div style={infoPanelStyle}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>{invitationPreview?.email ?? 'Invitation-secured account'}</div>
                    <div style={{ marginTop: 6, fontSize: 12, color: 'rgba(255,255,255,0.72)', lineHeight: 1.55 }}>
                      {invitationPreview?.organization_name
                        ? `This password will activate your invited access to ${invitationPreview.organization_name}.`
                        : 'This password will be attached to the invited email from your secure link.'}
                    </div>
                  </div>
                ) : (
                  <input
                    className="rf-login-input"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    style={settingsCompactInputStyle}
                    name="email"
                    autoComplete="email"
                    inputMode="email"
                    disabled={mode === 'reset'}
                  />
                )}
              </div>

              {mode === 'login' ? (
                <div style={fieldStyle}>
                  <div style={settingsFormLabelStyle}>Password</div>
                  <input
                    className="rf-login-input"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    style={settingsCompactInputStyle}
                    name="password"
                    type="password"
                    autoComplete="current-password"
                  />
                </div>
              ) : mode === 'forgot' ? (
                <div style={infoPanelStyle}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: '#fff', marginBottom: 6 }}>Recovery</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.72)', lineHeight: 1.55 }}>
                    We will send a secure recovery link to the email address.
                  </div>
                </div>
              ) : null}

              {mode !== 'login' && mode !== 'forgot' ? (
                <>
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
                    <div style={helperStyle}>
                      Strength: <b>{validation.ok ? 'OK' : 'Not valid yet'}</b>
                    </div>
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
                    <div style={helperStyle}>
                      Match: <b>{password2 ? (password === password2 ? 'OK' : 'No') : '-'}</b>
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, marginTop: 18, flexWrap: 'wrap' }}>
              {mode === 'login' ? (
                <button
                  type="button"
                  onClick={() => {
                    setErr('')
                    setMsg('')
                    setMode('forgot')
                  }}
                  className="rf-button"
                  style={{ ...settingsCompactActionButtonStyle, marginRight: 'auto' }}
                >
                  Forgot password?
                </button>
              ) : null}

              {inviteFlow && mode === 'login' ? (
                <button
                  type="button"
                  onClick={() => {
                    setErr('')
                    setMsg('')
                    setMode('activate')
                    setPassword('')
                    setPassword2('')
                  }}
                  className="rf-button"
                  style={settingsCompactActionButtonStyle}
                >
                  First access? Set password
                </button>
              ) : null}

              <button
                type="submit"
                disabled={submitDisabled}
                className="rf-button"
                style={{ ...settingsCompactPrimaryButtonStyle, opacity: submitDisabled ? 0.55 : 1 }}
              >
                {submitLabel}
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
    </div>
  )
}

function LoginPageSkeleton() {
  return (
    <div style={settingsPageStyle}>
      <SettingsBackdrop />
      <div style={loginPageCenterStyle}>
        <div style={{ ...loginCardStyle, color: 'rgba(255,255,255,0.78)', fontSize: 13, fontWeight: 700 }}>Loading login...</div>
      </div>
    </div>
  )
}

const loginPageCenterStyle: React.CSSProperties = {
  position: 'relative',
  zIndex: 1,
  minHeight: 'calc(100vh - 56px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
  boxSizing: 'border-box',
}

const loginCardStyle: React.CSSProperties = {
  ...settingsTableWrapStyle,
  width: 'min(460px, 96vw)',
  padding: 22,
  color: '#f8fafc',
  boxSizing: 'border-box',
}

const loginHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 12,
  flexWrap: 'wrap',
}

const loginHeaderActionsStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: 8,
  flexWrap: 'wrap',
}

const loginTitleStyle: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 800,
  letterSpacing: -0.2,
  color: settingsProcessAccent,
}

const loginSubtitleStyle: React.CSSProperties = {
  marginTop: 6,
  fontSize: 13,
  lineHeight: 1.45,
  color: 'rgba(255,255,255,0.72)',
}

const successTextStyle: React.CSSProperties = {
  marginTop: 10,
  color: '#16a34a',
  fontSize: 12.5,
  fontWeight: 800,
}

const fieldStyle: React.CSSProperties = { display: 'grid', gap: 6 }

const labelWithHelpStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
}

const helperStyle: React.CSSProperties = {
  marginTop: 8,
  fontSize: 12,
  color: 'rgba(255,255,255,0.62)',
}

const infoPanelStyle: React.CSSProperties = {
  ...settingsMutedTileStyle,
  padding: 12,
  minHeight: 44,
}
