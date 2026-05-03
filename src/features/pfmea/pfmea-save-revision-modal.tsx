import type React from 'react'
import { nextPfmeaRevisionLabel } from './pfmea-revision-utils'

const SURFACE_RADIUS = 8
const SURFACE_BG = 'rgba(255,255,255,0.08)'
const SURFACE_BORDER = 'rgba(255,255,255,0.16)'
const SURFACE_PANEL_BG = 'rgb(40, 39, 47)'
const SURFACE_TEXT = '#f8fafc'
const SURFACE_MUTED = 'rgba(255,255,255,0.72)'

type PfmeaSaveRevisionModalProps = {
  actionButtonStyle: React.CSSProperties
  authorName: string
  changeDescription: string
  currentRowsCount: number
  error: string
  isDirty: boolean
  onCancel: () => void
  onChangeDescription: (value: string) => void
  onSave: () => void
  readOnly: boolean
  saveBusy: boolean
  workingRevisionLabel: string | null | undefined
}

export function PfmeaSaveRevisionModal({
  actionButtonStyle,
  authorName,
  changeDescription,
  currentRowsCount,
  error,
  isDirty,
  onCancel,
  onChangeDescription,
  onSave,
  readOnly,
  saveBusy,
  workingRevisionLabel,
}: PfmeaSaveRevisionModalProps) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.25)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 80,
      }}
      onClick={() => (saveBusy ? null : onCancel())}
    >
      <div
        style={{
          width: 560,
          maxWidth: '92vw',
          background: SURFACE_PANEL_BG,
          borderRadius: SURFACE_RADIUS,
          border: `1px solid ${SURFACE_BORDER}`,
          boxShadow: '0 16px 36px rgba(0,0,0,0.2)',
          padding: 20,
          color: SURFACE_TEXT,
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={{ fontSize: 19, fontWeight: 700, marginBottom: 10 }}>Save PFMEA</div>
        <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.8)', lineHeight: 1.5, marginBottom: 12 }}>
          Describe what you changed.
        </div>
        <textarea
          autoFocus
          value={changeDescription}
          onChange={(event) => onChangeDescription(event.target.value)}
          placeholder="Describe changes (required)"
          style={{
            width: '100%',
            minHeight: 90,
            borderRadius: SURFACE_RADIUS,
            border: `1px solid ${SURFACE_BORDER}`,
            padding: '10px 12px',
            fontSize: 14,
            fontFamily: 'inherit',
            resize: 'vertical',
            marginBottom: 14,
            background: SURFACE_BG,
            color: SURFACE_TEXT,
          }}
        />
        <div style={{ fontSize: 12, color: SURFACE_MUTED, marginBottom: 6 }}>
          Next revision: <b>{nextPfmeaRevisionLabel(workingRevisionLabel ?? '')}</b>
        </div>
        <div style={{ fontSize: 12, color: SURFACE_MUTED, marginBottom: 6 }}>
          Author: <b>{authorName}</b>
        </div>
        <div style={{ fontSize: 12, color: SURFACE_MUTED, marginBottom: 14 }}>
          Current PFMEA: <b>{currentRowsCount}</b> risks
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={() => (saveBusy ? null : onCancel())}
            disabled={saveBusy}
            style={{ ...actionButtonStyle, height: 28, padding: '0 12px' }}
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={saveBusy || !isDirty || !changeDescription.trim() || readOnly}
            style={{ ...actionButtonStyle, height: 28, padding: '0 12px' }}
          >
            {saveBusy ? 'Saving...' : 'Save'}
          </button>
        </div>
        {error ? (
          <div
            style={{
              marginTop: 12,
              borderRadius: SURFACE_RADIUS,
              border: '1px solid rgba(239,68,68,0.28)',
              background: 'rgba(239,68,68,0.12)',
              padding: '8px 10px',
              color: '#fecaca',
              fontSize: 13,
              fontWeight: 700,
              lineHeight: 1.45,
            }}
          >
            {error}
          </div>
        ) : null}
      </div>
    </div>
  )
}
