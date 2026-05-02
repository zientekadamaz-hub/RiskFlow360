'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '@app/lib/supabaseBrowser'
import { getSessionUserWithRetries } from '@/lib/auth/client-session'
import {
  SettingsBanner,
  SettingsPageShell,
  SettingsSection,
  SettingsSummaryGrid,
  SettingsSummaryTile,
  getSettingsSummaryGridMaxWidth,
  settingsFrameStyle,
  settingsInputStyle,
  settingsProcessAccent,
  settingsRiskSummaryTileStyle,
  settingsSummaryTileStyle,
} from '@/features/settings/invitation-shell'
import { StandardSelect } from '@/features/settings/StandardSelect'
import { projectsSummaryValueStyle } from '@/features/projects/view-styles'
import { fetchProgressChartData } from './progress-chart-service'
import type { ProgressChartData, ProgressChartFilters, ProgressChartPoint, ProgressGranularity } from './types'
import type { RpnThresholds } from '@/features/projects/types'

const DEFAULT_FILTERS: ProgressChartFilters = {
  departments: [],
  granularity: 'monthly',
  projectIds: [],
  sites: [],
}

const GRANULARITY_OPTIONS: Array<{ label: string; value: ProgressGranularity }> = [
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
]

const CHART_WIDTH = 920
const CHART_HEIGHT = 297
const CHART_PADDING = { bottom: 44, left: 24, right: 24, top: 8 }

function formatIntegerValue(value: number | null) {
  if (value == null || !Number.isFinite(value)) return '-'
  return String(Math.round(value))
}

function avgRpnTileStyle(value: number | null, thresholds: RpnThresholds) {
  if (value == null || !Number.isFinite(value)) return settingsSummaryTileStyle
  if (value <= thresholds.greenMax) return settingsRiskSummaryTileStyle('green')
  if (value <= thresholds.yellowMax) return settingsRiskSummaryTileStyle('yellow')
  if (value <= thresholds.orangeMax) return settingsRiskSummaryTileStyle('orange')
  return settingsRiskSummaryTileStyle('red')
}

function FilterSelect({
  disabled,
  label,
  onChange,
  options,
  value,
}: {
  disabled?: boolean
  label: string
  onChange: (value: string) => void
  options: Array<{ label: string; value: string }>
  value: string
}) {
  return (
    <label style={{ display: 'grid', gap: 5, minWidth: 220 }}>
      <span style={{ color: 'rgba(255,255,255,0.72)', fontSize: 12, fontWeight: 700 }}>{label}</span>
      <StandardSelect
        ariaLabel={label}
        disabled={disabled}
        onChange={onChange}
        options={options}
        style={{ ...settingsInputStyle, height: 34 }}
        value={value}
      />
    </label>
  )
}

function ProgressSummary({ data }: { data: ProgressChartData | null }) {
  const averageRpn = data?.summary.averageRpn ?? null
  const thresholds = data?.summary.thresholds ?? DEFAULT_RPN_THRESHOLDS

  return (
    <div style={{ marginLeft: 'auto', maxWidth: getSettingsSummaryGridMaxWidth(3), width: '100%' }}>
      <SettingsSummaryGrid columns={3} maxWidth={getSettingsSummaryGridMaxWidth(3)}>
        <SettingsSummaryTile
          label="Average RPN"
          value={formatIntegerValue(averageRpn)}
          style={avgRpnTileStyle(averageRpn, thresholds)}
          valueStyle={{ ...projectsSummaryValueStyle, color: '#f8fafc' }}
        />
        <SettingsSummaryTile label="Open projects" value={data?.summary.openProjectsCount ?? 0} valueStyle={{ ...projectsSummaryValueStyle, color: '#f8fafc' }} />
        <SettingsSummaryTile label="Open risks" value={data?.summary.currentRecordCount ?? 0} valueStyle={{ ...projectsSummaryValueStyle, color: '#f8fafc' }} />
      </SettingsSummaryGrid>
    </div>
  )
}

const DEFAULT_RPN_THRESHOLDS: RpnThresholds = { greenMax: 100, yellowMax: 200, orangeMax: 360 }

function chartYMax(points: ProgressChartPoint[], thresholds: RpnThresholds) {
  const values = points.map((point) => point.averageRpn)
  const maxValue = Math.max(10, thresholds.orangeMax + 25, ...values)
  return Math.ceil(maxValue / 50) * 50
}

