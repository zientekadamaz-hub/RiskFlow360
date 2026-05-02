import type { CSSProperties } from 'react'
import {
  settingsCardStyle,
  settingsCompactInputStyle,
  settingsDangerNoticeStyle,
  settingsProcessAccent,
  settingsSharedOverlayBorder,
  settingsStatValueStyle,
  settingsSurfaceRadius,
  settingsTableCellStyle,
  settingsTableHeaderStyle,
  settingsTableStyle,
} from '@/components/rf-ui'
import type { RpnThresholds } from './types'

export const PROJECTS_PROCESS_ACCENT = settingsProcessAccent
export const PROJECTS_FILTER_ACTIVE_BG = 'rgba(156,163,175,0.18)'
export const PROJECTS_FILTER_ACTIVE_BORDER = 'rgba(156,163,175,0.42)'
export const PROJECTS_FILTER_CHIP_WIDTH = 120

export const projectsSubtitleStyle: CSSProperties = {
  marginTop: 4,
  fontSize: 13.5,
  color: 'rgba(255,255,255,0.78)',
}

export const projectsCardStyle: CSSProperties = {
  ...settingsCardStyle,
  color: '#fff',
}

export const projectsTableStyle: CSSProperties = {
  ...settingsTableStyle,
}

export const projectsTableShellStyle: CSSProperties = {
  ...projectsCardStyle,
  display: 'flex',
  flex: '1 1 auto',
  flexDirection: 'column',
  minHeight: 0,
}

export const projectsTableViewportScrollerStyle: CSSProperties = {
  overflowX: 'auto',
  overflowY: 'auto',
  minHeight: 0,
}

export const projectsTableHeaderStyle: CSSProperties = {
  ...settingsTableHeaderStyle,
  position: 'sticky',
  top: 0,
  zIndex: 5,
}

export const projectsTableCellStyle: CSSProperties = {
  ...settingsTableCellStyle,
}

export const projectsProcessCellStyle: CSSProperties = {
  fontWeight: 600,
  fontSize: 15,
  color: PROJECTS_PROCESS_ACCENT,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}

export const projectsCompactInputStyle: CSSProperties = {
  ...settingsCompactInputStyle,
  width: '100%',
}

export const projectsActionsStyle: CSSProperties = {
  display: 'inline-flex',
  gap: 8,
  justifyContent: 'flex-start',
  alignItems: 'center',
  flexWrap: 'nowrap',
}

export const projectsErrorBoxStyle: CSSProperties = {
  ...settingsDangerNoticeStyle,
  marginTop: 8,
}

export const projectsSummaryValueStyle: CSSProperties = {
  ...settingsStatValueStyle,
  marginTop: 0,
  lineHeight: 1,
}

export const projectsSkeletonBarStyle: CSSProperties = {
  height: 16,
  borderRadius: settingsSurfaceRadius,
  background: 'linear-gradient(90deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.18) 50%, rgba(255,255,255,0.08) 100%)',
}

export function projectsStatusStyle(status: string): CSSProperties {
  const normalized = status.toLowerCase()
  const base: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: 12,
    fontWeight: 700,
    whiteSpace: 'nowrap',
  }

  if (normalized === 'open') return { ...base, color: '#16a34a' }
  if (normalized === 'draft') return { ...base, color: 'rgba(255,255,255,0.82)' }
  if (normalized === 'obsolete') return { ...base, color: 'rgba(255,255,255,0.58)' }
  return { ...base, color: '#f8fafc' }
}

export function projectsAvgRpnStyle(value: number | null, thresholds: RpnThresholds): CSSProperties {
  const base: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 72,
    minHeight: 30,
    padding: '4px 12px',
    borderRadius: settingsSurfaceRadius,
    border: `1px solid ${settingsSharedOverlayBorder}`,
    fontSize: 14,
    fontWeight: 700,
    lineHeight: 1,
    textAlign: 'center',
    verticalAlign: 'middle',
  }

  if (value == null || !Number.isFinite(value)) {
    return { ...base, color: '#f8fafc', background: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.16)' }
  }
  if (value <= thresholds.greenMax) {
    return { ...base, color: '#f8fafc', background: 'rgba(34,197,94,0.18)', borderColor: 'rgba(34,197,94,0.45)' }
  }
  if (value <= thresholds.yellowMax) {
    return { ...base, color: '#f8fafc', background: 'rgba(250,204,21,0.22)', borderColor: 'rgba(250,204,21,0.55)' }
  }
  if (value <= thresholds.orangeMax) {
    return { ...base, color: '#f8fafc', background: 'rgba(251,146,60,0.18)', borderColor: 'rgba(251,146,60,0.45)' }
  }
  return { ...base, color: '#f8fafc', background: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.35)' }
}
