'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '@app/lib/supabaseBrowser'
import { getSessionUserWithRetries } from '@/lib/auth/client-session'
import { DO_VALUES, SEVERITIES, cellKey, defaultColor } from '@/features/settings/risk-matrix/matrix-config'
import type { RiskColor } from '@/features/settings/risk-matrix/matrix-colors'
import { riskColorForMatrixCell, riskColorFromRpnValue } from '@/lib/risk-engine'
import {
  SettingsBanner,
  SettingsPageShell,
  SettingsSection,
  SettingsSummaryGrid,
  SettingsSummaryTile,
  settingsFrameStyle,
  settingsInputStyle,
  settingsProcessAccent,
  settingsRiskMatrixCellFill,
  settingsRiskSummaryTileStyle,
  settingsSummaryTileStyle,
  settingsTableCellStyle,
  settingsTableHeaderStyle,
  settingsTableScrollerStyle,
  settingsTableWrapStyle,
} from '@/components/rf-ui'
import { StandardSelect } from '@/features/settings/StandardSelect'
import { projectsProcessCellStyle, projectsSummaryValueStyle } from '@/features/projects/view-styles'
import { fetchRpnMatrixReportData } from './rpn-matrix-service'
import type { RpnMatrixFilters, RpnMatrixReportData } from './types'
import { toUserErrorMessage } from '@/lib/error-utils'

const EMPTY_FILTERS: RpnMatrixFilters = { departments: [], projectIds: [], sites: [] }
const RISK_COLOR_CHART_ORDER: RiskColor[] = ['red', 'orange', 'yellow', 'green']
const RISK_COLOR_CHART_LABELS: Record<RiskColor, string> = {
  green: 'Green',
  orange: 'Orange',
  red: 'Red',
  yellow: 'Yellow',
}

function formatNumber(value: number | null) {
  if (value == null || !Number.isFinite(value)) return '-'
  return String(Math.round(value))
}

function avgRpnTileStyle(value: number | null, data: RpnMatrixReportData | null) {
  if (value == null || !data) return settingsSummaryTileStyle
  if (data.matrixMode === 'manual') {
    return settingsSummaryTileStyle
  }

  const color = riskColorFromRpnValue(value, data.thresholds)
  return settingsRiskSummaryTileStyle(color)
}

function cellColor(severity: number, doValue: number, data: RpnMatrixReportData): RiskColor {
  return riskColorForMatrixCell(
    severity,
    doValue,
    data.matrixMode,
    data.thresholds,
    data.riskMatrixCells,
    defaultColor
  ) as RiskColor
}

function RpnMatrixSummary({ data }: { data: RpnMatrixReportData | null }) {
  const colorCounts = data?.summary.colorCounts ?? { green: 0, orange: 0, red: 0, yellow: 0 }

  return (
    <SettingsSummaryGrid columns={7}>
      <SettingsSummaryTile label="Open projects" value={data?.summary.openProjectCount ?? 0} valueStyle={{ ...projectsSummaryValueStyle, color: '#f8fafc' }} />
      <SettingsSummaryTile label="Open risks" value={data?.summary.riskCount ?? 0} valueStyle={{ ...projectsSummaryValueStyle, color: '#f8fafc' }} />
      <SettingsSummaryTile
        label="Open Average RPN"
        value={formatNumber(data?.summary.averageRpn ?? null)}
        style={avgRpnTileStyle(data?.summary.averageRpn ?? null, data)}
        valueStyle={{ ...projectsSummaryValueStyle, color: '#f8fafc' }}
      />
      <SettingsSummaryTile label="Actions must be defined" value={colorCounts.red} style={settingsRiskSummaryTileStyle('red')} valueStyle={{ ...projectsSummaryValueStyle, color: '#f8fafc' }} />
      <SettingsSummaryTile label="Action plan required" value={colorCounts.orange} style={settingsRiskSummaryTileStyle('orange')} valueStyle={{ ...projectsSummaryValueStyle, color: '#f8fafc' }} />
      <SettingsSummaryTile label="Actions recommended" value={colorCounts.yellow} style={settingsRiskSummaryTileStyle('yellow')} valueStyle={{ ...projectsSummaryValueStyle, color: '#f8fafc' }} />
      <SettingsSummaryTile label="Acceptable risk" value={colorCounts.green} style={settingsRiskSummaryTileStyle('green')} valueStyle={{ ...projectsSummaryValueStyle, color: '#f8fafc' }} />
    </SettingsSummaryGrid>
  )
}