function chartLinePoints(points: ProgressChartPoint[], thresholds: RpnThresholds) {
  const plotWidth = CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right
  const plotHeight = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom
  const yMax = chartYMax(points, thresholds)
  const slotWidth = plotWidth / Math.max(points.length, 1)

  return points.map((point, index) => {
    const x = CHART_PADDING.left + index * slotWidth + slotWidth / 2
    const y = CHART_PADDING.top + plotHeight - (point.averageRpn / yMax) * plotHeight
    return { ...point, slotWidth, x, y, yMax }
  })
}

type ChartPoint = ReturnType<typeof chartLinePoints>[number]

function rpnThresholdLines(yMax: number, thresholds: RpnThresholds) {
  const plotHeight = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom
  const plotBottom = CHART_HEIGHT - CHART_PADDING.bottom
  const plotLeft = CHART_PADDING.left
  const plotRight = CHART_WIDTH - CHART_PADDING.right
  const values = [
    { color: 'rgb(77, 190, 116)', strokeWidth: 0.2, value: thresholds.greenMax },
    { color: 'rgba(219, 201, 91, 0.95)', strokeWidth: 0.4, value: thresholds.yellowMax },
    { color: 'rgba(226, 145, 70, 0.95)', strokeWidth: 0.4, value: thresholds.orangeMax },
  ]

  return values
    .filter((item, index, list) => item.value > 0 && item.value < yMax && list.findIndex((candidate) => candidate.value === item.value) === index)
    .map((item) => ({
      ...item,
      x1: plotLeft,
      x2: plotRight,
      y: plotBottom - (item.value / yMax) * plotHeight,
    }))
}

