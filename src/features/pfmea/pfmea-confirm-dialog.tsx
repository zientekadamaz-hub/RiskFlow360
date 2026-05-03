import type React from 'react'

const SURFACE_RADIUS = 8
const SURFACE_BORDER = 'rgba(255,255,255,0.16)'
const SURFACE_PANEL_BG = 'rgb(40, 39, 47)'
const SURFACE_TEXT = '#f8fafc'

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

export type PfmeaConfirmDialogConfig = {
  body: string
  dangerNote?: string
  onConfirm: () => Promise<boolean | void> | boolean | void
  title: string
}

type PfmeaConfirmDialogProps = {
  actionButtonStyle: React.CSSProperties
  busy: boolean
  dialog: PfmeaConfirmDialogConfig
  onBusyChange: (busy: boolean) => void
  onCancel: () => void
  onError: (message: string) => void
}

export function PfmeaConfirmDialog({
  actionButtonStyle,
  busy,
  dialog,
  onBusyChange,
  onCancel,
  onError,
}: PfmeaConfirmDialogProps) {
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
      onClick={() => (busy ? null : onCancel())}
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
        <div style={{ fontSize: 19, fontWeight: 700, marginBottom: 10 }}>{dialog.title}</div>
        <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.8)', lineHeight: 1.5, marginBottom: 10 }}>{dialog.body}</div>
        {dialog.dangerNote ? (
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.4, color: '#ef4444', marginBottom: 16 }}>
            {dialog.dangerNote}
          </div>
        ) : null}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={() => (busy ? null : onCancel())}
            disabled={busy}
            style={{ ...actionButtonStyle, height: 28, padding: '0 12px' }}
          >
            Cancel
          </button>
          <button
            onClick={async () => {
              if (busy) return
              onBusyChange(true)
              try {
                const shouldClose = await dialog.onConfirm()
                if (shouldClose !== false) onCancel()
              } catch (error: unknown) {
                onError(errorMessage(error))
              } finally {
                onBusyChange(false)
              }
            }}
            disabled={busy}
            style={{ ...actionButtonStyle, height: 28, padding: '0 12px' }}
          >
            Yes
          </button>
        </div>
      </div>
    </div>
  )
}
