import React from 'react'

import { UI_FONT } from '../../../app/pfd/_lib/ui/const'
import {
  SURFACE_BG_STRONG,
  SURFACE_BORDER,
  SURFACE_MUTED,
  SURFACE_RADIUS,
  SURFACE_TEXT,
} from './pfd-page-styles'

export function PaletteButton({
  title,
  subtitle,
  onClick,
  disabled,
  children,
}: {
  title: string
  subtitle?: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%',
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        padding: 8,
        borderRadius: SURFACE_RADIUS,
        border: `1px solid ${SURFACE_BORDER}`,
        background: disabled ? 'rgba(255,255,255,0.05)' : SURFACE_BG_STRONG,
        cursor: disabled ? 'not-allowed' : 'pointer',
        boxShadow: disabled ? 'none' : '0 18px 40px rgba(0,0,0,0.18)',
        transition: 'transform .10s ease, box-shadow .15s ease, border-color .15s ease',
        fontFamily: UI_FONT,
      }}
    >
      <div
        style={{
          width: 51,
          height: 41,
          borderRadius: SURFACE_RADIUS,
          display: 'grid',
          placeItems: 'center',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {children}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: SURFACE_TEXT, lineHeight: 1.02 }}>{title}</div>
        {subtitle ? <div style={{ fontSize: 10, color: SURFACE_MUTED, fontWeight: 600 }}>{subtitle}</div> : null}
      </div>
    </button>
  )
}

export function ThumbOperation() {
  return (
    <svg width="46" height="34" viewBox="0 0 46 34">
      <rect
        x="4"
        y="4"
        width="38"
        height="26"
        rx="6"
        fill="rgba(232,243,237,0.96)"
        stroke="rgba(107,145,125,0.42)"
        strokeWidth="1.2"
      />
    </svg>
  )
}

export function ThumbDecision() {
  return (
    <svg width="46" height="34" viewBox="0 0 46 34">
      <path
        d="M23 2 L44 17 L23 32 L2 17 Z"
        fill="rgba(232,243,237,0.96)"
        stroke="rgba(107,145,125,0.42)"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function ThumbCircle() {
  return (
    <svg width="46" height="34" viewBox="0 0 46 34">
      <circle cx="23" cy="17" r="13" fill="rgba(232,243,237,0.96)" stroke="rgba(107,145,125,0.42)" strokeWidth="1.2" />
    </svg>
  )
}

export function ThumbFrame() {
  return (
    <svg width="46" height="34" viewBox="0 0 46 34">
      <rect x="4" y="4" width="38" height="26" fill="transparent" stroke="rgba(107,145,125,0.42)" strokeWidth="1.2" strokeDasharray="4 3" />
    </svg>
  )
}

export function ThumbStartStop() {
  return (
    <svg width="46" height="34" viewBox="0 0 46 34">
      <rect
        x="4"
        y="8"
        width="38"
        height="18"
        rx="9"
        fill="rgba(232,243,237,0.96)"
        stroke="rgba(107,145,125,0.42)"
        strokeWidth="1.2"
      />
    </svg>
  )
}

export function ThumbTriangle() {
  return (
    <svg width="46" height="34" viewBox="0 0 46 34">
      <path d="M23 5 L40 29 L6 29 Z" fill="rgba(232,243,237,0.96)" stroke="rgba(107,145,125,0.42)" strokeWidth="1.2" />
    </svg>
  )
}

export function ThumbSubProcess() {
  return (
    <svg width="46" height="34" viewBox="0 0 46 34">
      <rect x="4" y="4" width="38" height="26" rx="6" fill="rgba(232,243,237,0.96)" stroke="rgba(107,145,125,0.42)" strokeWidth="1.2" />
      <line x1="11" y1="4" x2="11" y2="30" stroke="rgba(107,145,125,0.42)" strokeWidth="1.4" />
      <line x1="35" y1="4" x2="35" y2="30" stroke="rgba(107,145,125,0.42)" strokeWidth="1.4" />
    </svg>
  )
}
