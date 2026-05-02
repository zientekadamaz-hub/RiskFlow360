'use client'

import React, { useEffect, useMemo, useState } from 'react'
import {
  SettingsActionColumnHeader,
  SettingsFilterColumnHeader,
  SettingsHiddenColumnHeader,
} from '@/features/settings/column-filter-header'
import { getProjectResponsiveColumnWidth, type ProjectsTableColumnKey } from '@/features/projects/table-layout'
import {
  SettingsBanner,
  SettingsCellList,
  SettingsCellMetaText,
  SettingsConfirmDialog,
  SettingsLevelBadge,
  SettingsPageShell,
  SettingsSection,
  SettingsTableActions,
  SettingsSummaryGrid,
  SettingsSummaryTile,
  SettingsTrashButton,
  settingsActionButtonStyle,
  settingsCardStyle,
  settingsCompactActionButtonStyle,
  settingsCompactPrimaryButtonStyle,
  settingsInputStyle,
  settingsLabelStyle,
  settingsPageStyle,
  settingsPrimaryButtonStyle,
  settingsProcessAccent,
  settingsRiskMatrixCellFill,
  settingsRiskMatrixComparatorStyle,
  settingsRiskMatrixControlTileStyle,
  settingsRiskMatrixLegendLabelStyle,
  settingsRiskMatrixStepperButtonStyle,
  settingsRiskMatrixSwatchButtonStyle,
  settingsRiskMatrixSwatchStyle,
  settingsRiskMatrixThresholdRowStyle,
  settingsRiskMatrixValueControlStyle,
  settingsRiskMatrixValuePillStyle,
  settingsRiskSummaryTileStyle,
  settingsSharedOverlayBorder,
  settingsSharedOverlayBg,
  settingsSummaryTileStyle,
  settingsSurfaceRadius,
  settingsTableCellStyle,
  settingsTableHeaderStyle,
  settingsTableScrollerStyle,
  settingsTableSecondaryTextStyle,
  settingsTableStyle,
  settingsTableWrapStyle,
  settingsTextareaStyle,
  settingsToolbarRowStyle,
} from '@/components/rf-ui'
import { StandardSelect } from '@/features/settings/StandardSelect'

const mutedText = 'rgba(255,255,255,0.72)'
const processAccent = settingsProcessAccent
const previewTitleStyle: React.CSSProperties = { fontSize: 28, fontWeight: 600, letterSpacing: -0.3, color: '#fff' }
const previewSubtitleStyle: React.CSSProperties = { marginTop: 4, fontSize: 13.5, color: 'rgba(255,255,255,0.78)' }
const previewProjectsSubtitleStyle: React.CSSProperties = { fontSize: 13.5, color: 'rgba(255,255,255,0.78)' }
const previewFormLabelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 650,
  color: 'rgba(255,255,255,0.82)',
}
const popupAccent = settingsProcessAccent
const popupAccentSoft = settingsProcessAccent
const popupAccentStrong = '#f0c24a'
const previewInputStyle: React.CSSProperties = {
  ...settingsInputStyle,
  height: 32,
  padding: '0 8px',
  fontSize: 12,
  background: 'rgb(40, 39, 47)',
}
const previewTextareaStyle: React.CSSProperties = {
  ...settingsTextareaStyle,
  minHeight: 96,
  fontSize: 12,
  background: 'rgb(40, 39, 47)',
}
const previewTableCellStyle: React.CSSProperties = {
  ...settingsTableCellStyle,
  fontSize: 14,
  color: '#f8fafc',
  background: 'rgba(255,255,255,0.03)',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
}
const previewPopupStyle: React.CSSProperties = {
  borderRadius: 10,
  border: `1px solid ${settingsSharedOverlayBorder}`,
  background: 'rgb(40, 39, 47)',
  boxShadow: '0 14px 30px rgba(0,0,0,0.18)',
  padding: 10,
  textAlign: 'left',
}
const previewPopupTitleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: popupAccent,
  marginBottom: 6,
}
const previewPopupBodyStyle: React.CSSProperties = {
  fontSize: 12,
  color: popupAccentSoft,
  lineHeight: 1.35,
  fontWeight: 400,
}

const previewPopupOptionStyle: React.CSSProperties = {
  fontSize: 12,
  color: popupAccentSoft,
  lineHeight: 1.3,
  fontWeight: 400,
  padding: '6px 8px',
  borderRadius: 8,
  background: 'transparent',
}
const previewStatsTileStyle: React.CSSProperties = {
  ...settingsSummaryTileStyle,
}
const previewStatsValueStyle: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 800,
  lineHeight: 1,
  color: '#fff',
}

