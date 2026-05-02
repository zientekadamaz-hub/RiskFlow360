'use client'

import type { CSSProperties, Dispatch, SetStateAction } from 'react'
import { useEffect, useMemo, useState } from 'react'
import type { RatingScaleConfig } from './config'
import {
  SettingsActionColumnHeader,
  SettingsFilterColumnHeader,
  SettingsHiddenColumnHeader,
} from '@/features/settings/column-filter-header'
import {
  SettingsCellList,
  SettingsCellMetaText,
  SettingsTableActions,
  getSettingsTableColumnWidths,
  settingsCompactActionButtonStyle,
  settingsCompactInputStyle,
  settingsCompactPrimaryButtonStyle,
  settingsHiddenTableColumnWidthPx,
  settingsInlineStatusStyle,
  settingsTableCellStyle,
  settingsTableHeaderStyle,
  settingsTableScrollerStyle,
  settingsTableSecondaryTextStyle,
  settingsTableStyle,
} from '@/features/settings/invitation-shell'
import { StandardSelect } from '@/features/settings/StandardSelect'
import { projectsProcessCellStyle } from '@/features/projects/view-styles'
import type {
  RatingScaleConfirmState,
  RatingScaleHiddenColumnsState,
  RatingScaleSortDirection,
  RatingScaleSortableColumn,
  RatingScaleUiRow,
} from './types'
import {
  BASE_COLUMN_WIDTHS,
  composeName,
  formatDateOnly,
  LEVEL_COUNT,
  normalizeExampleInputs,
  parseExampleInputs,
} from './utils'

type SortState = { column: RatingScaleSortableColumn; direction: RatingScaleSortDirection }

type RatingScaleTableProps = {
  config: RatingScaleConfig
  displayRows: RatingScaleUiRow[]
  hiddenColumns: RatingScaleHiddenColumnsState
  onRequestConfirm: (nextConfirm: NonNullable<RatingScaleConfirmState>) => void
  onRestoreDefaults: (row: RatingScaleUiRow) => Promise<void>
  onUpdate: (row: RatingScaleUiRow, changes: Partial<Pick<RatingScaleUiRow, 'active' | 'definition' | 'description' | 'name' | 'title'>>) => Promise<void>
  setHiddenColumns: Dispatch<SetStateAction<RatingScaleHiddenColumnsState>>
  setSortState: Dispatch<SetStateAction<SortState>>
  setStatusFilterValues: (values: string[]) => void
  statusFilterValues: string[]
}