function FilterSelect({
  allLabel = 'All',
  label,
  onChange,
  options,
  value,
}: {
  allLabel?: string
  label: string
  onChange: (value: string) => void
  options: Array<{ label: string; value: string }> | string[]
  value: string
}) {
  const normalizedOptions = options.map((option) => (typeof option === 'string' ? { label: option, value: option } : option))

  return (
    <label style={{ display: 'grid', gap: 5, minWidth: 220 }}>
      <span style={{ color: 'rgba(255,255,255,0.72)', fontSize: 12, fontWeight: 700 }}>{label}</span>
      <StandardSelect
        ariaLabel={label}
        onChange={onChange}
        options={[
          { label: allLabel, value: '' },
          ...normalizedOptions,
        ]}
        placeholder={allLabel}
        style={{ ...settingsInputStyle, height: 34 }}
        value={value}
      />
    </label>
  )
}

function RpnMatrixReportTable({ data }: { data: RpnMatrixReportData }) {
  const thinBorderColor = 'rgba(255,255,255,0.14)'
  const headerStyle: React.CSSProperties = {
    ...settingsTableHeaderStyle,
    borderColor: thinBorderColor,
    borderStyle: 'solid',
    borderWidth: 0.5,
    padding: '5px 6px',
    position: 'sticky',
    textAlign: 'center',
    top: 0,
    zIndex: 3,
  }
  const severityHeaderStyle: React.CSSProperties = {
    ...headerStyle,
    color: settingsProcessAccent,
    left: 0,
    minWidth: 88,
    width: 88,
    zIndex: 4,
  }

  return (
    <div style={{ ...settingsTableWrapStyle, border: 'none' }}>
      <div style={{ ...settingsTableScrollerStyle, padding: 10 }}>
        <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', width: '100%' }}>
          <thead>
            <tr>
              <th style={severityHeaderStyle}>Severity</th>
              {DO_VALUES.map((value) => (
                <th key={value} style={headerStyle}>
                  {value}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {SEVERITIES.map((severity) => (
              <tr key={severity}>
                <th style={{ ...severityHeaderStyle, top: 'auto' }}>
                  <div style={{ ...projectsProcessCellStyle, justifyContent: 'center' }}>{severity}</div>
                </th>

                {DO_VALUES.map((doValue) => {
                  const key = cellKey(severity, doValue)
                  const cell = data.cells[key]
                  const color = cell?.color ?? cellColor(severity, doValue, data)
                  const count = cell?.count ?? 0
                  const title = [
                    `Severity: ${severity}`,
                    `Occurrence x Detection: ${doValue}`,
                    `Risks: ${count}`,
                    cell?.averageRpn != null ? `Average RPN: ${cell.averageRpn}` : null,
                    cell?.rpnMin != null && cell?.rpnMax != null ? `RPN range: ${cell.rpnMin}-${cell.rpnMax}` : null,
                  ].filter(Boolean).join(' | ')

                  return (
                    <td
                      key={doValue}
                      title={title}
                      style={{
                        ...settingsTableCellStyle,
                        aspectRatio: '1 / 1',
                        background: settingsRiskMatrixCellFill(color),
                        borderColor: thinBorderColor,
                        borderStyle: 'solid',
                        borderWidth: 0.5,
                        color: '#111',
                        fontSize: count > 0 ? 13 : 10,
                        fontWeight: 850,
                        padding: 0,
                        textAlign: 'center',
                        userSelect: 'none',
                        verticalAlign: 'middle',
                        width: 'auto',
                      }}
                    >
                      {count > 0 ? count : ''}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ color: 'rgba(255,255,255,0.78)', fontSize: 12.5, fontWeight: 700, marginTop: 8, textAlign: 'center' }}>
          Occurrence x Detection
        </div>
      </div>
    </div>
  )
}

function RpnMatrixProjectColorChart({ data }: { data: RpnMatrixReportData }) {
  const projects = data.projectColorCounts
  const maxTotal = Math.max(
    1,
    ...projects.map((project) => RISK_COLOR_CHART_ORDER.reduce((sum, color) => sum + (project.colorCounts[color] ?? 0), 0))
  )

  return (
    <div style={projectChartWrapStyle}>
      <div style={projectChartHeaderStyle}>
        <div style={projectChartTitleStyle}>Risk color count by project</div>
        <div style={projectChartLegendStyle}>
          {RISK_COLOR_CHART_ORDER.map((color) => (
            <span key={color} style={projectChartLegendItemStyle}>
              <span style={{ ...projectChartLegendSwatchStyle, background: settingsRiskMatrixCellFill(color) }} />
              {RISK_COLOR_CHART_LABELS[color]}
            </span>
          ))}
        </div>
      </div>

      {projects.length === 0 || data.summary.riskCount === 0 ? (
        <div style={{ color: 'rgba(255,255,255,0.62)', fontSize: 13, padding: '14px 2px' }}>No risks available for the selected filters.</div>
      ) : (
        <div style={projectChartScrollerStyle}>
          <div style={projectChartGroupsStyle}>
            {projects.map((project) => (
              <div key={project.projectId} style={projectChartGroupStyle}>
                <div style={projectChartStackStyle}>
                  {RISK_COLOR_CHART_ORDER.map((color) => {
                    const count = project.colorCounts[color] ?? 0
                    const height = count > 0 ? Math.max(18, Math.round((count / maxTotal) * 150)) : 0

                    return (
                      <div
                        key={color}
                        title={`${project.projectName} | ${RISK_COLOR_CHART_LABELS[color]}: ${count}`}
                        style={{
                          ...projectChartStackSegmentStyle,
                          background: count > 0 ? settingsRiskMatrixCellFill(color) : 'transparent',
                          borderColor: count > 0 ? 'rgba(255,255,255,0.22)' : 'transparent',
                          height,
                        }}
                      >
                        <div
                          aria-label={`${project.projectName} ${RISK_COLOR_CHART_LABELS[color]} risks: ${count}`}
                          style={projectChartSegmentValueStyle}
                        >
                          {count || ''}
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div title={project.projectName} style={projectChartProjectNameStyle}>
                  {project.projectName}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function RpnMatrixReportPage() {
  const [data, setData] = useState<RpnMatrixReportData | null>(null)
  const [filters, setFilters] = useState<RpnMatrixFilters>(EMPTY_FILTERS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const selectedSite = filters.sites[0] ?? ''
  const selectedDepartment = filters.departments[0] ?? ''
  const selectedProjectId = filters.projectIds[0] ?? ''

  const subtitle = useMemo(() => {
    if (!data) return 'Counts PFMEA risks from Open projects by Severity and Occurrence x Detection.'
    return `Counts PFMEA risks from ${data.projects.length} Open project${data.projects.length === 1 ? '' : 's'} by Severity and Occurrence x Detection.`
  }, [data])

  useEffect(() => {
    let active = true

    ;(async () => {
      setLoading(true)
      setError('')

      try {
        const user = await getSessionUserWithRetries()
        if (!user) throw new Error('Cannot read user: Not authenticated.')
        const next = await fetchRpnMatrixReportData(supabase, user.id, filters)
        if (active) setData(next)
      } catch (loadError) {
        if (active) setError(toUserErrorMessage(loadError, 'Could not load RPN Matrix report.'))
      } finally {
        if (active) setLoading(false)
      }
    })()

    return () => {
      active = false
    }
  }, [filters])

  return (
    <SettingsPageShell
      title="RPN Matrix Report"
      titleStyle={{ color: settingsProcessAccent }}
      subtitle={subtitle}
      summary={<RpnMatrixSummary data={data} />}
    >
      {error ? (
        <SettingsBanner tone="error">
          <b>Report error:</b> {error}
        </SettingsBanner>
      ) : null}

      <SettingsSection style={{ padding: '10px 12px' }}>
        <div style={{ alignItems: 'flex-end', display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <FilterSelect
              label="Site"
              onChange={(value) => setFilters((current) => ({ ...current, projectIds: [], sites: value ? [value] : [] }))}
              options={data?.sites ?? []}
              value={selectedSite}
            />
            <FilterSelect
              label="Department"
              onChange={(value) => setFilters((current) => ({ ...current, departments: value ? [value] : [], projectIds: [] }))}
              options={data?.departments ?? []}
              value={selectedDepartment}
            />
            <FilterSelect
              allLabel="All Projects"
              label="Project"
              onChange={(value) => setFilters((current) => ({ ...current, projectIds: value ? [value] : [] }))}
              options={(data?.projectOptions ?? []).map((project) => ({ label: project.name, value: project.id }))}
              value={selectedProjectId}
            />
          </div>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 650 }}>
            {loading ? 'Loading report...' : 'Only Open projects are included.'}
          </div>
        </div>
      </SettingsSection>

      <SettingsSection style={{ overflow: 'visible', padding: 0 }}>
        {data ? (
          <RpnMatrixReportTable data={data} />
        ) : (
          <div style={{ ...settingsFrameStyle, color: 'rgba(255,255,255,0.72)', padding: 16 }}>
            {loading ? 'Loading RPN Matrix report...' : 'No data available.'}
          </div>
        )}
      </SettingsSection>

      {data ? (
        <SettingsSection style={{ overflow: 'visible', padding: 12 }}>
          <RpnMatrixProjectColorChart data={data} />
        </SettingsSection>
      ) : null}
    </SettingsPageShell>
  )
}

const projectChartWrapStyle: React.CSSProperties = {
  display: 'grid',
  gap: 10,
}

const projectChartHeaderStyle: React.CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  gap: 12,
  justifyContent: 'space-between',
  marginBottom: 10,
  flexWrap: 'wrap',
}

const projectChartTitleStyle: React.CSSProperties = {
  color: settingsProcessAccent,
  fontSize: 14,
  fontWeight: 800,
}

const projectChartLegendStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
}

const projectChartLegendItemStyle: React.CSSProperties = {
  alignItems: 'center',
  color: 'rgba(255,255,255,0.72)',
  display: 'inline-flex',
  fontSize: 12,
  fontWeight: 650,
  gap: 5,
}

const projectChartLegendSwatchStyle: React.CSSProperties = {
  border: '1px solid rgba(255,255,255,0.22)',
  borderRadius: 4,
  height: 10,
  width: 10,
}

const projectChartScrollerStyle: React.CSSProperties = {
  overflowX: 'auto',
  paddingBottom: 2,
}

const projectChartGroupsStyle: React.CSSProperties = {
  alignItems: 'flex-end',
  display: 'flex',
  gap: 22,
  minHeight: 210,
  minWidth: 'max-content',
}

const projectChartGroupStyle: React.CSSProperties = {
  display: 'grid',
  gap: 8,
  justifyItems: 'center',
  minWidth: 126,
}

const projectChartStackStyle: React.CSSProperties = {
  alignItems: 'flex-end',
  borderBottom: '1px solid rgba(255,255,255,0.18)',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'flex-end',
  height: 176,
  padding: '0 10px',
  width: 54,
}

const projectChartStackSegmentStyle: React.CSSProperties = {
  alignItems: 'center',
  border: '1px solid rgba(255,255,255,0.22)',
  display: 'flex',
  justifyContent: 'center',
  minHeight: 0,
  overflow: 'hidden',
  transition: 'height 140ms ease',
  width: '100%',
}

const projectChartSegmentValueStyle: React.CSSProperties = {
  color: '#f8fafc',
  fontSize: 11,
  fontWeight: 850,
  lineHeight: 1,
  textShadow: '0 1px 2px rgba(0,0,0,0.4)',
}

const projectChartProjectNameStyle: React.CSSProperties = {
  color: 'rgba(255,255,255,0.78)',
  fontSize: 12,
  fontWeight: 650,
  lineHeight: 1.25,
  maxWidth: 126,
  minHeight: 30,
  overflow: 'hidden',
  textAlign: 'center',
  textOverflow: 'ellipsis',
  whiteSpace: 'normal',
}
