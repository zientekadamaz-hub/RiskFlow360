import type { CSSProperties } from 'react'

import {
  settingsPopupBg,
  settingsPopupText,
  settingsProcessAccent,
  settingsSharedOverlayBorder,
} from './tokens'

export const settingsPopoverPanelStyle: CSSProperties = {
  borderRadius: 10,
  border: `1px solid ${settingsSharedOverlayBorder}`,
  background: settingsPopupBg,
  boxShadow: '0 14px 32px rgba(0,0,0,0.16)',
  padding: 14,
  textAlign: 'left',
}

export const settingsPopoverTitleStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: settingsProcessAccent,
  marginBottom: 10,
}

export const settingsPopoverBodyStyle: CSSProperties = {
  fontSize: 12,
  color: settingsPopupText,
  lineHeight: 1.35,
}

export const settingsPopupPanelStyle: CSSProperties = {
  borderRadius: 10,
  border: `1px solid ${settingsSharedOverlayBorder}`,
  background: settingsPopupBg,
  boxShadow: '0 14px 32px rgba(0,0,0,0.16)',
  padding: 6,
}

export function settingsPopupItemStyle(selected = false): CSSProperties {
  return {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    border: '1px solid transparent',
    borderRadius: 8,
    background: selected ? 'rgba(255,255,255,0.12)' : 'transparent',
    color: settingsPopupText,
    padding: '7px 8px',
    cursor: 'pointer',
    fontSize: 12,
    lineHeight: 1.25,
  }
}

