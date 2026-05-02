import type { CSSProperties, ReactNode } from 'react'

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

export const settingsSummaryTileStyle: CSSProperties = {
  minHeight: 82,
  padding: '10px 12px',
  borderRadius: settingsSurfaceRadius,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  textAlign: 'center',
  background: 'rgba(255,255,255,0.12)',
  border: '1px solid rgba(255,255,255,0.22)',
}

export const settingsSummaryGridStyle: CSSProperties = {
  width: '100%',
  maxWidth: 920,
  display: 'grid',
  gap: 10,
}

const settingsSummaryGridStandardColumns = 7
const settingsSummaryGridStandardMaxWidth = 920
const settingsSummaryGridGapPx = 10
const settingsSummaryTileStandardWidth =
  (settingsSummaryGridStandardMaxWidth - (settingsSummaryGridStandardColumns - 1) * settingsSummaryGridGapPx) /
  settingsSummaryGridStandardColumns

export function getSettingsSummaryGridMaxWidth(columns: number) {
  return Math.round(settingsSummaryTileStandardWidth * columns + settingsSummaryGridGapPx * Math.max(columns - 1, 0))
}

export function settingsRiskSummaryTileStyle(color: SettingsRiskColor): CSSProperties {
  const byColor: Record<SettingsRiskColor, CSSProperties> = {
    red: {
      background: 'rgba(239,68,68,0.12)',
      border: '1px solid rgba(239,68,68,0.35)',
    },
    orange: {
      background: 'rgba(251,146,60,0.18)',
      border: '1px solid rgba(251,146,60,0.45)',
    },
    yellow: {
      background: 'rgba(250,204,21,0.22)',
      border: '1px solid rgba(250,204,21,0.55)',
    },
    green: {
      background: 'rgba(34,197,94,0.18)',
      border: '1px solid rgba(34,197,94,0.45)',
    },
  }

  return {
    ...settingsSummaryTileStyle,
    ...byColor[color],
  }
}

export function SettingsSummaryGrid({
  children,
  columns = 7,
  maxWidth = settingsSummaryGridStandardMaxWidth,
}: {
  children: ReactNode
  columns?: number
  maxWidth?: number
}) {
  return (
    <div
      style={{
        ...settingsSummaryGridStyle,
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        maxWidth,
      }}
    >
      {children}
    </div>
  )
}

export function SettingsSummaryTile({
  label,
  style,
  value,
  valueStyle,
}: {
  label: ReactNode
  style?: CSSProperties
  value: ReactNode
  valueStyle?: CSSProperties
}) {
  return (
    <div style={{ ...settingsSummaryTileStyle, ...style }}>
      <div style={{ fontSize: 12, color: '#f8fafc' }}>{label}</div>
      <div style={{ ...settingsStatValueStyle, ...valueStyle }}>{value}</div>
    </div>
  )
}

export const settingsMutedTileStyle: CSSProperties = {
  padding: 10,
  borderRadius: 10,
  background: 'rgba(255,255,255,0.12)',
  border: '1px solid rgba(255,255,255,0.22)',
}

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
  color: settingsPopupText,
}

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

export function settingsRiskMatrixControlTileStyle(color: SettingsRiskColor): CSSProperties {
  return {
    ...settingsRiskSummaryTileStyle(color),
    position: 'relative',
    minHeight: 86,
    padding: '10px 12px',
    display: 'block',
    gap: 8,
    textAlign: 'center',
  }
}

export const settingsRiskMatrixLegendLabelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  lineHeight: 1.35,
  color: 'rgba(248,250,252,0.86)',
  textAlign: 'center',
  width: '100%',
}

export const settingsRiskMatrixThresholdRowStyle: CSSProperties = {
  position: 'absolute',
  left: '50%',
  bottom: 12,
  transform: 'translateX(-50%)',
  display: 'grid',
  alignItems: 'center',
  gridTemplateColumns: '42px 83px',
  justifyContent: 'center',
  columnGap: 8,
  width: 133,
}

export const settingsRiskMatrixComparatorStyle: CSSProperties = {
  width: 42,
  color: '#fff',
  fontSize: 12,
  fontWeight: 700,
  textAlign: 'right',
  whiteSpace: 'nowrap',
}

export const settingsRiskMatrixValuePillStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 62,
  height: 25,
  minHeight: 25,
  boxSizing: 'border-box',
  padding: '0 8px',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 7,
  background: 'rgba(40,39,47,0.82)',
  color: '#fff',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
  fontSize: 12,
  fontWeight: 700,
  lineHeight: '25px',
}

export const settingsRiskMatrixValueControlStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 4,
  width: 83,
}

export const settingsRiskMatrixStepperButtonStyle: CSSProperties = {
  width: 17,
  height: 12,
  minHeight: 12,
  padding: 0,
  borderRadius: 4,
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(40,39,47,0.72)',
  color: 'rgba(255,255,255,0.78)',
  cursor: 'pointer',
  fontSize: 8,
  fontWeight: 800,
  lineHeight: '10px',
}

export const settingsRiskMatrixSwatchButtonStyle: CSSProperties = {
  ...settingsCompactActionButtonStyle,
  width: 36,
  height: 36,
  minHeight: 36,
  padding: 0,
  justifyContent: 'center',
}

export function settingsRiskMatrixSwatchStyle(color: SettingsRiskColor): CSSProperties {
  return {
    width: 14,
    height: 14,
    borderRadius: 4,
    border: '1px solid rgba(255,255,255,0.24)',
    background: settingsRiskMatrixCellFill(color),
  }
}

export function settingsSegmentButtonStyle(active: boolean): CSSProperties {
  return {
    ...settingsCompactActionButtonStyle,
    background: active ? 'rgba(217,168,108,0.18)' : 'rgba(255,255,255,0.08)',
    borderColor: active ? 'rgba(217,168,108,0.45)' : 'rgba(255,255,255,0.18)',
    color: active ? settingsProcessAccent : '#f8fafc',
  }
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

export const settingsFilterClearButtonStyle: CSSProperties = {
  padding: '2px 8px',
  borderRadius: settingsSurfaceRadius,
  border: `1px solid ${settingsSharedOverlayBorder}`,
  fontSize: 11,
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

export const settingsTableHeaderLabelStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
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

export const settingsModalCardStyle: CSSProperties = {
  width: 520,
  maxWidth: '92vw',
  background: settingsSharedOverlayBg,
  borderRadius: settingsSurfaceRadius,
  border: `1px solid ${settingsSharedOverlayBorder}`,
  boxShadow: '0 16px 36px rgba(0,0,0,0.2)',
  padding: 20,
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
}

export const settingsModalTitleStyle: CSSProperties = {
  fontSize: 19,
  fontWeight: 700,
  marginBottom: 10,
  color: '#fff',
}

export const settingsModalBodyStyle: CSSProperties = {
  fontSize: 15,
  color: 'rgba(255,255,255,0.8)',
  lineHeight: 1.5,
  marginBottom: 10,
}

export const settingsModalActionsStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
  justifyContent: 'flex-end',
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

export function settingsInlineStatusStyle(status: string): CSSProperties {
  const normalized = status.toLowerCase()
  const base: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: 12,
    fontWeight: 700,
    whiteSpace: 'nowrap',
  }

  if (normalized === 'open') return { ...base, color: '#16a34a' }
  if (normalized === 'active') return { ...base, color: '#16a34a' }
  if (normalized === 'inactive') return { ...base, color: 'rgba(255,255,255,0.58)' }
  if (normalized === 'noactive') return { ...base, color: 'rgba(255,255,255,0.58)' }
  if (normalized === 'pending') return { ...base, color: settingsProcessAccent }
  if (normalized === 'draft') return { ...base, color: '#6b7280' }
  if (normalized === 'obsolete') return { ...base, color: '#b91c1c' }
  return { ...base, color: '#f8fafc' }
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

export function SettingsBackdrop() {
  return <SettingsBackdropTone />
}

export function SettingsBackdropTone({
  imageStyle,
  overlayStyle,
}: {
  imageStyle?: CSSProperties
  overlayStyle?: CSSProperties
}) {
  return (
    <>
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: "url('/home-hero-bg.svg')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          ...imageStyle,
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(88, 58, 39, 0.58), rgba(23, 31, 51, 0.86))',
          ...overlayStyle,
        }}
      />
    </>
  )
}

