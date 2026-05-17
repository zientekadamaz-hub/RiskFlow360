import type { CSSProperties } from 'react'

import { UI_FONT } from '../../../app/pfd/_lib/ui/const'

export const SURFACE_RADIUS = 8
export const SURFACE_BG = 'rgba(255,255,255,0.08)'
export const SURFACE_BG_STRONG = 'rgba(255,255,255,0.12)'
export const SURFACE_BORDER = 'rgba(255,255,255,0.16)'
export const SURFACE_PANEL_BG = 'rgb(40, 39, 47)'
export const SURFACE_TEXT = '#f8fafc'
export const SURFACE_MUTED = 'rgba(255,255,255,0.72)'
export const PFMEA_CELL_TEXT = '#d7dbe3'
export const PFMEA_ACCENT = '#d9a86c'

export const baseBtn: CSSProperties = {
  height: 29,
  padding: '0 14px',
  borderRadius: SURFACE_RADIUS,
  border: `1px solid ${SURFACE_BORDER}`,
  background: SURFACE_BG,
  fontSize: 13,
  fontWeight: 600,
  color: SURFACE_TEXT,
  cursor: 'pointer',
  transition: 'background .15s ease, box-shadow .15s ease, transform .10s ease, border-color .15s ease, color .15s ease',
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: UI_FONT,
}

export const baseBtnDisabled: CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  color: 'rgba(255,255,255,0.35)',
  border: '1px solid rgba(255,255,255,0.08)',
}

export function th(extra: CSSProperties = {}): CSSProperties {
  return {
    position: 'sticky',
    top: 0,
    background: SURFACE_PANEL_BG,
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    padding: '10px 10px',
    textAlign: 'left',
    fontWeight: 800,
    color: PFMEA_ACCENT,
    zIndex: 1,
    ...extra,
  }
}

export function td(extra: CSSProperties = {}): CSSProperties {
  return {
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    borderRight: '1px solid rgba(255,255,255,0.06)',
    padding: 0,
    verticalAlign: 'top',
    color: PFMEA_CELL_TEXT,
    ...extra,
  }
}
