import type { CSSProperties, ReactNode } from 'react'

import { settingsActionButtonStyle, settingsCompactActionButtonStyle } from './buttons'
import {
  settingsDangerInlineAccentStyle,
  settingsDangerInlineStyle,
} from './sections'
import {
  settingsSharedOverlayBg,
  settingsSharedOverlayBorder,
  settingsSurfaceRadius,
} from './tokens'

export const settingsModalCardStyle: CSSProperties = {
  width: 520,
  maxWidth: '92vw',
  background: settingsSharedOverlayBg,
  borderRadius: settingsSurfaceRadius,
  border: `1px solid ${settingsSharedOverlayBorder}`,
  boxShadow: '0 16px 36px rgba(0,0,0,0.2)',
  padding: 20,
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
}

export const settingsModalTitleStyle: CSSProperties = {
  fontSize: 19,
  fontWeight: 700,
  marginBottom: 10,
  color: '#fff',
}

export const settingsModalBodyStyle: CSSProperties = {
  fontSize: 15,
  color: 'rgba(255,255,255,0.8)',
  lineHeight: 1.5,
  marginBottom: 10,
}

export const settingsModalActionsStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
  justifyContent: 'flex-end',
}

export function SettingsTrashButton({
  onClick,
  title = 'Delete item',
  ariaLabel = 'Delete item',
  style,
}: {
  onClick?: () => void
  title?: string
  ariaLabel?: string
  style?: CSSProperties
}) {
  const textButtonStyle: CSSProperties = {
    ...settingsCompactActionButtonStyle,
    padding: '0 10px',
    color: '#f8fafc',
    background: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.18)',
  }

  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
      className="rf-button settings-trash-btn"
      style={{ ...textButtonStyle, ...style }}
    >
      Delete
    </button>
  )
}

export function SettingsConfirmDialog({
  open,
  title,
  body,
  warning,
  busy,
  confirmLabel = 'Yes',
  cancelLabel = 'Cancel',
  hideConfirm = false,
  onCancel,
  onConfirm,
}: {
  open: boolean
  title: string
  body: ReactNode
  warning?: ReactNode
  busy?: boolean
  confirmLabel?: string
  cancelLabel?: string
  hideConfirm?: boolean
  onCancel: () => void
  onConfirm: () => void | Promise<void>
}) {
  if (!open) return null
  const titleId = `settings-confirm-dialog-title-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'dialog'}`

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(4, 8, 20, 0.52)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 80,
      }}
      tabIndex={-1}
      onClick={() => (busy ? null : onCancel())}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !busy) onCancel()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={settingsModalCardStyle}
        onClick={(event) => event.stopPropagation()}
      >
        <div id={titleId} style={settingsModalTitleStyle}>{title}</div>
        <div style={settingsModalBodyStyle}>{body}</div>
        {warning ? (
          <div style={settingsDangerInlineStyle}>
            <span aria-hidden="true" style={settingsDangerInlineAccentStyle} />
            <span>{warning}</span>
          </div>
        ) : null}
        <div style={{ ...settingsModalActionsStyle, marginTop: 16 }}>
          <button
            onClick={() => (busy ? null : onCancel())}
            disabled={busy}
            className="rf-button"
            style={{ ...settingsActionButtonStyle, minHeight: 34, padding: '8px 12px' }}
          >
            {cancelLabel}
          </button>
          {hideConfirm ? null : (
            <button
              onClick={() => {
                if (busy) return
                void onConfirm()
              }}
              disabled={busy}
              className="rf-button"
              style={{ ...settingsActionButtonStyle, minHeight: 34, padding: '8px 12px', fontWeight: 650 }}
            >
              {confirmLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
