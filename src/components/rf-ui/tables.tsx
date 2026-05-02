import type { CSSProperties, ReactNode } from 'react'

import {
  settingsSharedOverlayBorder,
  settingsSurfaceRadius,
} from './tokens'

export const settingsTableHeaderStyle: CSSProperties = {
  textAlign: 'left',
  padding: '10px 12px',
  fontSize: 13,
  color: '#f8fafc',
  fontWeight: 650,
  background: 'rgba(40, 39, 47, 0.88)',
  borderBottom: '1px solid rgba(255,255,255,0.14)',
  borderRight: '1px solid rgba(255,255,255,0.08)',
  whiteSpace: 'nowrap',
}

export const settingsTableCellStyle: CSSProperties = {
  padding: '10px 12px',
  verticalAlign: 'middle',
  fontSize: 14,
  color: '#f8fafc',
  overflow: 'hidden',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
  borderRight: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.03)',
}

export const settingsTableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  tableLayout: 'fixed',
  fontFamily: 'Arial, sans-serif',
}

export const settingsTableWrapStyle: CSSProperties = {
  borderRadius: settingsSurfaceRadius,
  border: `1px solid ${settingsSharedOverlayBorder}`,
  background: 'rgba(255,255,255,0.035)',
  boxShadow: 'none',
  backdropFilter: 'blur(6px)',
  WebkitBackdropFilter: 'blur(6px)',
  overflow: 'visible',
}

export const settingsTableScrollerStyle: CSSProperties = {
  overflowX: 'auto',
  overflowY: 'visible',
}

export const settingsHiddenTableColumnWidthPx = 34

export const settingsTableMetaTextStyle: CSSProperties = {
  marginTop: 6,
  fontSize: 12,
  color: 'rgba(255,255,255,0.6)',
}

export const settingsTableSecondaryTextStyle: CSSProperties = {
  fontSize: 13,
  lineHeight: 1.55,
  color: 'rgba(255,255,255,0.72)',
}

export const settingsTableEmptyTextStyle: CSSProperties = {
  fontSize: 13,
  color: 'rgba(255,255,255,0.6)',
}

export const settingsTableLevelBadgeStyle: CSSProperties = {
  display: 'inline-flex',
  minWidth: 40,
  justifyContent: 'center',
  borderRadius: 12,
  padding: '8px 10px',
  background: 'rgba(255,255,255,0.12)',
  border: '1px solid rgba(255,255,255,0.18)',
  fontWeight: 700,
}

export const settingsTableCellListStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
}

export const settingsTableCellListItemStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
  fontSize: 13,
  lineHeight: 1.5,
  color: 'rgba(255,255,255,0.72)',
}

export const settingsTableCellListBulletStyle: CSSProperties = {
  marginTop: 7,
  height: 6,
  width: 6,
  flexShrink: 0,
  borderRadius: 999,
  background: 'rgba(255,255,255,0.48)',
}

export const settingsTableActionsStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
}

export const settingsTableHeaderLabelStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
}

export function getSettingsTableColumnWidths<T extends string>({
  baseWidths,
  hiddenColumnWidth = settingsHiddenTableColumnWidthPx,
  hiddenColumns,
}: {
  baseWidths: Record<T | 'actions', number>
  hiddenColumnWidth?: number
  hiddenColumns: Record<T, boolean>
}): Record<T | 'actions', string> {
  const columnKeys = Object.keys(hiddenColumns) as T[]
  const totalWidth = Object.values(baseWidths).reduce((sum, width) => sum + Number(width), 0)
  const visibleKeys = columnKeys.filter((key) => !hiddenColumns[key])
  const hiddenKeys = columnKeys.filter((key) => hiddenColumns[key])
  const hiddenBudget = hiddenKeys.length * hiddenColumnWidth
  const visibleBudget = totalWidth - baseWidths.actions - hiddenBudget
  const visibleBaseTotal = visibleKeys.reduce((sum, key) => sum + baseWidths[key], 0)
  const widths = {} as Record<T | 'actions', string>

  columnKeys.forEach((key) => {
    if (hiddenColumns[key]) {
      widths[key] = `${((hiddenColumnWidth / totalWidth) * 100).toFixed(4)}%`
      return
    }

    const proportional = visibleBaseTotal > 0 ? (baseWidths[key] / visibleBaseTotal) * visibleBudget : 0
    widths[key] = `${((proportional / totalWidth) * 100).toFixed(4)}%`
  })

  widths.actions = `${((baseWidths.actions / totalWidth) * 100).toFixed(4)}%`
  return widths
}

export function SettingsLevelBadge({ children }: { children: ReactNode }) {
  return <div style={settingsTableLevelBadgeStyle}>{children}</div>
}

export function SettingsCellMetaText({ children }: { children: ReactNode }) {
  return <div style={settingsTableMetaTextStyle}>{children}</div>
}

export function SettingsCellList({
  emptyLabel = 'No items defined.',
  items,
}: {
  emptyLabel?: string
  items: string[]
}) {
  const visibleItems = items.map((item) => item.trim()).filter(Boolean)

  if (visibleItems.length === 0) {
    return <span style={settingsTableEmptyTextStyle}>{emptyLabel}</span>
  }

  return (
    <div style={settingsTableCellListStyle}>
      {visibleItems.map((item) => (
        <div key={item} style={settingsTableCellListItemStyle}>
          <span aria-hidden="true" style={settingsTableCellListBulletStyle} />
          <span>{item}</span>
        </div>
      ))}
    </div>
  )
}

export function SettingsTableActions({ children }: { children: ReactNode }) {
  return <div style={settingsTableActionsStyle}>{children}</div>
}

export function SettingsTableHeaderLabel({
  label,
  icon,
}: {
  label: ReactNode
  icon?: ReactNode
}) {
  return (
    <span style={settingsTableHeaderLabelStyle}>
      <span>{label}</span>
      {icon}
    </span>
  )
}

