import type { CSSProperties } from 'react'

import {
  settingsProcessAccent,
  settingsSharedOverlayBorder,
  settingsSurfaceRadius,
} from './tokens'

export const settingsActionButtonStyle: CSSProperties = {
  padding: '6px 10px',
  borderRadius: settingsSurfaceRadius,
  border: '1px solid rgba(255,255,255,0.2)',
  fontWeight: 650,
  fontSize: 12,
  fontFamily: 'inherit',
  lineHeight: 1,
  color: '#fff',
  background: 'rgba(255,255,255,0.08)',
  textDecoration: 'none',
  cursor: 'pointer',
  minHeight: 30,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: 'none',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
}

export const settingsPrimaryButtonStyle: CSSProperties = {
  height: 34,
  borderRadius: settingsSurfaceRadius,
  border: '1px solid rgba(255,255,255,0.3)',
  fontWeight: 650,
  fontSize: 12,
  fontFamily: 'inherit',
  lineHeight: 1,
  color: '#fff',
  background: 'rgba(255,255,255,0.16)',
  textDecoration: 'none',
  cursor: 'pointer',
  padding: '0 12px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0 8px 20px rgba(0,0,0,0.18)',
}

export const settingsCompactActionButtonStyle: CSSProperties = {
  ...settingsActionButtonStyle,
  minHeight: 29,
  height: 29,
  padding: '0 12px',
}

export const settingsCompactPrimaryButtonStyle: CSSProperties = {
  ...settingsPrimaryButtonStyle,
  height: 29,
  padding: '0 12px',
}

export const settingsColumnMenuButtonStyle: CSSProperties = {
  ...settingsActionButtonStyle,
  width: '100%',
  justifyContent: 'flex-start',
  minHeight: 28,
  padding: '0 10px',
  borderRadius: 8,
  background: 'transparent',
  borderColor: 'transparent',
  color: settingsProcessAccent,
}

export const settingsFilterClearButtonStyle: CSSProperties = {
  padding: '2px 8px',
  borderRadius: settingsSurfaceRadius,
  border: `1px solid ${settingsSharedOverlayBorder}`,
  fontSize: 11,
}

export function settingsSegmentButtonStyle(active: boolean): CSSProperties {
  return {
    ...settingsCompactActionButtonStyle,
    background: active ? 'rgba(217,168,108,0.18)' : 'rgba(255,255,255,0.08)',
    borderColor: active ? 'rgba(217,168,108,0.45)' : 'rgba(255,255,255,0.18)',
    color: active ? settingsProcessAccent : '#f8fafc',
  }
}

export const settingsIconButtonStyle: CSSProperties = {
  minHeight: 26,
  minWidth: 36,
  padding: '6px 10px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 12,
  border: '1px solid rgba(255, 255, 255, 0.18)',
  background: 'rgba(255, 255, 255, 0.08)',
  cursor: 'pointer',
  transition: 'background 0.12s ease, transform 0.06s ease',
  boxShadow: 'none',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
}

export const settingsIconGlyphStyle: CSSProperties = {
  width: 16,
  height: 16,
  color: 'rgba(255, 255, 255, 0.72)',
}