export function SettingsPageShell({
  title,
  titleStyle,
  subtitle,
  actions,
  summary,
  children,
  backdrop,
}: {
  title: string
  titleStyle?: CSSProperties
  subtitle: ReactNode
  actions?: ReactNode
  summary?: ReactNode
  children: ReactNode
  backdrop?: ReactNode
}) {
  return (
    <div style={settingsPageStyle}>
      {backdrop ?? <SettingsBackdrop />}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ ...settingsFrameStyle, marginTop: 20 }}>
          <div style={{ ...settingsHeroCardStyle, padding: '10px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 320px', maxWidth: 560 }}>
                <div style={{ ...settingsTitleStyle, ...titleStyle }}>{title}</div>
                <div style={settingsSubtitleStyle}>{subtitle}</div>
                {actions ? <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>{actions}</div> : null}
              </div>
              {summary ? (
                <div style={{ width: '100%', maxWidth: 920, marginLeft: 'auto', alignSelf: 'flex-start' }}>{summary}</div>
              ) : null}
            </div>
          </div>
        </div>

        {children}
      </div>
    </div>
  )
}

export function SettingsSection({
  children,
  style,
}: {
  children: ReactNode
  style?: CSSProperties
}) {
  return (
    <div style={{ ...settingsFrameStyle, marginTop: 12 }}>
      <div style={{ ...settingsCardStyle, ...style }}>{children}</div>
    </div>
  )
}

export function SettingsBanner({
  tone,
  children,
}: {
  tone: 'error' | 'success' | 'neutral'
  children: ReactNode
}) {
  if (tone === 'success' || tone === 'error') {
    return (
      <div style={{ ...settingsFrameStyle, marginTop: 8 }}>
        <div
          role={tone === 'error' ? 'alert' : 'status'}
          style={{
            color: tone === 'error' ? '#fecaca' : '#bbf7d0',
            fontSize: 12.5,
            fontWeight: 650,
            lineHeight: 1.35,
            padding: '0 2px',
          }}
        >
          {children}
        </div>
      </div>
    )
  }

  const neutralStyle: CSSProperties = {
    background: 'rgba(255,255,255,0.08)',
    color: '#f8fafc',
    borderColor: settingsSharedOverlayBorder,
  }

  return (
    <div style={{ ...settingsFrameStyle, marginTop: 12 }}>
      <div
        style={{
          fontSize: 12,
          padding: '10px 12px',
          borderRadius: settingsSurfaceRadius,
          borderStyle: 'solid',
          borderWidth: 1,
          ...neutralStyle,
        }}
      >
        {children}
      </div>
    </div>
  )
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

export function SettingsTrashButton({
  onClick,
  title = 'Delete item',
  ariaLabel = 'Delete item',
  style,
}: {
  onClick?: () => void
  title?: string
  ariaLabel?: string
  style?: CSSProperties
}) {
  const textButtonStyle: CSSProperties = {
    ...settingsCompactActionButtonStyle,
    padding: '0 10px',
    color: '#f8fafc',
    background: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.18)',
  }

  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
      className="rf-button settings-trash-btn"
      style={{ ...textButtonStyle, ...style }}
    >
      Delete
    </button>
  )
}

export function SettingsConfirmDialog({
  open,
  title,
  body,
  warning,
  busy,
  confirmLabel = 'Yes',
  cancelLabel = 'Cancel',
  hideConfirm = false,
  onCancel,
  onConfirm,
}: {
  open: boolean
  title: string
  body: ReactNode
  warning?: ReactNode
  busy?: boolean
  confirmLabel?: string
  cancelLabel?: string
  hideConfirm?: boolean
  onCancel: () => void
  onConfirm: () => void | Promise<void>
}) {
  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(4, 8, 20, 0.52)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 80,
      }}
      onClick={() => (busy ? null : onCancel())}
    >
      <div style={settingsModalCardStyle} onClick={(event) => event.stopPropagation()}>
        <div style={settingsModalTitleStyle}>{title}</div>
        <div style={settingsModalBodyStyle}>{body}</div>
        {warning ? (
          <div style={settingsDangerInlineStyle}>
            <span aria-hidden="true" style={settingsDangerInlineAccentStyle} />
            <span>{warning}</span>
          </div>
        ) : null}
        <div style={{ ...settingsModalActionsStyle, marginTop: 16 }}>
          <button
            onClick={() => (busy ? null : onCancel())}
            disabled={busy}
            className="rf-button"
            style={{ ...settingsActionButtonStyle, minHeight: 34, padding: '8px 12px' }}
          >
            {cancelLabel}
          </button>
          {hideConfirm ? null : (
            <button
              onClick={() => {
                if (busy) return
                void onConfirm()
              }}
              disabled={busy}
              className="rf-button"
              style={{ ...settingsActionButtonStyle, minHeight: 34, padding: '8px 12px', fontWeight: 650 }}
            >
              {confirmLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
