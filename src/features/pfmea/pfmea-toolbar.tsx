import type React from 'react'
import Link from 'next/link'

const SURFACE_BG = 'rgba(255,255,255,0.08)'
const SURFACE_BG_STRONG = 'rgba(255,255,255,0.12)'
const SURFACE_BORDER = 'rgba(255,255,255,0.16)'
const SURFACE_TEXT = '#f8fafc'
const SURFACE_MUTED = 'rgba(255,255,255,0.72)'

export type PfmeaToolbarColumn = {
  id: string
  label: string
}

export type PfmeaToolbarColumnGroup = {
  ids: string[]
  title: string
}

type PfmeaToolbarProps = {
  actionButtonStyle: React.CSSProperties
  cardStyle: React.CSSProperties
  columnFiltersOpen: boolean
  columnGroups: PfmeaToolbarColumnGroup[]
  columnsById: Record<string, PfmeaToolbarColumn>
  editButtonDisabled: boolean
  editButtonLabel: string
  isEditOwner: boolean
  isSaveDisabled: boolean
  onClearColumnGroup: (ids: string[]) => void
  onEditClick: () => void
  onOpenRevisionHistory: () => void
  onOpenSave: () => void
  onToggleColumn: (id: string, checked: boolean) => void
  onToggleColumnFilters: () => void
  onUncheckColumnGroup: (ids: string[]) => void
  projectId: string
  saveReadOnly: boolean
  visibleColumnIds: Set<string>
}

export function PfmeaToolbar({
  actionButtonStyle,
  cardStyle,
  columnFiltersOpen,
  columnGroups,
  columnsById,
  editButtonDisabled,
  editButtonLabel,
  isEditOwner,
  isSaveDisabled,
  onClearColumnGroup,
  onEditClick,
  onOpenRevisionHistory,
  onOpenSave,
  onToggleColumn,
  onToggleColumnFilters,
  onUncheckColumnGroup,
  projectId,
  saveReadOnly,
  visibleColumnIds,
}: PfmeaToolbarProps) {
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link href="/projects" className="rf-button" style={{ ...actionButtonStyle, padding: '8px 12px', height: 29 }}>
            Project
          </Link>
          <Link href={`/pfd?project=${projectId}`} className="rf-button" style={{ ...actionButtonStyle, padding: '8px 12px', height: 29 }}>
            PFD
          </Link>
          <Link href={`/pcp?project=${projectId}`} className="rf-button" style={{ ...actionButtonStyle, padding: '8px 12px', height: 29 }}>
            PCP
          </Link>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button
            className="rf-button"
            onClick={onEditClick}
            disabled={editButtonDisabled}
            style={{ ...actionButtonStyle, padding: '8px 12px', height: 29, cursor: 'pointer' }}
          >
            {editButtonLabel}
          </button>
          {isEditOwner ? (
            <button
              className="rf-button"
              onClick={onOpenSave}
              disabled={isSaveDisabled}
              style={{
                ...actionButtonStyle,
                padding: '8px 12px',
                height: 29,
                cursor: isSaveDisabled ? 'not-allowed' : 'pointer',
                opacity: isSaveDisabled ? 0.45 : 1,
                borderColor: !saveReadOnly && !isSaveDisabled ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.18)',
              }}
            >
              Save
            </button>
          ) : null}
          <button className="rf-button" onClick={onOpenRevisionHistory} style={{ ...actionButtonStyle, padding: '8px 12px', height: 29, cursor: 'pointer' }}>
            Revision History
          </button>
          <button
            onClick={onToggleColumnFilters}
            className="rf-button"
            style={{ ...actionButtonStyle, padding: '8px 12px', height: 29 }}
          >
            {columnFiltersOpen ? 'Hide columns' : 'Set columns'}
          </button>
        </div>
      </div>

      {columnFiltersOpen ? (
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {columnGroups.map((group) => (
              <div key={group.title} style={{ ...cardStyle, padding: '8px 12px', flex: 1, minWidth: 260 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    marginBottom: 6,
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, color: SURFACE_MUTED }}>{group.title}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      onClick={() => onUncheckColumnGroup(group.ids)}
                      className="rf-button"
                      style={{ padding: '2px 8px', borderRadius: 999, border: `1px solid ${SURFACE_BORDER}`, fontSize: 11 }}
                    >
                      Uncheck all
                    </button>
                    <button
                      onClick={() => onClearColumnGroup(group.ids)}
                      className="rf-button"
                      style={{ padding: '2px 8px', borderRadius: 999, border: `1px solid ${SURFACE_BORDER}`, fontSize: 11 }}
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {group.ids.map((id) => {
                    const col = columnsById[id]
                    const checked = visibleColumnIds.has(id)
                    return (
                      <label
                        key={id}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: 12,
                          padding: '4px 8px',
                          borderRadius: 999,
                          border: `1px solid ${SURFACE_BORDER}`,
                          background: checked ? SURFACE_BG_STRONG : SURFACE_BG,
                          color: SURFACE_TEXT,
                        }}
                      >
                        <input type="checkbox" checked={checked} onChange={(event) => onToggleColumn(id, event.target.checked)} />
                        {col?.label ?? id}
                      </label>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </>
  )
}