export function RatingScaleTable({
  config,
  displayRows,
  hiddenColumns,
  onRequestConfirm,
  onRestoreDefaults,
  onUpdate,
  setHiddenColumns,
  setSortState,
  setStatusFilterValues,
  statusFilterValues,
}: RatingScaleTableProps) {
  const columnWidths = useMemo(() => {
    return getSettingsTableColumnWidths<RatingScaleSortableColumn>({
      baseWidths: BASE_COLUMN_WIDTHS,
      hiddenColumns,
    })
  }, [hiddenColumns])

  const hiddenCellStyle: CSSProperties = {
    ...settingsTableCellStyle,
    width: settingsHiddenTableColumnWidthPx,
    padding: '0 6px',
  }

  const levelCellStyle: CSSProperties = {
    ...settingsTableCellStyle,
    textAlign: 'center',
  }

  const hiddenHeaderStyle: CSSProperties = {
    ...settingsTableHeaderStyle,
    width: settingsHiddenTableColumnWidthPx,
    padding: '0 6px',
    textAlign: 'center',
  }

  return (
    <div style={{ overflow: 'visible' }}>
      <div style={settingsTableScrollerStyle}>
        <table style={{ ...settingsTableStyle, minWidth: 980 }}>
          <colgroup>
            <col style={{ width: columnWidths.level }} />
            <col style={{ width: columnWidths.title }} />
            <col style={{ width: columnWidths.definition }} />
            <col style={{ width: columnWidths.examples }} />
            <col style={{ width: columnWidths.status }} />
            <col style={{ width: columnWidths.actions }} />
          </colgroup>
          <RatingScaleTableHeader
            hiddenColumns={hiddenColumns}
            hiddenHeaderStyle={hiddenHeaderStyle}
            setHiddenColumns={setHiddenColumns}
            setSortState={setSortState}
            setStatusFilterValues={setStatusFilterValues}
            statusFilterValues={statusFilterValues}
          />
          <tbody>
            {displayRows.slice(0, LEVEL_COUNT).map((row) => (
              <RatingScaleRow
                key={`${config.key}-${row.level}`}
                config={config}
                hiddenCellStyle={hiddenCellStyle}
                hiddenColumns={hiddenColumns}
                levelCellStyle={levelCellStyle}
                onRequestConfirm={onRequestConfirm}
                onRestoreDefaults={onRestoreDefaults}
                onUpdate={onUpdate}
                row={row}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function RatingScaleTableHeader({
  hiddenColumns,
  hiddenHeaderStyle,
  setHiddenColumns,
  setSortState,
  setStatusFilterValues,
  statusFilterValues,
}: {
  hiddenColumns: RatingScaleHiddenColumnsState
  hiddenHeaderStyle: CSSProperties
  setHiddenColumns: Dispatch<SetStateAction<RatingScaleHiddenColumnsState>>
  setSortState: Dispatch<SetStateAction<SortState>>
  setStatusFilterValues: (values: string[]) => void
  statusFilterValues: string[]
}) {
  return (
    <thead>
      <tr>
        <th style={hiddenColumns.level ? hiddenHeaderStyle : settingsTableHeaderStyle}>
          {hiddenColumns.level ? (
            <SettingsHiddenColumnHeader label="Level" onShow={() => setHiddenColumns((current) => ({ ...current, level: false }))} />
          ) : (
            <SettingsActionColumnHeader
              label="Level"
              onSort={(direction) => setSortState({ column: 'level', direction })}
              onHideColumn={() => setHiddenColumns((current) => ({ ...current, level: true }))}
            />
          )}
        </th>
        <th style={hiddenColumns.title ? hiddenHeaderStyle : settingsTableHeaderStyle}>
          {hiddenColumns.title ? (
            <SettingsHiddenColumnHeader label="Title" onShow={() => setHiddenColumns((current) => ({ ...current, title: false }))} />
          ) : (
            <SettingsActionColumnHeader
              label="Title"
              onSort={(direction) => setSortState({ column: 'title', direction })}
              onHideColumn={() => setHiddenColumns((current) => ({ ...current, title: true }))}
            />
          )}
        </th>
        <th style={hiddenColumns.definition ? hiddenHeaderStyle : settingsTableHeaderStyle}>
          {hiddenColumns.definition ? (
            <SettingsHiddenColumnHeader label="Definition" onShow={() => setHiddenColumns((current) => ({ ...current, definition: false }))} />
          ) : (
            <SettingsActionColumnHeader
              label="Definition"
              onSort={(direction) => setSortState({ column: 'definition', direction })}
              onHideColumn={() => setHiddenColumns((current) => ({ ...current, definition: true }))}
            />
          )}
        </th>
        <th style={hiddenColumns.examples ? hiddenHeaderStyle : settingsTableHeaderStyle}>
          {hiddenColumns.examples ? (
            <SettingsHiddenColumnHeader label="Examples" onShow={() => setHiddenColumns((current) => ({ ...current, examples: false }))} />
          ) : (
            <SettingsActionColumnHeader
              label="Examples"
              onSort={(direction) => setSortState({ column: 'examples', direction })}
              onHideColumn={() => setHiddenColumns((current) => ({ ...current, examples: true }))}
            />
          )}
        </th>
        <th style={hiddenColumns.status ? hiddenHeaderStyle : settingsTableHeaderStyle}>
          {hiddenColumns.status ? (
            <SettingsHiddenColumnHeader label="Status" onShow={() => setHiddenColumns((current) => ({ ...current, status: false }))} />
          ) : (
            <SettingsFilterColumnHeader
              label="Status"
              values={['ACTIVE', 'INACTIVE']}
              selectedValues={statusFilterValues}
              onApplyValues={setStatusFilterValues}
              onSort={(direction) => setSortState({ column: 'status', direction })}
              onHideColumn={() => setHiddenColumns((current) => ({ ...current, status: true }))}
            />
          )}
        </th>
        <th style={settingsTableHeaderStyle}>Actions</th>
      </tr>
    </thead>
  )
}

function RatingScaleRow({
  config,
  hiddenCellStyle,
  hiddenColumns,
  levelCellStyle,
  row,
  onRestoreDefaults,
  onRequestConfirm,
  onUpdate,
}: {
  config: RatingScaleConfig
  hiddenCellStyle: CSSProperties
  hiddenColumns: RatingScaleHiddenColumnsState
  levelCellStyle: CSSProperties
  row: RatingScaleUiRow
  onRestoreDefaults: (row: RatingScaleUiRow) => Promise<void>
  onRequestConfirm: (nextConfirm: NonNullable<RatingScaleConfirmState>) => void
  onUpdate: (row: RatingScaleUiRow, changes: Partial<Pick<RatingScaleUiRow, 'active' | 'definition' | 'description' | 'name' | 'title'>>) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState('')
  const [definition, setDefinition] = useState('')
  const [exampleInputs, setExampleInputs] = useState<string[]>([''])
  const [activeDraft, setActiveDraft] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setTitle(row.title)
    setDefinition(row.definition)
    setExampleInputs(parseExampleInputs(row.description))
    setActiveDraft(row.active)
  }, [row.active, row.definition, row.description, row.title])

  function requestSave() {
    const safeTitle = title.trim()
    const safeDefinition = definition.trim()
    if (!safeTitle) return

    onRequestConfirm({
      title: `Update ${config.title.toLowerCase()} level ${row.level}`,
      body: 'This change overwrites the current version for the active organization.',
      confirmLabel: 'Save changes',
      onConfirm: async () => {
        setBusy(true)
        try {
          await onUpdate(row, {
            name: composeName(safeTitle, safeDefinition),
            title: safeTitle,
            definition: safeDefinition,
            active: activeDraft,
            description: exampleInputs
              .map((line) => line.trim())
              .filter(Boolean)
              .join('\n'),
          })
          setEditing(false)
        } finally {
          setBusy(false)
        }
      },
    })
  }

  function requestRestoreDefaults() {
    onRequestConfirm({
      title: `Restore defaults for level ${row.level}`,
      body: 'This removes the organization override and brings back the factory defaults.',
      confirmLabel: 'Restore defaults',
      onConfirm: async () => {
        setBusy(true)
        try {
          await onRestoreDefaults(row)
          setEditing(false)
        } finally {
          setBusy(false)
        }
      },
    })
  }

  return (
    <tr>
      <td style={hiddenColumns.level ? hiddenCellStyle : levelCellStyle}>
        {hiddenColumns.level ? null : <div style={{ ...projectsProcessCellStyle, justifyContent: 'center', fontSize: 15 }}>{row.level}</div>}
      </td>
      <td style={hiddenColumns.title ? hiddenCellStyle : settingsTableCellStyle}>
        {hiddenColumns.title ? null : editing ? (
          <input
            id={`${config.key}-title-${row.level}`}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            style={settingsCompactInputStyle}
          />
        ) : (
          <>
            <div style={{ fontWeight: 700, color: '#fff' }}>{row.title || '-'}</div>
            {row.modified_by_name ? (
              <SettingsCellMetaText>
                Last modified by {row.modified_by_name} on {formatDateOnly(row.modified_at)}
              </SettingsCellMetaText>
            ) : null}
          </>
        )}
      </td>
      <td style={hiddenColumns.definition ? hiddenCellStyle : settingsTableCellStyle}>
        {hiddenColumns.definition ? null : editing ? (
          <input
            id={`${config.key}-definition-${row.level}`}
            value={definition}
            onChange={(event) => setDefinition(event.target.value)}
            style={settingsCompactInputStyle}
          />
        ) : (
          <div style={settingsTableSecondaryTextStyle}>{row.definition || '-'}</div>
        )}
      </td>
      <td style={hiddenColumns.examples ? hiddenCellStyle : settingsTableCellStyle}>
        {hiddenColumns.examples ? null : editing ? (
          <div style={{ display: 'grid', gap: 6 }}>
            {exampleInputs.map((value, index) => (
              <input
                key={`${config.key}-example-${row.level}-${index}`}
                id={index === 0 ? `${config.key}-examples-${row.level}` : undefined}
                value={value}
                onChange={(event) => {
                  const nextValue = event.target.value
                  setExampleInputs((current) => {
                    const next = [...current]
                    next[index] = nextValue
                    return normalizeExampleInputs(next)
                  })
                }}
                placeholder="Example"
                style={settingsCompactInputStyle}
              />
            ))}
          </div>
        ) : row.examples.length > 0 ? (
          <SettingsCellList items={row.examples} emptyLabel="No examples defined." />
        ) : (
          <SettingsCellList items={[]} emptyLabel="No examples defined." />
        )}
      </td>
      <td style={hiddenColumns.status ? hiddenCellStyle : settingsTableCellStyle}>
        {hiddenColumns.status ? null : editing ? (
          <StandardSelect
            compact
            onChange={(nextValue) => setActiveDraft(nextValue === 'ACTIVE')}
            options={[
              { label: 'ACTIVE', value: 'ACTIVE' },
              { label: 'INACTIVE', value: 'INACTIVE' },
            ]}
            style={settingsCompactInputStyle}
            value={activeDraft ? 'ACTIVE' : 'INACTIVE'}
          />
        ) : (
          <span style={settingsInlineStatusStyle(row.active ? 'active' : 'inactive')}>{row.active ? 'ACTIVE' : 'INACTIVE'}</span>
        )}
      </td>
      <td style={settingsTableCellStyle}>
        <SettingsTableActions>
          {editing ? (
            <>
              <button type="button" className="rf-button" style={settingsCompactPrimaryButtonStyle} disabled={busy} onClick={requestSave}>
                Save
              </button>
              <button
                type="button"
                className="rf-button"
                style={settingsCompactActionButtonStyle}
                disabled={busy}
                onClick={() => {
                  setTitle(row.title)
                  setDefinition(row.definition)
                  setExampleInputs(parseExampleInputs(row.description))
                  setActiveDraft(row.active)
                  setEditing(false)
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rf-button"
                style={settingsCompactActionButtonStyle}
                disabled={busy}
                onClick={requestRestoreDefaults}
              >
                Restore defaults
              </button>
            </>
          ) : (
            <button type="button" className="rf-button" style={settingsCompactActionButtonStyle} onClick={() => setEditing(true)}>
              Edit
            </button>
          )}
        </SettingsTableActions>
      </td>
    </tr>
  )
}
