'use client'

import React from 'react'

type HeaderUserControlsProps = {
  displayFullName: string | null
  displayOrgName: string | null
  displayRole: string
  idleLeftSec: number | null
  onLogout: () => void
}

function formatMmSs(sec: number | null) {
  if (sec === null) return ''
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function HeaderUserControls({
  displayFullName,
  displayOrgName,
  displayRole,
  idleLeftSec,
  onLogout,
}: HeaderUserControlsProps) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.05 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          {displayOrgName ? (
            <span
              style={{
                fontSize: 11,
                fontWeight: 400,
                color: 'rgba(0,0,0,0.55)',
                letterSpacing: 0.6,
                textTransform: 'uppercase',
                maxWidth: 240,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={displayOrgName}
            >
              {displayOrgName}
            </span>
          ) : null}

          <span style={{ fontSize: 12, fontWeight: 700, color: '#111' }}>{displayFullName ?? 'â€”'}</span>

          {displayRole ? (
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: 'rgba(0,0,0,0.45)',
                padding: '4px 8px',
                borderRadius: 999,
                border: '1px solid rgba(0,0,0,0.10)',
                background: 'rgba(0,0,0,0.02)',
                lineHeight: 1,
              }}
              title="Your role"
            >
              {displayRole}
            </span>
          ) : null}
        </div>
      </div>

      {idleLeftSec !== null ? (
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: '#111',
            padding: '7px 10px',
            borderRadius: 10,
            border: '1px solid rgba(0,0,0,0.10)',
            background: '#fff',
            minWidth: 72,
            textAlign: 'center',
          }}
          title="Auto-logout timer"
        >
          {formatMmSs(idleLeftSec)}
        </span>
      ) : null}

      <button
        onClick={onLogout}
        className="rf-button"
        style={{
          fontSize: 13,
          fontWeight: 650,
          padding: '6px 10px',
          borderRadius: 10,
          border: '1px solid #ddd',
          background: '#fff',
          color: '#111',
          cursor: 'pointer',
        }}
      >
        Log out
      </button>
    </div>
  )
}

export function HeaderUserSkeleton({
  authState,
  mounted,
  publicActions,
}: {
  authState: 'unknown' | 'authed' | 'unauthed'
  mounted: boolean
  publicActions: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12 }}>
      <div
        aria-hidden
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          visibility: !mounted || authState === 'unknown' ? 'visible' : 'hidden',
        }}
      >
        <div style={{ width: 120, height: 10 }} />
        <div style={{ width: 90, height: 12 }} />
        <div style={{ width: 54, height: 20, borderRadius: 999 }} />
      </div>
      {authState === 'unauthed' ? publicActions : <div style={{ width: 86, height: 34 }} />}
    </div>
  )
}