function parseLocalDateKey(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

function compactBarLabel(point: ProgressChartPoint, granularity: ProgressGranularity) {
  const start = parseLocalDateKey(point.bucketStart)
  if (!start) return point.label

  if (granularity === 'daily') return String(start.getDate()).padStart(2, '0')
  if (granularity === 'monthly') return String(start.getMonth() + 1).padStart(2, '0')

  return String(isoWeekNumber(start)).padStart(2, '0')
}

function isoWeekNumber(date: Date) {
  const target = new Date(date)
  target.setHours(0, 0, 0, 0)
  target.setDate(target.getDate() + 3 - ((target.getDay() + 6) % 7))
  const week1 = new Date(target.getFullYear(), 0, 4)
  return 1 + Math.round(((target.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
}

function groupLabelFor(point: ProgressChartPoint, granularity: ProgressGranularity) {
  const start = parseLocalDateKey(point.bucketStart)
  if (!start) return null

  if (granularity === 'daily') {
    return {
      key: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`,
      label: String(start.getMonth() + 1).padStart(2, '0'),
    }
  }

  if (granularity === 'monthly') {
    return {
      key: String(start.getFullYear()),
      label: String(start.getFullYear()),
    }
  }

  return null
}

function groupedAxisLabels(points: ChartPoint[], granularity: ProgressGranularity) {
  const groups: Array<{ key: string; label: string; startX: number; endX: number }> = []

  for (const point of points) {
    const group = groupLabelFor(point, granularity)
    if (!group) continue

    const startX = point.x - point.slotWidth / 2
    const endX = point.x + point.slotWidth / 2
    const last = groups.at(-1)
    if (last?.key === group.key) {
      last.endX = endX
    } else {
      groups.push({ ...group, startX, endX })
    }
  }

  return groups
}

function ProgressLineChart({
  granularity,
  points,
  thresholds,
}: {
  granularity: ProgressGranularity
  points: ProgressChartPoint[]
  thresholds: RpnThresholds
}) {
  const [hoveredBucketKey, setHoveredBucketKey] = useState<string | null>(null)

  if (!points.length) {
    return (
      <div style={emptyChartStyle}>
        No RPN records available for the selected filters.
      </div>
    )
  }

  const linePoints = chartLinePoints(points, thresholds)
  const yMax = linePoints[0]?.yMax ?? chartYMax(points, thresholds)
  const thresholdLines = rpnThresholdLines(yMax, thresholds)
  const groupLabels = groupedAxisLabels(linePoints, granularity)
  const xAxisY = CHART_HEIGHT - CHART_PADDING.bottom
  const xAxisStep = 13
  const xLabelToGroupLineGap = 7
  const barLabelY = xAxisY + xAxisStep
  const groupLineY = barLabelY + xLabelToGroupLineGap
  const groupLabelY = groupLineY + xAxisStep
  const linePath = linePoints.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ')
  const areaPath =
    linePoints.length > 0
      ? `${linePath} L ${linePoints.at(-1)?.x.toFixed(2)} ${xAxisY.toFixed(2)} L ${linePoints[0].x.toFixed(2)} ${xAxisY.toFixed(2)} Z`
      : ''
  const hoveredPoint = linePoints.find((point) => point.bucketKey === hoveredBucketKey) ?? null
  const hoverLabelWidth = 146
  const hoverLabelX = hoveredPoint
    ? Math.min(CHART_WIDTH - CHART_PADDING.right - hoverLabelWidth, Math.max(CHART_PADDING.left, hoveredPoint.x - hoverLabelWidth / 2))
    : 0
  const hoverLabelY = hoveredPoint ? Math.min(xAxisY - 34, Math.max(CHART_PADDING.top + 8, hoveredPoint.y + 16)) : 0

  return (
    <div style={chartScrollerStyle}>
      <svg
        role="img"
        aria-label="Average RPN trend over time"
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        style={chartSvgStyle}
      >
        <defs>
          <linearGradient id="progress-line-area" x1="0" x2="0" y1={CHART_PADDING.top} y2={xAxisY} gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="rgba(82, 182, 255, 0.34)" />
            <stop offset="55%" stopColor="rgba(82, 182, 255, 0.13)" />
            <stop offset="100%" stopColor="rgba(82, 182, 255, 0)" />
          </linearGradient>
        </defs>

        {thresholdLines.map((line) => (
          <g key={line.value}>
            <line x1={line.x1} x2={line.x2} y1={line.y} y2={line.y} stroke={line.color} strokeDasharray="4 5" strokeWidth={line.strokeWidth} />
            <text x={CHART_PADDING.left - 8} y={line.y + 3} textAnchor="end" style={{ ...chartThresholdTextStyle, fill: line.color }}>
              {line.value}
            </text>
          </g>
        ))}

        <line
          x1={CHART_PADDING.left}
          x2={CHART_WIDTH - CHART_PADDING.right}
          y1={CHART_HEIGHT - CHART_PADDING.bottom}
          y2={CHART_HEIGHT - CHART_PADDING.bottom}
          stroke="rgba(255, 255, 255, 0.16)"
        />

        <path d={areaPath} fill="url(#progress-line-area)" />
        <path
          d={linePath}
          fill="none"
          stroke="rgba(82, 182, 255, 0.96)"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={0.85}
        />

        {linePoints.map((point) => (
          <g key={point.bucketKey}>
            <circle cx={point.x} cy={point.y} r={2.1} fill="rgba(82, 182, 255, 0.5)" stroke="rgba(248,250,252,0.34)" strokeWidth={0.35} />
            <rect
              x={point.x - point.slotWidth / 2}
              y={CHART_PADDING.top}
              width={point.slotWidth}
              height={xAxisY - CHART_PADDING.top}
              fill="transparent"
              onMouseEnter={() => setHoveredBucketKey(point.bucketKey)}
              onMouseLeave={() => setHoveredBucketKey(null)}
            />
            <text
              x={point.x}
              y={barLabelY}
              textAnchor="middle"
              style={chartAxisTextStyle}
            >
              {compactBarLabel(point, granularity)}
            </text>
          </g>
        ))}

        {groupLabels.map((group) => {
          const centerX = (group.startX + group.endX) / 2
          const groupLineGap = 8
          const startX = Math.min(centerX, group.startX + groupLineGap / 2)
          const endX = Math.max(centerX, group.endX - groupLineGap / 2)
          return (
            <g key={group.key}>
              <line x1={startX} x2={endX} y1={groupLineY} y2={groupLineY} stroke="#d9a86c" strokeWidth={0.25} />
              <text x={centerX} y={groupLabelY} textAnchor="middle" style={chartGroupTextStyle}>
                {group.label}
              </text>
            </g>
          )
        })}

        {hoveredPoint ? (
          <g pointerEvents="none">
            <line
              x1={hoveredPoint.x}
              x2={hoveredPoint.x}
              y1={hoveredPoint.y}
              y2={xAxisY}
              stroke="rgba(82, 182, 255, 0.38)"
              strokeDasharray="2 5"
              strokeWidth={0.55}
            />
            <circle cx={hoveredPoint.x} cy={hoveredPoint.y} r={8} fill="rgba(82, 182, 255, 0.18)" />
            <circle cx={hoveredPoint.x} cy={hoveredPoint.y} r={3.4} fill="rgba(82, 182, 255, 0.98)" stroke="rgba(248,250,252,0.92)" strokeWidth={0.8} />
            <rect
              x={hoverLabelX}
              y={hoverLabelY}
              width={hoverLabelWidth}
              height={30}
              rx={6}
              fill="rgba(40, 39, 47, 0.94)"
              stroke="rgba(255,255,255,0.16)"
              strokeWidth={0.55}
            />
            <text x={hoverLabelX + 8} y={hoverLabelY + 12} style={chartHoverLabelStyle}>
              {hoveredPoint.label}
            </text>
            <text x={hoverLabelX + 8} y={hoverLabelY + 23} style={chartHoverValueStyle}>
              RPN {Math.round(hoveredPoint.averageRpn)} | Records {hoveredPoint.recordCount}
            </text>
          </g>
        ) : null}
      </svg>
    </div>
  )
}

export function ProgressChartReportPage() {
  const [data, setData] = useState<ProgressChartData | null>(null)
  const [filters, setFilters] = useState<ProgressChartFilters>(DEFAULT_FILTERS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const selectedSite = filters.sites[0] ?? ''
  const selectedDepartment = filters.departments[0] ?? ''
  const selectedProjectId = filters.projectIds[0] ?? ''

  const projectOptions = useMemo(() => {
    const projects = data?.projectOptions ?? []
    return [
      { label: 'All Projects', value: '' },
      ...projects
        .filter((project) => !selectedSite || project.site === selectedSite)
        .filter((project) => !selectedDepartment || project.department === selectedDepartment)
        .map((project) => ({ label: project.name, value: project.id })),
    ]
  }, [data?.projectOptions, selectedDepartment, selectedSite])

  useEffect(() => {
    let active = true

    ;(async () => {
      setLoading(true)
      setError('')

      try {
        const user = await getSessionUserWithRetries()
        if (!user) throw new Error('Cannot read user: Not authenticated.')
        const next = await fetchProgressChartData(supabase, user.id, filters)
        if (active) setData(next)
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Could not load Progress Chart report.')
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
      title="Progress Chart"
      titleStyle={{ color: settingsProcessAccent }}
      subtitle="Average RPN trend over time for organization, site, department and project scopes."
      summary={<ProgressSummary data={data} />}
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
              onChange={(site) => setFilters((current) => ({ ...current, projectIds: [], sites: site ? [site] : [] }))}
              options={[{ label: 'All Sites', value: '' }, ...(data?.siteOptions ?? []).map((site) => ({ label: site, value: site }))]}
              value={selectedSite}
            />
            <FilterSelect
              label="Department"
              onChange={(department) => setFilters((current) => ({ ...current, departments: department ? [department] : [], projectIds: [] }))}
              options={[{ label: 'All', value: '' }, ...(data?.departmentOptions ?? []).map((department) => ({ label: department, value: department }))]}
              value={selectedDepartment}
            />
            <FilterSelect
              label="Project"
              onChange={(projectId) => setFilters((current) => ({ ...current, projectIds: projectId ? [projectId] : [] }))}
              options={projectOptions}
              value={selectedProjectId}
            />
            <FilterSelect
              label="Aggregation"
              onChange={(granularity) => setFilters((current) => ({ ...current, granularity: granularity as ProgressGranularity }))}
              options={GRANULARITY_OPTIONS}
              value={filters.granularity}
            />
          </div>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 650 }}>
            {loading ? 'Loading chart...' : 'Only Open projects are included.'}
          </div>
        </div>
      </SettingsSection>

      <SettingsSection style={{ overflow: 'visible', padding: 12 }}>
        {data ? (
          <ProgressLineChart granularity={filters.granularity} points={data.points} thresholds={data.summary.thresholds ?? DEFAULT_RPN_THRESHOLDS} />
        ) : (
          <div style={{ ...settingsFrameStyle, color: 'rgba(255,255,255,0.72)', padding: 16 }}>
            {loading ? 'Loading Progress Chart...' : 'No data available.'}
          </div>
        )}
      </SettingsSection>
    </SettingsPageShell>
  )
}

const chartScrollerStyle: React.CSSProperties = {
  overflowX: 'auto',
}

const chartSvgStyle: React.CSSProperties = {
  display: 'block',
  minWidth: 760,
  width: '100%',
}

const chartAxisTextStyle: React.CSSProperties = {
  fill: '#d9a86c',
  fontSize: 7,
  fontWeight: 400,
}

const chartGroupTextStyle: React.CSSProperties = {
  fill: '#d9a86c',
  fontSize: 8,
  fontWeight: 400,
}

const chartThresholdTextStyle: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 500,
}

const chartHoverLabelStyle: React.CSSProperties = {
  fill: 'rgba(255,255,255,0.78)',
  fontSize: 7,
  fontWeight: 500,
}

const chartHoverValueStyle: React.CSSProperties = {
  fill: '#d9a86c',
  fontSize: 7,
  fontWeight: 400,
}

const emptyChartStyle: React.CSSProperties = {
  alignItems: 'center',
  border: '1px solid rgba(255,255,255,0.12)',
  color: 'rgba(255,255,255,0.62)',
  display: 'flex',
  fontSize: 13,
  justifyContent: 'center',
  minHeight: 260,
}
