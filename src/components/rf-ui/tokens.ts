import type { CSSProperties } from 'react'

export type SettingsRiskColor = 'green' | 'yellow' | 'orange' | 'red'

export const settingsSurfaceRadius = 8
export const settingsSharedOverlayBorder = 'rgba(255,255,255,0.16)'
export const settingsSharedOverlayBg = 'rgb(40, 39, 47)'
export const settingsPopupBg = 'rgb(52, 57, 69)'
export const settingsPopupText = '#d9a86c'
export const settingsProcessAccent = '#d9a86c'

export const settingsPageStyle: CSSProperties = {
  minHeight: 'calc(100vh - 56px)',
  paddingBottom: 14,
  position: 'relative',
  overflow: 'hidden',
  background: '#171f33',
  color: '#f8fafc',
  fontFamily: 'Arial, sans-serif',
}

export const settingsFrameStyle: CSSProperties = {
  width: '96%',
  marginLeft: 'auto',
  marginRight: 'auto',
}

export const settingsCardStyle: CSSProperties = {
  background: 'rgba(255,255,255,0.08)',
  borderStyle: 'solid',
  borderWidth: 1,
  borderColor: settingsSharedOverlayBorder,
  borderRadius: settingsSurfaceRadius,
  boxShadow: '0 18px 40px rgba(0,0,0,0.18)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
}

export const settingsHeroCardStyle: CSSProperties = {
  ...settingsCardStyle,
  background: 'rgba(255,255,255,0.08)',
}

export const settingsTitleStyle: CSSProperties = {
  fontSize: 28,
  fontWeight: 700,
  letterSpacing: -0.3,
  color: '#fff',
}

export const settingsSubtitleStyle: CSSProperties = {
  marginTop: 4,
  fontSize: 13,
  color: 'rgba(255,255,255,0.72)',
}

export const settingsLabelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 0.5,
  color: 'rgba(255,255,255,0.64)',
  textTransform: 'uppercase',
}

export const settingsFormLabelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 650,
  color: 'rgba(255,255,255,0.82)',
}

export const settingsStatValueStyle: CSSProperties = {
  marginTop: 6,
  fontSize: 24,
  fontWeight: 800,
  color: '#fff',
}

export const settingsRiskMatrixColorHex: Record<SettingsRiskColor, string> = {
  green: '#7bd77b',
  yellow: '#fff06a',
  orange: '#ffb347',
  red: '#ff4d4d',
}

export function settingsRgba(hex: string, alpha: number) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function settingsRiskMatrixCellFill(color: SettingsRiskColor) {
  const fill = settingsRgba(settingsRiskMatrixColorHex[color], 0.5)
  return `linear-gradient(0deg, ${fill}, ${fill}), #9ca3af`
}

