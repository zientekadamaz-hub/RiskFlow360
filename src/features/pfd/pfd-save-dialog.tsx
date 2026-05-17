import React from 'react'

import {
  SURFACE_BG,
  SURFACE_BORDER,
  SURFACE_MUTED,
  SURFACE_PANEL_BG,
  SURFACE_RADIUS,
  SURFACE_TEXT,
  baseBtn,
} from './pfd-page-styles'

function nextRevisionLabel(currentRevisionLabel: string) {
  const parts = (currentRevisionLabel || '0.0.0').split('.')
  const major = Number.parseInt(parts[0] ?? '0', 10)
  const safeMajor = Number.isFinite(major) ? major : 0
  const rest = parts.length > 1 ? parts.slice(1).join('.') : '0.0'
  return `${safeMajor + 1}.${rest}`
}

export function PfdSaveDialog(props: {
  author: string
  busy: boolean
  currentRevisionLabel: string
  description: string
  edgeCount: number
  nodeCount: number
  open: boolean
  onCancel: () => void
  onDescriptionChange: (value: string) => void
  onSave: () => void
}) {
  if (!props.open) return null

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
      onClick={() => (props.busy ? null : props.onCancel())}
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
        <div style={{ fontSize: 19, fontWeight: 700, marginBottom: 10 }}>Save PFD</div>
        <div style={{ fontSize: 15, color: SURFACE_MUTED, lineHeight: 1.5, marginBottom: 12 }}>
          Describe what you changed.
        </div>
        <textarea
          autoFocus
          value={props.description}
          onChange={(event) => props.onDescriptionChange(event.target.value)}
          placeholder="Describe changes (required)"
          style={{
            width: '100%',
            minHeight: 90,
            borderRadius: SURFACE_RADIUS,
            border: `1px solid ${SURFACE_BORDER}`,
            padding: '10px 12px',
            fontSize: 14,
            fontFamily: baseBtn.fontFamily,
            resize: 'vertical',
            marginBottom: 14,
            background: SURFACE_BG,
            color: SURFACE_TEXT,
          }}
        />
        <div style={{ fontSize: 12, color: SURFACE_MUTED, marginBottom: 6 }}>
          Next revision: <b>{nextRevisionLabel(props.currentRevisionLabel)}</b>
        </div>
        <div style={{ fontSize: 12, color: SURFACE_MUTED, marginBottom: 6 }}>
          Author: <b>{props.author}</b>
        </div>
        <div style={{ fontSize: 12, color: SURFACE_MUTED, marginBottom: 14 }}>
          Current diagram: <b>{props.nodeCount}</b> objects, <b>{props.edgeCount}</b> connections
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={() => (props.busy ? null : props.onCancel())}
            disabled={props.busy}
            style={{ ...baseBtn, height: 28, padding: '0 12px' }}
          >
            Cancel
          </button>
          <button
            onClick={props.onSave}
            disabled={props.busy || !props.description.trim()}
            style={{ ...baseBtn, height: 28, padding: '0 12px' }}
          >
            {props.busy ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
