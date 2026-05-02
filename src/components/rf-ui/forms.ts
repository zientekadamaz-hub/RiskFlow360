import type { CSSProperties } from 'react'

import { settingsSharedOverlayBorder, settingsSurfaceRadius } from './tokens'

export const settingsInputStyle: CSSProperties = {
  height: 36,
  borderRadius: settingsSurfaceRadius,
  border: `1px solid ${settingsSharedOverlayBorder}`,
  padding: '0 10px',
  fontSize: 13,
  color: '#fff',
  background: 'rgba(255,255,255,0.06)',
  outline: 'none',
  width: '100%',
}

export const settingsCompactInputStyle: CSSProperties = {
  ...settingsInputStyle,
  height: 32,
  padding: '0 8px',
  fontSize: 12,
  background: 'rgb(40, 39, 47)',
}

export const settingsSelectStyle: CSSProperties = {
  ...settingsInputStyle,
}

export const settingsTextareaStyle: CSSProperties = {
  ...settingsInputStyle,
  height: 'auto',
  minHeight: 112,
  paddingTop: 10,
  paddingBottom: 10,
  resize: 'vertical',
}