function RiskMatrixThresholdPreview({
  comparator,
  editable = false,
  value,
}: {
  comparator: 'RPN >' | 'RPN ≤'
  editable?: boolean
  value: number
}) {
  return (
    <div style={settingsRiskMatrixThresholdRowStyle}>
      <span style={settingsRiskMatrixComparatorStyle}>{comparator}</span>
      <span style={settingsRiskMatrixValueControlStyle}>
        <span style={settingsRiskMatrixValuePillStyle}>{value}</span>
        <span aria-hidden="true" style={editable ? { display: 'grid', gap: 2 } : { width: 17 }}>
          {editable ? (
            <>
              <span style={settingsRiskMatrixStepperButtonStyle}>▲</span>
              <span style={settingsRiskMatrixStepperButtonStyle}>▼</span>
            </>
          ) : null}
        </span>
      </span>
    </div>
  )
}

function previewTableHeaderStyle(fill: number): React.CSSProperties {
  return {
    ...settingsTableHeaderStyle,
    textAlign: 'left',
    fontSize: 13,
    color: '#f8fafc',
    fontWeight: 650,
    background: `rgba(40, 39, 47, ${fill})`,
    borderBottom: '1px solid rgba(255,255,255,0.14)',
  }
}

type PreviewTableRow = {
  process: string
  revision: string
  status: 'OPEN' | 'DRAFT' | 'OBSOLETE'
  updatedLabel: string
  updatedTs: number
  actionLabel: string
}

type PreviewColumnKey = Extract<ProjectsTableColumnKey, 'process' | 'revision' | 'status' | 'updated'>

const previewTableRowsBase: PreviewTableRow[] = [
  { process: 'Compressor housing', revision: '0.0.3', status: 'OPEN', updatedLabel: '23.04.2026, 21:45', updatedTs: 202604232145, actionLabel: 'Open' },
  { process: 'Valve assembly', revision: '0.0.1', status: 'DRAFT', updatedLabel: '23.04.2026, 20:08', updatedTs: 202604232008, actionLabel: 'Open draft' },
  { process: 'Sensor routing', revision: '1.1.0', status: 'OPEN', updatedLabel: '22.04.2026, 17:16', updatedTs: 202604221716, actionLabel: 'Open' },
  { process: 'Shipping cover', revision: '2.0.0', status: 'OBSOLETE', updatedLabel: '18.04.2026, 10:22', updatedTs: 202604181022, actionLabel: 'Read only' },
]

function previewStatusStyle(status: 'OPEN' | 'DRAFT') {
  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: 12,
    fontWeight: 700,
    whiteSpace: 'nowrap',
  }

  if (status === 'OPEN') return { ...base, color: '#16a34a' }
  return { ...base, color: '#6b7280' }
}

function SampleField({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={previewFormLabelStyle}>{label}</span>
      {children}
    </label>
  )
}

type PdfPreviewState =
  | { status: 'loading'; fileName: null; src: null; message: string | null }
  | { status: 'ready'; fileName: string; src: string; message: null }
  | { status: 'empty'; fileName: null; src: null; message: string }
  | { status: 'error'; fileName: null; src: null; message: string }

