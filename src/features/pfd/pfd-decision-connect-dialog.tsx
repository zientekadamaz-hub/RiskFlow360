import type { Connection } from 'reactflow'
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

export type PfdDecisionConnectDialogConfig = {
  params: Connection
  key: string
  value: string
}

export function PfdDecisionConnectDialog(props: {
  dialog: PfdDecisionConnectDialogConfig | null
  onAdd: () => void
  onCancel: () => void
  onValueChange: (value: string) => void
}) {
  if (!props.dialog) return null

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
      onClick={props.onCancel}
    >
      <div
        style={{
          width: 520,
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
        <div style={{ fontSize: 19, fontWeight: 700, marginBottom: 10 }}>Decision output label</div>
        <div style={{ fontSize: 15, color: SURFACE_MUTED, lineHeight: 1.5, marginBottom: 12 }}>
          Enter a label for this decision path.
        </div>
        <input
          autoFocus
          value={props.dialog.value}
          onChange={(event) => props.onValueChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return
            event.preventDefault()
            props.onAdd()
          }}
          placeholder="e.g. OK / NOK"
          style={{
            width: '100%',
            height: 40,
            borderRadius: SURFACE_RADIUS,
            border: `1px solid ${SURFACE_BORDER}`,
            padding: '0 12px',
            fontSize: 14,
            fontFamily: baseBtn.fontFamily,
            marginBottom: 16,
            background: SURFACE_BG,
            color: SURFACE_TEXT,
          }}
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={props.onCancel} style={{ ...baseBtn, height: 28, padding: '0 12px' }}>
            Cancel
          </button>
          <button onClick={props.onAdd} style={{ ...baseBtn, height: 28, padding: '0 12px' }}>
            Add
          </button>
        </div>
      </div>
    </div>
  )
}
