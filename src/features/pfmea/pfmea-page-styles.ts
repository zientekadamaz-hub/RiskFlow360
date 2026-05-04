import type React from 'react'

export const SURFACE_RADIUS = 8
export const SURFACE_BG = 'rgba(255,255,255,0.08)'
export const SURFACE_BORDER = 'rgba(255,255,255,0.16)'
export const SURFACE_TEXT = '#f8fafc'

export const actionBtn: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: SURFACE_RADIUS,
  border: `1px solid ${SURFACE_BORDER}`,
  fontWeight: 650,
  fontSize: 12,
  color: SURFACE_TEXT,
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: 'inherit',
  background: SURFACE_BG,
}
