import type { CSSProperties } from 'react'

import {
  settingsCardStyle,
  settingsSharedOverlayBorder,
  settingsSurfaceRadius,
} from './tokens'

export const settingsToolbarRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: 8,
  flexWrap: 'wrap',
  marginBottom: 10,
}

export const settingsSectionHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 12,
  flexWrap: 'wrap',
  marginBottom: 12,
}

export const settingsSectionTitleStyle: CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  color: '#fff',
}

export const settingsSectionSubtitleStyle: CSSProperties = {
  marginTop: 4,
  fontSize: 12,
  color: 'rgba(255,255,255,0.7)',
}

export const settingsFilterPanelStyle: CSSProperties = {
  ...settingsCardStyle,
  padding: 12,
}

export const settingsFilterGroupStyle: CSSProperties = {
  ...settingsCardStyle,
  padding: '8px 12px',
  flex: 1,
  borderRadius: settingsSurfaceRadius,
}

export const settingsFilterGroupHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  marginBottom: 6,
}

export const settingsFilterGroupLabelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: 'rgba(255,255,255,0.72)',
}

export function settingsFilterChipStyle(
  checked: boolean,
  options?: { width?: number; activeBg?: string; activeBorder?: string }
): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 6,
    fontSize: 11,
    padding: '4px 8px',
    width: options?.width ?? 120,
    minHeight: 34,
    boxSizing: 'border-box',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    borderRadius: settingsSurfaceRadius,
    border: '1px solid rgba(255,255,255,0.14)',
    background: checked ? options?.activeBg ?? 'rgba(156,163,175,0.18)' : 'rgba(255,255,255,0.05)',
    color: '#fff',
    borderColor: checked ? options?.activeBorder ?? 'rgba(156,163,175,0.42)' : 'rgba(255,255,255,0.14)',
  }
}

export const settingsDangerNoticeStyle: CSSProperties = {
  fontSize: 12,
  padding: '10px 12px',
  borderRadius: settingsSurfaceRadius,
  background: 'rgba(127, 29, 29, 0.42)',
  color: '#fee2e2',
  borderStyle: 'solid',
  borderWidth: 1,
  borderColor: 'rgba(248, 113, 113, 0.4)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
}

export const settingsDangerInlineStyle: CSSProperties = {
  marginTop: 10,
  padding: '6px 0',
  color: '#dc2626',
  fontSize: 12,
  fontWeight: 700,
  display: 'flex',
  alignItems: 'center',
  gap: 10,
}

export const settingsDangerInlineAccentStyle: CSSProperties = {
  width: 8,
  alignSelf: 'stretch',
  borderRadius: 999,
  background: 'linear-gradient(180deg, rgba(220,38,38,0.95), rgba(127,29,29,0.9))',
}

export const settingsInlinePanelBorder = settingsSharedOverlayBorder