export default function SettingsUiPreviewPage() {
  const tableHeaderFill = 0.88
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [previewRole, setPreviewRole] = useState('champion')
  const [sortState, setSortState] = useState<{ column: 'process' | 'revision' | 'status' | 'updated'; direction: 'asc' | 'desc' } | null>(null)
  const [hiddenColumns, setHiddenColumns] = useState<Record<PreviewColumnKey, boolean>>({
    process: false,
    revision: false,
    status: false,
    updated: false,
  })
  const [processFilterValues, setProcessFilterValues] = useState<string[]>(() => [...new Set(previewTableRowsBase.map((row) => row.process))])
  const [revisionFilterValues, setRevisionFilterValues] = useState<string[]>(() => [...new Set(previewTableRowsBase.map((row) => row.revision))])
  const [statusFilterValues, setStatusFilterValues] = useState<string[]>(['OPEN', 'DRAFT'])
  const [pdfPreview, setPdfPreview] = useState<PdfPreviewState>({
    status: 'loading',
    fileName: null,
    src: null,
    message: null,
  })
  useEffect(() => {
    let cancelled = false

    async function loadPdfPreview() {
      try {
        const response = await fetch('/api/ui-preview/pdf', { cache: 'no-store' })
        if (!response.ok) {
          throw new Error('Could not load PDF preview metadata.')
        }

        const data = (await response.json()) as {
          available: boolean
          fileName: string | null
          src: string | null
          message: string | null
        }

        if (cancelled) return

        if (data.available && data.fileName && data.src) {
          setPdfPreview({
            status: 'ready',
            fileName: data.fileName,
            src: data.src,
            message: null,
          })
          return
        }

        setPdfPreview({
          status: 'empty',
          fileName: null,
          src: null,
          message: data.message ?? 'No PDF found in the /PDF folder yet.',
        })
      } catch {
        if (cancelled) return
        setPdfPreview({
          status: 'error',
          fileName: null,
          src: null,
          message: 'Could not load PDF preview.',
        })
      }
    }

    void loadPdfPreview()
    return () => {
      cancelled = true
    }
  }, [])

  const previewRows = useMemo(() => {
    const next = previewTableRowsBase.filter(
      (row) =>
        processFilterValues.includes(row.process) &&
        revisionFilterValues.includes(row.revision) &&
        statusFilterValues.includes(row.status)
    )

    if (!sortState) return next

    return [...next].sort((a, b) => {
      let compare = 0
      if (sortState.column === 'process') compare = a.process.localeCompare(b.process, undefined, { sensitivity: 'base' })
      if (sortState.column === 'revision') compare = a.revision.localeCompare(b.revision, undefined, { numeric: true, sensitivity: 'base' })
      if (sortState.column === 'status') compare = a.status.localeCompare(b.status, undefined, { sensitivity: 'base' })
      if (sortState.column === 'updated') compare = a.updatedTs - b.updatedTs
      return sortState.direction === 'asc' ? compare : -compare
    })
  }, [processFilterValues, revisionFilterValues, statusFilterValues, sortState])

  return (
    <SettingsPageShell
      title="UI Preview"
      titleStyle={{ color: processAccent }}
      subtitle={
        <span style={previewProjectsSubtitleStyle}>
          Candidate standard based primarily on Projects, PFMEA and PCP before migrating the rest of the application. Status: waiting for approval
        </span>
      }
      summary={
        <SettingsSummaryGrid columns={7}>
          <SettingsSummaryTile label="Open projects" value={0} style={previewStatsTileStyle} valueStyle={previewStatsValueStyle} />
          <SettingsSummaryTile label="Open risks" value={0} style={previewStatsTileStyle} valueStyle={previewStatsValueStyle} />
          <SettingsSummaryTile label="Average RPN" value="-" style={previewStatsTileStyle} valueStyle={previewStatsValueStyle} />
          <SettingsSummaryTile label="Actions must be defined" value={0} style={settingsRiskSummaryTileStyle('red')} valueStyle={previewStatsValueStyle} />
          <SettingsSummaryTile label="Action plan required" value={0} style={settingsRiskSummaryTileStyle('orange')} valueStyle={previewStatsValueStyle} />
          <SettingsSummaryTile label="Actions recommended" value={0} style={settingsRiskSummaryTileStyle('yellow')} valueStyle={previewStatsValueStyle} />
          <SettingsSummaryTile label="Acceptable risk" value={0} style={settingsRiskSummaryTileStyle('green')} valueStyle={previewStatsValueStyle} />
        </SettingsSummaryGrid>
      }
    >
      <SettingsBanner tone="success">Success status candidate</SettingsBanner>
      <SettingsBanner tone="error">Error status candidate</SettingsBanner>

      <SettingsBanner tone="neutral">
        <span style={previewProjectsSubtitleStyle}>
          Review this page section by section. Once this candidate is approved, I will migrate real screens to these primitives instead of changing each page ad hoc.
        </span>
      </SettingsBanner>

      <SettingsSection style={{ padding: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={previewTitleStyle}>Typography</div>
          <div style={previewSubtitleStyle}>Primary heading, subtitle, labels and body text candidate based on process modules.</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 12 }}>
            <div style={{ ...settingsCardStyle, padding: 14 }}>
              <div style={{ ...previewTitleStyle, marginTop: 2 }}>Projects</div>
              <div style={{ ...previewSubtitleStyle, marginTop: 10 }}>
                Shared top-level heading used on process screens with a compact subtitle below it.
              </div>
            </div>

            <div style={{ ...settingsCardStyle, padding: 14 }}>
              <div style={{ marginTop: 2, fontSize: 18, fontWeight: 700, color: '#fff' }}>Open risk summary</div>
              <div style={{ marginTop: 10, fontSize: 13, color: mutedText }}>
                Supporting text should stay compact and readable, without looking like a separate documentation layer.
              </div>
            </div>

            <div style={{ ...settingsCardStyle, padding: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.4, color: 'rgba(255,255,255,0.82)' }}>Process name</div>
              <div style={{ marginTop: 8, fontSize: 15, fontWeight: 600, color: processAccent }}>Compressor housing</div>
              <div style={{ marginTop: 10, fontSize: 12, color: mutedText }}>
                Labels should work as quiet support for the value, not as dominant visual callouts.
              </div>
            </div>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection style={{ padding: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>Buttons and feedback</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="rf-button" style={settingsPrimaryButtonStyle}>
              Primary action
            </button>
            <button
              className="rf-button"
              style={{
                ...settingsPrimaryButtonStyle,
                background: 'rgba(255,255,255,0.08)',
                color: '#f8fafc',
              }}
            >
              Secondary action
            </button>
            <button
              className="rf-button"
              style={{
                ...settingsActionButtonStyle,
                background: 'rgba(22,163,74,0.18)',
                color: '#dcfce7',
                borderColor: 'rgba(74,222,128,0.35)',
              }}
            >
              Success chip
            </button>
            <button
              className="rf-button"
              style={{
                ...settingsActionButtonStyle,
                background: 'rgba(239,68,68,0.18)',
                color: '#fecaca',
                borderColor: 'rgba(248,113,113,0.35)',
              }}
            >
              Destructive chip
            </button>
          </div>

          <SettingsBanner tone="neutral">Neutral banner candidate</SettingsBanner>
        </div>
      </SettingsSection>

      <SettingsSection style={{ padding: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>Projects action row</div>
          <div style={{ fontSize: 12.5, color: mutedText }}>
            `Projects` no longer uses a separate filter bar. Filtering lives in the three-dot table headers, while the top action row keeps only the real page actions.
          </div>
          <div style={settingsToolbarRowStyle}>
            <button
              className="rf-button"
              style={{
                ...settingsCompactPrimaryButtonStyle,
              }}
            >
              Create project
            </button>
            <button
              className="rf-button"
              style={{
                ...settingsCompactActionButtonStyle,
              }}
            >
              Edit
            </button>
            <button className="rf-button" style={settingsCompactActionButtonStyle}>
              PFD
            </button>
            <button className="rf-button" style={settingsCompactActionButtonStyle}>
              PFMEA
            </button>
            <button className="rf-button" style={settingsCompactActionButtonStyle}>
              PCP
            </button>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection style={{ padding: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>Form standard</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
              <SampleField label="Email">
                <input defaultValue="champion@example.com" style={previewInputStyle} />
              </SampleField>
              <SampleField label="Role">
                <StandardSelect
                  compact
                  onChange={setPreviewRole}
                  options={[
                    { label: 'Champion', value: 'champion' },
                    { label: 'Engineer', value: 'engineer' },
                    { label: 'Viewer', value: 'viewer' },
                    { label: 'Customer', value: 'customer' },
                  ]}
                  style={previewInputStyle}
                  value={previewRole}
                />
              </SampleField>
              <SampleField label="First name">
                <input defaultValue="Anna" style={previewInputStyle} />
              </SampleField>
              <SampleField label="Last name">
                <input defaultValue="Nowak" style={previewInputStyle} />
              </SampleField>
            </div>

            <SampleField label="Notes">
              <textarea
                defaultValue="Use this candidate to approve spacing, field styling, borders and button hierarchy before the migration starts."
                style={previewTextareaStyle}
              />
            </SampleField>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>Card standard</div>
            <div style={{ ...settingsCardStyle, padding: 14 }}>
              <div style={settingsLabelStyle}>Card header</div>
              <div style={{ marginTop: 8, fontSize: 17, fontWeight: 700, color: '#fff' }}>Configuration summary</div>
              <div style={{ marginTop: 10, fontSize: 13, color: mutedText }}>
                Base card uses blurred dark glass with thin border, tight radius and compact vertical rhythm.
              </div>
            </div>
            <div style={{ ...settingsCardStyle, padding: 14 }}>
              <div style={settingsLabelStyle}>Compact content</div>
              <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ fontSize: 13, color: '#fff' }}>Process name</span>
                <span style={{ fontSize: 15, fontWeight: 600, color: processAccent }}>Compressor housing</span>
              </div>
              <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ fontSize: 13, color: '#fff' }}>Average RPN</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>24</span>
              </div>
            </div>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection style={{ padding: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 13, color: mutedText }}>
            Standard based on the current summary tiles from `PFMEA`. Colored backgrounds stay on the tile, while values remain white.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
            {([
              { color: 'red', label: 'Actions must be defined', note: 'Immediate action', value: 12 },
              { color: 'orange', label: 'Action plan required', note: 'Action required', value: 18 },
              { color: 'yellow', label: 'Actions recommended', note: 'Monitor and review', value: 24 },
              { color: 'green', label: 'Acceptable risk', note: 'Action not required', value: 31 },
            ] as Array<{ color: 'red' | 'orange' | 'yellow' | 'green'; label: string; note: string; value: number }>).map((item) => (
              <div key={item.color} style={settingsRiskSummaryTileStyle(item.color)}>
                <div style={{ fontSize: 12, color: '#f8fafc' }}>{item.label}</div>
                <div style={{ marginTop: 8, fontSize: 24, fontWeight: 800, lineHeight: 1, color: '#f8fafc' }}>{item.value}</div>
                <div style={{ marginTop: 8, fontSize: 12, color: '#fff' }}>{item.note}</div>
                <div style={{ marginTop: 10, fontSize: 12, color: mutedText }}>
                  This is the original process-module style and becomes the shared standard.
                </div>
              </div>
            ))}
          </div>
        </div>
      </SettingsSection>

      <SettingsSection style={{ padding: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>Risk Matrix threshold standard</div>
          <div style={{ fontSize: 12.5, color: mutedText }}>
            Accepted pattern for the Risk Matrix header: centered RPN controls, compact value pill, external up/down stepper and matching color swatches.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
            <div style={settingsRiskMatrixControlTileStyle('red')}>
              <div style={settingsRiskMatrixLegendLabelStyle}>Action must be implemented</div>
              <RiskMatrixThresholdPreview comparator="RPN >" value={329} />
            </div>
            <div style={settingsRiskMatrixControlTileStyle('orange')}>
              <div style={settingsRiskMatrixLegendLabelStyle}>Action required unless the team decides otherwise</div>
              <RiskMatrixThresholdPreview comparator="RPN ≤" value={329} editable />
            </div>
            <div style={settingsRiskMatrixControlTileStyle('yellow')}>
              <div style={settingsRiskMatrixLegendLabelStyle}>Action not required unless the team decides otherwise</div>
              <RiskMatrixThresholdPreview comparator="RPN ≤" value={179} editable />
            </div>
            <div style={settingsRiskMatrixControlTileStyle('green')}>
              <div style={settingsRiskMatrixLegendLabelStyle}>Action not required</div>
              <RiskMatrixThresholdPreview comparator="RPN ≤" value={100} editable />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 12, alignItems: 'start' }}>
            <div style={settingsTableWrapStyle}>
              <div style={{ ...settingsTableScrollerStyle, padding: 10 }}>
                <table style={{ ...settingsTableStyle, tableLayout: 'fixed' }}>
                  <tbody>
                    {[10, 9, 8].map((severity) => (
                      <tr key={severity}>
                        {[1, 2, 3, 4, 5].map((doValue) => {
                          const score = severity * doValue
                          const color: 'red' | 'orange' | 'yellow' | 'green' =
                            score > 35 ? 'red' : score > 25 ? 'orange' : score > 15 ? 'yellow' : 'green'
                          return (
                            <td
                              key={`${severity}-${doValue}`}
                              style={{
                                ...previewTableCellStyle,
                                aspectRatio: '1 / 1',
                                padding: 0,
                                textAlign: 'center',
                                fontWeight: 800,
                                color: 'rgba(0,0,0,0.65)',
                                background: settingsRiskMatrixCellFill(color),
                              }}
                            >
                              {severity * doValue}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ ...previewPopupStyle, padding: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {(['green', 'yellow', 'orange', 'red'] as const).map((color) => (
                  <button
                    key={color}
                    type="button"
                    className="rf-button"
                    aria-label={`Risk Matrix ${color} swatch`}
                    style={{
                      ...settingsRiskMatrixSwatchButtonStyle,
                      borderColor: color === 'orange' ? 'rgba(217,168,108,0.55)' : 'rgba(255,255,255,0.18)',
                      background: color === 'orange' ? 'rgba(217,168,108,0.16)' : 'rgba(255,255,255,0.08)',
                    }}
                  >
                    <span aria-hidden="true" style={settingsRiskMatrixSwatchStyle(color)} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection style={{ padding: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={settingsTableWrapStyle}>
            <div style={settingsTableScrollerStyle}>
              <table style={{ ...settingsTableStyle, minWidth: 900, background: 'rgba(255,255,255,0.04)' }}>
                <colgroup>
                  <col style={{ width: getProjectResponsiveColumnWidth(hiddenColumns, 'process') }} />
                  <col style={{ width: getProjectResponsiveColumnWidth(hiddenColumns, 'revision') }} />
                  <col style={{ width: getProjectResponsiveColumnWidth(hiddenColumns, 'status') }} />
                  <col style={{ width: getProjectResponsiveColumnWidth(hiddenColumns, 'updated') }} />
                  <col style={{ width: getProjectResponsiveColumnWidth(hiddenColumns, 'actions') }} />
                </colgroup>
                <thead>
                  <tr>
                    <th style={previewTableHeaderStyle(tableHeaderFill)}>
                      {hiddenColumns.process ? (
                        <SettingsHiddenColumnHeader
                          label="Process"
                          onShow={() => setHiddenColumns((current) => ({ ...current, process: false }))}
                        />
                      ) : (
                        <SettingsFilterColumnHeader
                          label="Process"
                          values={[...new Set(previewTableRowsBase.map((row) => row.process))]}
                          selectedValues={processFilterValues}
                          onApplyValues={setProcessFilterValues}
                          onSort={(direction) => setSortState({ column: 'process', direction })}
                          onHideColumn={() => setHiddenColumns((current) => ({ ...current, process: true }))}
                        />
                      )}
                    </th>
                    <th style={previewTableHeaderStyle(tableHeaderFill)}>
                      {hiddenColumns.revision ? (
                        <SettingsHiddenColumnHeader
                          label="Revision"
                          onShow={() => setHiddenColumns((current) => ({ ...current, revision: false }))}
                        />
                      ) : (
                        <SettingsFilterColumnHeader
                          label="Revision"
                          values={[...new Set(previewTableRowsBase.map((row) => row.revision))]}
                          selectedValues={revisionFilterValues}
                          onApplyValues={setRevisionFilterValues}
                          onSort={(direction) => setSortState({ column: 'revision', direction })}
                          onHideColumn={() => setHiddenColumns((current) => ({ ...current, revision: true }))}
                        />
                      )}
                    </th>
                    <th style={previewTableHeaderStyle(tableHeaderFill)}>
                      {hiddenColumns.status ? (
                        <SettingsHiddenColumnHeader
                          label="Status"
                          onShow={() => setHiddenColumns((current) => ({ ...current, status: false }))}
                        />
                      ) : (
                        <SettingsFilterColumnHeader
                          label="Status"
                          values={['OPEN', 'DRAFT', 'OBSOLETE']}
                          selectedValues={statusFilterValues}
                          onApplyValues={setStatusFilterValues}
                          onSort={(direction) => setSortState({ column: 'status', direction })}
                          onHideColumn={() => setHiddenColumns((current) => ({ ...current, status: true }))}
                        />
                      )}
                    </th>
                    <th style={previewTableHeaderStyle(tableHeaderFill)}>
                      {hiddenColumns.updated ? (
                        <SettingsHiddenColumnHeader
                          label="Updated"
                          onShow={() => setHiddenColumns((current) => ({ ...current, updated: false }))}
                        />
                      ) : (
                        <SettingsActionColumnHeader
                          label="Updated"
                          onSort={(direction) => setSortState({ column: 'updated', direction })}
                          onHideColumn={() => setHiddenColumns((current) => ({ ...current, updated: true }))}
                        />
                      )}
                    </th>
                    <th style={previewTableHeaderStyle(tableHeaderFill)}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row) => (
                    <tr key={`${row.process}-${row.revision}`}>
                      <td style={hiddenColumns.process ? { ...previewTableCellStyle, width: 34, padding: '0 6px' } : { ...previewTableCellStyle, color: processAccent, fontWeight: 600 }}>
                        {hiddenColumns.process ? '' : row.process}
                      </td>
                      <td style={hiddenColumns.revision ? { ...previewTableCellStyle, width: 34, padding: '0 6px' } : previewTableCellStyle}>
                        {hiddenColumns.revision ? '' : row.revision}
                      </td>
                      <td style={hiddenColumns.status ? { ...previewTableCellStyle, width: 34, padding: '0 6px' } : previewTableCellStyle}>
                        {hiddenColumns.status ? '' : <span style={previewStatusStyle(row.status === 'OBSOLETE' ? 'DRAFT' : row.status)}>{row.status}</span>}
                      </td>
                      <td style={hiddenColumns.updated ? { ...previewTableCellStyle, width: 34, padding: '0 6px' } : previewTableCellStyle}>
                        {hiddenColumns.updated ? '' : row.updatedLabel}
                      </td>
                      <td style={previewTableCellStyle}>
                        <SettingsTableActions>
                          <button className="rf-button" style={settingsCompactActionButtonStyle}>
                            {row.actionLabel}
                          </button>
                          <SettingsTrashButton title="Delete process" ariaLabel="Delete process" />
                        </SettingsTableActions>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div style={settingsTableWrapStyle}>
            <div style={settingsTableScrollerStyle}>
              <table style={{ ...settingsTableStyle, minWidth: 900, background: 'rgba(255,255,255,0.04)' }}>
                <colgroup>
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '24%' }} />
                  <col style={{ width: '46%' }} />
                  <col style={{ width: '20%' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th style={previewTableHeaderStyle(tableHeaderFill)}>Level</th>
                    <th style={previewTableHeaderStyle(tableHeaderFill)}>Title</th>
                    <th style={previewTableHeaderStyle(tableHeaderFill)}>Examples</th>
                    <th style={previewTableHeaderStyle(tableHeaderFill)}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={previewTableCellStyle}>
                      <SettingsLevelBadge>10</SettingsLevelBadge>
                    </td>
                    <td style={previewTableCellStyle}>
                      <div style={{ fontWeight: 700, color: '#fff' }}>Safety or regulatory issue</div>
                      <SettingsCellMetaText>Last modified by System Admin on 26 Apr 2026</SettingsCellMetaText>
                    </td>
                    <td style={previewTableCellStyle}>
                      <div style={settingsTableSecondaryTextStyle}>Loss of safety-related function or non-compliance.</div>
                      <div style={{ marginTop: 8 }}>
                        <SettingsCellList items={['Potential injury risk', 'Legal requirement not met', 'Vehicle or product unsafe to use']} />
                      </div>
                    </td>
                    <td style={previewTableCellStyle}>
                      <SettingsTableActions>
                        <button className="rf-button" style={settingsCompactActionButtonStyle}>
                          Edit
                        </button>
                      </SettingsTableActions>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection style={{ padding: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>Modal / confirm candidate</div>
            <div
              style={{
                padding: 18,
                borderRadius: settingsSurfaceRadius,
                border: `1px solid ${settingsSharedOverlayBorder}`,
                background: settingsSharedOverlayBg,
                boxShadow: '0 24px 48px rgba(0,0,0,0.28)',
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>Delete invitation</div>
              <div style={{ marginTop: 10, fontSize: 13, color: mutedText }}>
                Are you sure you want to remove this invitation? This preview shows the intended density and hierarchy for destructive dialogs.
              </div>
              <div
                style={{
                  marginTop: 10,
                  padding: '6px 0',
                  borderRadius: settingsSurfaceRadius,
                  color: '#dc2626',
                  fontSize: 12,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 8,
                    alignSelf: 'stretch',
                    borderRadius: 999,
                    background: 'linear-gradient(180deg, rgba(220,38,38,0.95), rgba(127,29,29,0.9))',
                  }}
                />
                <span>Data will be permanently removed.</span>
              </div>
              <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button className="rf-button" style={settingsActionButtonStyle}>
                  Cancel
                </button>
                <button
                  className="rf-button"
                  style={{
                    ...settingsActionButtonStyle,
                    background: 'rgba(255,255,255,0.12)',
                    borderColor: 'rgba(255,255,255,0.14)',
                  }}
                >
                  Save revision
                </button>
              </div>
            </div>
            <button className="rf-button" style={{ ...settingsActionButtonStyle, alignSelf: 'flex-start' }} onClick={() => setConfirmOpen(true)}>
              Open confirm preview
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>Approval checklist</div>
            <div style={{ ...settingsCardStyle, padding: 14 }}>
              {[
                'Typography scale and density',
                'Button hierarchy',
                'Inputs and select fields',
                'Table visual style',
                'RPN frame accents',
                'Banner and alert style',
                'Dialog visual language',
                'Popup / contextual help style',
              ].map((item) => (
                <div
                  key={item}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 0',
                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <div
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 999,
                      border: `1px solid ${settingsSharedOverlayBorder}`,
                      background: 'rgba(255,255,255,0.06)',
                    }}
                  />
                  <span style={{ fontSize: 13, color: '#fff' }}>{item}</span>
                </div>
              ))}
              <div style={{ marginTop: 12, fontSize: 12, color: mutedText }}>
                Approval is manual for now: you review this page and tell me what is accepted or what should change before the migration starts.
              </div>
            </div>
          </div>
        </div>
      </SettingsSection>

      <SettingsConfirmDialog
        open={confirmOpen}
        title="Delete process"
        body='Are you sure you want to delete "Valve assembly"? This will remove the entire project, including PFD/PFMEA/PCP and all defined actions.'
        warning="Data will be permanently removed."
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => setConfirmOpen(false)}
      />

      <SettingsSection style={{ padding: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>PDF preview window</div>
          <div style={{ fontSize: 13, color: mutedText }}>
            This panel automatically loads the first PDF from the local <code>/PDF</code> folder in the application root.
          </div>
          <div
            style={{
              ...settingsCardStyle,
              padding: 14,
              overflow: 'hidden',
            }}
          >
            <div style={{ ...settingsLabelStyle, marginBottom: 10 }}>Loaded file</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: pdfPreview.status === 'ready' ? processAccent : '#fff' }}>
              {pdfPreview.status === 'ready' ? pdfPreview.fileName : 'Waiting for PDF file'}
            </div>

            <div
              style={{
                marginTop: 12,
                borderRadius: settingsSurfaceRadius,
                border: `1px solid ${settingsSharedOverlayBorder}`,
                background: 'rgba(255,255,255,0.04)',
                minHeight: 620,
                overflow: 'hidden',
              }}
            >
              {pdfPreview.status === 'ready' && pdfPreview.src ? (
                <iframe
                  title={`PDF preview: ${pdfPreview.fileName}`}
                  src={pdfPreview.src}
                  style={{ width: '100%', height: 620, border: 'none', display: 'block', background: '#1c2233' }}
                />
              ) : (
                <div
                  style={{
                    minHeight: 620,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 24,
                    textAlign: 'center',
                    color: pdfPreview.status === 'error' ? '#fecaca' : mutedText,
                    fontSize: 13,
                    lineHeight: 1.5,
                  }}
                >
                  {pdfPreview.status === 'loading'
                    ? 'Loading PDF preview...'
                    : pdfPreview.message ?? 'No PDF found in the /PDF folder yet.'}
                </div>
              )}
            </div>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection style={{ padding: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>Popup candidate</div>
            <div style={{ fontSize: 13, color: mutedText }}>
              This candidate is based directly on `PFMEA` scale and contextual helper popups rather than on generic settings dialogs.
            </div>
            <div style={{ ...settingsCardStyle, padding: 14 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, position: 'relative' }}>
                <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>SEV</span>
                <span
                  aria-label="PFMEA severity help"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 15,
                    height: 15,
                    borderRadius: '50%',
                    border: `1px solid ${processAccent}`,
                    color: popupAccentSoft,
                    fontSize: 10,
                    fontWeight: 800,
                    lineHeight: 1,
                  }}
                >
                  ?
                </span>
              </div>

              <div style={{ marginTop: 14, maxWidth: 340, ...previewPopupStyle }}>
                <div style={previewPopupTitleStyle}>10 - Hazard without warning</div>
                <div style={{ display: 'grid', gap: 4 }}>
                  {[
                    'Failure mode affects safe machine operation and the operator may not receive a warning before the event.',
                    'Use short, concrete examples instead of long paragraphs.',
                  ].map((line) => (
                    <div key={line} style={previewPopupBodyStyle}>
                      {line}
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 8, display: 'grid', gap: 4 }}>
                  {[
                    'Examples',
                    'Uncontrolled tool movement near the operator',
                    'Unexpected release of stored pressure without alarm',
                    'Missing fail-safe action before hazardous motion',
                  ].map((line, index) => (
                    <div
                      key={line}
                      style={
                        index === 0
                          ? { ...previewPopupBodyStyle, fontWeight: 700, color: popupAccentStrong, padding: '2px 0' }
                          : previewPopupOptionStyle
                      }
                    >
                      {index === 0 ? line : line}
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: 8, ...previewPopupBodyStyle, color: processAccent }}>
                  Popup should stay compact, anchored to the trigger, and visually lighter than a modal.
                </div>
              </div>

              <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>CLASS</span>
                <span
                  aria-label="PFMEA class help"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 15,
                    height: 15,
                    borderRadius: '50%',
                    border: `1px solid ${processAccent}`,
                    color: popupAccentSoft,
                    fontSize: 10,
                    fontWeight: 800,
                    lineHeight: 1,
                  }}
                >
                  ?
                </span>
                <div style={{ fontSize: 12, color: mutedText }}>Secondary reference: compact option details like in PFMEA selectors.</div>
              </div>
              <div style={{ marginTop: 10, maxWidth: 300, ...previewPopupStyle }}>
                <div style={previewPopupTitleStyle}>SC - Special Characteristic</div>
                <div style={{ display: 'grid', gap: 4 }}>
                  {[
                    'A product characteristic or process parameter that requires special control.',
                    'Deviation may affect function, quality, compliance or downstream processing.',
                  ].map((line) => (
                    <div key={line} style={previewPopupBodyStyle}>
                      {line}
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: 12, maxWidth: 360, ...previewPopupStyle }}>
                <div style={previewPopupTitleStyle}>Revision details</div>
                <div
                  style={{
                    marginTop: 10,
                    overflow: 'hidden',
                    borderRadius: settingsSurfaceRadius,
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: 'rgba(255,255,255,0.04)',
                  }}
                >
                  <table style={{ width: '100%', borderCollapse: 'collapse', background: 'transparent' }}>
                    <thead>
                      <tr>
                        {['Module', 'Revision', 'Author'].map((label) => (
                          <th
                            key={label}
                            style={{
                              textAlign: 'left',
                              padding: '8px 10px',
                              fontSize: 12,
                              color: 'rgba(255,255,255,0.72)',
                              borderBottom: '1px solid rgba(255,255,255,0.08)',
                              background: 'rgb(40, 39, 47)',
                            }}
                          >
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={{ padding: '8px 10px', fontSize: 12, color: popupAccentSoft, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>PFMEA</td>
                        <td style={{ padding: '8px 10px', fontSize: 12, color: popupAccentSoft, borderBottom: '1px solid rgba(255,255,255,0.06)', fontWeight: 700 }}>0.0.3</td>
                        <td style={{ padding: '8px 10px', fontSize: 12, color: popupAccentSoft, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>A. Nowak</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>Popup rules</div>
            <div style={{ ...settingsCardStyle, padding: 14 }}>
              {[
                'Popup uses the PFMEA help-panel language, not the modal language',
                'Darker panel and warm text are preferred for technical hints',
                'Anchored to the field or icon, never centered like a dialog',
                'Compact 10px padding and 10px radius',
                'If popup contains a table, the inner table wrapper is also rounded',
                'Good for examples, rules, severity meaning and option details',
              ].map((item) => (
                <div
                  key={item}
                  style={{
                    fontSize: 13,
                    color: '#fff',
                    padding: '8px 0',
                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </SettingsSection>

      <div style={{ ...settingsPageStyle, minHeight: 'auto', paddingBottom: 24, background: 'transparent' }}>
        <div
          style={{
            width: '94%',
            margin: '12px auto 0',
            padding: '0 2px',
            fontSize: 12,
            color: mutedText,
          }}
        >
          Preview route: <code>/settings/ui-preview</code>
        </div>
      </div>
    </SettingsPageShell>
  )
}
