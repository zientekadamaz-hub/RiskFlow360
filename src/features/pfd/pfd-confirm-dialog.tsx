import React from 'react'

import { SURFACE_BORDER, SURFACE_MUTED, SURFACE_PANEL_BG, SURFACE_RADIUS, SURFACE_TEXT, baseBtn } from './pfd-page-styles'

export type PfdConfirmDialogConfig = {
  title: string
  body: string
  dangerNote?: string
  onConfirm: () => Promise<boolean | void> | boolean | void
}

export function PfdConfirmDialog(props: {
  busy: boolean
  dialog: PfdConfirmDialogConfig | null
  onCancel: () => void
  onConfirm: () => void
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
      onClick={() => (props.busy ? null : props.onCancel())}
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
        <div style={{ fontSize: 19, fontWeight: 700, marginBottom: 10 }}>{props.dialog.title}</div>
        <div style={{ fontSize: 15, color: SURFACE_MUTED, lineHeight: 1.5, marginBottom: 10 }}>{props.dialog.body}</div>
        {props.dialog.dangerNote ? (
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.4, color: '#ef4444', marginBottom: 16 }}>
            {props.dialog.dangerNote}
          </div>
        ) : null}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={() => (props.busy ? null : props.onCancel())}
            disabled={props.busy}
            style={{ ...baseBtn, height: 28, padding: '0 12px' }}
          >
            Cancel
          </button>
          <button
            onClick={props.onConfirm}
            disabled={props.busy}
            style={{ ...baseBtn, height: 28, padding: '0 12px' }}
          >
            Yes
          </button>
        </div>
      </div>
    </div>
  )
}
